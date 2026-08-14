// Chrome cookie extractor (macOS-only for now).
//
// Reads YouTube cookies directly from the user's local Chrome cookie SQLite
// store, decrypts the encrypted_value column using the per-user keychain
// password ("Chrome Safe Storage"), and returns a typed Map of cookies
// suitable for handing to youtubei.js.
//
// Why hand-rolled instead of `chrome-cookies-secure`?
//   - That npm package is unmaintained (last release 2023) and pulls in
//     additional dependencies (`keytar`, native bindings) we don't need.
//   - Our requirement is narrow: macOS, youtube.com only, no write path.
//
// USER PROMPT (first run):
//   macOS will prompt "security wants to use the 'Chrome Safe Storage'
//   keychain item." Click "Always Allow" — after that the keychain access
//   is silent for the lifetime of the developer's machine. If the user
//   clicks "Deny" we surface `cookies-unavailable`. The mock catalog that
//   used to absorb this is gone, so the practical result is an anonymous
//   feed, or an empty one if that fails too — not fabricated videos.
//
// macOS Chrome v80+ encrypted-value format:
//   - prefix bytes: ASCII "v10" or "v11" (3 bytes), then ciphertext.
//   - cipher: AES-128-CBC.
//   - key: PBKDF2-SHA1(password, salt='saltysalt', iter=1003, keylen=16)
//     where `password` = `security find-generic-password -s "Chrome Safe
//     Storage" -wa "Chrome"`.
//   - iv: 16 bytes of 0x20 (ASCII space).
//   - plaintext is PKCS#7 padded.
//
// Linux (TODO): same algorithm but the password comes from the GNOME
// keyring / KWallet, with a fallback to "peanuts" for the v11 prefix.
// Windows (TODO): DPAPI-protected, completely different code path.

import { copyFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import Database from 'better-sqlite3';

const execFileAsync = promisify(execFile);

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  secure: boolean;
  httpOnly: boolean;
}

export interface CookiesUnavailable {
  kind: 'cookies-unavailable';
  reason: string;
}

export interface CookiesOk {
  kind: 'ok';
  cookies: Cookie[];
}

export type CookiesResult = CookiesOk | CookiesUnavailable;

interface SqliteCookieRow {
  name: string;
  value: string;
  encrypted_value: Buffer | null;
  host_key: string;
  path: string;
  expires_utc: number;
  is_secure: number;
  is_httponly: number;
}

const KEYCHAIN_SERVICE = 'Chrome Safe Storage';
const KEYCHAIN_ACCOUNT = 'Chrome';
const PBKDF2_SALT = Buffer.from('saltysalt', 'utf-8');
const PBKDF2_ITERATIONS = 1003;
const KEY_LEN = 16;
const IV = Buffer.alloc(16, 0x20); // 16 bytes of ASCII space

let cachedKeychainPassword: string | null = null;

function maskValue(s: string): string {
  if (s.length === 0) return '';
  if (s.length <= 4) return '*'.repeat(s.length);
  return `${s.slice(0, 2)}${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-2)}`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// Locate the Chrome cookie file. Order:
//   1. CHROME_COOKIE_PATH env var (full override).
//   2. ~/Library/Application Support/Google/Chrome/Default/Cookies
//   3. ~/Library/Application Support/Google/Chrome/Profile 1/Cookies
//   4. ~/Library/Application Support/Google/Chrome/Profile 2/Cookies
async function findCookieDb(): Promise<string | null> {
  const override = process.env.CHROME_COOKIE_PATH;
  if (override && override.length > 0) {
    if (await fileExists(override)) return override;
    return null;
  }
  const home = homedir();
  const base = join(home, 'Library', 'Application Support', 'Google', 'Chrome');
  const candidates = [
    join(base, 'Default', 'Cookies'),
    join(base, 'Profile 1', 'Cookies'),
    join(base, 'Profile 2', 'Cookies'),
  ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

// Chrome holds the cookie file in WAL mode while running. Copying it to a
// temp path gives us a stable read-only snapshot. We never touch the original.
async function snapshotDb(src: string): Promise<{ tempDir: string; tempFile: string }> {
  const tempDir = await mkdtemp(join(tmpdir(), 'showcase-yt-cookies-'));
  const tempFile = join(tempDir, 'Cookies');
  await copyFile(src, tempFile);
  return { tempDir, tempFile };
}

async function readKeychainPassword(): Promise<string> {
  if (cachedKeychainPassword !== null) return cachedKeychainPassword;
  // `security find-generic-password -wa "Chrome" -s "Chrome Safe Storage"`
  // prints the password to stdout and a noise line ("password has been found")
  // to stderr — execFile resolves stdout only.
  const { stdout } = await execFileAsync('/usr/bin/security', [
    'find-generic-password',
    '-s',
    KEYCHAIN_SERVICE,
    '-wa',
    KEYCHAIN_ACCOUNT,
  ]);
  const password = stdout.trim();
  if (password.length === 0) {
    throw new Error('keychain returned empty password');
  }
  cachedKeychainPassword = password;
  return password;
}

function deriveKey(password: string): Buffer {
  return pbkdf2Sync(password, PBKDF2_SALT, PBKDF2_ITERATIONS, KEY_LEN, 'sha1');
}

function decryptValue(encrypted: Buffer, key: Buffer): string {
  // First 3 bytes are the version prefix ("v10" or "v11"). On macOS only "v10"
  // is observed in the wild; we accept both for forward compatibility.
  if (encrypted.length < 3) {
    throw new Error('encrypted value too short');
  }
  const prefix = encrypted.slice(0, 3).toString('utf-8');
  if (prefix !== 'v10' && prefix !== 'v11') {
    // Treat unknown prefixes as plain UTF-8 (very old Chromes) so we don't
    // throw on a lone legacy cookie.
    return encrypted.toString('utf-8');
  }
  const ciphertext = encrypted.slice(3);
  const decipher = createDecipheriv('aes-128-cbc', key, IV);
  let decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  // Chrome v118+ on macOS prepends a 32-byte SHA-256 of the cookie's
  // domain/name/path/etc. metadata to the plaintext as a tamper check.
  // Strip those bytes if present — detect by checking if the leading 32
  // bytes are non-printable (a real cookie value is always ASCII-printable).
  if (decrypted.length > 32) {
    const head = decrypted.subarray(0, 32);
    let nonPrintable = 0;
    for (const b of head) {
      if (b < 0x20 || b > 0x7e) nonPrintable++;
    }
    if (nonPrintable >= 8) {
      decrypted = decrypted.subarray(32);
    }
  }
  return decrypted.toString('utf-8');
}

function rowToCookie(row: SqliteCookieRow, key: Buffer): Cookie | null {
  let value = row.value;
  if (value.length === 0 && row.encrypted_value && row.encrypted_value.length > 0) {
    try {
      value = decryptValue(row.encrypted_value, key);
    } catch (err) {
      // Skip individual cookie decrypt failures rather than failing the whole
      // batch. A masked diagnostic logs once per failure.
      console.warn(
        `[chrome-cookies] decrypt failed for ${row.host_key}/${row.name}: ${(err as Error).message}`,
      );
      return null;
    }
  }
  if (value.length === 0) return null;
  return {
    name: row.name,
    value,
    domain: row.host_key,
    path: row.path,
    // Chrome stores expires_utc as microseconds since 1601-01-01. Convert to
    // unix epoch ms. 0 means session cookie.
    expires:
      row.expires_utc === 0
        ? 0
        : Math.floor(row.expires_utc / 1000 - 11644473600000),
    secure: row.is_secure === 1,
    httpOnly: row.is_httponly === 1,
  };
}

// ---------- public API ----------

export async function readYoutubeCookies(): Promise<CookiesResult> {
  const dbPath = await findCookieDb();
  if (dbPath === null) {
    return {
      kind: 'cookies-unavailable',
      reason: 'chrome cookie file not found (is Chrome installed?)',
    };
  }

  let snapshot: { tempDir: string; tempFile: string } | null = null;
  try {
    try {
      snapshot = await snapshotDb(dbPath);
    } catch (err) {
      return {
        kind: 'cookies-unavailable',
        reason: `failed to snapshot cookie db: ${(err as Error).message}`,
      };
    }

    let db: Database.Database;
    try {
      db = new Database(snapshot.tempFile, { readonly: true, fileMustExist: true });
    } catch (err) {
      return {
        kind: 'cookies-unavailable',
        reason: `failed to open cookie db: ${(err as Error).message}`,
      };
    }

    let rows: SqliteCookieRow[];
    try {
      const stmt = db.prepare(
        `SELECT name, value, encrypted_value, host_key, path, expires_utc, is_secure, is_httponly
         FROM cookies
         WHERE host_key LIKE '%youtube.com%'`,
      );
      rows = stmt.all() as SqliteCookieRow[];
    } catch (err) {
      db.close();
      return {
        kind: 'cookies-unavailable',
        reason: `failed to query cookie db: ${(err as Error).message}`,
      };
    } finally {
      try {
        db.close();
      } catch {
        // ignore
      }
    }

    if (rows.length === 0) {
      return {
        kind: 'cookies-unavailable',
        reason: 'no youtube.com cookies present (is the user logged in?)',
      };
    }

    let password: string;
    try {
      password = await readKeychainPassword();
    } catch (err) {
      const raw = (err as Error).message;
      // Mask any value that might be echoed back (defensive — `security` is
      // not known to leak the password into the error message, but if it did,
      // we'd want it scrubbed).
      const masked = raw.length > 60 ? `${raw.slice(0, 60)}...` : raw;
      return {
        kind: 'cookies-unavailable',
        reason: `keychain blocked or unavailable: ${masked}`,
      };
    }

    const key = deriveKey(password);

    const cookies: Cookie[] = [];
    for (const row of rows) {
      const cookie = rowToCookie(row, key);
      if (cookie !== null) cookies.push(cookie);
    }

    if (cookies.length === 0) {
      return {
        kind: 'cookies-unavailable',
        reason: 'all youtube.com cookies failed to decrypt (keychain mismatch?)',
      };
    }

    // Count-only log — never emit raw cookie values.
    console.log(`[chrome-cookies] loaded ${cookies.length} cookies for youtube.com`);
    return { kind: 'ok', cookies };
  } finally {
    if (snapshot !== null) {
      try {
        await rm(snapshot.tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup failures
      }
    }
  }
}

// Build a `Cookie:` header string from a list of cookies, restricted to the
// youtube.com domain. We accept any host_key that contains "youtube.com"
// (e.g. ".youtube.com", "www.youtube.com", "studio.youtube.com") but drop
// anything else as a defensive belt.
export function composeCookieHeader(cookies: Cookie[]): string {
  const filtered = cookies.filter((c) => c.domain.includes('youtube.com'));
  // De-dupe by name; if a name appears under both ".youtube.com" and a
  // sub-host, prefer the more specific one (longer host_key wins).
  const byName = new Map<string, Cookie>();
  for (const c of filtered) {
    const existing = byName.get(c.name);
    if (!existing || c.domain.length > existing.domain.length) {
      byName.set(c.name, c);
    }
  }
  return Array.from(byName.values())
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

// Test-only / diagnostics helper: mask a cookie value for safe logging.
export function _maskValueForDiagnostics(s: string): string {
  return maskValue(s);
}
