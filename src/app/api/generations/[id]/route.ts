import { NextResponse } from "next/server";
import { db } from "@/lib/video/db";
import { apiError } from "@/lib/video/http";
import { publicGeneration, refreshGeneration } from "@/lib/video/jobs";
import { getWorkspace } from "@/lib/video/session";
import { isSameOrigin } from "@/lib/video/session";
import { ProviderError } from "@/lib/video/fal";
import { isActive } from "@/lib/video/types";
import { removeMedia, mediaConfigured } from "@/lib/video/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const workspace = await getWorkspace();
    const job = workspace && await db.videoGeneration.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!job) return NextResponse.json({ error: "Video not found in your workspace." }, { status: 404 });
    return NextResponse.json({ generation: await publicGeneration(await refreshGeneration(job)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOrigin(request)) throw new ProviderError("Delete videos from your studio.", 403);
    const { id } = await params;
    const workspace = await getWorkspace();
    const job = workspace && await db.videoGeneration.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!job) throw new ProviderError("Video not found.", 404);
    if (isActive(job.status)) throw new ProviderError("Wait for this render to finish before deleting it.", 409);
    // Claim the unchanged row before touching storage. A concurrent completion
    // either wins this comparison or waits for deletion, then cleans its upload.
    // Storage failure rolls the deletion back so the user can retry it.
    await db.$transaction(async tx => {
      const deleted = await tx.videoGeneration.deleteMany({ where: { id: job.id, workspaceId: job.workspaceId, status: job.status, storagePath: job.storagePath, failureCode: job.failureCode } });
      if (!deleted.count) throw new ProviderError("This render changed while it was being removed. Refresh your library before retrying.", 409);
      if (job.storagePath || mediaConfigured()) await removeMedia([job.storagePath || `${job.workspaceId}/videos/${job.id}.mp4`]);
    }, { timeout: 20000 });
    return NextResponse.json({ deleted: true });
  } catch (error) { return apiError(error); }
}
