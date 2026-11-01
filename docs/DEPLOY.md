# Deploy YetsyAI

The existing project is `Adarsh-9182/yetsyai`, deployed at
https://yetsyai.vercel.app. Keep the existing Vercel/Supabase project links.
The complete service configuration is documented in [SETUP.md](SETUP.md).

## Release

1. Run `npm test`, `npm run lint`, `python3 tests/wan-worker.test.py` and
   `npm run build`. Tests use a local SQLite fixture, never bill a provider.
2. Configure production environment values in the existing Vercel project.
   Use `npm run setup:check -- --env-file .env.production.local` to validate
   syntax without printing values. Missing worker credentials intentionally keep
   rendering disabled.
3. Deploy through the linked Vercel project (`vercel --prod`) or its Git integration.
   The build command must be `npm run build`, not a bare `next build`: it generates
   the PostgreSQL Prisma client and applies additive migrations before compilation.
4. Verify the production alias points to the new deployment, account routes are
   private/no-store, and anonymous library responses contain no private data.

Never commit environment files. Do not enable paid fallback to make a release pass.
Do not disable email confirmation or make the media bucket public.

## Live backend smoke test

The opt-in script creates two tagged, disposable confirmed accounts via Supabase
Admin, signs in through the deployed API, saves/reopens/revises a storyboard,
checks stale revisions and account isolation, uploads/opens a reference using a
signed URL, checks private-bucket access, and signs out. It removes only the
accounts and data created by that run. It sends no email and makes no GPU call.

Generate the PostgreSQL client before running the script:

```bash
npx prisma generate --schema prisma/postgres/schema.prisma
node scripts/verify-live.cjs --run --env-file .env.production.local
```

Add `--video-fixture /absolute/test.mp4` to verify private video access and exact
download bytes using a disposable, clearly labeled MP4 fixture. This uses no
inference and is not a generated-video benchmark.

Restore the SQLite client before local SQLite tests/development:

```bash
npx prisma generate --schema prisma/schema.prisma
```

The smoke test does not prove signup-email delivery, recovery-mail delivery,
video quality, inference time or callback-to-download operation. Verify these
with one actual account and one real render after the owner's Space is connected.

## Free worker

Upload `spaces/wan-studio` to the owner's private Gradio Space and select only
eligible ZeroGPU hardware. Current Hugging Face documentation allows eligible,
verified personal accounts older than 30 days to host up to two ZeroGPU Spaces
for free. Eligibility and quota are controlled by Hugging Face; never switch to
paid hardware automatically. See https://huggingface.co/docs/hub/spaces-zerogpu.

Set the matching shared secret and completion URL on the Space, then
`HF_SPACE_URL` and a least-privilege access token on Vercel. Measure one real
5-second clip before changing render limits or inviting users. An HTTP 200 or
successful build is not proof of inference.
