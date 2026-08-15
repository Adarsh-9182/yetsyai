# NutritiScan — Clinical Platform Roadmap (honest scope)

This document tracks the high-reliability clinical-AI program. It exists so we
never fake clinical infrastructure. Each item says what it is, what it needs,
and how today's architecture plugs into it. **Nothing here is claimed as done
unless the status says so.**

## Reliability pipeline (spec §1) — status

`User → normalize → safety screen → intent → context → triage → retrieve →
reason → claim/evidence verify → hallucination check → safety verify →
uncertainty → response → audit`

| Stage | Status | Where |
|---|---|---|
| Deterministic safety screen (emergency red flags) | ✅ built | `src/lib/safety/redflags.ts` |
| Intent routing | 🟡 basic (keyword) | `src/lib/ai/orchestrator.ts` |
| Retrieval (lexical/BM25 over curated KB) | ✅ built | `src/lib/knowledge/retrieve.ts` |
| Evidence grounding + citations (real records only) | ✅ built | orchestrator + `components/companion/sources.tsx` |
| Evidence hierarchy / tiers | ✅ built | `src/lib/knowledge/types.ts` (tier 1–4) |
| Sources-disagree handling | 🟡 prompt-level | agents + KB (US vs UK BP records) |
| Abstention + calibrated uncertainty | 🟡 v1 (confidence + evidenceSufficient) | `src/lib/ai/types.ts` |
| Claim extraction + evidence verification pass | ⏳ planned | second-pass verifier over the draft |
| Hallucination detection (separate model) | ⏳ research | LLM-judge first; trained detector later |
| Deterministic clinical tools (BMI/BMR/TDEE…) | ⏳ next | `src/lib/tools/` (planned) |
| AI audit logging | 🟡 schema ready | `AIInteraction` table; wiring pending |

## Model strategy (spec §4–6)

- **Provider abstraction:** ✅ `src/lib/ai/provider.ts` (Anthropic today, swappable).
- **Model router by task/risk/modality:** ⏳ planned — extend the factory into a
  `ModelRouter`. The interface already isolates callers from the choice.
- **Benchmark harness:** ⏳ planned — a repeatable eval set scoring candidates on
  factuality, triage, emergency recognition, medication safety, citation
  accuracy, hallucination rate, abstention quality, latency, cost. Build this
  *before* committing a production model.

## Data & knowledge (spec §8–19) — requires infra / licensing / credentialing

These are **programs**, not code to generate in an app repo. Documented, not stubbed.

| Source | What it needs | Notes |
|---|---|---|
| WHO / CDC / NIH / FDA / NHS / NICE | Licensing review + ingestion pipeline | Starter excerpts exist (unverified) in `src/lib/knowledge/records.ts`; replace with verified, sourced content |
| PubMed / PMC | E-utilities integration, rate limits, full-text licensing | Real infra + network egress; not buildable in this sandbox |
| ClinicalTrials.gov | API integration | Trial existence ≠ efficacy — never imply otherwise |
| Drug database (DailyMed / Drugs@FDA) | Licensed labeling ingestion | Powers the medication-safety engine |
| Medical knowledge graph | Graph store + curation | Entities/relations defined in spec §19 |
| **MIMIC-IV / eICU / PhysioNet** | **Credentialing + training + DUA** | ⛔ Restricted. The DUA **prohibits** sending this data through third-party LLM APIs. Must run in a compliant environment with local models. Not in this repo. |
| USDA FoodData Central + Indian food data | Licensing + normalization | Feeds the nutrition engine |

## Governance, validation, regulatory (spec §2)

- Follow WHO guidance on large multi-modal models in health (human oversight,
  transparency, evidence of safety/effectiveness, clear limitations).
- **No diagnostic/treatment/accuracy claims** and **no "FDA approved" / "clinically
  validated"** language until prospective clinical validation and the relevant
  regulatory authorization actually exist. Until then the product states it is
  not a diagnosis and not a replacement for a clinician.

## Definition of "done" for any stage

Runs · tested on real flows · errors/edge cases handled · no fabricated data or
citations · claims match what actually exists.
