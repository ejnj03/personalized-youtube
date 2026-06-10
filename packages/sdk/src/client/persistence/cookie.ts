import type { ChatTurn, Mode, PersistenceAdapter } from '../../core/contract';
import type { Patch } from '../../core/patch';

export interface CookiePersistenceOptions {
  /** Cookie namespace prefix. Default: 'showcase'. */
  namespace?: string;
  /** Max-age in seconds. Default: 30 days. */
  maxAge?: number;
  /** SameSite policy. Default: 'lax'. */
  sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Persistence adapter that stores patches in cookies.
 *
 * Trade-offs:
 * - Limited size (~4 KB per cookie). Hosts with chatty patch histories
 *   will overflow; cookiePersistence prunes oldest patches when over budget.
 * - Cookies are sent on every HTTP request — adds bandwidth.
 * - Good for: small hosts, prototypes, no-DB demos.
 */
export function cookiePersistence(opts: CookiePersistenceOptions = {}): PersistenceAdapter {
  const ns = opts.namespace ?? 'showcase';
  const maxAge = opts.maxAge ?? 60 * 60 * 24 * 30; // 30 days
  const sameSite = opts.sameSite ?? 'lax';

  const cookieName = (v: string, s: string, m: string) => `${ns}_${s}_${m}_${v}`;
  const turnsCookieName = (v: string, s: string, m: string) => `${ns}_t_${s}_${m}_${v}`;
  const modesCookieName = (v: string, s: string) => `${ns}_m_${s}_${v}`;

  const nextId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `ck-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
    return match ? decodeURIComponent(match[1] ?? '') : null;
  }

  function setCookie(name: string, value: string): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; SameSite=${sameSite}; Path=/`;
  }

  return {
    async read(visitorId, slug, modeId): Promise<Patch[]> {
      const raw = getCookie(cookieName(visitorId, slug, modeId));
      if (!raw) return [];
      try {
        return JSON.parse(raw) as Patch[];
      } catch {
        return [];
      }
    },
    async write(visitorId, slug, modeId, patches): Promise<void> {
      if (typeof document === 'undefined') return;
      const existing = await this.read(visitorId, slug, modeId);
      let toWrite = [...existing, ...patches];
      let encoded = encodeURIComponent(JSON.stringify(toWrite));
      while (encoded.length > 3500 && toWrite.length > 1) {
        toWrite = toWrite.slice(1);
        encoded = encodeURIComponent(JSON.stringify(toWrite));
      }
      setCookie(cookieName(visitorId, slug, modeId), JSON.stringify(toWrite));
    },
    async reset(visitorId, slug, modeId): Promise<void> {
      if (typeof document === 'undefined') return;
      document.cookie = `${cookieName(visitorId, slug, modeId)}=; Max-Age=0; Path=/`;
      document.cookie = `${turnsCookieName(visitorId, slug, modeId)}=; Max-Age=0; Path=/`;
    },
    async recordTurn(visitorId, slug, modeId, turn): Promise<void> {
      if (typeof document === 'undefined') return;
      const existing = await this.readTurns(visitorId, slug, modeId);
      let toWrite = [...existing, turn];
      let encoded = encodeURIComponent(JSON.stringify(toWrite));
      while (encoded.length > 3500 && toWrite.length > 1) {
        toWrite = toWrite.slice(1);
        encoded = encodeURIComponent(JSON.stringify(toWrite));
      }
      setCookie(turnsCookieName(visitorId, slug, modeId), JSON.stringify(toWrite));
    },
    async readTurns(visitorId, slug, modeId, limit = 30): Promise<ChatTurn[]> {
      const raw = getCookie(turnsCookieName(visitorId, slug, modeId));
      if (!raw) return [];
      try {
        return (JSON.parse(raw) as ChatTurn[]).slice(-limit);
      } catch {
        return [];
      }
    },
    async listModes(visitorId, slug): Promise<Mode[]> {
      const raw = getCookie(modesCookieName(visitorId, slug));
      if (!raw) return [];
      try {
        return JSON.parse(raw) as Mode[];
      } catch {
        return [];
      }
    },
    async createMode(visitorId, slug, title): Promise<Mode> {
      const mode: Mode = { id: nextId(), title, createdAt: new Date().toISOString() };
      const existing = await this.listModes(visitorId, slug);
      setCookie(modesCookieName(visitorId, slug), JSON.stringify([...existing, mode]));
      return mode;
    },
  };
}
