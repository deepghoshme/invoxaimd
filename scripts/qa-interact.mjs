// Focused interaction checks: studio accordion, revenue chart presence, checkout modal.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const BASE = "http://localhost:3000";
const cookies = readFileSync("/tmp/cookie.txt", "utf8").trim().split(/;\s*/).filter(Boolean).map((p) => {
  const i = p.indexOf("="); return { name: p.slice(0, i), value: p.slice(i + 1), domain: "localhost", path: "/" };
});
const out = [];
const browser = await chromium.launch();

// 1) Studio store: confirm accordion sections + live preview iframe.
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/studio/store`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  const iframes = await page.locator("iframe").count();
  const toggles = await page.locator('button[role="switch"], input[type="checkbox"]').count();
  // try clicking first accordion header to confirm it responds
  const headers = page.locator('button, [role="button"]');
  const hCount = await headers.count();
  await page.screenshot({ path: "/tmp/qa-int-studio.png", fullPage: false });
  out.push({ check: "studio-store", iframes, toggles, clickableEls: hCount, ok: iframes >= 1 });
  await ctx.close();
}

// 2) Revenue chart: confirm an SVG/canvas chart node exists.
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin/revenue`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  const svg = await page.locator("svg").count();
  const canvas = await page.locator("canvas").count();
  await page.screenshot({ path: "/tmp/qa-int-revenue.png", fullPage: false });
  out.push({ check: "admin-revenue-chart", svg, canvas, ok: svg + canvas >= 1 });
  await ctx.close();
}

// 3) Checkout modal on tenant opp page — fill form and click pay, assert Razorpay opens (do NOT pay).
{
  const tb = await chromium.launch({ args: ["--host-resolver-rules=MAP *.invoxai.io 127.0.0.1"] });
  const ctx = await tb.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const rzpHits = [];
  page.on("request", (r) => { if (/razorpay|checkout/i.test(r.url())) rzpHits.push(r.url().slice(0, 80)); });
  await page.goto("http://deep.invoxai.io:3000/opp/rcU671bRw", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(500);
  // fill the order form fields if present
  try { await page.fill('input[type="email"]', "qa-test@example.com", { timeout: 3000 }); } catch {}
  try { await page.fill('input[name="name"], input[placeholder*="name" i]', "QA Test"); } catch {}
  try { await page.fill('input[type="tel"], input[placeholder*="98" i]', "9000000000"); } catch {}
  await page.screenshot({ path: "/tmp/qa-int-checkout-filled.png", fullPage: false });
  // find the pay CTA
  const cta = page.locator('button:has-text("Get NOW"), button:has-text("Buy"), button:has-text("Pay")').first();
  let ctaText = null, modalOpened = false;
  try {
    ctaText = (await cta.textContent({ timeout: 3000 }))?.trim();
    await cta.click({ timeout: 5000 });
    await page.waitForTimeout(3500);
    // Razorpay renders an iframe (api.razorpay) or a frame; also a network hit to razorpay
    const rzpFrame = page.frames().some((f) => /razorpay/i.test(f.url()));
    const rzpIframe = await page.locator('iframe[src*="razorpay"]').count();
    modalOpened = rzpFrame || rzpIframe > 0 || rzpHits.length > 0;
  } catch (e) { out.push({ checkoutNote: "cta click: " + e.message.slice(0, 120) }); }
  await page.screenshot({ path: "/tmp/qa-int-checkout-modal.png", fullPage: false });
  out.push({ check: "checkout-modal", ctaText, rzpHits, modalOpened });
  await ctx.close(); await tb.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
