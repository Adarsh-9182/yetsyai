const { test } = require("node:test");
const assert = require("node:assert/strict");
const { checkWorker } = require("../scripts/check-worker.cjs");
const env = { HF_SPACE_URL: "https://owner-studio.hf.space", HF_TOKEN: "test-only-token", HF_STUDIO_SECRET: "test-only-shared-secret-with-at-least-32-characters" };
const names = ["secret", "request_id", "prompt", "negative_prompt", "ratio", "seed", "reference"];
function metadata() { return { named_endpoints: { "/generate": { parameters: names.map((name, i) => ({ parameter_name: name, component: i === 5 ? "Number" : "Textbox" })), returns: [{ component: "Video" }] } } }; }
const withAuth = handler => (url, options) => url.hostname === "huggingface.co" ? Response.json({}) : handler(url, options);

test("preflight rejects missing or unsafe configuration before making any request", async () => {
  let calls = 0; const request = async () => { calls++; };
  await assert.rejects(checkWorker({}, request), /Missing configuration: HF_SPACE_URL, HF_TOKEN, HF_STUDIO_SECRET/);
  for (const url of ["http://owner-studio.hf.space", "https://owner-studio.hf.space.evil.example", "https://token@owner-studio.hf.space", "https://owner-studio.hf.space:8443", "https://owner-studio.hf.space/path", "https://owner-studio.hf.space?key=value"]) {
    await assert.rejects(checkWorker({ ...env, HF_SPACE_URL: url }, request), /plain HTTPS/);
  }
  await assert.rejects(checkWorker({ ...env, HF_STUDIO_SECRET: "short" }, request), /32 characters/);
  assert.equal(calls, 0);
});
test("preflight authenticates only a read-only metadata request and never transmits the shared secret", async () => {
  const seen = [];
  const result = await checkWorker(env, async (url, options) => {
    seen.push(String(url));
    assert.equal(options.method, "GET"); assert.equal(options.redirect, "manual");
    assert.equal(options.headers.Authorization, `Bearer ${env.HF_TOKEN}`);
    assert.equal(options.body, undefined); assert.ok(!JSON.stringify(options).includes(env.HF_STUDIO_SECRET));
    return Response.json(url.hostname === "huggingface.co" ? {} : metadata());
  });
  assert.deepEqual(seen, ["https://huggingface.co/api/whoami-v2", "https://owner-studio.hf.space/gradio_api/info"]);
  assert.match(result, /PASS token validation, Space API access/); assert.match(result, /still require a real render/);
});
test("preflight does not follow redirects or expose provider errors", async () => {
  for (const status of [302, 401, 403, 404, 503]) {
    let calls = 0;
    await assert.rejects(checkWorker(env, withAuth(async () => { calls++; return new Response(`private ${env.HF_TOKEN}`, { status, headers: { location: "https://attacker.example" } }); })), error => !error.message.includes(env.HF_TOKEN));
    assert.equal(calls, 1);
  }
  await assert.rejects(checkWorker(env, async () => { throw new Error(`private ${env.HF_TOKEN}`); }), error => !error.message.includes(env.HF_TOKEN));
});
test("invalid tokens cannot pass by probing a public Space", async () => {
  let calls = 0;
  await assert.rejects(checkWorker(env, async url => { calls++; assert.equal(url.hostname, "huggingface.co"); return new Response("private token failure", { status: 401 }); }), /token validation returned HTTP 401/);
  assert.equal(calls, 1);
});
test("preflight rejects mismatched inputs, output types, malformed and oversized metadata", async () => {
  const reordered = metadata(); reordered.named_endpoints["/generate"].parameters.reverse();
  const badOutput = metadata(); badOutput.named_endpoints["/generate"].returns[0].component = "Image";
  for (const value of [{}, reordered, badOutput]) await assert.rejects(checkWorker(env, withAuth(async () => Response.json(value))), /Worker \/generate/);
  await assert.rejects(checkWorker(env, withAuth(async () => new Response("not JSON", { headers: { "content-type": "application/json" } }))), /valid Space API metadata/);
  await assert.rejects(checkWorker(env, withAuth(async () => new Response("x".repeat(512 * 1024 + 1), { headers: { "content-type": "application/json" } }))), /size limit/);
});
