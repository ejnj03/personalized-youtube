// Logger + LogEntry contract + trivial defaults the SDK ships.
//
// Hosts implement `Logger` to send chat-turn metrics wherever they want
// (file, console, DataDog, etc.). The SDK calls `logger.log(entry)` after
// each turn — the host decides what `.log()` does with the entry.

/** One log record per chat turn — metrics for cost, performance, cache. */
export interface LogEntry {
  ts: string;                                          // ISO timestamp
  visitorId?: string;                                  // who triggered this turn (optional — some hosts have no visitor concept)
  sessionId?: string;                                  // the Claude message ID for correlation
  durationMs: number;                                  // how long the turn took
  model: string;                                       // which Claude model
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cacheHitRatio: number;                               // derived
  costUsd: number;                                     // derived
  toolUses: Array<{ name: string; input: unknown }>;   // what Claude called
  stopReason?: string | null;                          // why Claude stopped
  error?: string;                                      // if the turn failed
}

/** Interface a host implements to receive LogEntries. */
export interface Logger {
  log(entry: LogEntry): Promise<void> | void;
}

/** Drops every entry. Safe default when the host doesn't supply a logger. */
export const noopLogger: Logger = { log() {} };

/** Prints each entry with `[Claude]` prefix. Useful for dev. */
export const consoleLogger: Logger = {
  log(entry) {
    console.log('[Claude]', entry);
  },
};
