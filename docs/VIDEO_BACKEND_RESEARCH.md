# Video backend research and implementation

Reviewed November 1, 2026. Scope: published APIs and a shipped SDK artifact.
This is not a reconstruction of vendors' private servers, model weights,
training data or inference infrastructure. No paid generation was invoked.

## Evidence and boundaries

REA statically parsed four JavaScript files from the registry-distributed
`@runwayml/sdk` 4.24.0 package after its SHA-512 registry integrity was verified:
`resources/tasks.js`, `lib/polling.js`, `resources/generate/video.js`, `client.js`.
The code was read as inert text, never executed. REA parsed all four selected
files without parse failures; 685 inventoried files were outside the selected
analysis. Graph coverage remains partial, with dynamic behavior unresolved.

The [machine-readable receipt](research/runway-rea-summary.json) preserves
package identity, digests, coverage and Evidence IDs. Parent Evidence is
`ev_385908fdc9701b7b59be22b5c8a9d97283740eb45da934aa1a13f39988e97520`.
The `TaskTimedOutError` export is supported by REA item Evidence
`ev_b1f1ec0afe31e950ebeff2e14fe32e647e98a7a82c6d5635932ed97fd24fe602`,
with static locations in `lib/polling.js` lines 16–23. Direct reading of that
shipped file distinguishes polling timeout/abort from task failure and observes
pending/running/throttled polling states. These are SDK observations, not proof
of how Runway's servers are implemented. Browser runtime capture was not
completed; no conclusions below claim authenticated runtime observation.

## Published contracts

| Target | Verified public behavior | Design consequence |
| --- | --- | --- |
| Runway Gen-4.5 | Task-based generation, model-specific inputs and throttling; output links expire after 24–48 hours. | Keep submission, waiting and completion separate; archive successful media in application-owned storage. |
| Kling 3.0 / 4.0 | Current and legacy callback schemas differ, including `succeeded` versus `succeed`; webhook secrets are separate from API credentials. | Normalize events in versioned adapters; verify signatures before internal state transitions. |
| Luma Ray3.2 | New Luma Agents `/v1/generations` API, with queued/processing/completed/failed states. Signed output links expire after one hour and can be renewed by retrieving generation details. | Do not reuse legacy Ray2 request shapes; preserve generation identity and archive results promptly. |
| Veo3.1 | Google's Gemini preview endpoint IDs were shut down October 22, 2026; the docs direct migration to Gemini Omni Flash or enterprise GA models. Other providers may expose separate Veo contracts. | Treat model IDs and availability as provider-specific; a familiar marketing name does not establish an active endpoint. |

Sources: [Runway models](https://docs.dev.runwayml.com/guides/models/),
[Runway output retention](https://docs.dev.runwayml.com/assets/outputs/),
[Runway limits](https://docs.dev.runwayml.com/usage/tiers/),
[Kling models](https://kling.ai/dev/apiReference/model),
[Kling callback schemas](https://kling.ai/document-api/api/get-started/callbacks),
[Luma videos](https://docs.agents.lumalabs.ai/guides/videos/),
[Luma errors and retention](https://docs.agents.lumalabs.ai/guides/error-handling/),
[Google video API lifecycle](https://ai.google.dev/gemini-api/docs/video).
These establish public contracts, not comparative output quality or a market ranking.

## Changes implemented in YetsyAI

These are our design choices informed by those contracts and the SDK evidence:

1. **Request identity:** store a versioned SHA-256 fingerprint of normalized
   generation settings and reference identity. Matching UUID retries replay the
   same record; changed payloads return 409. A raw reference contributes only a
   content hash, not its bytes. Asset retries can replay even if the reference
   was subsequently removed. Legacy rows without a fingerprint explicitly reject
   replay; their saved videos remain readable.
2. **Timeout recovery:** distinguish `render_timeout` from definitive failure.
   Check for provider completion before applying the one-hour wait limit. Signed
   late success or a later status check may recover a timed-out result within
   24 hours of submission. Recovery does not submit inference, decrement the
   concurrency reservation again, or clear a newer active render.
3. **Library resilience:** a missing individual object no longer hides every
   saved video/reference. Valid signed links remain usable; unavailable items
   retain their metadata and removal controls. Storage-service outages still
   report retriable errors instead of pretending all objects are missing.
4. **Bounded background work:** maintenance prioritizes active jobs, checks one
   provider task per invocation and can recover eligible timeouts. Library
   reloads also check one eligible recovery candidate. Signed callbacks remain
   the primary browser-independent completion path. Daily maintenance is a
   recovery backstop, not a low-latency durable queue service.

Existing safeguards remain: private media, account ownership, atomic app quotas,
provider poll leases, signed callbacks and no blind retry of generation POSTs.
The default remains the owner's Wan/ZeroGPU worker. Proprietary provider
integrations are not enabled by this research, and their model quality is not
reproduced by implementing their public workflow patterns.

## Validation and remaining work

Regressions cover changed-payload conflicts, concurrent identical requests,
reference identity, missing-object isolation, late signed completion, expired
recovery windows, archival retry and protection of a newer render reservation.
External inference/storage are mocked in unit tests. Live auth/PostgreSQL/media
checks use disposable test accounts and a clearly labeled MP4 fixture, not AI
generation. Actual Wan inference remains gated by the owner's HF account/Space
credentials; SMTP delivery and mobile visual QA remain separate launch checks.

Future adapters must validate their current official schemas and credentials,
capabilities, cancellation semantics and spending policy before being offered.
No Runway/Kling/Luma/Google subscription, token or paid GPU is supplied by REA.
