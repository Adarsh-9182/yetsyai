import { z } from "zod";
import type { SafetyLevel } from "@/lib/safety/redflags";

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
  disclaimer: z.string().default(""),
});

export type StructuredResponse = z.infer<typeof StructuredResponseSchema>;

export interface CompanionResult {
  agent: string;
  model: string;
  safetyLevel: SafetyLevel;
  /** Present when the deterministic red-flag net fired before any AI call. */
  emergency?: { category?: string; message: string };
  structured?: StructuredResponse;
  /** Raw text fallback if the model didn't return parseable JSON. */
  text?: string;
  latencyMs: number;
}
