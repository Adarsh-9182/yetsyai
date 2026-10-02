const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } });
  module._compile(outputText, filename);
};
process.env.VIDEO_PROVIDER = "huggingface";
process.env.HF_SPACE_URL = "https://yetsyai-test.hf.space";
process.env.HF_TOKEN = "fake-test-token";
process.env.HF_STUDIO_SECRET = "test-only-secret-with-more-than-32-characters";
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; });
const { checkGeneration, submitGeneration, providerConfigured } = require("../src/lib/video/provider.ts");
const { compileScene, cameraDirections, sceneAdvice } = require("../src/lib/video/direction.ts");
const { storyboardFile, editableDraft } = require("../src/lib/video/drafts.ts");
const url = "https://yetsyai-test.hf.space/gradio_api/call/generate/test-event";

test("free backend sends authenticated requests without enabling paid inference", async () => {
  process.env.FAL_KEY = "a-leftover-key";
  let calls = 0;
  global.fetch = async (value, options) => {
    calls++; assert.equal(new URL(value).origin, "https://yetsyai-test.hf.space");
    assert.equal(options.headers.Authorization, "Bearer fake-test-token");
    assert.equal(options.redirect, "error");
    assert.equal(JSON.parse(options.body).data[2], "A sunlit forest");
    return Response.json({ event_id: "test-event" });
  };
  assert.equal(providerConfigured(), true);
  const originalSecret = process.env.HF_STUDIO_SECRET;
  process.env.HF_STUDIO_SECRET = "too-short";
  assert.equal(providerConfigured(), false, "The app and worker must agree about secret requirements");
  process.env.HF_STUDIO_SECRET = originalSecret;
  const input = { requestId: "d245349a-e031-4dd9-9897-6fa69270c459", prompt: "A sunlit forest", aspectRatio: "16:9", duration: 5, generateAudio: false, seed: 42, negativePrompt: "blur" };
  assert.equal((await submitGeneration(input)).statusUrl, url);
  await assert.rejects(submitGeneration({ ...input, generateAudio: true }), /silent clips/);
  assert.equal(calls, 1);
});

test("HF streaming results handle split events, heartbeats and valid videos", async () => {
  const valid = JSON.stringify([{ video: { url: "https://yetsyai-test.hf.space/gradio_api/file=outputs/a.mp4" } }]);
  global.fetch = async () => new Response(new ReadableStream({ start(controller) {
    for (const part of ["event: comp", `lete\r\ndata: ${valid}\r`, "\n\r\n"]) controller.enqueue(new TextEncoder().encode(part));
    controller.close();
  } }));
  assert.equal((await checkGeneration("huggingface", url, url)).status, "completed");
  global.fetch = async () => new Response("event: heartbeat\ndata: null\n\n");
  assert.equal((await checkGeneration("huggingface", url, url)).status, "processing");
});

test("malformed, empty and foreign-host results cannot complete a render", async () => {
  for (const payload of ["[]", "not-json", '[{"video":{"url":"https://attacker.example/file.mp4"}}]']) {
    global.fetch = async () => new Response(`event: complete\ndata: ${payload}\n\n`);
    await assert.rejects(checkGeneration("huggingface", url, url), (error) => error.status === 410);
  }
  global.fetch = async () => new Response("Restarted", { status: 404 });
  await assert.rejects(checkGeneration("huggingface", url, url), (error) => error.status === 410);
});

test("legacy camera suffixes are replaced rather than repeated", () => {
  const staticDirection = cameraDirections.find((item) => item.id === "static").detail;
  const result = compileScene(`A forest. ${staticDirection} ${staticDirection}`, "push");
  assert.doesNotMatch(result, /Locked-off/);
  assert.equal((result.match(/camera push in/g) || []).length, 1);
  assert.equal(compileScene("  A tracking shot at sunrise.  "), "A tracking shot at sunrise.");
  assert.ok(sceneAdvice("A person, then cut to a different city").some((tip) => tip.includes("Split")));
});

test("storyboard imports reject corrupt settings and preserve older drafts", () => {
  const scene = { id: "d245349a-e031-4dd9-9897-6fa69270c459", prompt: "A calm ocean", ratio: "16:9", seed: 42 };
  const parsed = storyboardFile.parse({ version: 1, scenes: [scene] });
  assert.equal(parsed.scenes[0].camera, "auto");
  assert.equal(parsed.scenes[0].duration, 5);
  assert.equal(editableDraft.safeParse({ ...scene, prompt: "" }).success, true);
  for (const extra of [{ seed: -1 }, { ratio: "3:2" }, { camera: "bad" }, { prompt: "" }]) assert.equal(storyboardFile.safeParse({ version: 1, scenes: [{ ...scene, ...extra }] }).success, false);
  assert.equal(storyboardFile.safeParse({ version: 1, scenes: Array(13).fill(scene) }).success, false);
});

test("library media is signed in one batch without public URLs", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-studio.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-key";
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(new URL(url).origin, "https://test-studio.supabase.co");
    assert.match(new URL(url).pathname, /object\/sign\/studio-media$/);
    const payload = JSON.parse(options.body);
    assert.deepEqual(payload.paths, ["owner/videos/a.mp4", "owner/videos/b.mp4"]);
    return Response.json(payload.paths.map((path) => ({ path, signedURL: `/object/sign/studio-media/${path}?token=test-token`, error: null })));
  };
  try {
    const { signedMediaBatch } = require("../src/lib/video/storage.ts");
    const result = await signedMediaBatch(["owner/videos/a.mp4", "owner/videos/b.mp4", "owner/videos/a.mp4"]);
    assert.equal(calls, 1);
    assert.equal(result.size, 2);
    assert.match(result.get("owner/videos/a.mp4"), /token=test-token/);
    await signedMediaBatch([]);
    assert.equal(calls, 1, "An empty library must not call storage");
  } finally { delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
});
