# NutritiScan — Architecture

This document is the map of the system. Read it before adding a feature.

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) + React 18 + TypeScript (strict) | UI + API routes in one app |
| Styling | Tailwind CSS + a token-driven design system | tokens in `globals.css` / `tailwind.config.ts` |
| UI primitives | Hand-built components (`src/components/ui`) with CVA | shadcn-style, no external UI lock-in |
| Fonts | Geist Sans / Geist Mono (bundled, no network) | tabular numerals for data |
| Database | Prisma ORM on SQLite (dev) → Postgres (prod) | one-line provider switch |
| AI | Provider-agnostic layer (`src/lib/ai`) | Anthropic today, swappable |
| Validation | Zod | request bodies + AI output parsing |

## Information architecture (routes)

| Route | Purpose | Status |
|---|---|---|
| `/` | Landing page | ✅ built |
| `/ask` | AI Health Companion (the "doctor") | ✅ v1 built |
| `/api/chat` | Companion endpoint (server) | ✅ built |
| `/scan` | Meal scanner | ⏳ planned |
| `/nutrition` | Nutrition plan & targets | ⏳ planned |
| `/timeline` | Longitudinal health record | ⏳ planned |
| `/reports` | Lab report analysis | ⏳ planned |
| `/profile` | Health profile & privacy center | ⏳ planned |

## Component system

- `components/ui/*` — primitives (Button, Card, Badge). Everything is built from these.
- `components/landing/*` — landing sections.
- `components/companion/*` — AI-doctor rendering (EmergencyBanner, AIStructuredMessage).
- Add new primitives here rather than styling ad-hoc in pages.

## AI architecture (multi-agent)

We do **not** use one giant prompt. Requests flow through an orchestrator:

```
user message
   │
   ▼
[ safety net ]  ── deterministic red-flag screen (src/lib/safety/redflags.ts)
   │  emergency? → short-circuit to EmergencyBanner (never buried)
   ▼
[ orchestrator ]  (src/lib/ai/orchestrator.ts)
   │  routes to a specialized agent by intent
   ▼
[ agent ]  triage | nutrition | medical_explanation | safety   (src/lib/ai/agents.ts)
   │  each has a focused system prompt; triage returns STRICT JSON
   ▼
[ provider ]  provider-agnostic interface (src/lib/ai/provider.ts)
   │  AnthropicProvider today; swap in index.ts
   ▼
structured result → UI renders scannable sections
```

The structured response schema lives in `src/lib/ai/types.ts` and is shared by
the API and the UI, so the contract is enforced in one place.

## AI observability

Every AI call is meant to be traceable via the `AIInteraction` table (model,
agent, input kind, latency, tokens, safety level). Wiring the writes into the
orchestrator is a Phase-9 task; the schema is already in place.

## Data model

See `prisma/schema.prisma`. Core entities: User, HealthProfile, HealthGoal,
Meal/FoodItem, NutritionRecord, Conversation/Message, HealthInsight,
SymptomRecord, LabReport/LabResult, Medication, HealthEvent, Source,
AIInteraction, Consent, AuditLog.

## Adding a provider

Implement `AIProvider` (`src/lib/ai/provider.ts`) and register it in
`src/lib/ai/index.ts`. No feature code changes.
