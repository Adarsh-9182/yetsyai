import type { VideoGeneration } from "@prisma/client";
import { db } from "./db";
import { ProviderError } from "./fal";
import { checkGeneration } from "./provider";
import { archiveVideo, mediaConfigured, signedMedia, signedMediaBatch } from "./storage";
import { releaseRender } from "./limits";
import { Generation, isActive, generationInput } from "./types";

export async function publicGeneration(job: VideoGeneration, signedUrl?: string): Promise<Generation> {
  let settings: Generation["settings"];
  try {
    if (job.settings) {
      const parsed = generationInput.pick({ camera: true, style: true, negativePrompt: true, generateAudio: true }).safeParse(JSON.parse(job.settings));
      if (parsed.success) settings = parsed.data;
    }
  } catch { /* Older records remain usable without render settings. */ }
  return {
    id: job.id, prompt: job.prompt, model: job.model, aspectRatio: job.aspectRatio,
    duration: job.duration, status: job.status as Generation["status"],
    videoUrl: job.storagePath ? signedUrl || await signedMedia(job.storagePath) : job.videoUrl, error: job.error, createdAt: job.createdAt.toISOString(), seed: job.seed,
    ...(settings ? { settings } : {}),
  };
}

export async function publicGenerations(jobs: VideoGeneration[]) {
  const urls = await signedMediaBatch(jobs.flatMap((job) => job.storagePath ? [job.storagePath] : []));
  return Promise.all(jobs.map((job) => publicGeneration(job, job.storagePath ? urls.get(job.storagePath) : undefined)));
}

export async function refreshGeneration(job: VideoGeneration) {
  if (!isActive(job.status)) return job;
  const age = Date.now() - job.createdAt.getTime();
  if (age > 60 * 60 * 1000) return finishGeneration(job, { status: "failed", error: "This render exceeded the one-hour limit. It may still finish at the provider; check before resubmitting." });
  if (job.status === "submitting") return job;
  if (!job.statusUrl || !job.responseUrl) return job;
  // Coalesce checks from tabs, devices and server instances with a database lease.
  const claimed = await db.videoGeneration.updateMany({
    where: { id: job.id, status: { in: ["queued", "processing"] }, OR: [{ pollAfter: null }, { pollAfter: { lte: new Date() } }] },
    data: { pollAfter: new Date(Date.now() + 45000) },
  });
  if (!claimed.count) return (await db.videoGeneration.findUnique({ where: { id: job.id } }))!;
  let result;
  try { result = await checkGeneration(job.provider, job.statusUrl, job.responseUrl); }
  catch (error) {
    if (error instanceof ProviderError && (error.status === 410 || error.status === 422)) return finishGeneration(job, { status: "failed", error: error.message });
    throw error;
  }
  if (!isActive(result.status)) {
    let storagePath: string | undefined;
    if (result.status === "completed" && "videoUrl" in result && result.videoUrl && mediaConfigured()) {
      try { storagePath = await archiveVideo(result.videoUrl, job.workspaceId, job.id); }
      catch (error) {
        if (error instanceof ProviderError && error.status === 410) return finishGeneration(job, { status: "failed", error: error.message });
        throw error;
      }
    }
    return finishGeneration(job, { ...result, ...(storagePath ? { storagePath } : {}) });
  }
  // Conditional update avoids an older poll overwriting a newer terminal result.
  await db.videoGeneration.updateMany({ where: { id: job.id, status: { in: result.status === "queued" ? ["queued"] : ["queued", "processing"] } }, data: result });
  return (await db.videoGeneration.findUnique({ where: { id: job.id } }))!;
}

export async function finishGeneration(job: VideoGeneration, data: { status: string; error?: string; videoUrl?: string; storagePath?: string }) {
  return db.$transaction(async (tx) => {
    const changed = await tx.videoGeneration.updateMany({ where: { id: job.id, status: { in: ["submitting", "queued", "processing"] } }, data: { ...data, pollAfter: null, ...(data.status === "completed" ? { error: null } : {}) } });
    if (changed.count) {
      await tx.studioWorkspace.updateMany({ where: { id: job.workspaceId, activeJobId: job.id }, data: { activeJobId: null } });
      if (job.quotaReserved) await releaseRender(tx);
    }
    return (await tx.videoGeneration.findUnique({ where: { id: job.id } }))!;
  });
}
