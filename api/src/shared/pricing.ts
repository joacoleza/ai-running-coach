export const MODEL_PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-sonnet-4-20250514': {
    input: 3.00 / 1_000_000,
    output: 15.00 / 1_000_000,
    cacheWrite: 3.75 / 1_000_000,
    cacheRead: 0.30 / 1_000_000,
  },
};

export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheWriteTokens: number,
  cacheReadTokens: number,
): number {
  const rates = MODEL_PRICING[model];
  if (!rates) return 0;
  return (
    inputTokens * rates.input +
    outputTokens * rates.output +
    cacheWriteTokens * rates.cacheWrite +
    cacheReadTokens * rates.cacheRead
  );
}
