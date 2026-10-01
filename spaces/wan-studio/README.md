---
title: Yetsyai Wan Studio
emoji: 🎬
colorFrom: green
colorTo: gray
sdk: gradio
sdk_version: 5.49.1
app_file: app.py
python_version: "3.11"
pinned: false
---

# Yetsyai's private GPU backend

Deploy these three files to **your own private Hugging Face Space**. Select
ZeroGPU hardware (if your account is eligible), never paid hardware for this MVP.
Set Space secrets `HF_STUDIO_SECRET` (a randomly generated 32-byte secret) and
`STUDIO_WEBHOOK_URL=https://yetsyai.vercel.app/api/provider-events`.
Set the same secret, a token with access to this private Space, and the Space URL
on the Yetsyai server. See `docs/SETUP.md` in the main repository.

This backend uses Apache-2.0 Wan 2.2 TI2V 5B weights for **text-to-video only**.
The initial profile is 832×480, 81 frames at 16 fps (approximately 5 seconds),
30 denoising steps, no audio. The reduced resolution limits GPU use. This is
an initial quality/latency profile, not a measured benchmark. Real GPU execution
and quota compatibility must be checked before opening generation publicly.

The shared secret is checked *before* reserving a GPU. Completed jobs are reused
by UUID, and a signed completion webhook saves the result to the app's private
storage even if the user closes the browser. In-memory cache is not persistent:
a Space restart can interrupt queued work; the app has a one-hour recovery bound.

No third-party public Space is used as production infrastructure. No quota bypass,
free-account rotation, paid-provider fallback or simulated video output is used.
Wan weights are free; GPU capacity has daily quotas and is not an unlimited SLA.
