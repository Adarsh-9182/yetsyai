import { z } from "zod";
import type { SafetyLevel } from "@/lib/safety/redflags";
import type { EvidenceTier, ReviewStatus } from "@/lib/knowledge/types";

/** The structured shape the triage/nutrition agents return and the UI renders. */
export const StructuredResponseSchema = z.object({
  summary: z.string().default(""),
  needMoreInfo: z.boolean().default(false),
  questions: z.array(z.string()).default([]),
  possibleCauses: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  nutritionAngle: z.string().default(""),
  seekCareIf: z.array(z.string()).default([]),
  doctorQuestions: z.array(z.string()).default([]),
  safetyLevel: z
    .enum(["none", "caution", "urgent", "emergency"])
    .default("none"),
  confidence: z.enum(["low", "moderate", "high"]).default("moderate"),
  evidenceSufficient: z.boolean().default(true),
  /** 1-based indices into the evidence list the model was given (see orchestrator). */
  usedSources: z.array(z.number().int().positive()).default([]),
  disclaimer: z.string().default(""),
});

export type StructuredResponse = z.infer<typeof StructuredResponseSchema>;

/** A source actually cited in a response — always a real retrieved record. */
export interface CitedSource {
  index: number;
  title: string;
  publisher: string;
  url: string;
  evidenceTier: EvidenceTier;
  reviewStatus: ReviewStatus;
}

export interface CompanionResult {
  agent: string;
  model: string;
  safetyLevel: SafetyLevel;
  /** Present when the deterministic red-flag net fired before any AI call. */
  emergency?: { category?: string; message: string };
  structured?: StructuredResponse;
  /** Raw text fallback if the model didn't return parseable JSON. */
  text?: string;
  /** Real records the answer cited, resolved from the model's usedSources. */
  sources: CitedSource[];
  /** Retrieval outcome for this turn. */
  evidence: { retrieved: number; sufficient: boolean };
  latencyMs: number;
}
