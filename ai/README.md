# NutritiScan — AI Doctor backend

This is the **real AI-doctor brain** behind the NutritiScan interface. It does *not* train a model from scratch (see the honest note below). Instead it does what serious clinical-AI products do: it uses a frontier model that already holds broad medical knowledge — **Claude (`claude-opus-5`)** — and wraps it in the two things that make such a model safe and trustworthy for health guidance:

1. **A rigorous medical + safety system prompt** — non-diagnosis stance, minimal-question triage, explicit uncertainty, emergency red-flag detection, medication and pediatric/pregnancy safety rules.
2. **Retrieval-Augmented Grounding (RAG)** — before answering, it retrieves real, citable literature from **Europe PMC / PubMed** and **arXiv** and hands it to the model, so explanations can be grounded in published sources instead of the model's memory alone.

The model returns a **structured JSON assessment** (triage, possible causes, reasoning factors, next steps, confidence, evidence, clinician handoff, or an emergency escalation). The NutritiScan front end renders it with the same components you see in the offline demo — but now driven by a real model.

## Why not "train a model on all medical textbooks"?

Because that is not how — or by whom — a safe medical model is actually built, and pretending otherwise would be dangerous:

- **Data licensing.** The great majority of medical textbooks are copyrighted and not freely usable for training. "Download every textbook and train on it" is not legally available.
- **Compute & time.** Pre-training a foundation model is a multi-month effort on thousands of GPUs costing millions of dollars — not something a session can do.
- **Safety & regulation.** A model that gives medical guidance needs clinical validation and regulatory review (e.g. FDA/CE) before it should be trusted. A model "trained in an afternoon" would have none of that.

The correct, honest architecture is the one implemented here: **a strong, already-trained model + careful prompting + retrieval grounding + hard safety guardrails**, with every answer framed as information to confirm with a clinician. If you later want to specialize it, the right next steps are **fine-tuning / preference-tuning on licensed, curated clinical Q&A** and **evaluation against clinical benchmarks** — not opaque bulk pre-training.

## Run it

```bash
cd ai
npm install
export ANTHROPIC_API_KEY=sk-ant-...      # or run `ant auth login`
node server.mjs
# open http://localhost:8787
```

The server also serves the NutritiScan static site, so the front end auto-detects the backend (via `/api/health`) and routes chat through the real model. With **no** backend running, the static site (`index.html`) still works — it falls back to a deterministic offline engine so the design demo is always usable.

## API

`POST /api/consult` (Server-Sent Events)

```json
{ "messages": [{ "role": "user", "content": "I've had chest pain since this morning" }],
  "patient": { "age": 29, "sex": "male", "conditions": ["hypertension"], "allergies": ["penicillin"] } }
```

Events: `status` (progress label), `final` (`{ payload, citations }`), `error`.

## Safety

NutritiScan provides health *information*, not a diagnosis, and is not a substitute for professional care. Emergency patterns transform the response into an urgent-care escalation. This is a prototype and has **not** been clinically validated.
