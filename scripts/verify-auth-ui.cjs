// Local fixture-only check. Does not sign in to Google/GitHub or send email.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const arg = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const base = new URL(arg("--base-url") || "http://127.0.0.1:3011");
assert.ok(base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname));
const { chromium } = require(arg("--playwright-module") || "playwright");
const output = arg("--output-dir") || fs.mkdtempSync(path.join(os.tmpdir(), "yetsyai-auth-ui-"));
fs.mkdirSync(output, { recursive: true });
let browser;
async function main() {
  browser = await chromium.launch({ headless: true });
  for (const [label, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: "dark" });
    const page = await context.newPage();
    const errors = [], starts = [];
    let enabled = true, settingsError = false;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
      const request = route.request(), url = new URL(request.url());
      assert.equal(url.origin, base.origin);
      let body, status = 200;
      if (url.pathname === "/api/generations") body = { configured: false, authConfigured: true, signedIn: false, model: "UI fixture", provider: "huggingface", generations: [], usage: { used: 0, limit: 2 } };
      else if (url.pathname === "/api/account/oauth" && request.method() === "GET") { status = settingsError ? 503 : 200; body = settingsError ? { error: "Fixture settings unavailable" } : { providers: { google: enabled, github: enabled } }; }
      else if (url.pathname === "/api/account/oauth" && request.method() === "POST") { starts.push(request.postDataJSON().provider); status = 503; body = { error: "Fixture provider unavailable. Email sign-in still works." }; }
      else throw new Error(`Unexpected application request: ${url.pathname}`);
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(base.origin);
    await page.locator(".account-trigger").click();
    const google = page.getByRole("button", { name: "Continue with Google", exact: true });
    const github = page.getByRole("button", { name: "Continue with GitHub", exact: true });
    await page.waitForFunction(() => !document.querySelector(".social-sign-in button")?.disabled);
    await google.click();
    await page.getByRole("alert").filter({ hasText: "Fixture provider unavailable" }).waitFor();
    await github.click();
    await page.getByRole("alert").filter({ hasText: "Fixture provider unavailable" }).waitFor();
    assert.deepEqual(starts, ["google", "github"], "Social buttons work without submitting required email/password fields");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    assert.equal(await google.isVisible(), true); assert.equal(await github.isVisible(), true);
    await page.getByRole("button", { name: "Forgot password?", exact: true }).click();
    assert.equal(await page.locator(".social-sign-in").count(), 0);
    await page.getByRole("button", { name: "Back to sign in", exact: true }).click();
    await page.screenshot({ path: path.join(output, `${label}-social-dark.png`) });
    assert.ok(await page.getByRole("dialog").evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 1));
    await page.getByRole("button", { name: "Close account", exact: true }).click();
    await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
    enabled = false;
    await page.locator(".account-trigger").click();
    await page.getByText("Unavailable", { exact: true }).first().waitFor();
    assert.equal(await page.locator(".social-sign-in button").first().isDisabled(), true);
    assert.equal(await page.locator(".social-sign-in button").nth(1).isDisabled(), true);
    assert.equal(await page.getByRole("textbox", { name: "Email address" }).isEnabled(), true);
    await page.screenshot({ path: path.join(output, `${label}-social-light.png`) });
    await page.getByRole("button", { name: "Close account", exact: true }).click();
    settingsError = true;
    await page.locator(".account-trigger").click();
    await page.locator(".social-status").getByRole("button", { name: "Retry" }).waitFor();
    settingsError = false; enabled = true;
    await page.locator(".social-status").getByRole("button", { name: "Retry" }).click();
    await page.waitForFunction(() => !document.querySelector(".social-sign-in button")?.disabled);
    await page.getByRole("button", { name: "Close account", exact: true }).click();
    await page.goto(`${base.origin}/?account=oauth-error`);
    await page.getByRole("alert").filter({ hasText: "Social sign-in was cancelled" }).waitFor();
    assert.equal(new URL(page.url()).searchParams.has("account"), false);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${label}: Google/GitHub buttons, sign-in/signup/reset, disabled providers, outage retry, callback errors, both themes and no dialog overflow`);
  }
  console.log(`Screenshots: ${output}. Fixture APIs only; no real provider sign-in.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => browser?.close());
