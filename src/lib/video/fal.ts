import { z } from "zod";
import { GenerationInput, MAX_REFERENCE_BYTES } from "./types";

const QUEUE = "https://queue.fal.run";
export class ProviderError extends Error {
  constructor(message: string, public readonly status = 502) { super(message); }
}

export function providerConfigured() {
  const key = process.env.FAL_KEY?.trim();
  return Boolean(key && key !== "your-fal-key" && key !== "your-key-goes-here");
}

function queueUrl(value: string) {
  const url = new URL(value);
  if (url.origin !== QUEUE || url.username || url.password || !url.pathname.startsWith("/fal-ai/kling-video/")) {
    throw new ProviderError("The provider returned an invalid queue URL.");
  }
  return url.toString();
}

export function validVideoUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && (url.hostname === "fal.media" || url.hostname.endsWith(".fal.media")
        || (url.hostname === "storage.googleapis.com" && url.pathname.startsWith("/falserverless/")));
  } catch { return false; }
}

export function validReferenceImage(value: string) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_REFERENCE_BYTES || bytes.length < 8) return false;
  return match[1] === "png"
    ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}

async function falRequest(url: string, init: RequestInit = {}) {
  if (!providerConfigured()) throw new ProviderError("Video generation isn't configured yet. Add FAL_KEY to your server environment.", 503);
  let response: Response;
  try {
    response = await fetch(queueUrl(url), {
      ...init,
      headers: { "Authorization": `Key ${process.env.FAL_KEY?.trim()}`, "Content-Type": "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
  } catch { throw new ProviderError("Couldn't reach the video provider. The request may still be running; check your library before trying again."); }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new ProviderError("The video provider rejected the API key. Check FAL_KEY on the server.", 503);
    if (response.status === 402) throw new ProviderError("The video provider account needs a balance top-up.", 503);
    if (response.status === 422) throw new ProviderError("The provider couldn't process this scene or reference. Try a different prompt or image.", 422);
    throw new ProviderError("The video provider is temporarily unavailable. Check your library for updates.");
  }
  try { return await response.json(); }
  catch { throw new ProviderError("The provider returned an unreadable response."); }
}

const submitResponse = z.object({ request_id: z.string().min(1), status_url: z.string().url(), response_url: z.string().url() });
export async function submitVideo(input: GenerationInput) {
  const endpoint = `fal-ai/kling-video/v3/standard/${input.referenceImage ? "image" : "text"}-to-video`;
  const body = {
    prompt: input.prompt,
    duration: String(input.duration),
    generate_audio: input.generateAudio,
    negative_prompt: input.negativePrompt,
    ...(input.referenceImage ? { start_image_url: input.referenceImage } : { aspect_ratio: input.aspectRatio }),
  };
  const parsed = submitResponse.safeParse(await falRequest(`${QUEUE}/${endpoint}`, { method: "POST", body: JSON.stringify(body) }));
  if (!parsed.success) throw new ProviderError("The provider didn't confirm the render. Check your fal dashboard before trying again.");
  return { requestId: parsed.data.request_id, statusUrl: queueUrl(parsed.data.status_url), responseUrl: queueUrl(parsed.data.response_url) };
}

const statusResponse = z.object({ status: z.enum(["IN_QUEUE", "IN_PROGRESS", "COMPLETED"]), error: z.string().nullish() });
export async function checkVideo(statusUrl: string, responseUrl: string) {
  const result = statusResponse.safeParse(await falRequest(statusUrl));
  if (!result.success) throw new ProviderError("The provider returned an unexpected render status.");
  if (result.data.status !== "COMPLETED") {
    return { status: result.data.status === "IN_QUEUE" ? "queued" as const : "processing" as const };
  }
  if (result.data.error) return { status: "failed" as const, error: "The provider couldn't render this scene. Try a different prompt or reference image." };
  let payload: unknown;
  try { payload = await falRequest(responseUrl); }
  catch (error) {
    if (error instanceof ProviderError && error.status === 422) return { status: "failed" as const, error: error.message };
    throw error;
  }
  const video = z.object({ video: z.object({ url: z.string().url().refine(validVideoUrl) }) }).safeParse(payload);
  if (!video.success) throw new ProviderError("The render finished but its video wasn't available. Please check again shortly.");
  return { status: "completed" as const, videoUrl: video.data.video.url };
}
