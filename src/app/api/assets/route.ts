import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, databaseConfigured } from "@/lib/video/db";
import { requireAccount } from "@/lib/video/auth";
import { ProviderError, validReferenceImage } from "@/lib/video/fal";
import { apiError, boundedJson } from "@/lib/video/http";
import { getWorkspace, isSameOrigin } from "@/lib/video/session";
import { mediaConfigured, signedMedia, uploadMedia, removeMedia } from "@/lib/video/storage";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (!databaseConfigured() || !mediaConfigured()) return NextResponse.json({ assets: [] });
    const workspace = await getWorkspace();
    const assets = workspace ? await db.studioAsset.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 20 }) : [];
    return NextResponse.json({ assets: await Promise.all(assets.map(async ({ path, workspaceId: _, ...asset }) => ({ ...asset, url: await signedMedia(path) }))) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new ProviderError("Upload references from your studio.", 403);
    await requireAccount();
    const workspace = await getWorkspace();
    if (!workspace) throw new ProviderError("Load your studio before uploading.", 401);
    const parsed = z.object({ name: z.string().trim().min(1).max(100), data: z.string().refine(validReferenceImage) }).safeParse(await boundedJson(request));
    if (!parsed.success) throw new ProviderError("Choose a valid JPG or PNG under 3 MB.", 400);
    const bytes = Buffer.from(parsed.data.data.split(",")[1], "base64");
    let metadata;
    try { metadata = await sharp(bytes, { limitInputPixels: 20000000 }).metadata(); }
    catch { throw new ProviderError("This image couldn't be opened. Use another JPG or PNG.", 400); }
    const { width = 0, height = 0 } = metadata;
    if (width < 300 || height < 300 || width / height > 2.5 || height / width > 2.5) throw new ProviderError("Use an image at least 300 × 300 px, with an aspect ratio between 2:5 and 5:2.", 400);
    const id = randomUUID();
    // Reserve the record before uploading so concurrent requests respect the cap.
    // Updating the workspace row serializes uploads across instances.
    const path = `${workspace.id}/references/${id}.${metadata.format === "png" ? "png" : "jpg"}`;
    await db.$transaction(async (tx) => {
      await tx.studioWorkspace.update({ where: { id: workspace.id }, data: { createdAt: workspace.createdAt } });
      if (await tx.studioAsset.count({ where: { workspaceId: workspace.id } }) >= 20) throw new ProviderError("Your reference library holds 20 images. Remove one to make room.", 429);
      await tx.studioAsset.create({ data: { id, workspaceId: workspace.id, name: parsed.data.name, path, width, height } });
    });
    try { await uploadMedia(path, bytes, metadata.format === "png" ? "image/png" : "image/jpeg"); }
    catch (error) { await db.studioAsset.delete({ where: { id } }); throw error; }
    return NextResponse.json({ asset: { id, name: parsed.data.name, width, height, url: await signedMedia(path) } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new ProviderError("Remove references from your studio.", 403);
    const workspace = await getWorkspace();
    const { id } = z.object({ id: z.string().uuid() }).parse(await boundedJson(request, 1024));
    const asset = workspace && await db.studioAsset.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!asset) throw new ProviderError("Reference not found.", 404);
    await removeMedia([asset.path]);
    await db.studioAsset.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) { return apiError(error); }
}
