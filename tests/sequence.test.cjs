const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { savedScene, storyboardFile } = require("../src/lib/video/drafts.ts");
const { projectInput } = require("../src/lib/video/projects.ts");
const { resolveSequence } = require("../src/lib/video/sequence.ts");
const scene = extra => savedScene.parse({ id: randomUUID(), prompt: "A calm sea in morning light", ratio: "16:9", ...extra });
const clip = (shot, extra = {}) => ({ id: shot.preferredGenerationId, sceneId: shot.id, status: "completed", videoUrl: "https://private.example/signed-fixture.mp4", duration: 5, ...extra });

test("preferred takes survive project and storyboard round trips without media URLs", () => {
  const legacy = scene();
  const chosen = scene({ preferredGenerationId: randomUUID() });
  const project = projectInput.parse({ id: randomUUID(), revision: 1, title: "My sequence", scenes: [legacy, chosen] });
  const reopened = storyboardFile.parse(JSON.parse(JSON.stringify({ version: 1, scenes: project.scenes })));
  assert.equal(reopened.scenes[0].preferredGenerationId, undefined);
  assert.equal(reopened.scenes[1].preferredGenerationId, chosen.preferredGenerationId);
  assert.equal(JSON.stringify(reopened).includes("https://"), false);
  assert.equal(savedScene.safeParse({ ...chosen, preferredGenerationId: "https://other.example/private.mp4" }).success, false);
});

test("sequence uses explicit preferred takes in storyboard order, independent of library order", () => {
  const first = scene({ preferredGenerationId: randomUUID() }), second = scene({ preferredGenerationId: randomUUID() });
  const a = clip(first), b = clip(second), unused = clip(first, { id: randomUUID() });
  const result = resolveSequence([second, first], [unused, a, b]);
  assert.deepEqual(result.map(shot => shot.generation.id), [b.id, a.id]);
  assert.deepEqual(result.map(shot => shot.scene.id), [second.id, first.id]);
});

test("unowned, cross-shot, active, failed and missing-media takes cannot enter a sequence", () => {
  const shot = scene({ preferredGenerationId: randomUUID() });
  for (const candidates of [[], [clip(shot, { sceneId: randomUUID() })], [clip(shot, { status: "processing" })], [clip(shot, { status: "failed" })], [clip(shot, { videoUrl: null, mediaUnavailable: true })]]) {
    assert.equal(resolveSequence([shot], candidates)[0].generation, null);
  }
  assert.equal(shot.preferredGenerationId !== undefined, true, "Unavailable choices retain editable project metadata");
});

test("a missing or unselected take never falls back silently to the latest render", () => {
  const shot = scene({ preferredGenerationId: randomUUID() });
  const newer = clip(shot, { id: randomUUID() });
  assert.equal(resolveSequence([shot], [newer])[0].generation, null);
  assert.equal(resolveSequence([{ ...shot, preferredGenerationId: undefined }], [newer])[0].generation, null);
});
