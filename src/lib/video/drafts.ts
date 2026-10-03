import { z } from "zod";
import { generationInput } from "./types";

export const sceneDraft = generationInput.pick({ prompt: true, seed: true, camera: true, style: true, duration: true, generateAudio: true, negativePrompt: true }).extend({
  ratio: z.enum(["16:9", "9:16", "1:1"]),
  duration: z.union([z.literal(5), z.literal(10)]).default(5),
});
export const savedScene = sceneDraft.extend({
  id: z.string().uuid(),
  title: z.string().trim().max(80).default(""),
});
export const editableDraft = sceneDraft.extend({ prompt: z.string().max(2500) });
export const storyboardFile = z.object({ version: z.literal(1), scenes: z.array(savedScene).max(12) });
export type SavedScene = z.infer<typeof savedScene>;
