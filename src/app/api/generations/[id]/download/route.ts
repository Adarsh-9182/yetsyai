import { NextResponse } from "next/server";
import { db } from "@/lib/video/db";
import { ProviderError } from "@/lib/video/fal";
import { validVideoUrl, mediaHeaders } from "@/lib/video/provider";
import { signedMedia } from "@/lib/video/storage";
import { apiError } from "@/lib/video/http";
import { getWorkspace } from "@/lib/video/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const workspace = await getWorkspace();
    const job = workspace && await db.videoGeneration.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!job) return NextResponse.json({ error: "Video not found in your workspace." }, { status: 404 });
    if (job.status !== "completed" || (!job.storagePath && (!job.videoUrl || !validVideoUrl(job.videoUrl)))) throw new ProviderError("This video isn't ready to download yet.", 409);
    const videoUrl = job.storagePath ? await signedMedia(job.storagePath) : job.videoUrl!;
    let video: Response;
    try {
      video = await fetch(videoUrl, { headers: job.storagePath ? {} : mediaHeaders(videoUrl), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
    } catch { throw new ProviderError("Couldn't reach the video download. Please try again shortly."); }
    if (!video.ok || !video.body) throw new ProviderError("This video link has expired or is temporarily unavailable.", 410);
    const headers = new Headers({
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="yetsyai-${job.id}.mp4"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (video.headers.get("content-length")) headers.set("Content-Length", video.headers.get("content-length")!);
    return new Response(video.body, { headers });
  } catch (error) { return apiError(error); }
}
