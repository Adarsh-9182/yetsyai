import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db, databaseConfigured } from "@/lib/video/db";
import { refreshGeneration, recoverablePollWhere } from "@/lib/video/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  const provided = request.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || Buffer.byteLength(expected) !== Buffer.byteLength(provided) || !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ skipped: true });
  // One provider check per invocation bounds serverless work. Timed-out tasks
  // remain eligible for output recovery; inference is never re-submitted.
  const active = await db.videoGeneration.findMany({ where: { status: { in: ["submitting", "queued", "processing"] }, OR: [{ pollAfter: null }, { pollAfter: { lte: new Date() } }] }, take: 1, orderBy: { createdAt: "asc" } });
  const jobs = active.length ? active : await db.videoGeneration.findMany({ where: recoverablePollWhere(), take: 1, orderBy: { createdAt: "asc" } });
  let recovered = 0; let expired = 0;
  for (const job of jobs) { try { const result = await refreshGeneration(job); if (job.status === "failed" && result.status === "completed") recovered++; if (job.status !== "failed" && result.failureCode === "render_timeout") expired++; } catch { /* A later callback/poll may recover a transient outage. */ } }
  await db.studioQuota.deleteMany({ where: { id: { not: "active" }, updatedAt: { lt: new Date(Date.now() - 7 * 86400000) } } });
  return NextResponse.json({ expired, recovered, checked: jobs.length });
}
