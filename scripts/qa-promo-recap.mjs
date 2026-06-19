// Follow-up: open the promo "+ New code" form and confirm the preview ticket
// reads 20% OFF (not 0% OFF), and re-capture the /qa dashboard now that
// results.json is clean. Overwrites .qa-out/admin-promo.png + qa-dashboard.png.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const BASE = "http://localhost:3000";
const cookies = readFileSync("/tmp/cookie.txt", "utf8").trim().split(/;\s*/).filter(Boolean).map((p) => {
  const i = p.indexOf("="); return { name: p.slice(0, i), value: p.slice(i + 1), domain: "localhost", path: "/" };
});
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
await ctx.addCookies(cookies);

// Promo: open create form, read preview ticket.
{
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/promo`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(600);
  try { await page.locator('button:has-text("New code")').first().click({ timeout: 4000 }); await page.waitForTimeout(700); } catch {}
  const body = await page.locator("body").innerText();
  const zeroOff = /0%\s*OFF/i.test(body);
  const twentyOff = /20%\s*OFF/i.test(body);
  console.log(`promo-preview: zeroOff=${zeroOff} twentyOff=${twentyOff}`);
  await page.screenshot({ path: ".qa-out/admin-promo.png", fullPage: true });
  await page.close();
}

// Re-capture /qa dashboard now that results.json is all-green.
{
  const page = await ctx.newPage();
  await page.goto(`${BASE}/qa`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: ".qa-out/qa-dashboard.png", fullPage: true });
  console.log("qa-dashboard recaptured");
  await page.close();
}
await ctx.close();
await browser.close();
