# NutritiScan — AI Doctor (Next.js)

A next-generation **AI doctor** built as a Next.js app, positioned as a modern alternative to products like Doctronic. It centers on a calm, trustworthy conversation that helps people understand symptoms, reports, medications and test results — grounded in real medical research.

## The AI agent

NutritiScan is not a chatbot wrapper and it is **not** a from-scratch trained model (see "On training" below). It is a **retrieval-augmented clinical agent**:

- **Reasoning core** — Claude (`claude-opus-5`), which already holds broad medical knowledge, run with a rigorous **medical + safety system prompt** (non-diagnosis stance, minimal-question triage, explicit uncertainty, emergency red-flag detection, medication/pediatric/pregnancy safety).
- **Research grounding (RAG)** — before every answer the agent retrieves citable literature from **PubMed / Europe PMC** and **arXiv** and hands it to the model, so explanations can cite real sources rather than memory alone. See `lib/rag.ts`.
- **Structured output** — the model returns a typed JSON assessment (triage, possible causes, reasoning, next steps, confidence, evidence, clinician handoff, or an emergency escalation), streamed over SSE from `app/api/consult/route.ts` and rendered by the UI's medical components.

If no `ANTHROPIC_API_KEY` is present the app runs a built-in **demo engine** so the deployed site works immediately; it upgrades to the live agent the moment a key is set.

## Run locally

```bash
cd web
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

## Deploy on Vercel

1. Push this repo to GitHub (already done).
2. In Vercel, **New Project → import the repo**.
3. Set **Root Directory = `web`** (this app lives in a subfolder).
4. Add an environment variable **`ANTHROPIC_API_KEY`** (Production + Preview).
5. Deploy. Vercel auto-detects Next.js; the `/api/consult` streaming route runs as a Node serverless function (`maxDuration = 60`).

That's the whole flow — no other configuration is required.

## On "training on arXiv papers"

Training a medical **foundation model** from scratch on research papers is a multi-month, multi-million-dollar effort with serious data-licensing and regulatory constraints, and is not something that produces a safe product quickly. The credible, honest architecture — and the one used here — is a strong pre-trained model **grounded** in live research via RAG, wrapped in hard safety rules, with every answer framed as information to confirm with a clinician. The natural next step to specialize it is **fine-tuning / preference-tuning on licensed, curated clinical Q&A** plus **evaluation on clinical benchmarks** — not opaque bulk pre-training.

## Safety

NutritiScan provides health *information*, not a diagnosis, and is not a substitute for professional care. This is a prototype and has **not** been clinically validated.
