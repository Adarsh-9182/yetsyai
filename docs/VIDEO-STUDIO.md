# Yetsyai video studio

## Current flow

1. Loading `/api/generations` creates an anonymous browser workspace with an HttpOnly cookie and returns its history.
2. `POST /api/generations` validates the scene, settings, and optional reference image. It reserves one active render slot in a SQLite transaction.
3. The server submits the request to fal's Kling 3.0 Standard text-to-video or image-to-video endpoint. `FAL_KEY` stays on the server.
4. The client polls `/api/generations/:id` for queue updates. Status and the completed output URL are persisted; refreshing or reopening the app resumes unfinished jobs in the same browser workspace.
5. Completed videos play in a dialog. `/api/generations/:id/download` streams the MP4 with an attachment header after verifying ownership and the provider CDN host.

Repeated submissions with the same request ID return the existing job. A per-workspace database lock prevents overlapping renders. Temporary polling errors retain the job and back off; confirmed failures free the active slot. An interrupted submission without a provider confirmation requires checking the fal dashboard before retrying, since an unconfirmed request could still have been accepted externally.

## Storage and limits

- SQLite stores prompts, generation settings, statuses, and provider output URLs. It does not store reference images or output video bytes.
- Browser workspace identity is local to its cookie. Clearing that cookie removes access to its history. This is not account authentication.
- Reference images are JPG/PNG up to 3 MB. The browser validates dimensions before submission; video generation receives the data URI as the starting frame. References are kept for the current editing session.
- The current UI supports 5 or 10 seconds, three text-video aspect ratios, an optional negative prompt, and optional audio. Image-video aspect ratio follows its starting frame.
- Output URLs have provider-controlled retention. Download videos you want to keep; permanent asset storage is the next stage.
- Vercel builds use the PostgreSQL schema and included migrations; local builds retain SQLite. Without a PostgreSQL URL, deployed API routes return a healthy setup state and reject rendering. No ephemeral SQLite database is created on Vercel.
- Add account authentication, durable asset storage, spending limits and billing before exposing paid generation publicly. Keep the generation backend private while those are pending.

## Verification

`npm test` exercises the production API handlers with real temporary SQLite and a mocked fal HTTP boundary. It covers provider configuration, input validation, cross-origin requests, job idempotency, queue transitions, transient failures, ownership checks, and MP4 download. These tests make no paid calls.

`npm run build` checks application compilation and TypeScript. A live render still needs a funded fal account and an actual key.

## Provider references

- [Kling Standard text-to-video schema](https://fal.ai/models/fal-ai/kling-video/v3/standard/text-to-video/api)
- [Kling Standard image-to-video schema](https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video/api)
- [fal queue API](https://fal.ai/docs/documentation/model-apis/inference/queue)

The other original clinical documents and unused clinical components are legacy material from the repository's previous purpose.
