import { getAIProvider } from "./index";
import { systemFor, type AgentName } from "./agents";
import { screenForRedFlags } from "@/lib/safety/redflags";
import { retrieveEvidence } from "@/lib/knowledge/retrieve";
import type { RetrievedRecord } from "@/lib/knowledge/types";
import {
  StructuredResponseSchema,
  type CitedSource,
  type CompanionResult,
  type StructuredResponse,
} from "./types";
import type { ChatMessage } from "./provider";

/** Lightweight, transparent intent router. Upgradeable to a model-based router. */
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

/** Format retrieved evidence as a numbered list the model cites by number. */
function buildEvidenceBlock(hits: RetrievedRecord[]): string {
  if (hits.length === 0) {
    return "\n\nEVIDENCE: (none retrieved from the vetted knowledge base). Set evidenceSufficient=false, lower confidence, and give only general guidance without citing sources.";
  }
  const lines = hits
    .map(
      (h) =>
        `[${h.index}] ${h.record.title} — ${h.record.publisher} (${h.record.jurisdiction}, tier ${h.record.evidenceTier}): ${h.record.excerpt}`,
    )
    .join("\n");
  return `\n\nEVIDENCE (cite only these, by number, in usedSources):\n${lines}`;
}

/** Resolve the model's cited indices back to the actual retrieved records. */
function resolveCitations(
  used: number[],
  hits: RetrievedRecord[],
): CitedSource[] {
  const byIndex = new Map(hits.map((h) => [h.index, h]));
  const seen = new Set<number>();
  const out: CitedSource[] = [];
  for (const n of used) {
    const h = byIndex.get(n);
    if (!h || seen.has(n)) continue;
    seen.add(n);
    out.push({
      index: h.index,
      title: h.record.title,
      publisher: h.record.publisher,
      url: h.record.url,
      evidenceTier: h.record.evidenceTier,
      reviewStatus: h.record.reviewStatus,
    });
  }
  return out;
}

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
      sources: [],
      evidence: { retrieved: 0, sufficient: false },
      latencyMs: 0,
    };
  }

  // 2. Route + retrieve grounding evidence.
  const agent = routeAgent(latestText);
  const { hits, sufficient } = retrieveEvidence(latestText);
  const provider = getAIProvider();

  // 3. Generate, grounded in the retrieved evidence.
  const result = await provider.complete({
    system: systemFor(agent) + buildEvidenceBlock(hits),
    messages,
    maxTokens: 1600,
  });

  const parsedRaw = extractJson(result.text);
  let structured: StructuredResponse | undefined;
  if (parsedRaw) {
    const safe = StructuredResponseSchema.safeParse(parsedRaw);
    if (safe.success) structured = safe.data;
  }

  // 4. Resolve citations to real records (drops any invented index).
  const sources = structured ? resolveCitations(structured.usedSources, hits) : [];

  return {
    agent,
    model: result.model,
    safetyLevel: structured?.safetyLevel ?? "none",
    structured,
    text: structured ? undefined : result.text,
    sources,
    evidence: { retrieved: hits.length, sufficient },
    latencyMs: result.latencyMs,
  };
}
