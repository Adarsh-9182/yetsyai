const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
process.env.NODE_ENV = "production";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://oauth-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only-public-anon-key";
const jar = new Map();
const writes = [];
const originalLoad = Module._load, originalResolve = Module._resolveFilename, originalFetch = global.fetch;
Module._resolveFilename = function(name, ...args) { return originalResolve.call(this, name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name, ...args); };
Module._load = function(name, ...args) {
  if (name === "next/headers") return { cookies: async () => ({ getAll: () => [...jar].map(([name, value]) => ({ name, value })), set: (name, value, options) => { writes.push({ name, value, options }); jar.set(name, value); } }) };
  return originalLoad.call(this, name, ...args);
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const route = require("../src/app/api/account/oauth/route.ts");
const { checkedOAuthUrl } = require("../src/lib/video/oauth.ts");
let providers = { google: true, github: true }, networkError = false, oversized = false, fetches = 0;
global.fetch = async (url, options) => {
  fetches++;
  assert.equal(String(url), "https://oauth-test.supabase.co/auth/v1/settings");
  assert.equal(options.headers.apikey, "test-only-public-anon-key");
  assert.equal(options.redirect, "error");
  if (networkError) throw new Error("PRIVATE UPSTREAM ERROR");
  if (oversized) return new Response("x".repeat(16385));
  return Response.json({ external: providers, unrelated_setting: "not exposed" });
};
after(() => { Module._load = originalLoad; Module._resolveFilename = originalResolve; global.fetch = originalFetch; });
const request = (provider, origin = "https://studio.example") => new Request("https://studio.example/api/account/oauth", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });

test("Google and GitHub starts use the real SSR SDK to create secure PKCE cookies", async () => {
  for (const provider of ["google", "github"]) {
    jar.clear(); writes.length = 0;
    const response = await route.POST(request(provider));
    assert.equal(response.status, 200);
    const data = await response.json(), url = new URL(data.url);
    assert.equal(url.origin, "https://oauth-test.supabase.co");
    assert.equal(url.searchParams.get("provider"), provider);
    assert.equal(url.searchParams.get("redirect_to"), "https://studio.example/account/confirm");
    assert.equal(url.searchParams.get("code_challenge_method"), "s256");
    assert.match(url.searchParams.get("code_challenge"), /^[A-Za-z0-9_-]{43}$/);
    assert.equal(url.searchParams.get("scopes"), provider === "github" ? "user:email" : null);
    const verifier = writes.find(write => write.name.includes("code-verifier") && write.value);
    assert.ok(verifier, "SSR SDK must persist its verifier in a cookie before redirecting");
    assert.equal(verifier.options.httpOnly, true); assert.equal(verifier.options.secure, true); assert.equal(verifier.options.sameSite, "lax");
    assert.equal(JSON.stringify(data).includes(verifier.value), false);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
});
test("social sign-in rejects cross-origin and unsupported providers before doing any provider work", async () => {
  const before = fetches;
  assert.equal((await route.POST(request("google", "https://attacker.example"))).status, 403);
  assert.equal((await route.POST(request("discord"))).status, 400);
  assert.equal(fetches, before);
});
test("disabled providers and configuration outages cannot create a misleading OAuth redirect", async () => {
  providers = { google: false, github: false }; writes.length = 0;
  const settings = await route.GET();
  assert.deepEqual(await settings.json(), { providers: { google: false, github: false } });
  assert.equal((await route.POST(request("google"))).status, 503);
  assert.equal(writes.length, 0);
  networkError = true;
  const failed = await route.GET(); assert.equal(failed.status, 503); assert.doesNotMatch(await failed.text(), /PRIVATE|UPSTREAM/);
  networkError = false; oversized = true;
  assert.equal((await route.GET()).status, 503);
  oversized = false; providers = { google: true, github: true };
});
test("OAuth destinations cannot escape the configured project, callback or SHA-256 PKCE flow", () => {
  const url = new URL("https://oauth-test.supabase.co/auth/v1/authorize");
  url.search = new URLSearchParams({ provider: "google", redirect_to: "https://studio.example/account/confirm", code_challenge: "x".repeat(43), code_challenge_method: "s256" }).toString();
  assert.equal(checkedOAuthUrl(url.href, "google", "https://studio.example/account/confirm"), url.href);
  for (const change of [candidate => candidate.hostname = "attacker.example", candidate => candidate.username = "secret", candidate => candidate.hash = "token", candidate => candidate.searchParams.set("provider", "github"), candidate => candidate.searchParams.set("redirect_to", "https://attacker.example"), candidate => candidate.searchParams.set("code_challenge_method", "plain"), candidate => candidate.searchParams.delete("code_challenge")]) {
    const candidate = new URL(url); change(candidate);
    assert.throws(() => checkedOAuthUrl(candidate.href, "google", "https://studio.example/account/confirm"), /Couldn't start secure sign-in/);
  }
});
