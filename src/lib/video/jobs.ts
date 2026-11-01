import type { VideoGeneration, Prisma } from "@prisma/client";
import { db } from "./db";
import { ProviderError } from "./fal";
import { checkGeneration } from "./provider";
import { archiveVideo, mediaConfigured, signedMediaBatch, removeMedia } from "./storage";
import { releaseRender } from "./limits";
import { Generation, isActive, generationInput } from "./types";

export async function publicGeneration(job: VideoGeneration, signedUrl?: string | null): Promise<Generation> {
  let settings: Generation["settings"];
  let sceneId: string | undefined;
  try {
    if (job.settings) {
      const parsed = generationInput.pick({ camera: true, style: true, negativePrompt: true, generateAudio: true, sceneId: true }).safeParse(JSON.parse(job.settings));
      if (parsed.success) { const { sceneId: source, ...renderSettings } = parsed.data; settings = renderSettings; sceneId = source; }
    }
  } catch { /* Older records remain usable without render settings. */ }
  // Undefined means this single-record request has not signed media yet. Null
  // means the batch already found an unavailable object: never sign it again or
  // expose a stale provider URL as a substitute for the private archived file.
  const videoUrl = job.storagePath
    ? signedUrl === undefined ? (await signedMediaBatch([job.storagePath])).get(job.storagePath) ?? null : signedUrl
    : job.videoUrl;
  return {
    id: job.id, prompt: job.prompt, model: job.model, aspectRatio: job.aspectRatio,
    duration: job.duration, status: job.status as Generation["status"],
    videoUrl, error: job.error, createdAt: job.createdAt.toISOString(), seed: job.seed,
    ...(sceneId ? { sceneId } : {}),
    ...(job.status === "completed" && !videoUrl ? { mediaUnavailable: true } : {}),
    ...(settings ? { settings } : {}),
  };
}

export async function publicGenerations(jobs: VideoGeneration[]) {
  const urls = await signedMediaBatch(jobs.flatMap((job) => job.storagePath ? [job.storagePath] : []));
  return Promise.all(jobs.map((job) => publicGeneration(job, job.storagePath ? urls.get(job.storagePath) ?? null : undefined)));
}

export const RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;
export function recoverablePollWhere(): Prisma.VideoGenerationWhereInput {
  return { status: "failed", failureCode: "render_timeout", createdAt: { gte: new Date(Date.now() - RECOVERY_WINDOW_MS) }, statusUrl: { not: null }, responseUrl: { not: null }, OR: [{ pollAfter: null }, { pollAfter: { lte: new Date() } }] };
}
export function isRecoverableTimeout(job: VideoGeneration) {
  return job.status === "failed" && job.failureCode === "render_timeout"
    && Date.now() - job.createdAt.getTime() <= RECOVERY_WINDOW_MS;
}
function timeout(job: VideoGeneration) {
  return finishGeneration(job, { status: "failed", failureCode: "render_timeout", error: "This render exceeded the one-hour limit. A late result can still be recovered for 24 hours from submission. Check your library before starting another take." });
}

export async function archiveCompletedGeneration(job: VideoGeneration, videoUrl: string) {
  const storagePath = await archiveVideo(videoUrl, job.workspaceId, job.id);
  try {
    const result = await finishGeneration(job, { status: "completed", videoUrl, storagePath });
    if (result.storagePath !== storagePath) await removeMedia([storagePath]);
    return result;
  } catch (error) {
    // A user may remove a timed-out record while the external upload finishes.
    // Only clean up after confirming deletion; an uncertain DB write may have
    // committed, so never delete media just because the database was unreachable.
    const current = await db.videoGeneration.findUnique({ where: { id: job.id } });
    if (!current) await removeMedia([storagePath]);
    throw error;
  }
}

export async function refreshGeneration(job: VideoGeneration) {
  const recovering = isRecoverableTimeout(job);
  if (!isActive(job.status) && !recovering) return job;
  const age = Date.now() - job.createdAt.getTime();
  const expired = age > 60 * 60 * 1000;
  if (age > RECOVERY_WINDOW_MS) return timeout(job);
  if (job.status === "submitting" || !job.statusUrl || !job.responseUrl) return expired && !recovering ? timeout(job) : job;
  // Check for a finished output before expiring an older task. A polling timeout
  // is not proof that inference failed (the SDKs expose these separately too).
  const claimed = await db.videoGeneration.updateMany({
    where: { id: job.id, OR: [{ status: { in: ["queued", "processing"] } }, { status: "failed", failureCode: "render_timeout" }], AND: [{ OR: [{ pollAfter: null }, { pollAfter: { lte: new Date() } }] }] },
    data: { pollAfter: new Date(Date.now() + 45000) },
  });
  if (!claimed.count) return (await db.videoGeneration.findUnique({ where: { id: job.id } }))!;
  let result;
  try { result = await checkGeneration(job.provider, job.statusUrl, job.responseUrl); }
  catch (error) {
    if (error instanceof ProviderError && (error.status === 410 || error.status === 422)) return finishGeneration(job, { status: "failed", failureCode: "provider_failed", error: error.message });
    if (recovering) return job;
    if (expired) return timeout(job);
    throw error;
  }
  if (!isActive(result.status)) {
    if (result.status === "completed" && "videoUrl" in result && result.videoUrl && mediaConfigured()) {
      try { return await archiveCompletedGeneration(job, result.videoUrl); }
      catch (error) {
        if (error instanceof ProviderError && error.status === 404) throw error;
        if (error instanceof ProviderError && error.status === 410) return finishGeneration(job, { status: "failed", failureCode: "invalid_media", error: error.message });
        if (recovering) return job;
        if (expired) return timeout(job);
        throw error;
      }
    }
    return finishGeneration(job, { ...result, ...(result.status === "failed" ? { failureCode: "provider_failed" } : {}) });
  }
  if (expired) return recovering ? job : timeout(job);
  await db.videoGeneration.updateMany({ where: { id: job.id, status: { in: result.status === "queued" ? ["queued"] : ["queued", "processing"] } }, data: result });
  return (await db.videoGeneration.findUnique({ where: { id: job.id } }))!;
}

export async function finishGeneration(job: VideoGeneration, data: { status: string; error?: string; failureCode?: string; videoUrl?: string; storagePath?: string }) {
  return db.$transaction(async (tx) => {
    const update = { ...data, pollAfter: null, failureCode: data.failureCode ?? null, ...(data.status === "completed" ? { error: null } : {}) };
    const changed = await tx.videoGeneration.updateMany({ where: { id: job.id, status: { in: ["submitting", "queued", "processing"] } }, data: update });
    if (changed.count) {
      await tx.studioWorkspace.updateMany({ where: { id: job.workspaceId, activeJobId: job.id }, data: { activeJobId: null } });
      if (job.quotaReserved) await releaseRender(tx);
    } else if (data.status === "completed") {
      // Timeout already released its reservation. Recover only a late success;
      // do not touch a newer active job or decrement global concurrency again.
      await tx.videoGeneration.updateMany({ where: { id: job.id, status: "failed", failureCode: "render_timeout", createdAt: { gte: new Date(Date.now() - RECOVERY_WINDOW_MS) } }, data: update });
    } else if (data.status === "failed" && data.failureCode && data.failureCode !== "render_timeout") {
      await tx.videoGeneration.updateMany({ where: { id: job.id, status: "failed", failureCode: "render_timeout" }, data: update });
    }
    const result = await tx.videoGeneration.findUnique({ where: { id: job.id } });
    if (!result) throw new ProviderError("This render was removed from your library.", 404);
    return result;
  });
}
