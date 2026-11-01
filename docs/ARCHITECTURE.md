# YetsyAI architecture

YetsyAI is a short-video studio built around existing model weights. It does not
train a new model. The active application is `src/components/studio` and
`src/lib/video`; unused nutrition modules are legacy code. `/api/chat` returns 410.

## Runtime

| Layer | Implementation |
| --- | --- |
| Application | Next.js 15.5 App Router, React 18, TypeScript |
| Studio | Prompt and shot controls, monitor, lookbook, video/reference libraries, storyboard |
| Design | Geist, Lucide, responsive charcoal/paper themes; theme and navigation preferences stay local |
| Accounts | Supabase email/password, server-verified HttpOnly session cookies |
| Database | Prisma; SQLite for local development, PostgreSQL on Vercel |
| Media | Private Supabase `studio-media` bucket, one-hour signed URLs |
| Inference | Owner-controlled private Hugging Face Gradio/ZeroGPU Space, Wan 2.2 TI2V 5B |
| Completion | HMAC-signed callbacks, browser polling and authenticated maintenance |

## Render lifecycle

1. The browser sends a unique request UUID and validated scene settings to
   `POST /api/generations`. Camera and treatment presets compile into the exact
   text displayed in the shot brief. A versioned SHA-256 fingerprint binds that
   UUID to normalized settings and reference identity. Identical retries replay
   the record; changed payloads and ambiguous legacy retries return 409.
2. The server verifies the account and ownership, validates provider capabilities,
   atomically reserves daily/global quota and one workspace render slot, and
   creates a `submitting` record before making the provider request.
3. The adapter submits to the configured private Space with a server-only access
   token and shared secret. It stores the bounded Gradio event ID, then marks the
   job `queued`. The Space reserves a GPU only after validating the shared secret.
4. Signed completion callbacks archive the MP4 in private storage and finish the
   record even if the browser closes. Polling can recover completion. Database
   leases coalesce checks across devices; conditional writes preserve terminal states.
5. Account-owned routes issue signed playback URLs and stream MP4 downloads.
   The browser renews library/reference URLs after long-lived tabs resume.
   Missing individual objects retain their metadata without hiding valid media.

Uncertain submissions retain their UUID and slot; they are never automatically
submitted again. After one hour a timeout releases the reservation, after first
checking for a finished result. Signed callbacks and bounded status checks can
recover a late success for 24 hours from submission without releasing quota
again or disturbing a newer render. Definitive failures cannot recover. Daily
maintenance checks one task per invocation, prioritizing active jobs. Worker attempt IDs
are cached only until the Space restarts. These controls reduce duplicate inference
but do not create a durable GPU service or guarantee availability.

## Data boundaries

- `StudioWorkspace`: one account owner and its current active job.
- `VideoGeneration`: original prompt/settings, provider lifecycle and private media path.
- `StudioAsset`: bounded image reference; uploads are decoded, validated and
  re-encoded to strip EXIF/GPS metadata.
- `StudioProject`: named storyboard, up to 12 shots; explicit saves use optimistic
  revision checks. Accounts hold up to 20 projects.
- `StudioQuota`: atomic UTC daily counters and global concurrent reservation.

The composer and unsaved storyboard are local to the device. Saved projects,
references and generated videos belong to the account. Signing out clears private
client libraries; other open tabs receive an account-change event. Database tables
have RLS/REST restrictions; service credentials never belong in browser code.

## Budget and validation

Default caps: two submissions/account/day, three globally/day and one active job.
Free Hugging Face capacity has independent quotas. No paid provider is enabled by
default; fal requires three explicit configuration conditions, including
`ENABLE_PAID_GENERATION=true`.

`npm test` checks routes with SQLite and mocked external providers/storage.
`python3 tests/wan-worker.test.py` stubs inference. `scripts/verify-live.cjs`
exercises real auth, PostgreSQL projects and private references with disposable
accounts; it does not send emails or render a video. A real GPU take and actual
confirmation/recovery email delivery are separate launch gates in [SETUP.md](SETUP.md).

Public provider contracts and the scoped REA analysis of a shipped Runway SDK
are documented in [VIDEO_BACKEND_RESEARCH.md](VIDEO_BACKEND_RESEARCH.md).
