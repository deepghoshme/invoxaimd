// Live-browser QA sweep. Drives real headless Chromium against the running app.
// Usage: node scripts/qa-sweep.mjs
// Prints one JSON line per target: {name,url,status,consoleErrors[],pageErrors[],failedResponses[]}
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const cookieHeader = readFileSync("/tmp/cookie.txt", "utf8").trim();

// Publish screenshots + a results.json into public/_qa so the /qa dashboard
// (live.invoxai.io/qa) can render the latest run. Served statically at /_qa/*.
const OUT = "public/_qa";
mkdirSync(OUT, { recursive: true });
const results = [];

// Parse "name=value; name2=value2" into Playwright cookie objects for localhost.
function parseCookies(header, domain = "localhost") {
  return header.split(/;\s*/).filter(Boolean).map((pair) => {
    const i = pair.indexOf("=");
    return { name: pair.slice(0, i), value: pair.slice(i + 1), domain, path: "/" };
  });
}

// Public (no auth) — default host.
const PUBLIC = [
  { name: "home", url: `${BASE}/` },
  { name: "login", url: `${BASE}/login` },
];

// Tenant pages: rendered by Host header. We resolve the real tenant hostname to
// 127.0.0.1:3000 via Chromium --host-resolver-rules so the browser sends the
// correct Host header (extraHTTPHeaders can't override Host — ERR_INVALID_ARGUMENT).
const TENANT = [
  { name: "opp-deep", url: `http://deep.invoxai.io:3000/opp/rcU671bRw` },
  { name: "event-dmkad", url: `http://dmkad.invoxai.io:3000/event/qgMeWZmUm` },
  { name: "course-dmkad", url: `http://dmkad.invoxai.io:3000/course/0kFsBW4n2` },
];

// Authenticated admin pages — use minted admin cookies.
const AUTH = [
  { name: "dashboard", url: `${BASE}/dashboard` },
  { name: "bio-edit", url: `${BASE}/dashboard/pages/bio/edit` },
  { name: "studio-store", url: `${BASE}/studio/store` },
  { name: "admin", url: `${BASE}/admin` },
  { name: "admin-orders", url: `${BASE}/admin/orders` },
  { name: "admin-revenue", url: `${BASE}/admin/revenue` },
  { name: "billing", url: `${BASE}/dashboard/billing` },
];

function attach(page, rec) {
  page.on("console", (m) => { if (m.type() === "error") rec.consoleErrors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => rec.pageErrors.push((e.message || String(e)).slice(0, 300)));
  page.on("response", (r) => {
    const s = r.status();
    if (s >= 400) rec.failedResponses.push({ status: s, url: r.url().replace(/^https?:\/\/[^/]+/, "") });
  });
}

async function visit(context, t) {
  const rec = { name: t.name, url: t.url, status: null, consoleErrors: [], pageErrors: [], failedResponses: [] };
  const page = await context.newPage();
  attach(page, rec);
  try {
    const resp = await page.goto(t.url, { waitUntil: "networkidle", timeout: 30000 });
    rec.status = resp ? resp.status() : null;
    rec.finalUrl = page.url().replace(BASE, "");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${t.name}.png`, fullPage: true });
  } catch (e) {
    rec.pageErrors.push("NAV: " + (e.message || String(e)).slice(0, 200));
    try { await page.screenshot({ path: `${OUT}/${t.name}.png`, fullPage: true }); } catch {}
  }
  rec.screenshot = `/_qa/${t.name}.png`;
  rec.ok = rec.status === 200 && rec.consoleErrors.length === 0 && rec.pageErrors.length === 0 && rec.failedResponses.length === 0;
  results.push(rec);
  console.log(JSON.stringify(rec));
  await page.close();
  return rec;
}

const browser = await chromium.launch();

// Public context
const pub = await browser.newContext({ viewport: { width: 1280, height: 900 } });
for (const t of PUBLIC) await visit(pub, t);

// Auth context
const auth = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await auth.addCookies(parseCookies(cookieHeader));
for (const t of AUTH) await visit(auth, t);
await auth.close();
await pub.close();
await browser.close();

// Tenant browser: resolve tenant hostnames -> 127.0.0.1:3000 so real Host header flows.
const tenantBrowser = await chromium.launch({
  args: ["--host-resolver-rules=MAP *.invoxai.io 127.0.0.1, MAP invoxai.io 127.0.0.1"],
});
const tctx = await tenantBrowser.newContext({ viewport: { width: 1280, height: 900 } });
for (const t of TENANT) await visit(tctx, t);
await tctx.close();
await tenantBrowser.close();

// Publish the run for the /qa dashboard.
const summary = {
  ranAt: new Date().toISOString(),
  total: results.length,
  passed: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  targets: results,
};
writeFileSync(`${OUT}/results.json`, JSON.stringify(summary, null, 2));
console.log("SWEEP_DONE");
