// Local browser regression check with clearly labeled fixtures. All application
// API calls are intercepted: this never signs in, submits inference or sends mail.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const arg = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
if (!arg("--video-fixture")) {
  console.log("Usage: node scripts/verify-studio-ui.cjs --video-fixture /path/test.mp4 [--base-url http://127.0.0.1:3011] [--playwright-module /path/to/playwright] [--output-dir /path/screenshots]");
  process.exit(0);
}
const base = new URL(arg("--base-url") || "http://127.0.0.1:3011");
assert.ok(base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname) && base.pathname === "/", "Only a local development server is allowed");
const { chromium } = require(arg("--playwright-module") || "playwright");
const bytes = fs.readFileSync(arg("--video-fixture"));
assert.equal(bytes.toString("ascii", 4, 8), "ftyp", "Use a real MP4 fixture; it is not model output");
const output = arg("--output-dir") || fs.mkdtempSync(path.join(os.tmpdir(), "yetsyai-ui-"));
fs.mkdirSync(output, { recursive: true });
const sceneId = randomUUID();
const shot = { id: sceneId, title: "Ocean opening", prompt: "UI FIXTURE: A paper boat in warm sunlight", ratio: "16:9", seed: 42, camera: "push", style: "cinema", duration: 5, generateAudio: false, negativePrompt: "blur" };
const fixture = (name, extra = {}) => ({ id: randomUUID(), prompt: `UI FIXTURE: ${name}`, model: "UI fixture — not AI generated", aspectRatio: "16:9", duration: 5, status: "completed", videoUrl: `${base.origin}/__ui-fixture.mp4`, error: null, createdAt: new Date().toISOString(), seed: 42, settings: { camera: "push", style: "cinema", negativePrompt: "blur", generateAudio: false }, ...extra });
let jobs = [fixture("Opening take A", { sceneId }), fixture("Opening take B", { sceneId, seed: 87 }), fixture("Standalone take"), fixture("Missing video", { videoUrl: null, mediaUnavailable: true })];
const submitted = [];
const failures = [];
let browser;
async function noOverflow(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Viewport must not overflow horizontally");
}
async function navigate(page, label, mobile) {
  if (mobile) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
}
async function main() {
  browser = await chromium.launch({ headless: true });
  for (const [label, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    const mobile = label === "mobile";
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: "dark" });
    const page = await context.newPage();
    page.on("pageerror", error => failures.push(error.message));
    await context.addInitScript(({ shot }) => {
      localStorage.setItem("yetsyai-theme", "dark");
      localStorage.setItem("yetsyai-board-v1", JSON.stringify([shot]));
      localStorage.setItem("yetsyai-draft-v1", JSON.stringify({ ...shot, sceneId: shot.id }));
    }, { shot });
    await page.route("**/__ui-fixture.mp4", route => route.fulfill({ contentType: "video/mp4", body: bytes }));
    await page.route("**/api/**", async route => {
      const request = route.request(), url = new URL(request.url());
      assert.equal(url.origin, base.origin);
      let body;
      if (url.pathname === "/api/generations" && request.method() === "GET") body = { configured: true, storageConfigured: true, model: "UI fixture", provider: "huggingface", durations: [5], audio: false, image: false, authConfigured: true, signedIn: true, mediaConfigured: true, configuration: { accounts: true, database: true, media: true, generation: true }, generations: jobs, usage: { used: 0, limit: 10, globalRemaining: 10 } };
      else if (url.pathname === "/api/generations" && request.method() === "POST") {
        const input = request.postDataJSON(); submitted.push(input);
        const generation = fixture(input.prompt, { id: input.requestId, prompt: input.prompt, seed: input.seed, sceneId: input.sceneId });
        jobs = [generation, ...jobs]; body = { generation, usage: { used: 1, limit: 10, globalRemaining: 9 } };
      } else if (url.pathname === "/api/assets") body = { assets: [] };
      else if (url.pathname === "/api/projects") body = { projects: [] };
      else throw new Error(`Unexpected application request: ${request.method()} ${url.pathname}`);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(base.origin);
    await page.locator(".linked-shot").waitFor();
    assert.match(await page.locator(".linked-shot").innerText(), /Ocean opening/);
    await noOverflow(page);
    await page.getByRole("button", { name: "Generate video", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("render queue"));
    assert.equal(submitted.at(-1).sceneId, sceneId, "Composer must send the linked shot identity");
    await navigate(page, "Storyboard", mobile);
    await page.getByRole("button", { name: "Review takes", exact: true }).click();
    assert.match(await page.locator(".shot-library-filter").innerText(), /Ocean opening/);
    assert.equal(await page.locator(".job-card").count(), jobs.filter(job => job.sceneId === sceneId).length);
    await page.getByRole("button", { name: "Show all videos" }).click();
    await page.getByRole("button", { name: "Select for comparison: UI FIXTURE: Opening take A", exact: true }).click();
    await page.getByRole("button", { name: "Select for comparison: UI FIXTURE: Opening take B", exact: true }).click();
    await page.getByRole("button", { name: "Select for comparison: UI FIXTURE: Standalone take", exact: true }).click();
    assert.equal(await page.locator('.take-select[aria-pressed="true"]').count(), 2);
    assert.equal(await page.locator('.job-card').filter({ hasText: "UI FIXTURE: Missing video" }).getByRole("button", { name: /comparison/ }).count(), 0);
    await page.getByRole("button", { name: "Compare takes", exact: true }).click();
    await page.getByRole("dialog", { name: "Compare your takes." }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll(".comparison-take video")].length === 2 && [...document.querySelectorAll(".comparison-take video")].every(video => video.readyState >= 2));
    await page.getByRole("button", { name: "Play both from start" }).click();
    await page.waitForFunction(() => [...document.querySelectorAll(".comparison-take video")].every(video => !video.paused && video.currentTime > 0));
    await page.getByRole("button", { name: "Pause both", exact: true }).click();
    assert.ok(await page.locator(".comparison-take video").evaluateAll(videos => videos.every(video => video.paused)));
    const columns = await page.locator(".comparison-grid").evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length);
    assert.equal(columns, mobile ? 1 : 2);
    await noOverflow(page);
    await page.screenshot({ path: path.join(output, `${label}-comparison-dark.png`) });
    await page.getByRole("button", { name: "Play both from start" }).click();
    await page.waitForFunction(() => [...document.querySelectorAll(".comparison-take video")].every(video => !video.paused));
    await page.evaluate(() => { globalThis.__comparisonPlayers = [...document.querySelectorAll(".comparison-take video")]; });
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.ok(await page.evaluate(() => globalThis.__comparisonPlayers.every(video => video.paused)), "Closing comparison must stop both players");
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await page.getByRole("button", { name: "Compare takes", exact: true }).click();
    await page.screenshot({ path: path.join(output, `${label}-comparison-light.png`) });
    await page.getByRole("button", { name: "Close take comparison" }).click();
    await navigate(page, "Storyboard", mobile);
    await page.getByRole("button", { name: "Open scene", exact: true }).click();
    await page.getByLabel("Describe your scene", { exact: false }).fill("UI FIXTURE: Updated ocean opening in soft morning light");
    await page.getByRole("button", { name: "Update shot", exact: true }).click();
    await navigate(page, "Storyboard", mobile);
    assert.equal(await page.locator(".storyboard-card").count(), 1, "Updating a shot must not create a duplicate");
    await page.getByRole("button", { name: "Duplicate scene 1" }).click();
    assert.equal(await page.locator(".storyboard-card").count(), 2);
    assert.match(await page.locator(".storyboard-card").nth(1).innerText(), /0 linked takes/, "Duplicate shots must not inherit another shot's renders");
    await page.getByRole("button", { name: "Open scene", exact: true }).first().click();
    await page.getByRole("button", { name: "Detach from storyboard shot" }).click();
    assert.equal(await page.locator(".linked-shot").count(), 0);
    await noOverflow(page);
    await context.close();
    console.log(`PASS ${label}: shot linking, render payload, shot filtering, two-take comparison/playback, both themes, update/duplicate/detach and no horizontal overflow`);
  }
  assert.deepEqual(failures, [], "Browser must have no uncaught application errors");
  console.log(`Screenshots: ${output}. All videos and accounts were local UI fixtures; no inference or real auth calls.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
