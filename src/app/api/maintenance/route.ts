import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db, databaseConfigured } from "@/lib/video/db";
import { refreshGeneration } from "@/lib/video/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  const provided = request.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || Buffer.byteLength(expected) !== Buffer.byteLength(provided) || !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ skipped: true });
  const abandoned = await db.videoGeneration.findMany({ where: { status: { in: ["submitting", "queued", "processing"] }, createdAt: { lt: new Date(Date.now() - 3600000) } }, take: 100 });
  for (const job of abandoned) await refreshGeneration(job);
  const jobs = await db.videoGeneration.findMany({ where: { status: { in: ["queued", "processing"] } }, take: 1, orderBy: { createdAt: "asc" } });
  for (const job of jobs) { try { await refreshGeneration(job); } catch { /* A later callback/poll may recover a transient outage. */ } }
  await db.studioQuota.deleteMany({ where: { id: { not: "active" }, updatedAt: { lt: new Date(Date.now() - 7 * 86400000) } } });
  return NextResponse.json({ expired: abandoned.length, checked: jobs.length });
}
