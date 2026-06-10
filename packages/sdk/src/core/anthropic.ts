import Anthropic from '@anthropic-ai/sdk';

export const MODEL_OPUS = 'claude-opus-4-7';
export const MODEL_HAIKU = 'claude-haiku-4-5-20251001';

// Approximate cost per million tokens (Opus 4.7). Haiku is roughly 1/5 input / 1/4 output.
export const COST_PER_M = {
  [MODEL_OPUS]: { in: 15, cachedIn: 1.5, cacheWrite: 18.75, out: 75 },
  [MODEL_HAIKU]: { in: 1, cachedIn: 0.1, cacheWrite: 1.25, out: 5 },
} as const;

//Type for the usage object Anthropic returns
export interface ClaudeUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export function estimateCost(model: string, usage: ClaudeUsage) {
  const c = COST_PER_M[model as keyof typeof COST_PER_M] ?? COST_PER_M[MODEL_OPUS];
  const inT = usage.input_tokens ?? 0;
  const outT = usage.output_tokens ?? 0;
  const cReadT = usage.cache_read_input_tokens ?? 0;
  const cWriteT = usage.cache_creation_input_tokens ?? 0;
  return (
    (inT * c.in + outT * c.out + cReadT * c.cachedIn + cWriteT * c.cacheWrite) / 1_000_000
  );
}

// 5. Options shape for the client factory
export interface CreateClientOptions {
  apiKey: string;
  baseURL?: string;  // forward-compat for Bedrock / Vertex / proxy
}

export function createAnthropicClient(opts: CreateClientOptions): Anthropic {
  return new Anthropic({ apiKey: opts.apiKey, baseURL: opts.baseURL });
}