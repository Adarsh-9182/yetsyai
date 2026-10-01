import { NextResponse } from "next/server";
import { db } from "@/lib/video/db";
import { apiError } from "@/lib/video/http";
import { publicGeneration, refreshGeneration } from "@/lib/video/jobs";
import { getWorkspace } from "@/lib/video/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const workspace = await getWorkspace();
    const job = workspace && await db.videoGeneration.findFirst({ where: { id: params.id, workspaceId: workspace.id } });
    if (!job) return NextResponse.json({ error: "Video not found in your workspace." }, { status: 404 });
    return NextResponse.json({ generation: publicGeneration(await refreshGeneration(job)) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
