import { NextResponse } from "next/server";
import sharp from "sharp";
import { db, databaseConfigured } from "@/lib/video/db";
import { ProviderError, validReferenceImage } from "@/lib/video/fal";
import { modelName, providerConfigured, providerName, submitGeneration } from "@/lib/video/provider";
import { requireAccount, currentUser, authConfigured } from "@/lib/video/auth";
import { mediaConfigured, readAsset } from "@/lib/video/storage";
import { reserveRender, usage } from "@/lib/video/limits";
import { apiError, boundedJson } from "@/lib/video/http";
import { publicGeneration, publicGenerations, refreshGeneration, finishGeneration } from "@/lib/video/jobs";
import { getWorkspace, isSameOrigin } from "@/lib/video/session";
import { generationInput } from "@/lib/video/types";
import { compileScene } from "@/lib/video/direction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const user = await currentUser();
    const capabilities = { model: modelName(), provider: providerName(), durations: providerName() === "fal" ? [5, 10] : [5], audio: providerName() === "fal", image: providerName() === "fal", authConfigured: authConfigured(), signedIn: Boolean(user), mediaConfigured: mediaConfigured(), configuration: { accounts: authConfigured(), database: databaseConfigured(), media: mediaConfigured(), generation: providerConfigured() } };
    if (!databaseConfigured()) return NextResponse.json({ ...capabilities, configured: false, storageConfigured: false, generations: [], usage: { used: 0, limit: 2 } }, { headers: { "Cache-Control": "private, no-store" } });
    const configured = providerConfigured() && authConfigured() && mediaConfigured();
    if (!user && process.env.NODE_ENV === "production") return NextResponse.json({ ...capabilities, configured, storageConfigured: true, generations: [], usage: { used: 0, limit: 2 } }, { headers: { "Cache-Control": "private, no-store" } });
    const workspace = (await getWorkspace(true))!;
    const stale = await db.videoGeneration.findMany({ where: { workspaceId: workspace.id, status: { in: ["submitting", "queued", "processing"] }, createdAt: { lt: new Date(Date.now() - 3600000) } }, take: 10 });
    for (const job of stale) await refreshGeneration(job);
    const jobs = await db.videoGeneration.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ ...capabilities, configured, storageConfigured: true, generations: await publicGenerations(jobs), usage: await usage(workspace.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new ProviderError("Submit generations from your studio workspace.", 403);
    if (!databaseConfigured()) throw new ProviderError("Connect a PostgreSQL database before creating a video.", 503);
    await requireAccount();
    const workspace = await getWorkspace();
    if (!workspace) throw new ProviderError("Load the studio before creating a video.", 401);
    const parsed = generationInput.safeParse(await boundedJson(request));
    if (!parsed.success) throw new ProviderError(parsed.error.issues[0]?.message || "Check the generation settings.", 400);
    const input = parsed.data;
    const directedPrompt = compileScene(input.prompt, input.camera, input.style);
    if (directedPrompt.length > 2500) throw new ProviderError("Shorten your scene to leave room for camera and style directions (2500 characters total).", 400);
    if (input.assetId) {
      const asset = await db.studioAsset.findFirst({ where: { id: input.assetId, workspaceId: workspace.id } });
      if (!asset) throw new ProviderError("Reference image not found in your library.", 404);
      input.referenceImage = await readAsset(asset.path);
    }
    if (input.referenceImage && !validReferenceImage(input.referenceImage)) throw new ProviderError("Choose a valid JPG or PNG reference image under 3 MB.", 400);
    if (input.referenceImage) {
      let metadata;
      try { metadata = await sharp(Buffer.from(input.referenceImage.split(",")[1], "base64"), { limitInputPixels: 20000000 }).metadata(); }
      catch { throw new ProviderError("This reference image couldn't be decoded. Choose another JPG or PNG.", 400); }
      const { width = 0, height = 0 } = metadata;
      if (width < 300 || height < 300 || width / height > 2.5 || height / width > 2.5) throw new ProviderError("Use a reference at least 300 × 300 px, with an aspect ratio between 2:5 and 5:2.", 400);
    }
    const existing = await db.videoGeneration.findUnique({ where: { id: input.requestId } });
    if (existing) {
      if (existing.workspaceId !== workspace.id) throw new ProviderError("This request ID is already in use.", 409);
      return NextResponse.json({ generation: await publicGeneration(existing), usage: await usage(workspace.id) });
    }
    if (!providerConfigured()) throw new ProviderError("The studio's video service is being connected. Save a draft and check back soon.", 503);
    if (providerName() === "huggingface" && !mediaConfigured()) throw new ProviderError("The studio's saved-video storage is being connected. Please try later.", 503);
    if (providerName() !== "fal" && (input.referenceImage || input.duration !== 5 || input.generateAudio)) throw new ProviderError("Free generation currently supports text prompts, 5 seconds and no audio.", 400);
    // Recover abandoned locks even when the originating browser never returns.
    const abandoned = await db.videoGeneration.findMany({ where: { status: { in: ["submitting", "queued", "processing"] }, createdAt: { lt: new Date(Date.now() - 3600000) } }, take: 20 });
    for (const old of abandoned) await refreshGeneration(old);

    const job = await db.$transaction(async (tx) => {
      const lock = await tx.studioWorkspace.updateMany({ where: { id: workspace.id, activeJobId: null }, data: { activeJobId: input.requestId } });
      if (lock.count === 0) throw new ProviderError("Your current video is still rendering. Wait for it to finish before creating another.", 409);
      await reserveRender(tx, workspace.id);
      if (await tx.videoGeneration.count({ where: { workspaceId: workspace.id } }) >= 50) throw new ProviderError("Your library holds 50 videos. Delete an older video to make room.", 429);
      return tx.videoGeneration.create({ data: {
        id: input.requestId, workspaceId: workspace.id, prompt: input.prompt, model: modelName(), provider: providerName(), seed: input.seed, quotaReserved: true,
        settings: JSON.stringify({ camera: input.camera, style: input.style, negativePrompt: input.negativePrompt, generateAudio: input.generateAudio }),
        duration: input.duration, aspectRatio: input.referenceImage ? "Reference image" : input.aspectRatio,
      } });
    });

    try {
      const provider = await submitGeneration({ ...input, prompt: directedPrompt });
      await db.videoGeneration.updateMany({ where: { id: job.id, status: "submitting" }, data: {
        status: "queued", providerRequestId: provider.requestId, statusUrl: provider.statusUrl, responseUrl: provider.responseUrl,
      } });
      const updated = (await db.videoGeneration.findUnique({ where: { id: job.id } }))!;
      return NextResponse.json({ generation: await publicGeneration(updated), usage: await usage(workspace.id) }, { status: 202 });
    } catch (error) {
      const message = error instanceof ProviderError ? error.message : "Submission confirmation was lost. Check your library before trying again.";
      const uncertain = !(error instanceof ProviderError) || error.uncertain;
      let failed;
      if (uncertain) {
        // A completion webhook may arrive before submission returns. Preserve it.
        await db.videoGeneration.updateMany({ where: { id: job.id, status: "submitting" }, data: { error: "Submission confirmation was interrupted. We are holding this render to avoid a duplicate. Check back later." } });
        failed = (await db.videoGeneration.findUnique({ where: { id: job.id } }))!;
      } else failed = await finishGeneration(job, { status: "failed", error: message });
      if (failed.status === "completed") return NextResponse.json({ generation: await publicGeneration(failed) });
      return NextResponse.json({ generation: await publicGeneration(failed), error: message }, { status: uncertain ? 202 : error instanceof ProviderError ? error.status : 502 });
    }
  } catch (error) { return apiError(error); }
}
