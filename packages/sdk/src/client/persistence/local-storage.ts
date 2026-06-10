import type { ChatTurn, Mode, PersistenceAdapter } from '../../core/contract';
import type { Patch } from '../../core/patch';

export interface LocalStoragePersistenceOptions {
  /** Storage key prefix. Default: 'showcase'. */
  namespace?: string;
}

/**
 * Persistence adapter that stores patches in browser localStorage.
 *
 * Trade-offs:
 * - ~5-10 MB capacity per origin — comfortable for most patch histories
 * - Browser-only — server-side reads/writes are no-ops
 * - Not shared across browsers / devices (visitor is bound to the device)
 *
 * Good for: SPAs without a backend (Spotify clone, calendar clone), demos.
 */
export function localStoragePersistence(
  opts: LocalStoragePersistenceOptions = {},
): PersistenceAdapter {
  const ns = opts.namespace ?? 'showcase';
  const patchKey = (v: string, s: string, m: string) => `${ns}:${s}:${m}:${v}`;
  const turnsKey = (v: string, s: string, m: string) => `${ns}:t:${s}:${m}:${v}`;
  const modesKey = (v: string, s: string) => `${ns}:m:${s}:${v}`;

  const nextId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `ls-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  return {
    async read(visitorId, slug, modeId): Promise<Patch[]> {
      if (typeof window === 'undefined') return [];
      const raw = window.localStorage.getItem(patchKey(visitorId, slug, modeId));
      if (!raw) return [];
      try {
        return JSON.parse(raw) as Patch[];
      } catch {
        return [];
      }
    },
    async write(visitorId, slug, modeId, patches): Promise<void> {
      if (typeof window === 'undefined') return;
      const existing = await this.read(visitorId, slug, modeId);
      const combined = [...existing, ...patches];
      window.localStorage.setItem(patchKey(visitorId, slug, modeId), JSON.stringify(combined));
    },
    async reset(visitorId, slug, modeId): Promise<void> {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(patchKey(visitorId, slug, modeId));
      window.localStorage.removeItem(turnsKey(visitorId, slug, modeId));
    },
    async recordTurn(visitorId, slug, modeId, turn): Promise<void> {
      if (typeof window === 'undefined') return;
      const existing = await this.readTurns(visitorId, slug, modeId);
      const combined = [...existing, turn];
      window.localStorage.setItem(turnsKey(visitorId, slug, modeId), JSON.stringify(combined));
    },
    async readTurns(visitorId, slug, modeId, limit = 30): Promise<ChatTurn[]> {
      if (typeof window === 'undefined') return [];
      const raw = window.localStorage.getItem(turnsKey(visitorId, slug, modeId));
      if (!raw) return [];
      try {
        const all = JSON.parse(raw) as ChatTurn[];
        return all.slice(-limit);
      } catch {
        return [];
      }
    },
    async listModes(visitorId, slug): Promise<Mode[]> {
      if (typeof window === 'undefined') return [];
      const raw = window.localStorage.getItem(modesKey(visitorId, slug));
      if (!raw) return [];
      try {
        return JSON.parse(raw) as Mode[];
      } catch {
        return [];
      }
    },
    async createMode(visitorId, slug, title): Promise<Mode> {
      const mode: Mode = { id: nextId(), title, createdAt: new Date().toISOString() };
      if (typeof window === 'undefined') return mode;
      const existing = await this.listModes(visitorId, slug);
      window.localStorage.setItem(modesKey(visitorId, slug), JSON.stringify([...existing, mode]));
      return mode;
    },
  };
}
