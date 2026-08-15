/**
 * Provider-agnostic AI interface.
 *
 * The rest of the app depends only on these types — never on a specific model
 * SDK. To add a new provider (OpenAI, a local model, Bedrock, …) implement
 * `AIProvider` and register it in `index.ts`. Nothing else has to change.
 */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}
