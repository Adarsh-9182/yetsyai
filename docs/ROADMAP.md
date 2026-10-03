# Yetsyai product roadmap

Updated October 2, 2026. The current release is a preview studio until real
accounts, PostgreSQL, private media storage and the owner's GPU Space are connected.

## Implemented and locally checked

- Responsive studio, movable/collapsible navigation, prompt composer and photo looks.
- Camera and visual treatment presets, exact shot prompt preview, practical shot advice.
- Full text-shot draft settings, storyboard ordering and validated JSON import/export.
- Named storyboard shots, duplicate shots with preserved settings, planned sequence timing.
- Photo-led studio showcase, creative shortcuts, filtered lookbook and responsive charcoal styling.
- Account routes, owned library/assets, signed downloads and completion callbacks.
- Atomic app quotas, request IDs, conditional completion and abandoned lock recovery.
- Database provider-poll leases, monotonic status updates and batch library media signing.
- Worker attempt cache, bounded outputs, failed-attempt deduplication and profile controls.
- Regression checks use SQLite and mocked external services. Browser checks cover
  local preview workflows; neither validates production provider or account services.

## Next gate: one real clip

1. Connect a Supabase Free project and private storage; apply PostgreSQL migrations.
2. Configure account confirmation/recovery and appropriate email delivery.
3. Deploy the private Wan Space on eligible ZeroGPU hardware and connect Vercel secrets.
4. Confirm one account, render one short clip, and record duration, runtime and GPU quota.
5. Close the browser during a render; verify the callback saves the MP4, then play
   and download it on a second signed-in device.
6. Check account isolation and provider restart/quota failure recovery against real services.

The first render determines whether this resolution/step profile fits the actual
free account. Model quality has not been benchmarked. Setup instructions are in
[SETUP.md](SETUP.md).

## Before a small public beta

- Benchmark representative single shots: product, person, landscape and simple motion.
- Measure successful-render rate, queue time, render time and download failures.
- Set app allowance below measured GPU capacity and monitor storage/egress usage.
- Exercise callback/poll races and migration recovery against PostgreSQL.
- Verify confirmation/reset emails on different devices and reliable email delivery.
- Publish realistic capabilities and limits based on measured clips.

## Later improvements, once generation works

- Account-synced storyboards, automatic shot-to-render associations and comparison takes.
- Image-to-video after a compatible model path passes real integration checks.
- Clip trimming, sequence assembly and soundtrack editing without more inference.
- A durable worker queue when measured demand exceeds the one-active-render prototype.
- Capacity expansion needs GPU resources; increasing frontend traffic does not increase
  free GPU quota. The current budget supports a limited beta, not unlimited rendering.
