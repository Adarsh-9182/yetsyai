// Real-browser smoke test. Serves the app and drives Chromium through the core
// flows, asserting no console/page errors along the way.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };

const server = createServer(async (req, res) => {
  try {
    let p = normalize(decodeURIComponent(req.url.split("?")[0]));
    if (p === "/") p = "/index.html";
    const body = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

// Point CHROMIUM_PATH at a Chromium/Chrome binary, or let playwright-core find
// its own download. The bundled path is a convenience for CI images that ship
// Chromium under /opt/pw-browsers.
const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const errors = [];
let failed = false;
const fail = (m) => { failed = true; console.error("✗", m); };
const ok = (m) => console.log("✓", m);

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } }); // mobile
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(base, { waitUntil: "networkidle" });

  // Empty state present on first load.
  await page.waitForSelector(".empty");
  ok("empty state renders on first load");

  // Create a habit.
  await page.click(".empty .btn-primary");
  await page.waitForSelector("dialog.editor[open]");
  await page.fill("#habit-name", "Drink water");
  await page.click(".editor .emoji-chip:nth-child(2)");
  await page.click(".editor .color-chip.color-sky");
  await page.click(".editor-actions .btn-primary");
  await page.waitForSelector(".habit-card");
  const name = await page.textContent(".habit-card .habit-name");
  name === "Drink water" ? ok("habit created and listed") : fail(`habit name was "${name}"`);

  // Toggle complete → check state + streak.
  await page.click(".habit-card .check");
  await page.waitForSelector(".habit-card.is-done");
  const checked = await page.getAttribute(".habit-card .check", "aria-checked");
  checked === "true" ? ok("toggle marks complete (aria-checked)") : fail("aria-checked not true");
  const streak = await page.textContent(".habit-card .streak");
  streak.includes("1 day") ? ok("streak shows 1 day after first check") : fail(`streak text: ${streak}`);

  // Header ring should read 100%.
  const ring = await page.textContent(".ring-label");
  ring === "100%" ? ok("progress ring reads 100%") : fail(`ring: ${ring}`);

  // Insights tab.
  await page.click(".tabs .tab:nth-child(2)");
  await page.waitForSelector(".stat-grid");
  await page.waitForSelector(".habit-analytics");
  await page.waitForSelector(".heat .heat-cell");
  const active = await page.textContent(".stat-grid .stat:first-child .stat-value");
  active === "1" ? ok("insights: active habits = 1") : fail(`active count: ${active}`);
  const cells = await page.$$eval(".heat-cell", (n) => n.length);
  cells === 119 ? ok("heatmap renders 119 cells") : fail(`heatmap cells: ${cells}`);

  // Persistence across reload.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".habit-card.is-done");
  ok("state persists across reload (localStorage)");

  // Archive via kebab menu.
  await page.click(".habit-card .kebab");
  await page.waitForSelector(".menu");
  await page.click(".menu .menu-item:has-text('Archive')");
  await page.waitForSelector(".empty");
  ok("archive moves habit out of Today");

  if (errors.length) fail(`console/page errors: ${JSON.stringify(errors, null, 2)}`);
  else ok("no console or page errors");
} finally {
  await browser.close();
  server.close();
}

if (failed) { console.error("\nSMOKE TEST FAILED"); process.exit(1); }
console.log("\nAll smoke checks passed.");
