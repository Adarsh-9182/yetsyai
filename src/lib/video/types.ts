import { z } from "zod";

export const VIDEO_MODEL = "Wan 2.2 · Open model";
export const MAX_REFERENCE_BYTES = 3 * 1024 * 1024;
export const ACTIVE_STATUSES = ["submitting", "queued", "processing"] as const;

export const generationInput = z.object({
  requestId: z.string().uuid(),
  prompt: z.string().trim().min(3, "Describe your scene in at least 3 characters.").max(2500),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  duration: z.union([z.literal(5), z.literal(10)]),
  generateAudio: z.boolean().default(false),
  negativePrompt: z.string().trim().max(500).default("blur, distort, and low quality"),
  referenceImage: z.string().max(Math.ceil(MAX_REFERENCE_BYTES / 3) * 4 + 64).optional(),
  assetId: z.string().uuid().optional(),
  seed: z.number().int().min(0).max(2147483647).default(42),
});

export type GenerationInput = z.infer<typeof generationInput>;
export type GenerationStatus = "submitting" | "queued" | "processing" | "completed" | "failed";
export type Generation = {
  id: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  duration: number;
  status: GenerationStatus;
  videoUrl: string | null;
  error: string | null;
  createdAt: string;
  seed: number;
};

export function isActive(status: string) {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}
