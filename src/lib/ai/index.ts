import type { AIProvider } from "./provider";
import { AnthropicProvider } from "./anthropic";

/**
 * Factory: returns the configured AI provider. Swap providers here without
 * touching any feature code. Defaults to Anthropic.
 */
let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const which = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  switch (which) {
    case "anthropic":
    default:
      cached = new AnthropicProvider();
      break;
  }
  return cached;
}

export type { AIProvider } from "./provider";
export type { ChatMessage, CompletionResult } from "./provider";
