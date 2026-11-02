// Explicit live smoke test. Creates only tagged, disposable accounts/data and
// never submits a render or sends mail. Requires server credentials locally.
const fs = require("node:fs");
const { parseEnv } = require("node:util");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");

const envFile = process.argv[process.argv.indexOf("--env-file") + 1];
if (!process.argv.includes("--run") || !process.argv.includes("--env-file") || !envFile) {
  console.log("Usage: node scripts/verify-live.cjs --run --env-file .env.production.local");
  console.log("Tests the existing YetsyAI deployment with disposable confirmed accounts. No GPU calls or emails.");
  process.exit(0);
}
for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(envFile, "utf8")))) process.env[key] ??= value;
const base = "https://yetsyai.vercel.app";
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20000) }) } });
const users = [];
const sessions = [];
const credentials = [];
const assetIds = [];
const fixtureIndex = process.argv.indexOf("--video-fixture");
const fixturePath = fixtureIndex >= 0 ? process.argv[fixtureIndex + 1] : null;
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
let projectId;
let phase = "initialization";

async function request(jar, path, method = "GET", body, origin = base) {
  const response = await fetch(`${base}${path}`, { method, redirect: "manual", headers: { ...(method !== "GET" ? { origin, "Content-Type": "application/json" } : {}), ...(jar?.size ? { cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; ") } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  for (const cookie of response.headers.getSetCookie()) { const item = cookie.split(";")[0]; const split = item.indexOf("="); jar?.set(item.slice(0, split), item.slice(split + 1)); }
  const data = await response.json();
  return { status: response.status, data, headers: response.headers };
}

async function main() {
  assert.equal(db._engineConfig.activeProvider, "postgresql", "Generate the PostgreSQL Prisma client before live testing");
  phase = "create disposable confirmed accounts";
  for (let i = 0; i < 2; i++) {
    const email = `yetsyai-smoke-${randomUUID()}@example.com`;
    const password = randomBytes(24).toString("base64url");
    const result = await client.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { yetsyai_smoke: true } });
    assert.ok(!result.error && result.data.user, "Could not create a disposable test account");
    users.push(result.data.user.id);
    credentials.push({ email, password });
    const jar = new Map(); sessions.push(jar);
    phase = "sign in through the deployed account API";
    const signedIn = await request(jar, "/api/account", "POST", { action: "signin", email, password });
    assert.equal(signedIn.status, 200);
    assert.ok(signedIn.headers.getSetCookie().some(cookie => /httponly/i.test(cookie) && /secure/i.test(cookie)), "Session cookie must be HttpOnly and Secure");
    assert.equal((await request(jar, "/api/account")).data.user?.email, email, "Session cookie did not authenticate");
    const studio = await request(jar, "/api/generations");
    assert.equal(studio.status, 200); assert.equal(studio.data.signedIn, true);
    assert.deepEqual(studio.data.generations, []);
  }
  console.log("PASS confirmed-account sign-in, HttpOnly session and live PostgreSQL library");
  const [owner, other] = sessions;
  phase = "save and revise a storyboard";
  projectId = randomUUID();
  const scene = { id: randomUUID(), title: "Disposable smoke-test shot", prompt: "A calm ocean at sunrise", ratio: "16:9", seed: 42, camera: "auto", style: "original", duration: 5, generateAudio: false, negativePrompt: "blur" };
  const body = { id: projectId, revision: 0, title: "Disposable live smoke test", scenes: [scene] };
  let saved = await request(owner, "/api/projects", "PUT", body);
  assert.equal(saved.status, 200); assert.equal(saved.data.project.revision, 1);
  assert.equal((await request(owner, `/api/projects?id=${projectId}`)).data.project.scenes[0].prompt, scene.prompt);
  saved = await request(owner, "/api/projects", "PUT", { ...body, revision: 1, title: "Disposable revised smoke test" });
  assert.equal(saved.status, 200); assert.equal(saved.data.project.revision, 2);
  assert.equal((await request(owner, "/api/projects", "PUT", { ...body, revision: 1 })).status, 409);
  assert.equal((await request(other, `/api/projects?id=${projectId}`)).status, 404);
  assert.equal((await request(other, "/api/projects", "DELETE", { id: projectId, revision: 2 })).status, 409);
  assert.equal((await request(owner, "/api/projects", "PUT", body, "https://untrusted.example")).status, 403);
  console.log("PASS project save/reopen/revision conflicts, cross-account isolation and same-origin enforcement");
  phase = "upload a disposable reference to private media storage";
  const image = await sharp({ create: { width: 320, height: 320, channels: 3, background: "#ddfb86" } }).png().toBuffer();
  const uploaded = await request(owner, "/api/assets", "POST", { name: "Disposable smoke test.png", data: `data:image/png;base64,${image.toString("base64")}` });
  assert.equal(uploaded.status, 201);
  assetIds.push(uploaded.data.asset.id);
  assert.equal((await request(owner, "/api/assets")).data.assets.length, 1);
  assert.deepEqual((await request(other, "/api/assets")).data.assets, []);
  assert.equal((await request(other, "/api/assets", "DELETE", { id: assetIds[0] })).status, 404);
  const media = await fetch(uploaded.data.asset.url, { signal: AbortSignal.timeout(20000) });
  assert.equal(media.status, 200); assert.equal((await sharp(Buffer.from(await media.arrayBuffer())).metadata()).width, 320);
  const privatePath = new URL(uploaded.data.asset.url); privatePath.pathname = privatePath.pathname.replace("/object/sign/", "/object/public/"); privatePath.search = "";
  assert.notEqual((await fetch(privatePath, { signal: AbortSignal.timeout(20000) })).status, 200, "Private reference was publicly readable");
  console.log("PASS reference upload/reopen/signed playback, private bucket and cross-account isolation");
  if (fixturePath) {
    phase = "download a clearly-labeled video fixture (no inference)";
    const bytes = fs.readFileSync(fixturePath);
    assert.ok(bytes.length >= 12 && bytes.length <= 40 * 1024 * 1024 && bytes.toString("ascii", 4, 8) === "ftyp", "Provide a valid MP4 fixture under 40 MiB");
    const workspace = await db.studioWorkspace.findUniqueOrThrow({ where: { userId: users[0] } });
    const id = randomUUID(); const storagePath = `${workspace.id}/videos/${id}.mp4`;
    await db.videoGeneration.create({ data: { id, workspaceId: workspace.id, prompt: "DISPOSABLE TEST FIXTURE — NOT AI GENERATED", model: "Download test fixture", provider: "huggingface", status: "completed", storagePath, duration: 5, aspectRatio: "16:9", settings: JSON.stringify({ camera: "push", style: "cinema", negativePrompt: "blur", generateAudio: false, sceneId: scene.id }) } });
    assert.ok(!(await client.storage.from("studio-media").upload(storagePath, bytes, { contentType: "video/mp4" })).error);
    const library = await request(owner, "/api/generations");
    assert.equal(library.data.generations[0].id, id);
    assert.equal(library.data.generations[0].sceneId, scene.id);
    assert.equal(library.data.generations[0].settings.camera, "push");
    assert.equal((await request(owner, `/api/generations/${id}`)).data.generation.sceneId, scene.id);
    assert.equal((await request(other, `/api/generations/${id}`)).status, 404);
    phase = "save and reopen a preferred storyboard take";
    const withTake = await request(owner, "/api/projects", "PUT", { ...body, revision: 2, scenes: [{ ...scene, preferredGenerationId: id }] });
    assert.equal(withTake.status, 200); assert.equal(withTake.data.project.revision, 3);
    assert.equal((await request(owner, `/api/projects?id=${projectId}`)).data.project.scenes[0].preferredGenerationId, id);
    assert.equal((await request(other, `/api/projects?id=${projectId}`)).status, 404);
    console.log("PASS preferred take persists with the owned project and remains isolated from other accounts");
    phase = "isolate deliberately missing fixture media";
    const missingId = randomUUID(), missingAssetId = randomUUID();
    await db.videoGeneration.create({ data: { id: missingId, workspaceId: workspace.id, prompt: "DISPOSABLE MISSING-MEDIA FIXTURE", model: "Missing-file test", provider: "huggingface", status: "completed", storagePath: `${workspace.id}/videos/${missingId}.mp4`, duration: 5, aspectRatio: "16:9" } });
    await db.studioAsset.create({ data: { id: missingAssetId, workspaceId: workspace.id, name: "Disposable missing reference", path: `${workspace.id}/references/${missingAssetId}.png`, width: 320, height: 320 } });
    const mixedLibrary = await request(owner, "/api/generations");
    assert.equal(mixedLibrary.status, 200);
    assert.ok(mixedLibrary.data.generations.find(job => job.id === id).videoUrl);
    const missingVideo = mixedLibrary.data.generations.find(job => job.id === missingId);
    assert.equal(missingVideo.videoUrl, null); assert.equal(missingVideo.mediaUnavailable, true);
    const mixedAssets = await request(owner, "/api/assets");
    assert.equal(mixedAssets.status, 200);
    assert.ok(mixedAssets.data.assets.find(asset => asset.id === assetIds[0]).url);
    assert.equal(mixedAssets.data.assets.find(asset => asset.id === missingAssetId).url, null);
    assert.equal((await request(owner, `/api/generations/${missingId}`, "DELETE")).status, 200);
    assert.equal((await request(owner, "/api/assets", "DELETE", { id: missingAssetId })).status, 200);
    console.log("PASS missing video/reference objects preserve valid media and metadata, and remain removable");
    phase = "download a clearly-labeled video fixture (no inference)";
    const cookie = [...owner].map(([key, value]) => `${key}=${value}`).join("; ");
    const download = await fetch(`${base}/api/generations/${id}/download`, { headers: { cookie }, signal: AbortSignal.timeout(30000) });
    assert.equal(download.status, 200); assert.equal(download.headers.get("content-type"), "video/mp4");
    assert.match(download.headers.get("content-disposition"), /attachment; filename="yetsyai-/);
    const hash = data => createHash("sha256").update(data).digest("hex");
    assert.equal(hash(Buffer.from(await download.arrayBuffer())), hash(bytes), "Download bytes changed");
    assert.equal((await request(other, `/api/generations/${id}/download`)).status, 404);
    assert.equal((await request(new Map(), `/api/generations/${id}/download`)).status, 404);
    assert.equal((await request(owner, `/api/generations/${id}`, "DELETE")).status, 200);
    console.log("PASS saved-video signed playback URL, exact MP4 download bytes, ownership and deletion (fixture only; no GPU inference)");
  }
  phase = "signed-out library isolation";
  assert.equal((await request(owner, "/api/account", "POST", { action: "signout" })).status, 200);
  assert.equal((await request(owner, "/api/account")).data.user, null);
  assert.deepEqual((await request(owner, "/api/generations")).data.generations, []);
  console.log("PASS sign-out discards authenticated access");
  phase = "one-time recovery link on a fresh device session (no email)";
  const recovery = await client.auth.admin.generateLink({ type: "recovery", email: credentials[0].email });
  assert.ok(!recovery.error && recovery.data.properties?.hashed_token, "Could not create disposable recovery link");
  const recoveryUrl = new URL(`${base}/account/confirm`);
  recoveryUrl.searchParams.set("token_hash", recovery.data.properties.hashed_token);
  recoveryUrl.searchParams.set("type", "recovery");
  const recovered = new Map();
  const callback = await fetch(recoveryUrl, { redirect: "manual", signal: AbortSignal.timeout(30000) });
  assert.equal(callback.status, 307);
  assert.equal(callback.headers.get("location"), `${base}/account/reset`);
  assert.equal(callback.headers.get("referrer-policy"), "no-referrer");
  for (const cookie of callback.headers.getSetCookie()) { const item = cookie.split(";")[0]; const split = item.indexOf("="); recovered.set(item.slice(0, split), item.slice(split + 1)); }
  assert.equal((await request(recovered, "/api/account")).data.user?.email, credentials[0].email);
  const newPassword = randomBytes(24).toString("base64url");
  assert.equal((await request(new Map(), "/api/account", "POST", { action: "update", password: newPassword })).status, 401);
  assert.equal((await request(recovered, "/api/account", "POST", { action: "update", password: newPassword })).status, 200);
  assert.equal((await request(recovered, "/api/account", "POST", { action: "signout" })).status, 200);
  const fresh = new Map();
  assert.equal((await request(fresh, "/api/account", "POST", { action: "signin", ...credentials[0] })).status, 400);
  assert.equal((await request(fresh, "/api/account", "POST", { action: "signin", email: credentials[0].email, password: newPassword })).status, 200);
  assert.equal((await request(fresh, "/api/account", "POST", { action: "signout" })).status, 200);
  const replay = await fetch(recoveryUrl, { redirect: "manual", signal: AbortSignal.timeout(30000) });
  assert.equal(replay.headers.get("location"), `${base}/?account=expired`);
  console.log("PASS cross-device recovery callback, password change, old-password rejection and one-time-link replay rejection (no mail delivery tested)");
}

async function cleanup() {
  // Administrative deletion is restricted to the freshly-created, tagged users.
  // Supabase auth deletion alone does not remove custom tables/storage records.
  if (!users.length) return;
  try {
    for (const id of users) {
      const result = await client.auth.admin.getUserById(id);
      if (result.data.user?.app_metadata?.yetsyai_smoke !== true || !result.data.user.email?.startsWith("yetsyai-smoke-")) throw new Error("Test cleanup ownership guard failed");
      const workspace = await db.studioWorkspace.findUnique({ where: { userId: id }, include: { assets: true, generations: true } });
      if (workspace) {
        const paths = [...workspace.assets.map(asset => asset.path), ...workspace.generations.flatMap(job => job.storagePath ? [job.storagePath] : [])];
        if (paths.length) { const removed = await client.storage.from("studio-media").remove(paths); assert.ok(!removed.error, "Could not remove disposable media"); }
        await db.studioWorkspace.delete({ where: { id: workspace.id } });
      }
      assert.ok(!(await client.auth.admin.deleteUser(id)).error, "Could not remove disposable account");
    }
    console.log("PASS cleanup: all disposable accounts, workspaces, projects and reference files removed");
  } finally { await db.$disconnect(); }
}

main().catch(() => { console.error(`FAIL during: ${phase}. No secrets or raw provider responses are printed.`); process.exitCode = 1; }).finally(async () => { try { await cleanup(); } catch { console.error("FAIL disposable-data cleanup. Rerun with the same environment only after reviewing tagged test accounts."); process.exitCode = 1; } });
