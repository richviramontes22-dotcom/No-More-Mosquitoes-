// Mobile UX audit — captures top/middle/bottom screenshots, checks for horizontal
// overflow, and records console errors for every reachable page across a curated
// device matrix. Runs against the local dev server only (no production writes).
import { chromium, webkit, devices } from "playwright";
import { mkdirSync, writeFileSync, existsSync } from "fs";

const BASE = "http://localhost:8080";
const OUT_DIR = "reports/mobile-audit/screenshots";
mkdirSync(OUT_DIR, { recursive: true });

// ── Device matrix ────────────────────────────────────────────────────────────
// Tier 1: run for EVERY page (one representative per required category).
// Tier 2: run ONLY for flagship pages (extra iOS/Android/tablet/foldable coverage).
const TIER1 = [
  { slug: "iphone-13", ...devices["iPhone 13"] },
  { slug: "pixel-7", ...devices["Pixel 7"] },
  { slug: "galaxy-z-fold-6", ...devices["Galaxy Z Fold 6"] },
  { slug: "ipad-gen7", ...devices["iPad (gen 7)"] }, // closest built-in descriptor to iPad Air
];

const TIER2_EXTRA = [
  { slug: "iphone-se", ...devices["iPhone SE"] },
  { slug: "iphone-15-pro-max", ...devices["iPhone 15 Pro Max"] },
  { slug: "pixel-8-pro", ...devices["Pixel 8 Pro"] },
  { slug: "galaxy-s24", ...devices["Galaxy S24"] },
  { slug: "galaxy-tab-s9", ...devices["Galaxy Tab S9"] },
  { slug: "ipad-mini", ...devices["iPad Mini"] },
  { slug: "ipad-pro-11", ...devices["iPad Pro 11"] },
  { slug: "galaxy-z-flip-6", ...devices["Galaxy Z Flip 6"] },
];

const FLAGSHIP_SLUGS = new Set(["home", "pricing", "schedule", "login", "dashboard", "employee-dashboard", "admin-overview"]);

// ── Auth ──────────────────────────────────────────────────────────────────────
const ACCOUNTS = JSON.parse(await import("fs").then(fs => fs.promises.readFile("reports/mobile-audit/TEST_ACCOUNTS.json", "utf8")));
const byRole = Object.fromEntries(ACCOUNTS.map(a => [a.role, a]));

async function loginViaUI(page, loginPath, email, password) {
  await page.goto(`${BASE}${loginPath}`, { waitUntil: "networkidle", timeout: 30000 });
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

// ── Pages ─────────────────────────────────────────────────────────────────────
const PUBLIC_PAGES = [
  { slug: "home", path: "/" },
  { slug: "pricing", path: "/pricing" },
  { slug: "services", path: "/services" },
  { slug: "our-story", path: "/our-story" },
  { slug: "reviews", path: "/reviews" },
  { slug: "service-area", path: "/service-area" },
  { slug: "faq", path: "/faq" },
  { slug: "blog", path: "/blog" },
  { slug: "contact", path: "/contact" },
  { slug: "safety", path: "/safety" },
  { slug: "licenses", path: "/licenses" },
  { slug: "schedule", path: "/schedule" },
  { slug: "login", path: "/login" },
  { slug: "forgot-password", path: "/forgot-password" },
  { slug: "guarantee", path: "/guarantee" },
  { slug: "legal-terms", path: "/legal/terms" },
  { slug: "legal-privacy", path: "/legal/privacy" },
  { slug: "legal-service-agreement", path: "/legal/service-agreement" },
  { slug: "legal-pesticide-consent", path: "/legal/pesticide-consent" },
];

const CUSTOMER_PAGES = [
  { slug: "dashboard", path: "/dashboard" },
  { slug: "dashboard-appointments", path: "/dashboard/appointments" },
  { slug: "dashboard-billing", path: "/dashboard/billing" },
  { slug: "dashboard-properties", path: "/dashboard/properties" },
  { slug: "dashboard-marketplace", path: "/dashboard/marketplace" },
  { slug: "dashboard-help", path: "/dashboard/help" },
  { slug: "dashboard-profile", path: "/dashboard/profile" },
];

const EMPLOYEE_PAGES = [
  { slug: "employee-dashboard", path: "/employee" },
  { slug: "employee-assignments", path: "/employee/assignments" },
  { slug: "employee-messages", path: "/employee/messages" },
  { slug: "employee-timesheets", path: "/employee/timesheets" },
  { slug: "employee-profile", path: "/employee/profile" },
  { slug: "employee-onboarding", path: "/employee/onboarding" },
  { slug: "employee-route", path: "/employee/route" },
];

// Reachable via the admin test account (RequireCustomerService allows admin too)
const CS_TOOL_PAGES = [
  { slug: "employee-tickets", path: "/employee/tickets" },
  { slug: "employee-satisfaction", path: "/employee/satisfaction" },
  { slug: "employee-reschedule-requests", path: "/employee/reschedule-requests" },
];

const ADMIN_PAGES = [
  { slug: "admin-overview", path: "/admin" },
  { slug: "admin-customers", path: "/admin/customers" },
  { slug: "admin-properties", path: "/admin/properties" },
  { slug: "admin-appointments", path: "/admin/appointments" },
  { slug: "admin-reschedule-requests", path: "/admin/reschedule-requests" },
  { slug: "admin-visits", path: "/admin/visits" },
  { slug: "admin-messages", path: "/admin/messages" },
  { slug: "admin-tickets", path: "/admin/tickets" },
  { slug: "admin-route-planning", path: "/admin/route-planning" },
  { slug: "admin-billing", path: "/admin/billing" },
  { slug: "admin-revenue", path: "/admin/revenue" },
  { slug: "admin-employee-tracking", path: "/admin/employee-tracking" },
  { slug: "admin-website-manager", path: "/admin/website-manager" },
  { slug: "admin-content", path: "/admin/content" },
  { slug: "admin-pricing", path: "/admin/pricing" },
  { slug: "admin-promos", path: "/admin/promos" },
  { slug: "admin-referrals", path: "/admin/referrals" },
  { slug: "admin-service-areas", path: "/admin/service-areas" },
  { slug: "admin-employees", path: "/admin/employees" },
  { slug: "admin-legal-compliance", path: "/admin/legal-compliance" },
  { slug: "admin-legal", path: "/admin/legal" },
  { slug: "admin-workforce", path: "/admin/workforce" },
  { slug: "admin-debug", path: "/admin/debug" },
  { slug: "admin-email-management", path: "/admin/email-management" },
  { slug: "admin-workforce-schedules", path: "/admin/workforce/schedules" },
  { slug: "admin-workforce-capacity", path: "/admin/workforce/capacity" },
  { slug: "admin-reports", path: "/admin/reports" },
  { slug: "admin-analytics", path: "/admin/analytics" },
  { slug: "admin-territory-intelligence", path: "/admin/territory-intelligence" },
  { slug: "admin-workforce-optimization", path: "/admin/workforce-optimization" },
  { slug: "admin-satisfaction", path: "/admin/satisfaction" },
  { slug: "admin-business-hours", path: "/admin/business-hours" },
  { slug: "admin-notifications", path: "/admin/notifications" },
  { slug: "admin-alerts", path: "/admin/alerts" },
  { slug: "admin-leads", path: "/admin/leads" },
  { slug: "admin-settings", path: "/admin/settings" },
];

const GROUPS = [
  { name: "public", pages: PUBLIC_PAGES, auth: null },
  { name: "customer", pages: CUSTOMER_PAGES, auth: { loginPath: "/login", ...byRole.customer } },
  { name: "employee", pages: EMPLOYEE_PAGES, auth: { loginPath: "/employee/login", ...byRole.employee } },
  { name: "cs-tools-via-admin", pages: CS_TOOL_PAGES, auth: { loginPath: "/employee/login", ...byRole.admin } },
  { name: "admin", pages: ADMIN_PAGES, auth: { loginPath: "/admin/login", ...byRole.admin } },
];

const results = [];

async function auditPage(context, group, pageDef, deviceSlug) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300)); });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message.slice(0, 300)}`));

  const record = { group: group.name, page: pageDef.slug, path: pageDef.path, device: deviceSlug, consoleErrors: [], httpStatus: null, hasHorizontalOverflow: false, scrollWidth: null, clientWidth: null, screenshots: {}, error: null };

  try {
    const resp = await page.goto(`${BASE}${pageDef.path}`, { waitUntil: "networkidle", timeout: 20000 });
    record.httpStatus = resp?.status() ?? null;
    await page.waitForTimeout(900);

    const dims = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    record.scrollWidth = dims.scrollWidth;
    record.clientWidth = dims.clientWidth;
    record.hasHorizontalOverflow = dims.scrollWidth > dims.clientWidth + 2;

    const base = `${OUT_DIR}/${pageDef.slug}_${deviceSlug}_portrait`;
    await page.screenshot({ path: `${base}_top.png` });
    record.screenshots.top = `${base}_top.png`;

    if (dims.scrollHeight > dims.clientWidth) {
      await page.evaluate((h) => window.scrollTo(0, h / 2), dims.scrollHeight);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${base}_middle.png` });
      record.screenshots.middle = `${base}_middle.png`;

      await page.evaluate((h) => window.scrollTo(0, h), dims.scrollHeight);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${base}_bottom.png` });
      record.screenshots.bottom = `${base}_bottom.png`;
    }
  } catch (err) {
    record.error = String(err.message || err).slice(0, 300);
  }

  record.consoleErrors = consoleErrors.slice(0, 15);
  await page.close();
  return record;
}

for (const group of GROUPS) {
  console.log(`\n=== Group: ${group.name} (${group.pages.length} pages) ===`);
  for (const dev of TIER1) {
    const isWebkitDevice = dev.defaultBrowserType === "webkit";
    const browserType = isWebkitDevice ? webkit : chromium;
    const browser = await browserType.launch();
    const context = await browser.newContext({ ...dev });

    if (group.auth) {
      const loginPage = await context.newPage();
      try {
        await loginViaUI(loginPage, group.auth.loginPath, group.auth.email, group.auth.password);
      } catch (err) {
        console.error(`  LOGIN FAILED for ${group.name}/${dev.slug}: ${err.message}`);
      }
      await loginPage.close();
    }

    for (const pageDef of group.pages) {
      const rec = await auditPage(context, group, pageDef, dev.slug);
      results.push(rec);
      console.log(`  ${pageDef.slug} @ ${dev.slug}: status=${rec.httpStatus} overflow=${rec.hasHorizontalOverflow} errors=${rec.consoleErrors.length}${rec.error ? " ERROR:" + rec.error : ""}`);
    }
    await browser.close();
  }

  // Tier 2 extra devices, flagship pages only — one browser per device, all flagship pages within it.
  const flagshipPages = group.pages.filter(p => FLAGSHIP_SLUGS.has(p.slug));
  for (const dev of TIER2_EXTRA) {
    if (!flagshipPages.length) continue;
    const isWebkitDevice = dev.defaultBrowserType === "webkit";
    const browserType = isWebkitDevice ? webkit : chromium;
    const browser = await browserType.launch();
    const context = await browser.newContext({ ...dev });

    if (group.auth) {
      const loginPage = await context.newPage();
      try {
        await loginViaUI(loginPage, group.auth.loginPath, group.auth.email, group.auth.password);
      } catch (err) {
        console.error(`  LOGIN FAILED for ${group.name}/${dev.slug}: ${err.message}`);
      }
      await loginPage.close();
    }

    for (const pageDef of flagshipPages) {
      const rec = await auditPage(context, group, pageDef, dev.slug);
      results.push(rec);
      console.log(`  [tier2] ${pageDef.slug} @ ${dev.slug}: status=${rec.httpStatus} overflow=${rec.hasHorizontalOverflow} errors=${rec.consoleErrors.length}`);
    }
    await browser.close();
  }
}

writeFileSync("reports/mobile-audit/audit-results.json", JSON.stringify(results, null, 2));
console.log(`\nDone. ${results.length} page/device captures. Wrote reports/mobile-audit/audit-results.json`);
