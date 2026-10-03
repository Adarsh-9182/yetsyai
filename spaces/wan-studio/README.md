---
title: Yetsyai Wan Studio
emoji: 🎬
colorFrom: green
colorTo: gray
sdk: gradio
sdk_version: 5.49.1
app_file: app.py
python_version: "3.12.12"
pinned: false
---

# Yetsyai's private GPU backend

Deploy these three files to **your own private Hugging Face Space**. Select
ZeroGPU hardware (if your account is eligible), never paid hardware for this MVP.
Set Space secrets `HF_STUDIO_SECRET` (a randomly generated 32-byte secret) and
`STUDIO_WEBHOOK_URL=https://yetsyai.vercel.app/api/provider-events`.
Set the same secret, a token with access to this private Space, and the Space URL
on the Yetsyai server. See `docs/SETUP.md` in the main repository.

Python is pinned to 3.12.12, one of the runtimes currently listed in the
[ZeroGPU compatibility documentation](https://huggingface.co/docs/hub/spaces-zerogpu#supported-versions).

This backend uses Apache-2.0 Wan 2.2 TI2V 5B weights for **text-to-video only**.
The initial profile is 832×480, 81 frames at 16 fps (approximately 5 seconds),
30 denoising steps, no audio. The reduced resolution limits GPU use. This is
an initial quality/latency profile, not a measured benchmark. Real GPU execution
and quota compatibility must be checked before opening generation publicly.

Space variables `WAN_STEPS` (20–40, default 30) and `WAN_GPU_SECONDS` (60–180,
default 180) allow tuning after a real benchmark. Reducing steps can reduce
render time and quality; GPU duration is a reservation ceiling, not a guaranteed
render time. Do not change these values until you measure your first clip.

The shared secret is checked *before* reserving a GPU. Up to 128 terminal attempts
are remembered by UUID, including failures; up to 24 MP4 files are retained.
Reusing a remembered UUID with a different scene is rejected. Missing or expired
files never trigger another inference for that remembered UUID. A signed
completion webhook saves the result to the app's private
storage even if the user closes the browser. In-memory cache is not persistent:
a Space restart can interrupt queued work; the app has a one-hour recovery bound.

No third-party public Space is used as production infrastructure. No quota bypass,
free-account rotation, paid-provider fallback or simulated video output is used.
Wan weights are free; GPU capacity has daily quotas and is not an unlimited SLA.
