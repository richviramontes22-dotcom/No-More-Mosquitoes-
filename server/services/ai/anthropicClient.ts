import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

// Null-safe pattern: returns null when ANTHROPIC_API_KEY is not set.
// Callers must check for null and return 503.
export const anthropicClient: Anthropic | null = apiKey
  ? new Anthropic({ apiKey })
  : null;
