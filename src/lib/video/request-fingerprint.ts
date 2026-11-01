import { createHash } from "node:crypto";
import type { GenerationInput } from "./types";

/** Receives generationInput.parse() output so omitted defaults are canonical. */
export function generationRequestFingerprint(input: GenerationInput) {
  // Keep encoded image content out of the database. Asset IDs name immutable
  // uploads; include both identities when both fields were explicitly supplied.
  const reference = input.referenceImage ? createHash("sha256").update(input.referenceImage).digest("hex") : null;
  const canonical = JSON.stringify([
    "generation-request-v1", input.prompt, input.aspectRatio, input.duration,
    input.generateAudio, input.negativePrompt, input.seed, input.camera, input.style,
    input.assetId ?? null, reference,
  ]);
  return `v1:${createHash("sha256").update(canonical).digest("hex")}`;
}
