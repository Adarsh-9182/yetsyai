# Free studio setup

The interface can deploy without credentials, in preview mode. Real generation
requires a database, account service, private media storage and a GPU backend.
All four must be connected before calling this a working generation product.
Never paste credentials into GitHub, PRs or chat; put them in `.env.local` and
Vercel/Space environment settings.

## 1. Supabase project (free tier)

Create one project. It supplies PostgreSQL, email/password accounts and storage.

- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel.
  The anon/publishable key is intentionally public; database access is protected
  by the migration's RLS restrictions. The app verifies users on the server.
- Set server-only `SUPABASE_SERVICE_ROLE_KEY` for media uploads/signing.
- Set server-only `DATABASE_URL` to the **session pooler, port 5432**, with the
  project owner (`postgres`) credentials and `sslmode=require`. Keep connection
  count small, e.g. `connection_limit=1&pool_timeout=20`. Transaction poolers on
  port 6543 need special migration handling; use the session pooler here.
- Create a **private** bucket named `studio-media`; set max file size 40 MiB and
  allowed MIME types `video/mp4`, `image/jpeg`, `image/png`. Add no public bucket
  or object read policies. All URLs are signed by the server after ownership checks.
- Auth Site URL: `https://yetsyai.vercel.app`. Allow redirects to
  `https://yetsyai.vercel.app/account/confirm` and
  `https://yetsyai.vercel.app/account/confirm?next=/account/reset`.
- Keep email confirmations enabled. For reliable cross-browser confirmation,
  change the Confirm signup template link to
  `{{ .SiteURL }}/account/confirm?token_hash={{ .TokenHash }}&type=email`.
  Recovery email template:
  `{{ .SiteURL }}/account/confirm?token_hash={{ .TokenHash }}&type=recovery`.
- Supabase's default mail service has restrictions and is for development.
  Configure your own SMTP sender before opening account signup broadly.

The Vercel build applies additive PostgreSQL migrations. The browser cannot read
studio tables through Supabase's public REST interface. Keep DB owner credentials
server-only; do not use a database role that is restricted by the new RLS rules
without adding narrowly scoped server policies.

## 2. Hugging Face ZeroGPU Space

Use **your own** private Space; do not rely on someone else's public demo API.
Upload `spaces/wan-studio/{README.md,app.py,requirements.txt}`. Select ZeroGPU,
provided your account is eligible. Free quota and hosting eligibility can change;
check [official ZeroGPU documentation](https://huggingface.co/docs/hub/spaces-zerogpu).
If not eligible, do not select paid hardware accidentally. A GPU you already own
can run the same model after adapting the `spaces.GPU` decorator and HTTPS hosting.

Generate a random secret locally, for example:

```bash
openssl rand -hex 32
```

Store it as `HF_STUDIO_SECRET` in **both** the Space and Vercel. Space secret
`STUDIO_WEBHOOK_URL`: `https://yetsyai.vercel.app/api/provider-events`.
Server variables:

- `VIDEO_PROVIDER=huggingface`
- `HF_SPACE_URL=https://your-space-name.hf.space` (root origin, no extra path)
- `HF_TOKEN` with access to this private Space
- `HF_STUDIO_SECRET` as above

The 5B open model is a starting choice for short text-to-video, not a proven
"best" model. Measure actual output and runtime before increasing resolution.
Initial profile: 832×480 landscape or portrait equivalent, approximately 5 seconds,
no audio, 30 steps. Text only; image animation is explicitly disabled. An
inference run that exceeds ZeroGPU duration fails; don't raise paid spending or
rotate accounts to bypass free quota. Reduce resolution/frames or choose a
smaller model if your account's GPU budget does not fit the profile.

## 3. Limits and operations

Defaults: 2 render submissions/account/day, 3 for the whole studio/day,
1 concurrent render globally. These are hard database counters across server
instances, separate from Hugging Face's own per-account GPU quota. They reset at
UTC midnight. Failed/uncertain submissions consume daily allowance conservatively;
they are not billed credits. Account video cap: 50; reference cap: 20.

Provider failures/expired requests release locks; temporary transport errors keep
the job for polling. Ambiguous submissions are held for up to one hour, never
automatically resubmitted. The Space deduplicates completed UUIDs until restart.
Signed callbacks archive MP4 bytes before a job is marked complete. Delivery
retries are limited; client polling is a second recovery path. Free Space restarts
can lose a provider event; there is no claim of exactly-once inference or a
production GPU SLA. Paid fal mode remains explicit opt-in.

Set random `CRON_SECRET` in Vercel to enable the daily maintenance endpoint. It
expires abandoned locks, refreshes a bounded number of jobs and removes old
quota rows. Check provider event delivery failures and storage usage in your
platform logs. No prompts or credentials are logged by the callback worker.

## 4. Acceptance before inviting users

Credentials are required for these checks; they have not been performed yet:

1. Create and confirm an account, sign out/in, reset a password.
2. Run one real landscape clip and check output quality/runtime/quota.
3. Close the browser during a render and verify webhook completion/storage.
4. Sign in from a second device and preview/download the saved MP4.
5. Check account isolation, caps, expired events and Space restart recovery.
6. Exercise the PostgreSQL migration against your actual project.

Build success does not validate GPU runtime, authentication delivery, database
integration or output quality. Billing and subscriptions are intentionally not
part of this free prototype's scope.
