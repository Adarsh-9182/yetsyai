# Deploying NutritiScan to Vercel

The app is deploy-ready. At this stage it needs **one** environment variable
(`ANTHROPIC_API_KEY`) and **no database** — nothing queries the DB at runtime
yet, so Vercel's serverless environment is fine.

---

## Option A — Vercel dashboard (recommended, ~5 minutes)

1. **Push the branch** (already done) and, when you're ready, merge it to your
   default branch — or just deploy the branch directly in step 3.
2. Go to <https://vercel.com> → sign in with **GitHub**.
3. **Add New… → Project** → import the repo **`Adarsh-9182/yetsyai`**.
   - Vercel auto-detects Next.js. Leave build settings at their defaults
     (Build: `next build`, Install: `npm install`).
   - If you're deploying the feature branch, pick it under
     **Settings → Git → Production Branch**, or deploy it as a preview.
4. **Environment Variables** — add:
   | Name | Value |
   |------|-------|
   | `ANTHROPIC_API_KEY` | your key from <https://console.anthropic.com> |
   | `NUTRITISCAN_MODEL` | *(optional)* `claude-opus-5` (default) or `claude-sonnet-5` for lower cost |
5. Click **Deploy**. In ~2 minutes you get a live URL like
   `https://nutritiscan.vercel.app`. The AI doctor lives at `/ask`.

That's the launch. Every future push to the branch redeploys automatically.

---

## Option B — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel            # first run links the project (accept the Next.js defaults)
vercel env add ANTHROPIC_API_KEY production   # paste your key when prompted
vercel --prod     # ship to production
```

---

## Verifying the launch

- Open the URL → landing page loads.
- Go to `/ask` → send "I've been tired for a week" → you should get a
  **structured** answer with a confidence indicator and (when the topic matches
  the knowledge base) a **Sources** section.
- Try "severe chest pain radiating to my arm" → you should get the **emergency
  banner**, not a normal chat reply.

---

## When you add real features later

- **Database (accounts, saved conversations, timeline):** add a Postgres
  database (Vercel Postgres / Neon / Supabase), change `provider` in
  `prisma/schema.prisma` to `postgresql`, set `DATABASE_URL` in Vercel, and run
  migrations. `postinstall` already runs `prisma generate` on every build.
- **Custom domain:** Vercel → Project → Settings → Domains.

---

## ⚠️ Launch responsibly (health product)

A public URL is a great way to demo and gather feedback. Before promoting this
as a real medical service to the public, the items in
[`CLINICAL-PLATFORM.md`](CLINICAL-PLATFORM.md) matter — especially clinical
validation and regulatory review (spec §52–53). Until then, keep the product's
existing framing: **evidence-informed guidance, not a diagnosis, and not a
replacement for a clinician.** Don't add claims like "clinically validated" or
"FDA approved" until they are actually true.
