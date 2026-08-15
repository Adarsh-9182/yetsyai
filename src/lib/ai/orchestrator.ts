import { getAIProvider } from "./index";
import { systemFor, type AgentName } from "./agents";
import { screenForRedFlags } from "@/lib/safety/redflags";
import {
  StructuredResponseSchema,
  type CompanionResult,
  type StructuredResponse,
} from "./types";
import type { ChatMessage } from "./provider";

/**
 * Lightweight router: picks which specialized agent handles a message.
 * Deliberately simple and transparent for now; can be upgraded to a
 * model-based router later without changing callers.
 */
function routeAgent(latestUserText: string): AgentName {
  const t = latestUserText.toLowerCase();
  const nutritionHints =
    /\b(meal|eat|diet|calorie|protein|carb|fat|fiber|fibre|roti|dal|paneer|rice|snack|breakfast|lunch|dinner|hydration|water|recipe|food)\b/;
  const explainHints =
    /\b(what (is|does)|explain|meaning of|hemoglobin|cholesterol|hba1c|blood test|report says)\b/;
  if (explainHints.test(t)) return "medical_explanation";
  if (nutritionHints.test(t)) return "nutrition";
  return "triage";
}

function extractJson(raw: string): unknown | null {
  // Models occasionally wrap JSON in prose or code fences; be forgiving.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Main entry point for the AI Health Companion.
 * 1. Deterministic red-flag screen (emergency short-circuit).
 * 2. Route to a specialized agent.
 * 3. Call the provider and parse a structured response.
 */
export async function runCompanion(
  messages: ChatMessage[],
): Promise<CompanionResult> {
  const latest = [...messages].reverse().find((m) => m.role === "user");
  const latestText = latest?.content ?? "";

  // 1. Safety net first — never buried behind the AI.
  const flag = screenForRedFlags(latestText);
  if (flag.level === "emergency") {
    return {
      agent: "safety",
      model: "n/a",
      safetyLevel: "emergency",
      emergency: { category: flag.category, message: flag.message },
      latencyMs: 0,
    };
  }

  // 2. Route.
  const agent = routeAgent(latestText);
  const provider = getAIProvider();

  // 3. Generate.
  const result = await provider.complete({
    system: systemFor(agent),
    messages,
    maxTokens: 1500,
  });

  const parsedRaw = extractJson(result.text);
  let structured: StructuredResponse | undefined;
  if (parsedRaw) {
    const safe = StructuredResponseSchema.safeParse(parsedRaw);
    if (safe.success) structured = safe.data;
  }

  return {
    agent,
    model: result.model,
    safetyLevel: structured?.safetyLevel ?? "none",
    structured,
    text: structured ? undefined : result.text,
    latencyMs: result.latencyMs,
  };
}
