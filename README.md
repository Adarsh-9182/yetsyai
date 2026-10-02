# Yetsyai

An independent AI video studio for short clips: a prompt composer, camera prompt
and visual treatment presets, an exact shot-prompt preview, scene monitor, look
templates, saved drafts, a reorderable local storyboard with JSON import/export, account
library and MP4 downloads.

Live interface: [yetsyai.vercel.app](https://yetsyai.vercel.app).

## Budget and generation

The default backend is **your own private Hugging Face ZeroGPU Space**, using
Apache-2.0 Wan 2.2 5B weights for short **text-to-video**. Free GPU capacity is
quota-limited. The model weights being free does not make GPU hosting unlimited.
The initial profile is approximately 5 seconds, reduced resolution, no audio.
Image animation is disabled for this backend; stored references can be collected
for future use. No public third-party demo API or fake render is used.

Paid fal/Kling is available only with `VIDEO_PROVIDER=fal`, `FAL_KEY` and
`ENABLE_PAID_GENERATION=true`. An old API key never activates paid mode implicitly.

**Current deployment can be in preview mode.** Real generation, account email
delivery, PostgreSQL and GPU output quality require credentials and integration
checks. These are not validated by a successful frontend build.

## Local development

Node.js 22 or later:

```bash
npm ci
cp .env.example .env.local
npm run db:push
npm run dev
```

SQLite is for local development with persistent disk. Vercel uses the PostgreSQL
schema and additive migrations automatically. With no PostgreSQL URL, the public
studio shows preview access and never attempts video generation.

## Connect the free backend

Follow [the complete setup guide](docs/SETUP.md):

1. Supabase free project: PostgreSQL, email/password auth and a **private**
   `studio-media` storage bucket.
2. Your private ZeroGPU Space: upload the files in [spaces/wan-studio](spaces/wan-studio).
3. Store credentials in Vercel/Space environment settings; never commit them.
4. Redeploy, then check one real render, sign-in, second-device library,
   webhook completion and MP4 download before inviting users.

## Reliability and controls

- Server-verified accounts; HttpOnly sessions; account-owned workspaces.
- Atomic database limits: 2 submissions/account/day, 3 globally/day, 1 active job.
- Idempotent request UUIDs, conditional job state transitions, stale lock recovery.
- A database poll lease shares provider checks across tabs and server instances.
- Batch media signing for library pages and renewal after long-lived tabs resume.
- Uncertain submissions held for an hour; inference is never blindly retried.
- Signed completion callbacks archive videos even with the browser closed.
- Private media with expiring signed URLs and ownership-checked downloads.
- 50 videos/account, 20 references/account, bounded uploads and media downloads.
- Daily maintenance with a secret; no credentials or prompts in worker logs.

Account videos/references sync across devices. **Drafts and storyboards are local
to this device**. Camera presets append instructions to prompts, not exact camera
trajectory controls. Free Space restarts and quota exhaustion remain real limits.

## Stack

Next.js 15.5 · React · TypeScript · Tailwind · Prisma · Supabase · Wan / ZeroGPU.

`npm run build` generates the appropriate Prisma client and compiles the app.
`npm test` covers route flows with SQLite, mocked providers and storage, including
quota/concurrency races and malformed SSE results. `python3 tests/wan-worker.test.py`
checks worker validation, attempt deduplication and output retention with inference
stubbed. These checks do not validate real GPU inference, Supabase auth/storage
or PostgreSQL integration. See [the product roadmap](docs/ROADMAP.md) for launch gates.
Some legacy nutrition modules remain unused; the old chat endpoint returns 410.
