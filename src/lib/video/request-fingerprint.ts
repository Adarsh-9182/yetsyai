import { createHash } from "node:crypto";
import type { GenerationInput } from "./types";

/** Receives generationInput.parse() output so omitted defaults are canonical. */
export function generationRequestFingerprint(input: GenerationInput) {
  // Keep encoded image content out of the database. Asset IDs name immutable
  // uploads; include both identities when both fields were explicitly supplied.
  const reference = input.referenceImage ? createHash("sha256").update(input.referenceImage).digest("hex") : null;
  // Preserve existing v1 retries. Linked storyboard takes use v2 so the same
  // UUID cannot silently move a render to a different shot.
  const version = input.sceneId ? "v2" : "v1";
  const canonical = JSON.stringify([
    `generation-request-${version}`, input.prompt, input.aspectRatio, input.duration,
    input.generateAudio, input.negativePrompt, input.seed, input.camera, input.style,
    input.assetId ?? null, reference, ...(input.sceneId ? [input.sceneId] : []),
  ]);
  return `${version}:${createHash("sha256").update(canonical).digest("hex")}`;
}
