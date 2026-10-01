import { createClient } from "@supabase/supabase-js";
import { ProviderError } from "./fal";
import { validVideoUrl, mediaHeaders } from "./provider";

const BUCKET = "studio-media";
export function mediaConfigured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }
function storage() {
  if (!mediaConfigured()) throw new ProviderError("Media storage is being connected. Try later.", 503);
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) } }).storage;
}
export async function uploadMedia(path: string, bytes: Buffer, contentType: string) {
  const { error } = await storage().from(BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new ProviderError("Couldn't save this file to your library. Please retry.", 503);
  return path;
}
export async function signedMedia(path: string) {
  const { data, error } = await storage().from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw new ProviderError("Couldn't open this saved file. Please retry.", 503);
  return data.signedUrl;
}
export async function readAsset(path: string) {
  const { data, error } = await storage().from(BUCKET).download(path);
  if (error || !data || data.size > 3 * 1024 * 1024) throw new ProviderError("Couldn't load the saved reference image.", 410);
  return `data:${data.type};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
}
export async function archiveVideo(url: string, workspaceId: string, jobId: string) {
  if (!validVideoUrl(url)) throw new ProviderError("Invalid video location.", 410);
  const response = await fetch(url, { headers: mediaHeaders(url), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!response.ok || !response.body) throw new ProviderError("The video couldn't be saved yet. We'll retry.", 502);
  const limit = 40 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > limit) { await response.body.cancel(); throw new ProviderError("This video exceeds the studio's storage limit.", 410); }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) throw new ProviderError("This video exceeds the studio's storage limit.", 410);
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = Buffer.concat(chunks);
  if (bytes.length < 12 || bytes.toString("ascii", 4, 8) !== "ftyp") throw new ProviderError("The provider returned an invalid MP4 file.", 410);
  return uploadMedia(`${workspaceId}/videos/${jobId}.mp4`, bytes, "video/mp4");
}
export async function removeMedia(paths: string[]) { if (paths.length) { const { error } = await storage().from(BUCKET).remove(paths); if (error) throw new ProviderError("Couldn't remove the saved media. Retry shortly.", 503); } }
