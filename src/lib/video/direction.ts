// Shot direction is deterministic and free. Video inference remains at the provider.
export const cameraDirections = [
  { id: "auto", name: "Follow prompt", detail: "" },
  { id: "static", name: "Static", detail: "Locked-off camera, subtle natural motion, one continuous shot." },
  { id: "push", name: "Push in", detail: "A slow, smooth camera push in toward the subject, one continuous shot." },
  { id: "orbit", name: "Orbit", detail: "A gentle camera orbit around the subject, steady movement, one continuous shot." },
  { id: "handheld", name: "Handheld", detail: "Intimate handheld camera with subtle drift, documentary feel, one continuous shot." },
] as const;
export const visualStyles = [
  { id: "original", name: "Your vision", detail: "" },
  { id: "cinema", name: "Cinema", detail: "Cinematic composition, soft directional lighting, restrained film grain." },
  { id: "product", name: "Product", detail: "Clean product-film composition, controlled studio lighting, crisp material detail." },
  { id: "dream", name: "Dreamscape", detail: "Atmospheric composition, soft diffused light, an ethereal color palette." },
] as const;
export type CameraDirection = typeof cameraDirections[number]["id"];
export type VisualStyle = typeof visualStyles[number]["id"];
export function compileScene(prompt: string, camera: CameraDirection = "auto", style: VisualStyle = "original") {
  let scene = prompt.trim();
  // Older videos stored appended camera instructions in the prompt.
  if (camera !== "auto") {
    let previous: string;
    do {
      previous = scene;
      for (const direction of cameraDirections) if (direction.detail && scene.endsWith(direction.detail)) scene = scene.slice(0, -direction.detail.length).trim();
    } while (previous !== scene);
  }
  return [scene, cameraDirections.find((item) => item.id === camera)?.detail, visualStyles.find((item) => item.id === style)?.detail].filter(Boolean).join(" ");
}
export function sceneAdvice(prompt: string) {
  const text = prompt.trim();
  if (!text) return ["Start with a subject and one visible action."];
  const advice: string[] = [];
  if (!/\b(light|lighting|sun|sunset|sunrise|night|shadow|golden|blue hour|lit|glow|neon)\b/i.test(text)) advice.push("Describe the lighting: warm studio light, blue hour, or soft daylight.");
  if (/\b(then|cut to|montage|multiple scenes|scene 2)\b/i.test(text)) advice.push("Split scene changes into separate storyboard shots for a short clip.");
  if (text.split(/\s+/).length > 100) advice.push("Simplify the scene. A clear subject and one action are easier to direct.");
  if (/\b(text|logo|lettering|subtitle)\b/i.test(text)) advice.push("Add precise lettering during editing; generated text can be inconsistent.");
  return advice.slice(0, 2);
}
