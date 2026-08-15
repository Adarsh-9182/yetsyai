/**
 * Emergency red-flag detection.
 *
 * This is a deterministic FIRST-PASS safety net that runs before any AI call.
 * If it fires, the UI shows a prominent emergency state immediately — we do not
 * wait for, or bury the warning inside, a long AI response. The AI's own
 * safety agent is a second layer on top of this; this layer must never be the
 * only thing standing between a user and emergency care.
 *
 * It is intentionally high-recall (better a false alarm than a missed
 * emergency). It is NOT a diagnosis and NOT exhaustive.
 */

export type SafetyLevel = "none" | "caution" | "urgent" | "emergency";

export interface SafetyFinding {
  level: SafetyLevel;
  category?: string;
  message: string;
}

interface Rule {
  category: string;
  patterns: RegExp[];
}

const EMERGENCY_RULES: Rule[] = [
  {
    category: "cardiac",
    patterns: [
      /\bchest (pain|pressure|tightness)\b/i,
      /\bpain (in|down) (my )?(left )?arm\b/i,
      /\bcrushing chest\b/i,
    ],
  },
  {
    category: "breathing",
    patterns: [
      /\b(can'?t|cannot|unable to|struggling to|hard to) breathe?\b/i,
      /\b(severe|sudden) (shortness of breath|difficulty breathing)\b/i,
      /\bchoking\b/i,
    ],
  },
  {
    category: "stroke",
    patterns: [
      /\b(face|facial) droop/i,
      /\bslurred speech\b/i,
      /\b(sudden )?(numbness|weakness) (on )?one side\b/i,
      /\bcan'?t (move|feel) (my )?(arm|leg|face)\b/i,
    ],
  },
  {
    category: "bleeding",
    patterns: [/\b(heavy|severe|uncontrolled|won'?t stop) bleeding\b/i, /\bbleeding (a lot|badly)\b/i],
  },
  {
    category: "consciousness",
    patterns: [/\b(passed out|fainted|unconscious|unresponsive)\b/i, /\blost consciousness\b/i],
  },
  {
    category: "anaphylaxis",
    patterns: [
      /\b(throat|tongue|lips?) (is |are )?(swelling|closing)\b/i,
      /\bsevere allergic reaction\b/i,
      /\banaphylaxis\b/i,
    ],
  },
  {
    category: "neuro",
    patterns: [/\bworst headache of my life\b/i, /\bsudden severe headache\b/i, /\bseizure\b/i, /\bstiff neck (and|with) fever\b/i],
  },
  {
    category: "self-harm",
    patterns: [
      /\b(kill|hurt|harm) (myself|my self)\b/i,
      /\b(suicidal|suicide)\b/i,
      /\b(want|going) to (die|end (it|my life))\b/i,
      /\bno reason to live\b/i,
    ],
  },
  {
    category: "infant",
    patterns: [/\b(baby|infant|newborn).{0,30}\b(fever|not breathing|won'?t wake|limp)\b/i],
  },
];

const SELF_HARM_MESSAGE =
  "It sounds like you may be going through something extremely painful. You deserve immediate support. Please contact a crisis line right now — in the US call or text 988, in the UK call 111, or call your local emergency number. If you are in immediate danger, call your local emergency number now.";

const EMERGENCY_MESSAGE =
  "Some of what you described can be a medical emergency. Please call your local emergency number now (911 in the US, 112 in the EU, 999 in the UK) or go to the nearest emergency department. Do not wait for an AI response.";

export function screenForRedFlags(text: string): SafetyFinding {
  for (const rule of EMERGENCY_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return {
        level: "emergency",
        category: rule.category,
        message: rule.category === "self-harm" ? SELF_HARM_MESSAGE : EMERGENCY_MESSAGE,
      };
    }
  }
  return { level: "none", message: "" };
}
