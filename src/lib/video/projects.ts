import { z } from "zod";
import { savedScene } from "./drafts";

export const projectInput = z.object({
  id: z.string().uuid(),
  revision: z.number().int().min(0).max(2147483646),
  title: z.string().trim().min(1).max(80),
  scenes: z.array(savedScene).max(12).refine(scenes => new Set(scenes.map(scene => scene.id)).size === scenes.length, "Shot IDs must be unique."),
});
export const projectIdentity = projectInput.pick({ id: true, revision: true });
export type ProjectSummary = { id: string; title: string; sceneCount: number; revision: number; createdAt: string; updatedAt: string };
export type SavedProject = ProjectSummary & { scenes: z.infer<typeof savedScene>[] };
