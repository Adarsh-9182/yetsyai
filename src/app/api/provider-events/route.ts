import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/video/db";
import { ProviderError } from "@/lib/video/fal";
import { validVideoUrl } from "@/lib/video/provider";
import { finishGeneration } from "@/lib/video/jobs";
import { apiError } from "@/lib/video/http";
import { archiveVideo } from "@/lib/video/storage";
import { isActive } from "@/lib/video/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const timestamp = request.headers.get("x-studio-timestamp") || "";
    const signature = request.headers.get("x-studio-signature") || "";
    const secret = process.env.HF_STUDIO_SECRET;
    if (!secret || !/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/.test(signature)) throw new ProviderError("Invalid provider signature.", 401);
    if (Number(request.headers.get("content-length")) > 8192) throw new ProviderError("Event is too large.", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new ProviderError("Empty event.", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 8192) throw new ProviderError("Event is too large.", 413); chunks.push(value); } }
    finally { await reader.cancel().catch(() => {}); }
    const body = Buffer.concat(chunks).toString("utf8");
    const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new ProviderError("Invalid provider signature.", 401);
    const event = z.object({ id: z.string().uuid(), status: z.enum(["completed", "failed"]), videoUrl: z.string().url().refine(validVideoUrl).optional() }).parse(JSON.parse(body));
    const job = await db.videoGeneration.findUnique({ where: { id: event.id } });
    if (!job || job.provider !== "huggingface") throw new ProviderError("Render not found.", 404);
    if (!isActive(job.status)) return NextResponse.json({ accepted: true });
    if (event.status === "completed" && event.videoUrl) {
      const storagePath = await archiveVideo(event.videoUrl, job.workspaceId, job.id);
      await finishGeneration(job, { status: "completed", videoUrl: event.videoUrl, storagePath });
    } else if (event.status === "failed") {
      await finishGeneration(job, { status: "failed", error: "The free GPU couldn't finish this scene. Its quota may be exhausted. Please try later." });
    } else throw new ProviderError("Missing video.", 400);
    return NextResponse.json({ accepted: true });
  } catch (error) { return apiError(error); }
}
