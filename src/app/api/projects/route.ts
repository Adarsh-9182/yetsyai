import { NextResponse } from "next/server";
import { db, databaseConfigured } from "@/lib/video/db";
import { currentUser } from "@/lib/video/auth";
import { getWorkspace, isSameOrigin } from "@/lib/video/session";
import { ProviderError } from "@/lib/video/fal";
import { apiError, boundedJson } from "@/lib/video/http";
import { projectIdentity, projectInput } from "@/lib/video/projects";
import { storyboardFile } from "@/lib/video/drafts";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const summary = { id: true, title: true, sceneCount: true, revision: true, createdAt: true, updatedAt: true } as const;

async function owner() {
  const user = await currentUser();
  if (!user || !user.email_confirmed_at) throw new ProviderError("Sign in with a confirmed account to save projects.", 401);
  if (!databaseConfigured()) throw new ProviderError("Project storage is being connected. Keep your local storyboard or export it.", 503);
  const workspace = await getWorkspace();
  if (!workspace || workspace.userId !== user.id) throw new ProviderError("Sign in again to open your projects.", 401);
  return { workspace, user };
}

export async function GET(request: Request) {
  try {
    const { workspace, user } = await owner();
    const id = new URL(request.url).searchParams.get("id");
    if (id !== null) {
      const parsedId = projectIdentity.shape.id.parse(id);
      const project = await db.studioProject.findFirst({ where: { id: parsedId, workspaceId: workspace.id }, select: { ...summary, scenes: true } });
      if (!project) throw new ProviderError("Project not found in your account.", 404);
      const scenes = storyboardFile.parse({ version: 1, scenes: JSON.parse(project.scenes) }).scenes;
      return NextResponse.json({ project: { ...project, scenes }, owner: user.id }, { headers });
    }
    const projects = await db.studioProject.findMany({ where: { workspaceId: workspace.id }, select: summary, orderBy: { updatedAt: "desc" }, take: 20 });
    return NextResponse.json({ projects, owner: user.id }, { headers });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new ProviderError("Save projects from your studio.", 403);
    const { workspace } = await owner();
    const data = projectInput.parse(await boundedJson(request, 256 * 1024, "This project is too large. Use up to 12 shots with shorter prompts."));
    const scenes = JSON.stringify(data.scenes);
    const project = await db.$transaction(async tx => {
      if (data.revision === 0) {
        // Serialize project creation per account so the cap holds across instances.
        await tx.studioWorkspace.update({ where: { id: workspace.id }, data: { createdAt: workspace.createdAt } });
        const existing = await tx.studioProject.findUnique({ where: { id: data.id } });
        if (existing) {
          if (existing.workspaceId === workspace.id && existing.revision === 1 && existing.title === data.title && existing.scenes === scenes) {
            const { scenes: _, workspaceId: __, ...result } = existing;
            return result; // Recover a lost creation response without creating a duplicate.
          }
          throw new ProviderError("This project changed. Open its latest version or save your work as a new project.", 409);
        }
        if (await tx.studioProject.count({ where: { workspaceId: workspace.id } }) >= 20) throw new ProviderError("Your account holds 20 projects. Remove one before saving another.", 429);
        return tx.studioProject.create({ data: { id: data.id, workspaceId: workspace.id, title: data.title, scenes, sceneCount: data.scenes.length }, select: summary });
      }
      const updated = await tx.studioProject.updateMany({ where: { id: data.id, workspaceId: workspace.id, revision: data.revision }, data: { title: data.title, scenes, sceneCount: data.scenes.length, revision: { increment: 1 } } });
      if (!updated.count) throw new ProviderError("This project changed or was removed. Open its latest version or save your work as a new project.", 409);
      return tx.studioProject.findFirstOrThrow({ where: { id: data.id, workspaceId: workspace.id }, select: summary });
    });
    return NextResponse.json({ project }, { headers });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new ProviderError("Remove projects from your studio.", 403);
    const { workspace } = await owner();
    const { id, revision } = projectIdentity.parse(await boundedJson(request, 1024, "This project removal request is too large."));
    const deleted = await db.studioProject.deleteMany({ where: { id, workspaceId: workspace.id, revision } });
    if (!deleted.count) throw new ProviderError("This project changed or was removed. Refresh the project list before removing it.", 409);
    return NextResponse.json({ deleted: true }, { headers });
  } catch (error) { return apiError(error); }
}
