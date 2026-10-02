import { z } from "zod";
import { checkVideo, ProviderError, providerConfigured as falConfigured, submitVideo, validVideoUrl as falVideoUrl } from "./fal";
import { GenerationInput } from "./types";

// Paid generation is opt-in. A leftover FAL_KEY never switches the free backend.
export function providerName() { return process.env.VIDEO_PROVIDER === "fal" ? "fal" : "huggingface"; }
export function modelName() { return providerName() === "fal" ? "Kling 3.0 Standard" : "Wan 2.2 · Open model"; }
function spaceUrl() {
  const url = new URL(process.env.HF_SPACE_URL || "https://unconfigured.hf.space");
  if (url.protocol !== "https:" || !url.hostname.endsWith(".hf.space") || url.port || url.username || url.password || url.pathname !== "/") throw new ProviderError("The video studio's GPU connection is invalid.", 503);
  return url.origin;
}
export function providerConfigured() {
  if (providerName() === "fal") return process.env.ENABLE_PAID_GENERATION === "true" && falConfigured();
  try { spaceUrl(); return Boolean(process.env.HF_SPACE_URL && process.env.HF_TOKEN && (process.env.HF_STUDIO_SECRET?.length || 0) >= 32); } catch { return false; }
}
export function validVideoUrl(value: string) {
  if (falVideoUrl(value)) return true;
  try { const url = new URL(value); return url.origin === spaceUrl() && url.pathname.startsWith("/gradio_api/file=") && !url.username && !url.password; }
  catch { return false; }
}
export function mediaHeaders(value: string): HeadersInit {
  try { if (new URL(value).origin === spaceUrl()) return { Authorization: `Bearer ${process.env.HF_TOKEN}` }; } catch { /* fal URLs use public media. */ }
  return {};
}
async function hfFetch(path: string, init: RequestInit = {}, timeout = 12000) {
  let response: Response;
  try {
    response = await fetch(`${spaceUrl()}${path}`, { ...init, cache: "no-store", redirect: "error", headers: { "Authorization": `Bearer ${process.env.HF_TOKEN}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(timeout) });
  } catch { throw new ProviderError("The free GPU service is waking up or busy. We'll keep checking your render.", 502, init.method === "POST"); }
  if (response.status === 404 || response.status === 410) throw new ProviderError("The GPU service restarted and this render is no longer available. Try again.", 410);
  if (response.status === 401 || response.status === 403) throw new ProviderError("The GPU connection needs attention. Please try later.", 503);
  if (response.status === 429) throw new ProviderError("The free GPU quota is exhausted. Please try again tomorrow.", 429);
  if (!response.ok) throw new ProviderError("The free GPU service is temporarily busy. Please retry later.", 502, init.method === "POST");
  return response;
}
export async function submitGeneration(input: GenerationInput) {
  if (providerName() === "fal") return submitVideo(input);
  if (!providerConfigured()) throw new ProviderError("Video generation is being connected. You can save a draft now.", 503);
  if (input.duration !== 5 || input.generateAudio) throw new ProviderError("The free model creates 5-second silent clips. Choose 5 seconds and turn audio off.", 400);
  const response = await hfFetch("/gradio_api/call/generate", { method: "POST", body: JSON.stringify({ data: [process.env.HF_STUDIO_SECRET, input.requestId, input.prompt, input.negativePrompt, input.aspectRatio, input.seed, input.referenceImage || ""] }) });
  const parsed = z.object({ event_id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/) }).safeParse(await response.json());
  if (!parsed.success) throw new ProviderError("Render confirmation was interrupted. We'll hold your place before a retry.", 502, true);
  const statusUrl = `${spaceUrl()}/gradio_api/call/generate/${parsed.data.event_id}`;
  return { requestId: parsed.data.event_id, statusUrl, responseUrl: statusUrl };
}
export async function checkGeneration(provider: string, statusUrl: string, responseUrl: string) {
  if (provider === "fal") return checkVideo(statusUrl, responseUrl);
  const url = new URL(statusUrl);
  if (url.origin !== spaceUrl() || !/^\/gradio_api\/call\/generate\/[a-zA-Z0-9_-]+$/.test(url.pathname)) throw new ProviderError("Invalid render reference.", 410);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await hfFetch(url.pathname, {}, 14000);
    reader = response.body?.getReader();
    if (!reader) throw new ProviderError("Couldn't read the render status.");
    let buffer = "";
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      if (buffer.length > 65536) throw new ProviderError("Invalid render status.");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        const event = /^event:\s*(.+)$/m.exec(block)?.[1]?.trim();
        const raw = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (event === "error") return { status: "failed" as const, error: "The free GPU couldn't complete this scene. Its quota may be exhausted; try later or simplify your prompt." };
        if (event === "complete") {
          let payload: unknown;
          try { payload = JSON.parse(raw); } catch { throw new ProviderError("The GPU returned an unreadable result.", 410); }
          const output = z.array(z.object({ video: z.object({ url: z.string().url().refine(validVideoUrl) }) })).min(1).safeParse(payload);
          if (!output.success) throw new ProviderError("The GPU finished without a playable video.", 410);
          return { status: "completed" as const, videoUrl: output.data[0].video.url };
        }
        if (event === "heartbeat" || event === "generating") return { status: "processing" as const };
      }
    }
    return { status: "queued" as const };
  } catch (error) {
    if (error instanceof DOMException && ["TimeoutError", "AbortError"].includes(error.name)) return { status: "queued" as const };
    throw error;
  } finally { await reader?.cancel().catch(() => {}); }
}
