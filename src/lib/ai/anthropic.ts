import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider,
  CompletionRequest,
  CompletionResult,
} from "./provider";

/**
 * Anthropic (Claude) implementation of the provider interface.
 * The API key is read from the environment on the server only.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly model: string;
  private client: Anthropic;

  constructor(model = process.env.NUTRITISCAN_MODEL || "claude-opus-5") {
    this.model = model;
    this.client = new Anthropic();
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const started = Date.now();
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 1500,
      system: req.system,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return {
      text,
      model: this.model,
      inputTokens: res.usage?.input_tokens,
      outputTokens: res.usage?.output_tokens,
      latencyMs: Date.now() - started,
    };
  }
}
