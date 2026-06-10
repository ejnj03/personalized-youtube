import type { ChatTurn, Mode, PersistenceAdapter } from '../../core/contract';
import type { Patch } from '../../core/patch';

/**
 * Persistence adapter that holds patches in process memory only.
 *
 * Useful for: tests, dev mode without a DB, ephemeral demos.
 * NOT for production — patches are lost on process restart and aren't
 * shared across visitors or replicas.
 */
export function inMemoryPersistence(): PersistenceAdapter {
  // Map<visitorId:slug:modeId → ...>
  const patchStore = new Map<string, Patch[]>();
  const turnStore = new Map<string, ChatTurn[]>();
  // Map<visitorId:slug → Mode[]>
  const modeStore = new Map<string, Mode[]>();
  const dataKey = (v: string, s: string, m: string) => `${v}:${s}:${m}`;
  const modeKey = (v: string, s: string) => `${v}:${s}`;

  // Lazy id generator that doesn't rely on crypto.randomUUID being available.
  let counter = 0;
  const nextId = () => `mem-${Date.now()}-${++counter}`;

  return {
    async read(visitorId, slug, modeId): Promise<Patch[]> {
      return patchStore.get(dataKey(visitorId, slug, modeId)) ?? [];
    },
    async write(visitorId, slug, modeId, patches): Promise<void> {
      const k = dataKey(visitorId, slug, modeId);
      const existing = patchStore.get(k) ?? [];
      patchStore.set(k, [...existing, ...patches]);
    },
    async reset(visitorId, slug, modeId): Promise<void> {
      const k = dataKey(visitorId, slug, modeId);
      patchStore.delete(k);
      turnStore.delete(k);
    },
    async recordTurn(visitorId, slug, modeId, turn): Promise<void> {
      const k = dataKey(visitorId, slug, modeId);
      const existing = turnStore.get(k) ?? [];
      turnStore.set(k, [...existing, turn]);
    },
    async readTurns(visitorId, slug, modeId, limit = 30): Promise<ChatTurn[]> {
      const all = turnStore.get(dataKey(visitorId, slug, modeId)) ?? [];
      return all.slice(-limit);
    },
    async listModes(visitorId, slug): Promise<Mode[]> {
      return modeStore.get(modeKey(visitorId, slug)) ?? [];
    },
    async createMode(visitorId, slug, title): Promise<Mode> {
      const mode: Mode = { id: nextId(), title, createdAt: new Date().toISOString() };
      const k = modeKey(visitorId, slug);
      const existing = modeStore.get(k) ?? [];
      modeStore.set(k, [...existing, mode]);
      return mode;
    },
  };
}
