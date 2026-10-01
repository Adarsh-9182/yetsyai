const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { execFileSync } = require("node:child_process");
const ts = require("typescript");

// Load the production route handlers in Node, with a request-local cookie store.
// The database is real SQLite; only external fal HTTP and Next's cookie context
// are replaced so these regressions never charge a provider account.
const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "yetsyai-tests-"));
process.env.DATABASE_URL = `file:${path.join(temp, "workspace.db")}`;
process.env.FAL_KEY = "test-key-not-a-real-credential";
let cookieStore = new Map();
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
const originalFetch = global.fetch;
Module._resolveFilename = function (name, ...args) {
  return originalResolve.call(this, name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name, ...args);
};
Module._load = function (name, ...args) {
  if (name === "next/headers") return { cookies: () => ({
    get: (key) => cookieStore.has(key) ? { value: cookieStore.get(key) } : undefined,
    set: (key, value) => cookieStore.set(key, value),
  }) };
  return originalLoad.call(this, name, ...args);
};
require.extensions[".ts"] = function (module, filename) {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  });
  module._compile(outputText, filename);
};

let db, routes, detail, download, fal;
let providerCalls = [];
let providerStatus = "IN_QUEUE";
let providerFailure = false;
let providerUnavailable = false;
let submitFailure = 0;

before(async () => {
  execFileSync(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"], { cwd: root, env: process.env, stdio: "pipe" });
  db = require("../src/lib/video/db.ts").db;
  routes = require("../src/app/api/generations/route.ts");
  detail = require("../src/app/api/generations/[id]/route.ts");
  download = require("../src/app/api/generations/[id]/download/route.ts");
  fal = require("../src/lib/video/fal.ts");
  global.fetch = async (url, init = {}) => {
    providerCalls.push({ url: String(url), init });
    if (String(url).startsWith("https://v3.fal.media/")) return new Response("mock-mp4-bytes", { headers: { "content-type": "video/mp4" } });
    assert.equal(new URL(url).origin, "https://queue.fal.run", "Never call an unexpected external host");
    assert.equal(init.headers.Authorization, "Key test-key-not-a-real-credential");
    if (init.method === "POST") {
      if (submitFailure) return new Response("Rejected", { status: submitFailure });
      const id = randomUUID();
      return Response.json({ request_id: id, status_url: `https://queue.fal.run/fal-ai/kling-video/requests/${id}/status`, response_url: `https://queue.fal.run/fal-ai/kling-video/requests/${id}` });
    }
    if (String(url).endsWith("/status")) {
      if (providerUnavailable) return new Response("Unavailable", { status: 503 });
      return Response.json({ status: providerStatus, ...(providerFailure ? { error: "provider-internal-error" } : {}) });
    }
    return Response.json({ video: { url: "https://v3.fal.media/files/test/output.mp4" } });
  };
});
after(async () => {
  await db?.$disconnect();
  global.fetch = originalFetch;
  Module._load = originalLoad;
  Module._resolveFilename = originalResolve;
  fs.rmSync(temp, { recursive: true, force: true });
});

async function newWorkspace() { cookieStore = new Map(); const response = await routes.GET(); assert.equal(response.status, 200); return response.json(); }
function input(extra = {}) { return { requestId: randomUUID(), prompt: "Cinematic sunset over the ocean", aspectRatio: "9:16", duration: 5, generateAudio: false, negativePrompt: "blur", ...extra }; }
function request(body, origin = "http://localhost:3000") { return new Request("http://localhost:3000/api/generations", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }
async function status(id) { return detail.GET(new Request(`http://localhost:3000/api/generations/${id}`), { params: { id } }); }

test("missing provider key and invalid inputs do not create a render", async () => {
  await newWorkspace();
  process.env.FAL_KEY = "";
  const beforeCount = providerCalls.length;
  assert.equal((await routes.POST(request(input()))).status, 503);
  process.env.FAL_KEY = "test-key-not-a-real-credential";
  assert.equal((await routes.POST(request(input({ prompt: " " })))).status, 400);
  assert.equal((await routes.POST(request(input({ duration: 8 })))).status, 400);
  assert.equal((await routes.POST(request(input({ referenceImage: "https://localhost/private" })))).status, 400);
  assert.equal((await routes.POST(request(input(), "https://attacker.example"))).status, 403);
  assert.equal(providerCalls.length, beforeCount);
  assert.deepEqual((await (await routes.GET()).json()).generations, []);
});

test("text render preserves settings, rejects duplicate renders, resumes and downloads", async () => {
  await newWorkspace();
  providerStatus = "IN_QUEUE";
  const scene = input();
  const created = await routes.POST(request(scene));
  assert.equal(created.status, 202);
  const job = (await created.json()).generation;
  assert.equal(job.status, "queued");
  assert.equal(job.videoUrl, null);
  assert.equal(job.providerRequestId, undefined, "Do not expose provider queue credentials or IDs");
  const submission = providerCalls.filter((call) => call.init.method === "POST").at(-1);
  assert.match(submission.url, /text-to-video$/);
  const sent = JSON.parse(submission.init.body);
  assert.equal(sent.aspect_ratio, "9:16");
  assert.equal(sent.duration, "5");
  assert.equal(sent.generate_audio, false);
  const submitCount = providerCalls.filter((call) => call.init.method === "POST").length;
  assert.equal((await routes.POST(request(scene))).status, 200);
  assert.equal(providerCalls.filter((call) => call.init.method === "POST").length, submitCount);
  assert.equal((await routes.POST(request(input()))).status, 409);
  assert.equal((await download.GET(new Request("http://localhost:3000"), { params: { id: job.id } })).status, 409);
  providerStatus = "IN_PROGRESS";
  assert.equal((await (await status(job.id)).json()).generation.status, "processing");
  providerUnavailable = true;
  assert.equal((await status(job.id)).status, 502);
  assert.equal((await (await routes.GET()).json()).generations[0].status, "processing", "Transient polling errors must not discard a running job");
  providerUnavailable = false;
  providerStatus = "COMPLETED";
  const complete = (await (await status(job.id)).json()).generation;
  assert.equal(complete.status, "completed");
  assert.equal((await (await routes.GET()).json()).generations[0].videoUrl, complete.videoUrl);
  const file = await download.GET(new Request("http://localhost:3000"), { params: { id: job.id } });
  assert.equal(file.status, 200);
  assert.match(file.headers.get("content-disposition"), /attachment.*\.mp4/);
  assert.equal(await file.text(), "mock-mp4-bytes");
  assert.equal((await db.studioWorkspace.findUnique({ where: { id: cookieStore.get("yetsyai_workspace") } })).activeJobId, null);
  await newWorkspace();
  assert.equal((await status(job.id)).status, 404);
  assert.equal((await download.GET(new Request("http://localhost:3000"), { params: { id: job.id } })).status, 404);
  assert.equal((await routes.POST(request(scene))).status, 409);
});

test("reference images use the image endpoint and a failed render releases the workspace", async () => {
  await newWorkspace();
  providerStatus = "IN_QUEUE";
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const referenceImage = `data:image/png;base64,${bytes.toString("base64")}`;
  const created = await routes.POST(request(input({ referenceImage, duration: 10, generateAudio: true })));
  assert.equal(created.status, 202);
  const job = (await created.json()).generation;
  assert.equal(job.aspectRatio, "Reference image");
  const submission = providerCalls.filter((call) => call.init.method === "POST").at(-1);
  assert.match(submission.url, /image-to-video$/);
  const sent = JSON.parse(submission.init.body);
  assert.equal(sent.start_image_url, referenceImage);
  assert.equal(sent.aspect_ratio, undefined, "Reference image determines its own aspect ratio");
  assert.equal(sent.duration, "10");
  assert.equal(sent.generate_audio, true);
  providerStatus = "COMPLETED";
  providerFailure = true;
  const failed = (await (await status(job.id)).json()).generation;
  assert.equal(failed.status, "failed");
  assert.doesNotMatch(failed.error, /provider-internal-error/);
  providerFailure = false;
  providerStatus = "IN_QUEUE";
  assert.equal((await routes.POST(request(input()))).status, 202);
});

test("download and reference validation reject private hosts and invalid content", () => {
  assert.equal(fal.validVideoUrl("https://v3.fal.media/files/output.mp4"), true);
  assert.equal(fal.validVideoUrl("https://storage.googleapis.com/falserverless/output.mp4"), true);
  for (const url of ["http://127.0.0.1/video", "https://fal.media.attacker.example/out.mp4", "https://u:p@v3.fal.media/out.mp4", "https://storage.googleapis.com/private/out.mp4", "https://v3.fal.media:444/out.mp4"]) assert.equal(fal.validVideoUrl(url), false);
  assert.equal(fal.validReferenceImage("data:image/png;base64,aGVsbG8="), false);
  assert.equal(fal.validReferenceImage("data:image/svg+xml;base64,PHN2Zz4="), false);
  assert.equal(fal.validReferenceImage(`data:image/png;base64,${Buffer.alloc(3 * 1024 * 1024 + 1).toString("base64")}`), false);
});

test("concurrent submissions reserve only one paid render slot", async () => {
  await newWorkspace();
  providerStatus = "IN_QUEUE";
  const count = providerCalls.filter((call) => call.init.method === "POST").length;
  const responses = await Promise.all([routes.POST(request(input())), routes.POST(request(input()))]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [202, 409]);
  assert.equal(providerCalls.filter((call) => call.init.method === "POST").length, count + 1);
});

test("provider account rejection persists a useful failure and releases the slot", async () => {
  await newWorkspace();
  submitFailure = 402;
  const response = await routes.POST(request(input()));
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.generation.status, "failed");
  assert.match(data.error, /balance top-up/);
  assert.equal((await (await routes.GET()).json()).generations[0].status, "failed");
  submitFailure = 0;
  assert.equal((await routes.POST(request(input()))).status, 202);
});

test("an interrupted submission recovers without automatically charging again", async () => {
  await newWorkspace();
  const id = randomUUID();
  const workspaceId = cookieStore.get("yetsyai_workspace");
  await db.videoGeneration.create({ data: {
    id, workspaceId, prompt: "Interrupted scene", model: "Kling 3.0 Standard",
    aspectRatio: "16:9", duration: 5, createdAt: new Date(Date.now() - 130000),
  } });
  await db.studioWorkspace.update({ where: { id: workspaceId }, data: { activeJobId: id } });
  const count = providerCalls.length;
  const recovered = (await (await status(id)).json()).generation;
  assert.equal(recovered.status, "failed");
  assert.match(recovered.error, /Check your fal dashboard/);
  assert.equal(providerCalls.length, count, "Never resubmit an unconfirmed paid request automatically");
  assert.equal((await db.studioWorkspace.findUnique({ where: { id: workspaceId } })).activeJobId, null);
});
