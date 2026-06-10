/**
 * Direct SQL migration runner — uses the service role key (already in .env)
 * to execute migrations against Postgres via a raw connection.
 *
 * Idempotent SQL only (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS).
 * Existing rows already at the target state are unaffected.
 *
 * Run: node --env-file=.env --import tsx scripts/migrate-direct.ts
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import postgres from 'postgres';

const MIGRATIONS_DIR = join(__dirname, '../supabase/migrations');

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL or SUPABASE_DB_URL missing in .env. ' +
        'Find it under Project Settings → Database → Connection string (URI).',
    );
  }

  const sql = postgres(dbUrl, { prepare: false });

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Running ${files.length} migration(s)...`);

  for (const file of files) {
    process.stdout.write(`  ${file}... `);
    const content = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');
    try {
      await sql.unsafe(content);
      console.log('ok');
    } catch (err) {
      console.log('FAILED');
      console.error(err);
      await sql.end();
      process.exit(1);
    }
  }

  await sql.end();
  console.log('All migrations applied.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
