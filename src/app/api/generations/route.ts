import { NextResponse } from "next/server";
import { db } from "@/lib/video/db";
import { ProviderError, providerConfigured, submitVideo, validReferenceImage } from "@/lib/video/fal";
import { apiError, boundedJson } from "@/lib/video/http";
import { publicGeneration } from "@/lib/video/jobs";
import { getWorkspace, isSameOrigin } from "@/lib/video/session";
import { generationInput, VIDEO_MODEL } from "@/lib/video/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspace = (await getWorkspace(true))!;
    const jobs = await db.videoGeneration.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ configured: providerConfigured(), generations: jobs.map(publicGeneration) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new ProviderError("Submit generations from your studio workspace.", 403);
    const workspace = await getWorkspace();
    if (!workspace) throw new ProviderError("Load the studio before creating a video.", 401);
    const parsed = generationInput.safeParse(await boundedJson(request));
    if (!parsed.success) throw new ProviderError(parsed.error.issues[0]?.message || "Check the generation settings.", 400);
    const input = parsed.data;
    if (input.referenceImage && !validReferenceImage(input.referenceImage)) throw new ProviderError("Choose a valid JPG or PNG reference image under 3 MB.", 400);
    const existing = await db.videoGeneration.findUnique({ where: { id: input.requestId } });
    if (existing) {
      if (existing.workspaceId !== workspace.id) throw new ProviderError("This request ID is already in use.", 409);
      return NextResponse.json({ generation: publicGeneration(existing) });
    }
    if (!providerConfigured()) throw new ProviderError("Video generation isn't configured yet. Add FAL_KEY to your server environment.", 503);

    const job = await db.$transaction(async (tx) => {
      const lock = await tx.studioWorkspace.updateMany({ where: { id: workspace.id, activeJobId: null }, data: { activeJobId: input.requestId } });
      if (lock.count === 0) throw new ProviderError("Your current video is still rendering. Wait for it to finish before creating another.", 409);
      return tx.videoGeneration.create({ data: {
        id: input.requestId, workspaceId: workspace.id, prompt: input.prompt, model: VIDEO_MODEL,
        duration: input.duration, aspectRatio: input.referenceImage ? "Reference image" : input.aspectRatio,
      } });
    });

    try {
      const provider = await submitVideo(input);
      const updated = await db.videoGeneration.update({ where: { id: job.id }, data: {
        status: "queued", providerRequestId: provider.requestId, statusUrl: provider.statusUrl, responseUrl: provider.responseUrl,
      } });
      return NextResponse.json({ generation: publicGeneration(updated) }, { status: 202 });
    } catch (error) {
      const message = error instanceof ProviderError ? error.message : "Submission confirmation was lost. Check your fal dashboard before trying again.";
      const failed = await db.videoGeneration.update({ where: { id: job.id }, data: { status: "failed", error: message } });
      await db.studioWorkspace.updateMany({ where: { id: workspace.id, activeJobId: job.id }, data: { activeJobId: null } });
      return NextResponse.json({ generation: publicGeneration(failed), error: message }, { status: error instanceof ProviderError ? error.status : 502 });
    }
  } catch (error) { return apiError(error); }
}
