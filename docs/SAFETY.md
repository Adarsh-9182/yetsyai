# NutritiScan — Safety Boundaries

Safety is a product requirement, not a feature. This document defines the line
NutritiScan must not cross.

## The core boundary

NutritiScan provides **evidence-informed guidance and education**. It is **not**
a medical device, does **not** diagnose, and does **not** prescribe. Every
capability must respect the line between AI assistance and medical care.

Allowed language: "Here's what *may* be contributing", "possibilities to
consider", "discuss with a healthcare professional".
Forbidden language: "You have X disease", medication doses, "99% accurate".

## Two-layer emergency safety

1. **Deterministic first pass** (`src/lib/safety/redflags.ts`) runs *before* any
   AI call. If it detects a red flag, the app short-circuits to a prominent
   `EmergencyBanner` — the warning is never buried under a long AI response.
2. **AI safety agent** is a second layer that can raise the safety level from
   inside a response. It never lowers what layer 1 raised.

### Emergency red-flag categories (high-recall by design)

cardiac · breathing · stroke · severe bleeding · loss of consciousness ·
anaphylaxis · sudden severe neuro (worst-ever headache, seizure, stiff neck +
fever) · self-harm / suicidal intent · distressed infant under ~3 months.

Self-harm gets a dedicated crisis-support message (988 in the US, 111 in the UK,
local emergency number). Better a false alarm than a missed emergency.

## Estimates and uncertainty

- Meal/nutrition figures are **estimates** and must be labeled as such. Image
  recognition is never presented as laboratory-accurate.
- Lab values are shown against reference ranges with plain-language "what this
  *may* mean" — never a diagnosis from a value alone.
- The AI must make uncertainty explicit and must never invent studies,
  statistics, or citations. Citations come only from the vetted `Source` table.

## Data & consent (see docs/ARCHITECTURE.md and Phase 9)

Health data is sensitive. Minimal collection, explicit consent per category,
user-controlled export and deletion, and an audit log are first-class
requirements, not afterthoughts.
