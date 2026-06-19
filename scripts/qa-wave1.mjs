// Live-browser verification of Wave 1 UI (commit 7bb1987). Drives real Chromium.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const cookieHeader = readFileSync("/tmp/cookie.txt", "utf8").trim();
const OUT = ".qa-out";
mkdirSync(OUT, { recursive: true });

const STORE_ID = "39c8590d-b03b-4639-946b-c8c15c17a6cb"; // dmkad (admin-owned)
const BOOKING_ORDER = "cdef90c7-6560-4294-9eac-58ff38080153"; // created booking order
const TENANT = "http://dmkad.invoxai.io:3000";

function parseCookies(header, domain = "localhost") {
  return header.split(/;\s*/).filter(Boolean).map((pair) => {
    const i = pair.indexOf("=");
    return { name: pair.slice(0, i), value: pair.slice(i + 1), domain, path: "/" };
  });
}

const results = [];
function rec(name, url) {
  const r = { name, url, status: null, ok: false, screenshot: null, consoleErrors: [], pageErrors: [], failedResponses: [], notes: [] };
  results.push(r);
  return r;
}
function attach(page, r) {
  page.on("console", (m) => { if (m.type() === "error") r.consoleErrors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => r.pageErrors.push((e.message || String(e)).slice(0, 300)));
  page.on("response", (rp) => { const s = rp.status(); if (s >= 400) r.failedResponses.push({ status: s, url: rp.url().replace(/^https?:\/\/[^/]+/, "") }); });
}

const browser = await chromium.launch();
const auth = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
await auth.addCookies(parseCookies(cookieHeader));

// ───── 1. PROMO ON BILLING (seller) ─────
{
  const r = rec("1-promo-on-billing", "/dashboard/billing");
  const page = await auth.newPage(); attach(page, r);
  const resp = await page.goto(`${BASE}/dashboard/billing`, { waitUntil: "networkidle" });
  r.status = resp.status();
  r.finalUrl = page.url();
  await page.waitForTimeout(600);
  r.promoInputCount = await page.locator('input[placeholder="ENTER CODE"]').count();
  r.promoLabel = await page.getByText(/promo code/i).count();
  r.toggleWrap = await page.locator('.bl-toggle').count();
  r.monthlyBtn = await page.locator('.bl-toggle button', { hasText: /monthly/i }).count();
  r.annualBtn = await page.locator('.bl-toggle button', { hasText: /annual/i }).count();
  r.planCards = await page.locator('.bl-plan').count();
  r.planFeatureLists = await page.locator('.bl-plan .bl-flist').count();
  r.selectPlanBtns = await page.getByRole("button", { name: /select plan/i }).count();
  r.screenshot = `${OUT}/wave1-1-billing-promo.png`;
  await page.screenshot({ path: r.screenshot, fullPage: true });
  // Try clicking annual toggle to confirm it swaps
  if (r.annualBtn) {
    try {
      await page.locator('.bl-toggle button', { hasText: /annual/i }).click();
      await page.waitForTimeout(400);
      r.afterAnnualPlanCards = await page.locator('.bl-plan').count();
      await page.screenshot({ path: `${OUT}/wave1-1b-billing-annual.png`, fullPage: true });
      await page.locator('.bl-toggle button', { hasText: /monthly/i }).click();
      await page.waitForTimeout(300);
    } catch (e) { r.notes.push("toggle click err: " + e.message.slice(0, 120)); }
  }
  // Enter a (fake) promo code + click Select plan; assert request reaches /start. STOP before Razorpay charge.
  if (r.promoInputCount && r.selectPlanBtns) {
    try {
      await page.locator('input[placeholder="ENTER CODE"]').fill("QATESTCODE");
      let startHit = null;
      page.on("request", (req) => { if (req.url().includes("/api/plans/subscribe/start")) startHit = req.url(); });
      const startResp = page.waitForResponse((rp) => rp.url().includes("/api/plans/subscribe/start"), { timeout: 8000 }).catch(() => null);
      await page.getByRole("button", { name: /select plan/i }).first().click();
      const sr = await startResp;
      if (sr) { r.startReached = true; r.startStatus = sr.status(); try { r.startBody = JSON.stringify(await sr.json()).slice(0, 300); } catch {} }
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/wave1-1c-billing-promo-submitted.png`, fullPage: true });
    } catch (e) { r.notes.push("promo submit err: " + e.message.slice(0, 150)); }
  }
  r.ok = r.status === 200 && r.promoInputCount >= 1 && r.planCards >= 1 && r.planFeatureLists >= 1;
  await page.close();
}

// ───── 2. COMMISSION OVERRIDE (admin) ─────
{
  const r = rec("2-commission-override", `/admin/sellers/${STORE_ID}`);
  const page = await auth.newPage(); attach(page, r);
  const resp = await page.goto(`${BASE}/admin/sellers/${STORE_ID}`, { waitUntil: "networkidle" });
  r.status = resp.status();
  r.finalUrl = page.url();
  await page.waitForTimeout(500);
  const body = await page.locator("body").innerText();
  r.hasHeading = /commission override/i.test(body);
  r.hasEffectiveRate = /effective rate/i.test(body);
  r.overrideInput = await page.locator('input[aria-label="Commission override percentage"]').count();
  r.setBtn = await page.getByRole("button", { name: /set override/i }).count();
  r.clearBtn = await page.getByRole("button", { name: /clear override/i }).count();
  // capture effective rate text
  const m = body.match(/effective rate[\s\S]{0,40}/i);
  r.effectiveText = m ? m[0].replace(/\s+/g, " ").slice(0, 80) : null;
  r.screenshot = `${OUT}/wave1-2-commission.png`;
  await page.screenshot({ path: r.screenshot, fullPage: true });
  // scroll the override card into view + screenshot it cropped
  try {
    const card = page.locator('h3', { hasText: /commission override/i }).first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/wave1-2b-commission-card.png` });
  } catch (e) { r.notes.push("scroll err: " + e.message.slice(0, 100)); }
  r.ok = r.status === 200 && r.hasHeading && r.hasEffectiveRate && r.overrideInput >= 1 && r.setBtn >= 1;
  await page.close();
}

// ───── 3. PLAN FEATURES + INTERVAL (admin) ─────
{
  const r = rec("3-admin-plans", "/admin/plans");
  const page = await auth.newPage(); attach(page, r);
  const resp = await page.goto(`${BASE}/admin/plans`, { waitUntil: "networkidle" });
  r.status = resp.status();
  r.finalUrl = page.url();
  await page.waitForTimeout(500);
  const body = await page.locator("body").innerText();
  r.textareaCount = await page.locator('textarea').count();
  r.featureRemoveBtns = await page.locator('button[title="Remove feature"]').count();
  r.addFeatureBtns = await page.getByRole("button", { name: /^\+ add$/i }).count();
  r.newFeaturePlaceholders = await page.locator('input[placeholder="New feature line..."]').count();
  r.intervalToggle = await page.locator('.pa-toggle').count();
  r.toggleAllBtn = await page.locator('.pa-toggle button', { hasText: /^all \(/i }).count();
  r.toggleMonthly = await page.locator('.pa-toggle button', { hasText: /monthly \(/i }).count();
  r.toggleAnnual = await page.locator('.pa-toggle button', { hasText: /annual \(/i }).count();
  r.intervalSelects = await page.locator('select').count();
  r.screenshot = `${OUT}/wave1-3-admin-plans.png`;
  await page.screenshot({ path: r.screenshot, fullPage: true });
  // grab toggle counts text
  const toggleText = await page.locator('.pa-toggle').first().innerText().catch(() => "");
  r.toggleText = toggleText.replace(/\n/g, " | ");
  r.ok = r.status === 200 && r.textareaCount === 0 && r.featureRemoveBtns >= 1 && r.addFeatureBtns >= 1 && r.intervalToggle >= 1;
  await page.close();
}

// ───── 5a. BILLING-PDF SPLIT — billing platform invoices card ─────
{
  const r = rec("5a-billing-platform-invoices", "/dashboard/billing");
  const page = await auth.newPage(); attach(page, r);
  await page.goto(`${BASE}/dashboard/billing`, { waitUntil: "networkidle" });
  r.status = 200;
  await page.waitForTimeout(400);
  const body = await page.locator("body").innerText();
  r.hasPlatformInvoicesCard = /platform invoices/i.test(body);
  r.cardMentionsPlanWallet = /plan subscriptions and wallet recharges/i.test(body);
  // confirm download PDF links in the platform-invoices table
  r.invoiceDownloadLinks = await page.locator('a[href^="/api/invoices/"][download]').count();
  // confirm it's NOT labeled as buyer/order invoices
  r.hasBuyerInvoiceLabel = /buyer (order )?invoices|order invoices/i.test(body);
  r.screenshot = `${OUT}/wave1-5a-billing-platform-invoices.png`;
  // scroll to the platform invoices card
  try {
    await page.getByText("Platform invoices").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
  } catch {}
  await page.screenshot({ path: r.screenshot, fullPage: true });
  r.ok = r.hasPlatformInvoicesCard && !r.hasBuyerInvoiceLabel;
  await page.close();
}

// ───── 5b. BILLING-PDF SPLIT — orders drawer Download invoice PDF ─────
{
  const r = rec("5b-orders-invoice-pdf", "/dashboard/orders");
  const page = await auth.newPage(); attach(page, r);
  const resp = await page.goto(`${BASE}/dashboard/orders`, { waitUntil: "networkidle" });
  r.status = resp.status();
  r.finalUrl = page.url();
  await page.waitForTimeout(600);
  // open the order with an invoice: "Envato Elements — LifeTime" (order 1b16e80c) has INV-2026-000008
  let drawerOpened = false, hasInvoicePdf = false, invoiceHref = null;
  try {
    // click the first order row that has an invoice; try the Envato LifeTime row
    const row = page.getByText(/Envato Elements — LifeTime/i).first();
    if (await row.count()) {
      await row.click();
    } else {
      // fall back to first row
      await page.locator('table tbody tr, .dx-row, [role="row"]').first().click();
    }
    await page.waitForTimeout(700);
    drawerOpened = true;
    const pdfLink = page.locator('a:has-text("Download invoice PDF"), a[href^="/api/invoices/"][href$="/pdf"]');
    hasInvoicePdf = (await pdfLink.count()) >= 1;
    if (hasInvoicePdf) invoiceHref = await pdfLink.first().getAttribute("href");
  } catch (e) { r.notes.push("drawer err: " + e.message.slice(0, 150)); }
  r.drawerOpened = drawerOpened;
  r.hasInvoicePdf = hasInvoicePdf;
  r.invoiceHref = invoiceHref;
  r.screenshot = `${OUT}/wave1-5b-orders-drawer.png`;
  await page.screenshot({ path: r.screenshot, fullPage: true });
  r.ok = r.status === 200 && hasInvoicePdf;
  await page.close();
}

// ───── 6. FOCUS/TAP a11y ─────
{
  const r = rec("6-focus-a11y", "/dashboard");
  const page = await auth.newPage(); attach(page, r);
  const resp = await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  r.status = resp.status();
  await page.waitForTimeout(400);
  // 1) Mouse click a button → :focus:not(:focus-visible) should remove outline
  let mouseOutline = null, tabOutline = null;
  try {
    const btn = page.locator('button, a.btn, .btn').first();
    await btn.click();
    await page.waitForTimeout(150);
    mouseOutline = await btn.evaluate((el) => getComputedStyle(el).outlineStyle + " / width=" + getComputedStyle(el).outlineWidth);
  } catch (e) { r.notes.push("mouse focus err: " + e.message.slice(0, 100)); }
  // 2) Keyboard Tab → :focus-visible should show a ring
  try {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(150);
    tabOutline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return "no-active";
      const cs = getComputedStyle(el);
      return `tag=${el.tagName} outlineStyle=${cs.outlineStyle} outlineWidth=${cs.outlineWidth} outlineColor=${cs.outlineColor}`;
    });
  } catch (e) { r.notes.push("tab focus err: " + e.message.slice(0, 100)); }
  // Check the CSS rules are present in stylesheets
  const cssRules = await page.evaluate(() => {
    let foundNotFocusVisible = false, foundFocusVisible = false;
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      for (const rule of rules) {
        const t = rule.selectorText || "";
        if (/:focus:not\(:focus-visible\)/.test(t)) foundNotFocusVisible = true;
        if (/:focus-visible/.test(t) && /outline/.test(rule.cssText || "")) foundFocusVisible = true;
      }
    }
    return { foundNotFocusVisible, foundFocusVisible };
  });
  r.mouseOutline = mouseOutline;
  r.tabOutline = tabOutline;
  r.cssRules = cssRules;
  r.screenshot = `${OUT}/wave1-6-focus.png`;
  await page.screenshot({ path: r.screenshot, fullPage: true });
  r.ok = r.status === 200 && cssRules.foundNotFocusVisible && cssRules.foundFocusVisible;
  await page.close();
}

// ───── 7. NOTIFICATIONS bell anchor + mobile topbar ─────
{
  const r = rec("7-notifications", "/dashboard");
  const page = await auth.newPage(); attach(page, r);
  const resp = await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  r.status = resp.status();
  await page.waitForTimeout(400);
  let bellFound = false, dropdownVisible = false, beforeRect = null, afterScrollRect = null, bellRectAfter = null;
  try {
    const bell = page.locator('button[aria-label="Notifications"]').first();
    bellFound = (await bell.count()) >= 1;
    if (bellFound) {
      await bell.click();
      await page.waitForTimeout(400);
      // dropdown panel is a fixed portal with "Notifications" header
      const panel = page.locator('div', { has: page.getByText(/^Notifications$/) }).last();
      const bellBox = await bell.boundingBox();
      // find the fixed panel: look for the portal element with position fixed near the bell
      beforeRect = await page.evaluate(() => {
        const panels = [...document.querySelectorAll('div')].filter((d) => {
          const cs = getComputedStyle(d);
          return cs.position === "fixed" && parseInt(cs.zIndex) >= 1001;
        });
        const p = panels[0];
        if (!p) return null;
        const r = p.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right) };
      });
      dropdownVisible = !!beforeRect;
      r.bellBox = bellBox ? { x: Math.round(bellBox.x), bottom: Math.round(bellBox.y + bellBox.height) } : null;
      await page.screenshot({ path: `${OUT}/wave1-7a-bell-open.png`, fullPage: false });
      // Scroll the page while dropdown open, then re-measure both bell + panel
      await page.evaluate(() => window.scrollTo(0, 400));
      await page.waitForTimeout(350);
      afterScrollRect = await page.evaluate(() => {
        const panels = [...document.querySelectorAll('div')].filter((d) => {
          const cs = getComputedStyle(d);
          return cs.position === "fixed" && parseInt(cs.zIndex) >= 1001;
        });
        const p = panels[0];
        if (!p) return null;
        const r = p.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right) };
      });
      bellRectAfter = await bell.boundingBox().then((b) => b ? { x: Math.round(b.x), bottom: Math.round(b.y + b.height) } : null).catch(() => null);
      await page.screenshot({ path: `${OUT}/wave1-7b-bell-after-scroll.png`, fullPage: false });
    }
  } catch (e) { r.notes.push("bell err: " + e.message.slice(0, 150)); }
  r.bellFound = bellFound;
  r.dropdownVisible = dropdownVisible;
  r.beforeRect = beforeRect;
  r.afterScrollRect = afterScrollRect;
  r.bellRectAfter = bellRectAfter;
  // anchored = panel top tracks the bell bottom after scroll (within a small tolerance)
  if (afterScrollRect && bellRectAfter) {
    r.panelTracksBell = Math.abs(afterScrollRect.top - bellRectAfter.bottom) <= 16;
  }
  r.screenshot = `${OUT}/wave1-7a-bell-open.png`;
  await page.close();

  // mobile topbar at 390px
  const mctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await mctx.addCookies(parseCookies(cookieHeader));
  const mp = await mctx.newPage();
  const rm = rec("7m-mobile-topbar", "/dashboard @390px");
  attach(mp, rm);
  await mp.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  rm.status = 200;
  await mp.waitForTimeout(400);
  // measure topbar overflow
  rm.topbarOverflow = await mp.evaluate(() => {
    const tb = document.querySelector('header, .dx-topbar, .dx-header, [class*="topbar"]');
    if (!tb) return null;
    return { scrollW: tb.scrollWidth, clientW: tb.clientWidth, overflow: tb.scrollWidth > tb.clientWidth + 2 };
  });
  rm.bodyOverflowX = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  rm.screenshot = `${OUT}/wave1-7m-mobile-topbar.png`;
  await mp.screenshot({ path: rm.screenshot, fullPage: false });
  rm.ok = rm.status === 200 && rm.bodyOverflowX === false;
  await mctx.close();

  r.ok = r.status === 200 && r.bellFound && r.dropdownVisible && (r.panelTracksBell !== false);
}

await auth.close();
await browser.close();

// ───── 4 + 8: tenant/public browser (Host header resolves *.invoxai.io → 127.0.0.1) ─────
const tenantBrowser = await chromium.launch({
  args: ["--host-resolver-rules=MAP *.invoxai.io 127.0.0.1, MAP invoxai.io 127.0.0.1"],
});

// 4. PUBLIC PRICING TOGGLE (home #pricing)
{
  const r = rec("4-public-pricing-toggle", "http://invoxai.io:3000/#pricing");
  const ctx = await tenantBrowser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage(); attach(page, r);
  const resp = await page.goto(`http://invoxai.io:3000/`, { waitUntil: "networkidle" }).catch((e) => { r.notes.push("nav:" + e.message.slice(0, 120)); return null; });
  r.status = resp ? resp.status() : null;
  await page.waitForTimeout(500);
  await page.locator('#pricing').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  r.hasPricingSection = await page.locator('#pricing').count();
  r.toggleWrap = await page.locator('.mk-pricing-toggle').count();
  r.monthlyBtn = await page.locator('.mk-pricing-toggle button', { hasText: /monthly/i }).count();
  r.annualBtn = await page.locator('.mk-pricing-toggle button', { hasText: /annual/i }).count();
  // capture monthly prices
  const monthlyPrices = await page.locator('#pricing .mk-price, #pricing [class*="price"]').allInnerTexts().catch(() => []);
  r.monthlyPricesSample = monthlyPrices.slice(0, 6);
  await page.screenshot({ path: `${OUT}/wave1-4a-pricing-monthly.png`, fullPage: false });
  // click Annual
  let pricesChanged = false;
  try {
    await page.locator('.mk-pricing-toggle button', { hasText: /annual/i }).click();
    await page.waitForTimeout(500);
    const annualPrices = await page.locator('#pricing .mk-price, #pricing [class*="price"]').allInnerTexts().catch(() => []);
    r.annualPricesSample = annualPrices.slice(0, 6);
    pricesChanged = JSON.stringify(monthlyPrices) !== JSON.stringify(annualPrices);
    r.saveHintVisible = await page.getByText(/2 months free on annual/i).count();
    await page.screenshot({ path: `${OUT}/wave1-4b-pricing-annual.png`, fullPage: false });
  } catch (e) { r.notes.push("toggle err: " + e.message.slice(0, 120)); }
  r.pricesChanged = pricesChanged;
  r.screenshot = `${OUT}/wave1-4b-pricing-annual.png`;
  r.ok = r.status === 200 && r.toggleWrap >= 1 && r.monthlyBtn >= 1 && r.annualBtn >= 1 && pricesChanged;
  await ctx.close();
}

// 8. MOBILE PAY BAR (checkout page)
{
  // mobile
  const r = rec("8-mobile-pay-bar", `${TENANT}/book/checkout/${BOOKING_ORDER} @390px`);
  const mctx = await tenantBrowser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await mctx.newPage(); attach(page, r);
  const resp = await page.goto(`${TENANT}/book/checkout/${BOOKING_ORDER}`, { waitUntil: "networkidle" }).catch((e) => { r.notes.push("nav:" + e.message.slice(0, 120)); return null; });
  r.status = resp ? resp.status() : null;
  r.finalUrl = page.url();
  await page.waitForTimeout(500);
  const body = await page.locator("body").innerText();
  r.invalidCheckout = /order not found|invalid or expired/i.test(body);
  // pay bar fixed bottom visible; inline pay hidden
  r.payBarPresent = await page.locator('.co-pay-bar').count();
  r.payBarVisibleMobile = await page.locator('.co-pay-bar').first().isVisible().catch(() => false);
  r.inlinePayHiddenMobile = await page.locator('.co-inline-pay').first().isHidden().catch(() => null);
  // confirm fixed/bottom positioning
  r.payBarStyleMobile = await page.locator('.co-pay-bar').first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { position: cs.position, display: cs.display, bottom: cs.bottom, rectBottom: Math.round(r.bottom), winH: window.innerHeight };
  }).catch((e) => ({ err: e.message.slice(0, 80) }));
  r.screenshot = `${OUT}/wave1-8a-paybar-mobile.png`;
  await page.screenshot({ path: r.screenshot, fullPage: false });
  await mctx.close();

  // desktop
  const r2 = rec("8d-desktop-inline-pay", `${TENANT}/book/checkout/${BOOKING_ORDER} @1280px`);
  const dctx = await tenantBrowser.newContext({ viewport: { width: 1280, height: 900 } });
  const dpage = await dctx.newPage(); attach(dpage, r2);
  const dresp = await dpage.goto(`${TENANT}/book/checkout/${BOOKING_ORDER}`, { waitUntil: "networkidle" }).catch(() => null);
  r2.status = dresp ? dresp.status() : null;
  await dpage.waitForTimeout(400);
  r2.inlinePayVisibleDesktop = await dpage.locator('.co-inline-pay').first().isVisible().catch(() => false);
  r2.payBarHiddenDesktop = await dpage.locator('.co-pay-bar').first().isHidden().catch(() => null);
  r2.payBarStyleDesktop = await dpage.locator('.co-pay-bar').first().evaluate((el) => getComputedStyle(el).display).catch((e) => "err:" + e.message.slice(0, 60));
  r2.screenshot = `${OUT}/wave1-8b-paybar-desktop.png`;
  await dpage.screenshot({ path: r2.screenshot, fullPage: false });
  await dctx.close();

  r.ok = r.status === 200 && !r.invalidCheckout && r.payBarPresent >= 1 && r.payBarVisibleMobile === true && r.inlinePayHiddenMobile === true;
  r2.ok = r2.status === 200 && r2.inlinePayVisibleDesktop === true && r2.payBarHiddenDesktop === true;
}

await tenantBrowser.close();

const passed = results.filter((r) => r.ok).length;
writeFileSync(`${OUT}/wave1-results.json`, JSON.stringify({
  ranAt: new Date().toISOString(), total: results.length, passed, failed: results.length - passed,
  targets: results.map((r) => ({ name: r.name, url: r.url, status: r.status, ok: r.ok, screenshot: r.screenshot, consoleErrors: r.consoleErrors, pageErrors: r.pageErrors, failedResponses: r.failedResponses })),
  detail: results,
}, null, 2));
for (const r of results) console.log(JSON.stringify(r));
console.log("WAVE1_DONE passed=" + passed + "/" + results.length);
