# NutritiScan

**Your intelligent health companion** — an AI-powered health & nutrition product
that helps you understand symptoms, understand nutrition, and make better
decisions. Built to be more sophisticated, trustworthy, and useful than a
generic symptom checker.

> ⚠️ NutritiScan provides evidence-informed guidance for educational purposes
> only. It is not a medical device and is not a substitute for professional
> medical advice, diagnosis, or treatment. In an emergency, call your local
> emergency number.

## Stack

Next.js 14 (App Router) · React · TypeScript · Tailwind · Prisma (SQLite → Postgres)
· provider-agnostic AI (Anthropic today). See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/SAFETY.md`](docs/SAFETY.md), and [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Run it locally

You need [Node.js](https://nodejs.org) 18.18+.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   then open .env and paste your Claude API key:
#   ANTHROPIC_API_KEY=sk-ant-...   (get one at https://console.anthropic.com)

# 3. Create the local database (SQLite file — no server needed)
npm run db:push

# 4. Start the app
npm run dev
```

Open <http://localhost:3000>. The AI companion lives at `/ask`.
(Without an API key the site still runs; the companion returns a clear
"AI isn't configured yet" message instead of answering.)

## Project layout

```
src/
  app/            routes: / (landing), /ask (AI doctor), /api/chat
  components/
    ui/           design-system primitives (Button, Card, Badge)
    landing/      landing page sections
    companion/    AI-doctor rendering (emergency banner, structured message)
  lib/
    ai/           provider abstraction, agents, orchestrator, types
    safety/       deterministic emergency red-flag detection
prisma/schema.prisma   full data model (SQLite locally)
docs/                  architecture, safety, roadmap
```

## Switching to production infra later

- **Postgres:** change `provider` in `prisma/schema.prisma` to `postgresql` and
  point `DATABASE_URL` at your database, then `npm run db:push`.
- **A different AI model:** set `NUTRITISCAN_MODEL`, or implement a new provider
  in `src/lib/ai/` — no feature code changes.
