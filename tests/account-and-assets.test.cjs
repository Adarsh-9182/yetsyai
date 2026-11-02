const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const sharp = require("sharp");
const root = path.resolve(__dirname, "..");
const originalLoad = Module._load;
const originalResolve = Module._resolveFilename;
let user = null;
let calls = [];
let emailError = false;
let reservations = 0;
let uploaded;
const auth = {
  signInWithPassword: async data => { calls.push(["signin", data]); return { data: { session: {} }, error: null }; },
  signUp: async data => { calls.push(["signup", data]); return { data: { session: null }, error: null }; },
  resend: async data => { calls.push(["resend", data]); return { error: emailError }; },
  updateUser: async data => { calls.push(["update", data]); return { error: null }; },
  resetPasswordForEmail: async (...data) => { calls.push(["reset", data]); return { error: emailError }; },
  signOut: async () => ({ error: null }),
  verifyOtp: async data => { calls.push(["verify", data]); return { error: null }; },
  exchangeCodeForSession: async code => { calls.push(["exchange", code]); return { error: null }; },
};
const workspace = { id: "test-workspace", createdAt: new Date() };
const tx = { studioWorkspace: { update: async () => {} }, studioAsset: { count: async () => 0, create: async () => { reservations++; } } };
Module._resolveFilename = function(name, ...args) { return originalResolve.call(this, name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name, ...args); };
Module._load = function(name, ...args) {
  if (name === "@/lib/video/auth") return { authClient: async () => ({ auth }), authConfigured: () => true, currentUser: async () => user, requireAccount: async () => {} };
  if (name === "@/lib/video/db") return { databaseConfigured: () => true, db: { $transaction: async fn => fn(tx), studioAsset: { delete: async () => {} } } };
  if (name === "@/lib/video/session") return { getWorkspace: async () => workspace, isSameOrigin: req => req.headers.get("origin") === new URL(req.url).origin };
  if (name === "@/lib/video/storage") return { uploadMedia: async (_path, bytes) => { uploaded = bytes; }, signedMedia: async () => "https://media.example/signed-test.png" };
  return originalLoad.call(this, name, ...args);
};
require.extensions[".ts"] = function(module, filename) { module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename); };
const account = require("../src/app/api/account/route.ts");
const confirm = require("../src/app/account/confirm/route.ts");
const assets = require("../src/app/api/assets/route.ts");
after(() => { Module._load = originalLoad; Module._resolveFilename = originalResolve; });
function request(body, origin = "https://studio.example") { return new Request("https://studio.example/api/account", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

test("sign-in accepts an existing password while account creation enforces ten characters", async () => {
  calls = [];
  assert.equal((await account.POST(request({ action: "signup", email: "test@example.com", password: "short" }))).status, 400);
  assert.equal(calls.length, 0);
  const response = await account.POST(request({ action: "signin", email: " test@example.com ", password: "existing" }));
  assert.equal(response.status, 200); assert.equal((await response.json()).signedIn, true);
  assert.equal(calls[0][1].email, "test@example.com");
  assert.equal((await account.POST(request({ action: "signup", email: "test@example.com", password: "long-password" }))).status, 200);
  assert.equal(calls.at(-1)[1].options.emailRedirectTo, "https://studio.example/account/confirm");
});
test("confirmation resend is same-origin, bounded and reports provider throttling without leaking details", async () => {
  calls = [];
  assert.equal((await account.POST(request({ action: "resend", email: "test@example.com" }, "https://attacker.example"))).status, 403);
  assert.equal(calls.length, 0);
  const response = await account.POST(request({ action: "resend", email: "test@example.com" }));
  assert.equal(response.status, 200); assert.match((await response.json()).message, /^If your account/);
  assert.deepEqual(calls[0], ["resend", { type: "signup", email: "test@example.com", options: { emailRedirectTo: "https://studio.example/account/confirm" } }]);
  emailError = { message: "private upstream failure" };
  const failed = await account.POST(request({ action: "resend", email: "test@example.com" }));
  assert.equal(failed.status, 429); assert.doesNotMatch(await failed.text(), /private upstream/);
  emailError = false;
});
test("password updates require a session and recovery callbacks cannot redirect outside the studio", async () => {
  user = null;
  assert.equal((await account.POST(request({ action: "update", password: "new-password" }))).status, 401);
  user = { id: "test-user" };
  assert.equal((await account.POST(request({ action: "update", password: "new-password" }))).status, 200);
  const recovery = await confirm.GET(new Request("https://studio.example/account/confirm?token_hash=test-hash&type=recovery&next=https://attacker.example"));
  assert.equal(recovery.headers.get("location"), "https://studio.example/account/reset");
  assert.equal(recovery.headers.get("referrer-policy"), "no-referrer");
  const signup = await confirm.GET(new Request("https://studio.example/account/confirm?token_hash=test-hash&type=email&next=//attacker.example"));
  assert.equal(signup.headers.get("location"), "https://studio.example/");
  assert.equal((await confirm.GET(new Request("https://studio.example/account/confirm"))).headers.get("location"), "https://studio.example/?account=expired");
});
test("OAuth callbacks exchange codes, notify signed-in tabs and strip provider failure details", async () => {
  calls = [];
  const success = await confirm.GET(new Request("https://studio.example/account/confirm?code=test-code&next=https://attacker.example"));
  assert.deepEqual(calls[0], ["exchange", "test-code"]);
  assert.equal(success.headers.get("location"), "https://studio.example/?account=signed-in");
  assert.equal(success.headers.get("referrer-policy"), "no-referrer");
  const failed = await confirm.GET(new Request("https://studio.example/account/confirm?error=access_denied&error_description=PRIVATE_PROVIDER_DETAIL"));
  assert.equal(failed.headers.get("location"), "https://studio.example/?account=oauth-error");
  assert.doesNotMatch(await failed.text(), /PRIVATE_PROVIDER_DETAIL/);
});
test("reference uploads reject disguised formats before reserving storage and remove embedded metadata", async () => {
  const source = sharp({ create: { width: 320, height: 320, channels: 3, background: "#000000" } });
  const gif = await source.clone().gif().toBuffer();
  const bad = await assets.POST(request({ name: "disguised.png", data: `data:image/png;base64,${gif.toString("base64")}` }));
  assert.equal(bad.status, 400); assert.equal(reservations, 0);
  const jpeg = await source.clone().withMetadata({ exif: { IFD0: { Artist: "PRIVATE TEST METADATA" } } }).jpeg().toBuffer();
  assert.ok((await sharp(jpeg).metadata()).exif);
  const good = await assets.POST(request({ name: "reference.jpg", data: `data:image/jpeg;base64,${jpeg.toString("base64")}` }));
  assert.equal(good.status, 201); assert.equal(reservations, 1);
  const metadata = await sharp(uploaded).metadata(); assert.equal(metadata.width, 320); assert.equal(metadata.exif, undefined);
});
