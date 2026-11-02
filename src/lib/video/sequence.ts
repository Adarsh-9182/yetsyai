import type { SavedScene } from "./drafts";
import type { Generation } from "./types";

export type SequenceShot = { scene: SavedScene; generation: Generation | null };

// Resolve against the current account's library, never a URL or an arbitrary ID
// fetched from an imported storyboard. A chosen take must still belong to its
// source shot and be playable; missing/deleted choices remain editable metadata.
export function resolveSequence(scenes: SavedScene[], generations: Generation[]): SequenceShot[] {
  const owned = new Map(generations.map(generation => [generation.id, generation]));
  return scenes.map(scene => {
    const chosen = scene.preferredGenerationId ? owned.get(scene.preferredGenerationId) : undefined;
    const generation = chosen?.sceneId === scene.id && chosen.status === "completed" && chosen.videoUrl ? chosen : null;
    return { scene, generation };
  });
}
