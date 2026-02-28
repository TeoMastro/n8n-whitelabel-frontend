export type ModelPricing = {
  promptCostPer1M: number;
  completionCostPer1M: number;
};

// Represents current pricing for models (in USD per 1M tokens)
export const PRICING_TABLE: Record<string, ModelPricing> = {
  'gpt-5.1': {
    promptCostPer1M: 5.0,
    completionCostPer1M: 15.0,
  }
};

/**
 * Calculates the estimated cost of an AI generation.
 * @param model The exact model string (e.g., 'gpt-5.1')
 * @param promptTokens Number of input tokens
 * @param completionTokens Number of output tokens
 * @returns Estimated cost in USD. Returns 0 if the model is unknown.
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = PRICING_TABLE[model];

  if (!pricing) {
    // If the model isn't listed, we can't calculate its cost
    return 0;
  }

  const promptCost = (promptTokens / 1_000_000) * pricing.promptCostPer1M;
  const completionCost = (completionTokens / 1_000_000) * pricing.completionCostPer1M;

  return promptCost + completionCost;
}
