// Read-only Gradio contract check. Never queues inference or sends the shared secret.
const fs = require("node:fs");
const { parseEnv } = require("node:util");
const PARAMETERS = ["secret", "request_id", "prompt", "negative_prompt", "ratio", "seed", "reference"];
class WorkerCheckError extends Error {}

async function checkWorker(env, request = fetch) {
  const missing = ["HF_SPACE_URL", "HF_TOKEN", "HF_STUDIO_SECRET"].filter(name => !env[name]?.trim());
  if (missing.length) throw new WorkerCheckError(`Missing configuration: ${missing.join(", ")}. Save values locally; never paste tokens in chat.`);
  let space;
  try { space = new URL(env.HF_SPACE_URL); } catch { throw new WorkerCheckError("HF_SPACE_URL must be your Space's HTTPS root URL."); }
  if (space.protocol !== "https:" || !space.hostname.endsWith(".hf.space") || space.port || space.username || space.password || space.pathname !== "/" || space.search || space.hash) {
    throw new WorkerCheckError("HF_SPACE_URL must be a plain HTTPS *.hf.space root URL without credentials, port, query or fragment.");
  }
  if (env.HF_STUDIO_SECRET.length < 32) throw new WorkerCheckError("HF_STUDIO_SECRET must contain at least 32 characters.");
  if (/[\r\n]/.test(env.HF_TOKEN)) throw new WorkerCheckError("HF_TOKEN contains invalid header characters.");
  const options = () => ({ method: "GET", headers: { Authorization: `Bearer ${env.HF_TOKEN.trim()}`, Accept: "application/json" }, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15000) });
  // Validate the token separately: a public Space might serve metadata even with
  // an invalid token. Discard the identity body; it can contain private details.
  let identity;
  try { identity = await request(new URL("https://huggingface.co/api/whoami-v2"), options()); }
  catch { throw new WorkerCheckError("Could not validate the Hugging Face token. Check network access; no render was submitted."); }
  await identity.body?.cancel().catch(() => {});
  if (identity.status !== 200 || !identity.headers.get("content-type")?.includes("application/json")) throw new WorkerCheckError(`Hugging Face token validation returned HTTP ${identity.status}. Check the token; no provider response is printed.`);
  let response;
  try {
    response = await request(new URL("/gradio_api/info", space), options());
  } catch { throw new WorkerCheckError("Could not reach the Space. Check network access and the Space runtime; no render was submitted."); }
  const fail = async message => { await response.body?.cancel().catch(() => {}); throw new WorkerCheckError(message); };
  if (response.status === 401 || response.status === 403) return fail("Space access was denied. Check token permissions and private Space access.");
  if (response.status === 404) return fail("Space API was not found. Check the URL, private access and Gradio deployment.");
  if (response.status >= 300 && response.status < 400) return fail("Space redirected the request. Redirects were not followed and credentials were not forwarded.");
  if (!response.ok) return fail(`Space returned HTTP ${response.status}. Check its runtime and try again; no render was submitted.`);
  if (!response.headers.get("content-type")?.includes("application/json") || !response.body) return fail("Space returned an unexpected API response. Check that the worker has finished starting.");
  const limit = 512 * 1024;
  if (Number(response.headers.get("content-length")) > limit) return fail("Space API metadata exceeded the size limit.");
  const reader = response.body.getReader();
  let info;
  try {
    const chunks = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) throw new WorkerCheckError("Space API metadata exceeded the size limit.");
      chunks.push(value);
    }
    info = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof WorkerCheckError) throw error;
    throw new WorkerCheckError("Could not read valid Space API metadata. No provider response or credentials are printed.");
  } finally { await reader.cancel().catch(() => {}); }
  const endpoint = info?.named_endpoints?.["/generate"];
  if (!Array.isArray(endpoint?.parameters) || endpoint.parameters.length !== PARAMETERS.length || endpoint.parameters.some((item, i) => item?.parameter_name !== PARAMETERS[i] || item?.component !== (i === 5 ? "Number" : "Textbox"))) {
    throw new WorkerCheckError("Worker /generate inputs do not match this studio. Deploy the matching spaces/wan-studio files before rendering.");
  }
  if (!Array.isArray(endpoint.returns) || endpoint.returns.length !== 1 || endpoint.returns[0]?.component !== "Video") throw new WorkerCheckError("Worker /generate must return one Gradio Video output.");
  return "PASS token validation, Space API access and seven-input /generate contract. No generation endpoint was called. Shared-secret agreement, GPU quota, output quality and completion callbacks still require a real render.";
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--env-file" || !args[1] || args[1].startsWith("--"))) throw new WorkerCheckError("Usage: npm run setup:worker -- --env-file .env.production.local");
  try {
    if (args.length) {
      for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(args[1], "utf8")))) process.env[key] ??= value;
    } else require("@next/env").loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  } catch { throw new WorkerCheckError("Could not read the local environment file."); }
  console.log(await checkWorker(process.env));
}
if (require.main === module) main().catch(error => { console.error(error instanceof WorkerCheckError ? error.message : "Worker check failed. No raw provider error or credentials are printed."); process.exitCode = 1; });
module.exports = { checkWorker, WorkerCheckError };
