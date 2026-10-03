# Studio architecture

## Request path

1. The browser loads capabilities and its account library. Public preview visitors
   do not create database workspaces. Auth is verified by Supabase on the server.
2. `POST /api/generations` checks origin, account, bounded input, owned reference
   and actual image dimensions. PostgreSQL atomically reserves workspace/global
   slots and daily quota before recording an idempotent request UUID.
3. The provider adapter sends the scene to the owner's private ZeroGPU Gradio
   Space. Paid fal/Kling is explicit opt-in. Keys never reach the browser.
4. The browser polls with backoff. A 45-second database lease allows one provider
   check per render across tabs/devices/instances. Processing cannot regress to
   queued, and terminal completion clears earlier submission warnings.
   Gradio SSE results are cached by the Space;
   status is persisted in PostgreSQL. A signed callback is the primary completion
   path, so users can close the page during a render.
5. Completed MP4s are copied to private Supabase storage before marking a free
   job complete. UI links expire after an hour; authenticated routes issue fresh
   signed links in one batch for a library page. Browser focus and periodic renewal
   refresh links in long-lived tabs. Download/delete checks workspace ownership.

Conditional terminal state updates release quota once, even when callback and
polling race. Expired/missing provider events become failures. Temporary network
errors retain work. Ambiguous submissions hold their slot for an hour, with no
automatic inference retry. Daily maintenance and the next submission expire
abandoned slots. The protocol does not guarantee exactly-once provider execution.

## Persistence

- Account library and reference metadata: PostgreSQL on Vercel, SQLite locally.
- Video/reference bytes: a private `studio-media` Supabase bucket.
- Local drafts/storyboards: browser storage, explicitly limited to this device.
- Space job/cache state: ephemeral; a restart can interrupt rendering.

Default app allowance is two submissions/account/day, three globally/day and one
active render. This is separate from provider GPU quotas. Failed/uncertain work
consumes daily allowance. Storage caps are 50 videos and 20 references/account.
Maintenance cleans old quota rows. The app uses owner credentials for migrations
and server DB access; migrations deny public Supabase REST access to studio tables.

## Initial creative scope

Free profile: short silent text-to-video clips, three aspect ratios, negative
prompt, seed, prompt camera presets. Image animation is disabled for the default
backend. Presets describe intended motion; they do not implement exact camera
trajectories. The storyboard plans individual shots and does not automatically
generate or stitch a full film. Photo look templates are labeled as inspiration.
Camera/style instructions are compiled on the server; the original user prompt
and render settings remain separate for reuse. The browser shows the exact
compiled shot prompt before submission and preserves all text-shot settings in
drafts and storyboards. JSON exports carry up to 12 ordered shots and import uses
schema validation, a 128 KB file limit and UUID deduplication. Shot advice is
deterministic and makes no LLM API calls.

Storyboard shots have optional names (up to 80 characters). Duplicating a shot
inserts a new UUID immediately after it and retains all generation settings.
The sequence shows each shot's planned start/end and total runtime, recalculated
after reordering or removal. These timings describe the plan, not an assembled
video. Names persist in local storage and JSON exports; older version-1 files
without names remain compatible.

## Deployment and checks

See [SETUP.md](SETUP.md) for credentials, bucket/auth configuration, limits and
the required real integration checks. The build validates compilation, not GPU
runtime or output quality. The original fal route regression harness is mocked
and does not exercise Supabase auth/storage, PostgreSQL or ZeroGPU.

References: [Wan model](https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B-Diffusers),
[ZeroGPU](https://huggingface.co/docs/hub/spaces-zerogpu),
[Gradio HTTP/SSE API](https://gradio.app/4.44.1/guides/querying-gradio-apps-with-curl).

Legacy nutrition modules/tables are retained without deleting old local data;
the retired chat endpoint returns 410 and never calls Anthropic.
