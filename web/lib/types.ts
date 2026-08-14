// Shared types for the NutritiScan AI-doctor agent.

export type Role = "user" | "assistant";
export interface ChatMessage { role: Role; content: string; }

export interface Patient {
  age?: number;
  sex?: string;
  conditions?: string[];
  allergies?: string[];
  medications?: string[];
  memory?: string[];
}

export interface Citation {
  source: string;      // "Europe PMC" | "arXiv"
  title: string;
  authors?: string;
  publication?: string;
  year?: string;
  id?: string;
  url?: string;
}

export interface Followup { question: string; multi: boolean; options: string[]; }
export interface Cause { group: "common" | "important"; name: string; likelihood: number; }
export interface ReasoningFactor { factor: string; value: string; }
export interface EvidenceItem { title: string; source: string; detail: string; url: string; }
export interface Handoff {
  concern: string;
  symptoms: string[];
  history: string;
  questions: string[];
  evaluation: string;
}

export interface Assessment {
  mode: "ask" | "assess" | "emergency";
  reply: string;
  triage: "none" | "green" | "amber" | "red";
  confidence: "high" | "moderate" | "insufficient";
  followups: Followup[];
  causes: Cause[];
  reasoning: ReasoningFactor[];
  next_steps: string[];
  disclaimer: string;
  evidence: EvidenceItem[];
  emergency_flags: string[];
  handoff: Handoff;
}
