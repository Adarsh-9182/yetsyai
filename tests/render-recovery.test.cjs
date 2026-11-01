const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { randomUUID, createHmac } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "yetsyai-recovery-"));
process.env.DATABASE_URL = `file:${path.join(temp, "test.db")}`;
process.env.HF_STUDIO_SECRET = "test-only-provider-secret-more-than-32-characters";
const output = "https://worker.hf.space/gradio_api/file=outputs/test.mp4";
let providerStatus = "completed", providerError = null, storageError = false;
let archiveCalls = 0, providerCalls = 0, signCalls = 0;
let duringArchive = null, removedPaths = [], removalError = false, sessionWorkspace = null;
const load = Module._load, resolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) { return resolve.call(this, name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name, ...args); };
Module._load = function(name, ...args) {
  if (name === "@/lib/video/session") return { ...load.call(this, name, ...args), getWorkspace: async () => sessionWorkspace };
  if (name === "./provider" || name === "@/lib/video/provider") return {
    validVideoUrl: url => url === output,
    checkGeneration: async () => { providerCalls++; if (providerError) throw providerError; return providerStatus === "completed" ? { status: "completed", videoUrl: output } : { status: providerStatus }; },
  };
  if (name === "./storage" || name === "@/lib/video/storage") return {
    mediaConfigured: () => true,
    archiveVideo: async (_url, workspaceId, id) => { archiveCalls++; if (storageError) throw new (require("../src/lib/video/fal.ts").ProviderError)("Storage unavailable", 503); if (duringArchive) await duringArchive(id); return `${workspaceId}/videos/${id}.mp4`; },
    removeMedia: async paths => { if (removalError) throw new (require("../src/lib/video/fal.ts").ProviderError)("Storage unavailable", 503); removedPaths.push(...paths); },
    signedMediaBatch: async paths => { signCalls++; return new Map(paths.filter(p => !p.includes("missing")).map(p => [p, "https://private.example/signed.mp4"])); },
  };
  return load.call(this, name, ...args);
};
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
let db, jobs, callbacks, generationRoute;
before(async () => {
  execFileSync(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"], { cwd: root, env: process.env, stdio: "pipe" });
  db = require("../src/lib/video/db.ts").db;
  jobs = require("../src/lib/video/jobs.ts");
  callbacks = require("../src/app/api/provider-events/route.ts");
  generationRoute = require("../src/app/api/generations/[id]/route.ts");
});
after(async () => { await db?.$disconnect(); Module._load = load; Module._resolveFilename = resolve; fs.rmSync(temp, { recursive: true, force: true }); });
async function makeJob(ageHours = 2) {
  providerError = null; storageError = false; archiveCalls = 0; providerCalls = 0;
  duringArchive = null; removedPaths = []; removalError = false;
  const id = randomUUID(), workspaceId = randomUUID();
  await db.studioWorkspace.create({ data: { id: workspaceId, activeJobId: id } });
  await db.studioQuota.upsert({ where: { id: "active" }, create: { id: "active", used: 1 }, update: { used: 1 } });
  return db.videoGeneration.create({ data: { id, workspaceId, prompt: "Recovery test", model: "Test only", provider: "huggingface", status: "processing", quotaReserved: true, aspectRatio: "16:9", duration: 5, statusUrl: "test-status", responseUrl: "test-response", createdAt: new Date(Date.now() - ageHours * 3600000) } });
}
async function activeCount() { return (await db.studioQuota.findUnique({ where: { id: "active" } })).used; }
async function callback(job, status = "completed", signatureOverride) {
  const body = JSON.stringify({ id: job.id, status, ...(status === "completed" ? { videoUrl: output } : {}) });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signatureOverride || createHmac("sha256", process.env.HF_STUDIO_SECRET).update(`${timestamp}.${body}`).digest("hex");
  return callbacks.POST(new Request("https://studio.example/api/provider-events", { method: "POST", headers: { "x-studio-timestamp": timestamp, "x-studio-signature": signature }, body }));
}
test("an older completed provider job is archived before the wait timeout is applied", async () => {
  const job = await makeJob(); providerStatus = "completed";
  const result = await jobs.refreshGeneration(job);
  assert.equal(result.status, "completed"); assert.ok(result.storagePath);
  assert.equal(result.failureCode, null); assert.equal(providerCalls, 1); assert.equal(archiveCalls, 1); assert.equal(await activeCount(), 0);
});
test("late signed completion recovers a timeout once without releasing a newer render reservation", async () => {
  const job = await makeJob(); providerStatus = "processing";
  const timedOut = await jobs.refreshGeneration(job);
  assert.equal(timedOut.status, "failed"); assert.equal(timedOut.failureCode, "render_timeout"); assert.equal(await activeCount(), 0);
  const newerId = randomUUID();
  await db.studioWorkspace.update({ where: { id: job.workspaceId }, data: { activeJobId: newerId } });
  await db.studioQuota.update({ where: { id: "active" }, data: { used: 1 } });
  assert.equal((await callback(job, "completed", "0".repeat(64))).status, 401);
  assert.equal(archiveCalls, 0);
  assert.equal((await callback(job)).status, 200);
  assert.equal((await callback(job)).status, 200);
  const result = await db.videoGeneration.findUnique({ where: { id: job.id } });
  assert.equal(result.status, "completed"); assert.equal(result.error, null); assert.equal(result.failureCode, null);
  assert.equal(archiveCalls, 1); assert.equal(await activeCount(), 1);
  assert.equal((await db.studioWorkspace.findUnique({ where: { id: job.workspaceId } })).activeJobId, newerId);
});
test("definitive failures and timeouts older than 24 hours cannot be revived", async () => {
  const job = await makeJob();
  await jobs.finishGeneration(job, { status: "failed", error: "Definitive failure" });
  assert.equal((await callback(job)).status, 200); assert.equal(archiveCalls, 0);
  const old = await makeJob(25);
  const expired = await jobs.refreshGeneration(old);
  assert.equal(expired.failureCode, "render_timeout"); assert.equal(providerCalls, 0);
  assert.equal((await callback(old)).status, 200); assert.equal(archiveCalls, 0);
});
test("transient storage failure during timeout recovery retries archival, not inference", async () => {
  const job = await makeJob(); providerStatus = "processing";
  const timedOut = await jobs.refreshGeneration(job);
  providerStatus = "completed"; storageError = true;
  await db.videoGeneration.update({ where: { id: job.id }, data: { pollAfter: null } });
  assert.equal((await jobs.refreshGeneration(timedOut)).status, "failed");
  storageError = false;
  await db.videoGeneration.update({ where: { id: job.id }, data: { pollAfter: null } });
  assert.equal((await jobs.refreshGeneration(timedOut)).status, "completed");
  assert.equal(await activeCount(), 0); assert.equal(archiveCalls, 2);
});
test("one missing archived video keeps valid media and all library metadata available", async () => {
  const a = await makeJob(); const b = await makeJob();
  const records = [{ ...a, status: "completed", storagePath: "owner/good.mp4", videoUrl: output }, { ...b, status: "completed", storagePath: "owner/missing.mp4", videoUrl: output }];
  signCalls = 0;
  const result = await jobs.publicGenerations(records);
  assert.equal(signCalls, 1); assert.equal(result.length, 2);
  assert.equal(result[0].videoUrl, "https://private.example/signed.mp4");
  assert.equal(result[1].videoUrl, null); assert.equal(result[1].mediaUnavailable, true);
  assert.equal(result[1].id, b.id); assert.equal(result[1].prompt, b.prompt);
});
test("a removed timeout cannot be resurrected by an upload finishing after deletion", async () => {
  const job = await makeJob(); providerStatus = "processing";
  await jobs.refreshGeneration(job);
  duringArchive = async id => { await db.videoGeneration.delete({ where: { id } }); };
  assert.equal((await callback(job)).status, 404);
  assert.equal(await db.videoGeneration.findUnique({ where: { id: job.id } }), null);
  assert.deepEqual(removedPaths, [`${job.workspaceId}/videos/${job.id}.mp4`]);
  assert.equal(await activeCount(), 0);
});
test("a definitive provider failure stops timeout recovery polling", async () => {
  const job = await makeJob(); providerStatus = "processing";
  const timedOut = await jobs.refreshGeneration(job);
  providerStatus = "failed";
  const failed = await jobs.refreshGeneration(timedOut);
  assert.equal(failed.failureCode, "provider_failed");
  const count = providerCalls;
  await jobs.refreshGeneration(failed);
  assert.equal(providerCalls, count);
  assert.equal((await callback(job)).status, 200); assert.equal(archiveCalls, 0);
  assert.equal(await activeCount(), 0);
});
async function removeJob(job) {
  sessionWorkspace = { id: job.workspaceId };
  return generationRoute.DELETE(new Request(`https://studio.example/api/generations/${job.id}`, { method: "DELETE", headers: { origin: "https://studio.example" } }), { params: Promise.resolve({ id: job.id }) });
}
test("failed storage deletion preserves the record for a safe retry", async () => {
  const job = await makeJob();
  await jobs.finishGeneration(job, { status: "failed", failureCode: "render_timeout" });
  removalError = true;
  assert.equal((await removeJob(job)).status, 503);
  assert.ok(await db.videoGeneration.findUnique({ where: { id: job.id } }));
  removalError = false;
  assert.equal((await removeJob(job)).status, 200);
  assert.equal(await db.videoGeneration.findUnique({ where: { id: job.id } }), null);
});
test("completion winning the deletion comparison preserves its media", async () => {
  const job = await makeJob();
  await jobs.finishGeneration(job, { status: "failed", failureCode: "render_timeout" });
  const original = db.videoGeneration.findFirst;
  db.videoGeneration.findFirst = async (...args) => {
    const snapshot = await original.apply(db.videoGeneration, args);
    await jobs.finishGeneration(job, { status: "completed", storagePath: `${job.workspaceId}/videos/${job.id}.mp4` });
    return snapshot;
  };
  try { assert.equal((await removeJob(job)).status, 409); }
  finally { db.videoGeneration.findFirst = original; }
  assert.equal((await db.videoGeneration.findUnique({ where: { id: job.id } })).status, "completed");
  assert.deepEqual(removedPaths, []);
});
