"""Private Gradio/ZeroGPU backend. Keep secrets in Space Settings, not this file."""
import hashlib
import hmac
import json
import os
import threading
import time
import uuid
from collections import OrderedDict
from pathlib import Path
from urllib.parse import quote, urlparse

import gradio as gr
import requests
import spaces
import torch
from diffusers import AutoencoderKLWan, WanPipeline
from diffusers.utils import export_to_video

MODEL = "Wan-AI/Wan2.2-TI2V-5B-Diffusers"
OUTPUTS = Path("outputs").resolve()
OUTPUTS.mkdir(exist_ok=True)
SECRET = os.environ.get("HF_STUDIO_SECRET", "")
WEBHOOK = os.environ.get("STUDIO_WEBHOOK_URL", "")
if not SECRET or len(SECRET) < 32:
    raise RuntimeError("Set a HF_STUDIO_SECRET of at least 32 characters.")
if not WEBHOOK.startswith("https://") or urlparse(WEBHOOK).path != "/api/provider-events":
    raise RuntimeError("Set a HTTPS STUDIO_WEBHOOK_URL ending in /api/provider-events.")

# ZeroGPU supports CUDA placement at startup through CUDA emulation.
vae = AutoencoderKLWan.from_pretrained(MODEL, subfolder="vae", torch_dtype=torch.float32)
pipe = WanPipeline.from_pretrained(MODEL, vae=vae, torch_dtype=torch.bfloat16)
pipe.to("cuda")
pipe.vae.enable_tiling()
completed = OrderedDict()
STEPS = int(os.environ.get("WAN_STEPS", "30"))
GPU_SECONDS = int(os.environ.get("WAN_GPU_SECONDS", "180"))
if not 20 <= STEPS <= 40 or not 60 <= GPU_SECONDS <= 180:
    raise RuntimeError("Use WAN_STEPS between 20 and 40 and WAN_GPU_SECONDS between 60 and 180.")


def remember(request_id, fingerprint, path):
    """Cache terminal attempts, including failures, so the same UUID is not rerun."""
    completed[request_id] = {"fingerprint": fingerprint, "path": path}
    while len(completed) > 128:
        _, old = completed.popitem(last=False)
        if old["path"]:
            Path(old["path"]).unlink(missing_ok=True)
    files = [entry for entry in completed.values() if entry["path"]]
    for entry in files[:-24]:
        Path(entry["path"]).unlink(missing_ok=True)
        entry["path"] = None


def notify(payload):
    """Only webhook delivery is retried; model inference is never auto-retried."""
    body = json.dumps(payload, separators=(",", ":")).encode()
    for delay in (0, 2, 5, 10, 30, 60):
        time.sleep(delay)
        timestamp = str(int(time.time()))
        signature = hmac.new(SECRET.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
        try:
            response = requests.post(WEBHOOK, data=body, headers={"Content-Type": "application/json", "x-studio-timestamp": timestamp, "x-studio-signature": signature}, timeout=55, allow_redirects=False)
            if response.ok:
                return
        except requests.RequestException:
            pass
    # Do not log prompts, media URLs, credentials or provider response bodies.
    print("Completion delivery deferred; client polling can recover the result.")


@spaces.GPU(duration=GPU_SECONDS)
def render(prompt, negative_prompt, ratio, seed):
    width, height = {"16:9": (832, 480), "9:16": (480, 832), "1:1": (640, 640)}[ratio]
    frames = pipe(prompt=prompt, negative_prompt=negative_prompt, width=width, height=height,
                  num_frames=81, num_inference_steps=STEPS, guidance_scale=5.0,
                  generator=torch.Generator(device="cuda").manual_seed(seed)).frames[0]
    path = OUTPUTS / f"{uuid.uuid4()}.mp4"
    export_to_video(frames, str(path), fps=16)
    return str(path)


def generate(secret, request_id, prompt, negative_prompt, ratio, seed, reference):
    if not isinstance(secret, str) or not hmac.compare_digest(secret, SECRET):
        raise gr.Error("Studio access required.")
    try:
        request_id = str(uuid.UUID(request_id))
        seed = int(seed)
    except (ValueError, TypeError, AttributeError):
        raise gr.Error("Invalid render request.")
    if not isinstance(prompt, str) or not 3 <= len(prompt.strip()) <= 2500 or not isinstance(negative_prompt, str) or len(negative_prompt) > 500:
        raise gr.Error("Describe one scene in 3–2500 characters.")
    if ratio not in ("16:9", "9:16", "1:1") or not 0 <= seed <= 2147483647 or reference:
        raise gr.Error("Choose a supported ratio and seed. This backend uses text prompts only.")
    fingerprint = hashlib.sha256(json.dumps([prompt.strip(), negative_prompt, ratio, seed]).encode()).hexdigest()
    previous = completed.get(request_id)
    if previous:
        if previous["fingerprint"] != fingerprint:
            raise gr.Error("This request ID belongs to a different scene.")
        if previous["path"] and Path(previous["path"]).exists():
            return previous["path"]
        raise gr.Error("This request already ended. Create a new scene to try again.")
    try:
        path = render(prompt.strip(), negative_prompt, ratio, seed)
    except Exception:
        remember(request_id, fingerprint, None)
        threading.Thread(target=notify, args=({"id": request_id, "status": "failed"},), daemon=True).start()
        raise gr.Error("The GPU couldn't finish this scene. Check your quota and retry later.")
    remember(request_id, fingerprint, path)
    host = os.environ.get("SPACE_HOST", "")
    if host.endswith(".hf.space"):
        url = f"https://{host}/gradio_api/file={quote(path)}"
        threading.Thread(target=notify, args=({"id": request_id, "status": "completed", "videoUrl": url},), daemon=True).start()
    return path


with gr.Blocks(title="Yetsyai GPU backend", delete_cache=(3600, 86400)) as demo:
    gr.Markdown("# Yetsyai GPU backend\nUse your Yetsyai studio to create and manage videos.")
    inputs = [gr.Textbox(visible=False), gr.Textbox(visible=False), gr.Textbox(visible=False), gr.Textbox(visible=False), gr.Textbox(visible=False), gr.Number(visible=False), gr.Textbox(visible=False)]
    output = gr.Video(visible=False)
    trigger = gr.Button(visible=False)
    trigger.click(generate, inputs=inputs, outputs=output, api_name="generate", concurrency_limit=1)

demo.queue(max_size=8).launch(allowed_paths=[str(OUTPUTS)], show_error=False)
