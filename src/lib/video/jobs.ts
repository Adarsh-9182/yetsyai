import type { VideoGeneration } from "@prisma/client";
import { db } from "./db";
import { checkVideo } from "./fal";
import { Generation, isActive } from "./types";

export function publicGeneration(job: VideoGeneration): Generation {
  return {
    id: job.id, prompt: job.prompt, model: job.model, aspectRatio: job.aspectRatio,
    duration: job.duration, status: job.status as Generation["status"],
    videoUrl: job.videoUrl, error: job.error, createdAt: job.createdAt.toISOString(),
  };
}

export async function refreshGeneration(job: VideoGeneration) {
  if (!isActive(job.status)) return job;
  if (job.status === "submitting") {
    if (Date.now() - job.createdAt.getTime() < 120000) return job;
    const updated = await db.videoGeneration.update({ where: { id: job.id }, data: {
      status: "failed", error: "Submission confirmation was lost. Check your fal dashboard before submitting again.",
    } });
    await db.studioWorkspace.updateMany({ where: { id: job.workspaceId, activeJobId: job.id }, data: { activeJobId: null } });
    return updated;
  }
  if (!job.statusUrl || !job.responseUrl) return job;
  const result = await checkVideo(job.statusUrl, job.responseUrl);
  // Conditional update avoids an older poll overwriting a newer terminal result.
  await db.videoGeneration.updateMany({ where: { id: job.id, status: { in: ["queued", "processing"] } }, data: result });
  if (!isActive(result.status)) {
    await db.studioWorkspace.updateMany({ where: { id: job.workspaceId, activeJobId: job.id }, data: { activeJobId: null } });
  }
  return (await db.videoGeneration.findUnique({ where: { id: job.id } }))!;
}
