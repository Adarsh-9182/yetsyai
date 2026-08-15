# NutritiScan — Build Roadmap

Built phase by phase. A phase is "done" only when it actually works — not mocked.

| Phase | Scope | Status |
|---|---|---|
| Foundations | Architecture, DB schema, AI abstraction, safety boundaries, design system | ✅ done |
| 1 | Design system + landing page | ✅ done |
| — | Authentication (email → Google/OTP later) | ⏳ next |
| 2 | AI Health Companion (the "doctor") — structured triage + emergency safety | 🟡 v1 built (`/ask`, `/api/chat`); needs auth, persistence, citations |
| 3 | Companion polish: conversation history, context panel, sources | ⏳ planned |
| 4 | Meal Scanner (photo/text/barcode) + Rate My Meal | ⏳ planned |
| 5 | Personalized Nutrition engine + Indian food intelligence | ⏳ planned |
| 6 | Health Timeline + Insights (from real data) | ⏳ planned |
| 7 | Lab Report analysis | ⏳ planned |
| 8 | Medical knowledge retrieval + citations | 🟡 grounding engine + citations built (curated KB, BM25 retrieval, evidence tiers, confidence/abstention). See `docs/CLINICAL-PLATFORM.md` |
| 9 | Security, privacy center, consent, audit logs, AI observability | ⏳ planned |
| 10 | Testing, performance, accessibility, final polish | ⏳ planned |

## What works right now

- Runnable Next.js app: landing page + `/ask` AI companion, mobile-first.
- Real AI backend: provider-agnostic layer → specialized agents → structured
  output, with a deterministic emergency safety net that fires before the AI.
- SQLite database created from the full schema (`npm run db:push`).

To make the companion actually answer, add `ANTHROPIC_API_KEY` to `.env`.

## Honest gaps (not yet real — do not claim otherwise)

- No authentication yet; no data is persisted per user.
- Meal scanner, nutrition engine, timeline, insights, lab analysis: not built.
- Citations/retrieval: schema exists, retrieval not wired.
- These are interfaces waiting to be implemented, not fake UI.
