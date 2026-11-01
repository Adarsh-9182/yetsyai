# Yetsyai

An independent AI video studio for short clips: a prompt composer, camera prompt
and visual treatment presets, an exact shot-prompt preview, scene monitor, look
templates, saved drafts, a reorderable local storyboard with shot names, duplication,
planned sequence timing and JSON import/export, account
library and MP4 downloads.

Storyboard includes a named project library: save up to 20 projects to your
account and open their shots on another device. Saves are explicit; revision
checks prevent an older device from overwriting newer changes. Save as new keeps
an alternate version, and removing a project keeps existing rendered videos.

The studio puts the director’s desk first, with a photographic inspiration card,
persisted light/dark themes, a first-take guide, searchable status-filtered video
library and a lookbook filtered by cinematic, product, nature and portrait treatments.
Selecting a look applies its prompt and relevant visual treatment. Inspiration
photos are labeled separately from generated videos.

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

**Rendering is currently disabled until the owner’s private worker is connected.**
Live checks have verified sign-in with disposable confirmed accounts, PostgreSQL
project saves/revisions/account isolation, and private reference storage. Actual
signup/recovery email delivery and a real GPU-generated clip remain launch gates.
These are not validated by a successful frontend build.

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

`npm run setup:check -- --env-file .env.production.local` checks production
configuration without printing secrets. `npm run setup:storage` with the same
file option creates or checks the private media bucket. See the setup guide for
what these commands verify and the remaining integration checks.

## Reliability and controls

- Server-verified accounts; HttpOnly sessions; account-owned workspaces.
- Confirmation-email resend, password visibility controls and cross-tab sign-out.
- Decoded reference uploads strip EXIF/GPS metadata before private storage.
- Atomic database limits: 2 submissions/account/day, 3 globally/day, 1 active job.
- Idempotent request UUIDs, conditional job state transitions, stale lock recovery.
- A database poll lease shares provider checks across tabs and server instances.
- Batch media signing for library pages and renewal after long-lived tabs resume.
- Uncertain submissions held for an hour; inference is never blindly retried.
- Signed completion callbacks archive videos even with the browser closed.
- Private media with expiring signed URLs and ownership-checked downloads.
- 50 videos/account, 20 references/account, bounded uploads and media downloads.
- Daily maintenance with a secret; no credentials or prompts in worker logs.

Account videos/references and **saved projects** sync across devices. The current
composer draft and unsaved storyboard edits remain local until you save a project.
Projects store storyboard shots and their settings; they do not store an unsaved
composer prompt, attached reference files or assembled video. Camera presets append instructions to prompts, not exact camera
trajectory controls. Free Space restarts and quota exhaustion remain real limits.

## Stack

Next.js 15.5 · React · TypeScript · Tailwind · Prisma · Supabase · Wan / ZeroGPU.

`npm run build` generates the appropriate Prisma client and compiles the app.
`npm test` covers route flows with SQLite, mocked providers and storage, including
quota/concurrency races and malformed SSE results. `python3 tests/wan-worker.test.py`
checks worker validation, attempt deduplication and output retention with inference
stubbed. These checks do not validate real GPU inference, Supabase auth/storage
or PostgreSQL integration. The opt-in `scripts/verify-live.cjs` checks the live
backend with disposable accounts; see [DEPLOY.md](docs/DEPLOY.md) for its scope.
See [the product roadmap](docs/ROADMAP.md) for launch gates.
Some legacy nutrition modules remain unused; the old chat endpoint returns 410.
