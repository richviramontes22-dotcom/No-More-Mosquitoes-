// Completion + repair pass for the mobile audit. Uses domcontentloaded (not
// networkidle, which proved fragile under sustained load) and verifies the final
// URL after login so a silently-failed login can't masquerade as a successful
// capture of protected content. Writes results incrementally so a crash/kill
// doesn't lose completed work.
import { chromium, webkit, devices } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";

const BASE = "http://localhost:8080";
const OUT_DIR = "reports/mobile-audit/screenshots";
mkdirSync(OUT_DIR, { recursive: true });

const ACCOUNTS = JSON.parse(readFileSync("reports/mobile-audit/TEST_ACCOUNTS.json", "utf8"));
const byRole = Object.fromEntries(ACCOUNTS.map(a => [a.role, a]));

const RESULTS_PATH = "reports/mobile-audit/audit-results-finish.json";
const results = existsSync(RESULTS_PATH) ? JSON.parse(readFileSync(RESULTS_PATH, "utf8")) : [];
function save() { writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2)); }

async function loginViaUI(page, loginPath, email, password, expectedPathPrefix) {
  await page.goto(`${BASE}${loginPath}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((url) => url.pathname.startsWith(expectedPathPrefix) || url.pathname === "/onboarding", { timeout: 20000 });
  await page.waitForTimeout(800);
  if (!page.url().includes(expectedPathPrefix) && !page.url().includes("/onboarding")) {
    throw new Error(`Login did not land on expected path. Final URL: ${page.url()}`);
  }
}

async function auditPage(context, pageDef, deviceSlug) {
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300)); });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message.slice(0, 300)}`));

  const record = { page: pageDef.slug, path: pageDef.path, device: deviceSlug, consoleErrors: [], httpStatus: null, finalUrl: null, hasHorizontalOverflow: false, screenshots: {}, error: null };

  try {
    const resp = await page.goto(`${BASE}${pageDef.path}`, { waitUntil: "domcontentloaded", timeout: 25000 });
    record.httpStatus = resp?.status() ?? null;
    await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1200);
    record.finalUrl = page.url();

    const dims = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
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

async function runDevicePass(dev, pages, auth) {
  const isWebkitDevice = dev.defaultBrowserType === "webkit";
  const browserType = isWebkitDevice ? webkit : chromium;
  const browser = await browserType.launch();
  const context = await browser.newContext({ ...dev });

  if (auth) {
    const loginPage = await context.newPage();
    try {
      await loginViaUI(loginPage, auth.loginPath, auth.email, auth.password, auth.expectedPathPrefix);
      console.log(`  [login ok] ${auth.email} @ ${dev.slug}`);
    } catch (err) {
      console.error(`  LOGIN FAILED for ${auth.email}/${dev.slug}: ${err.message}`);
      await loginPage.close();
      await browser.close();
      return; // skip this device entirely rather than capture junk
    }
    await loginPage.close();
  }

  for (const pageDef of pages) {
    const rec = await auditPage(context, pageDef, dev.slug);
    results.push(rec);
    save();
    console.log(`  ${pageDef.slug} @ ${dev.slug}: status=${rec.httpStatus} url=${rec.finalUrl} overflow=${rec.hasHorizontalOverflow} errors=${rec.consoleErrors.length}${rec.error ? " ERROR:" + rec.error : ""}`);
  }
  await browser.close();
  // brief pause to let the OS fully reap the closed browser's processes before the next launch
  await new Promise((r) => setTimeout(r, 1500));
}

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

const adminAuth = { loginPath: "/admin/login", expectedPathPrefix: "/admin", ...byRole.admin };
const employeeAuth = { loginPath: "/employee/login", expectedPathPrefix: "/employee", ...byRole.employee };
const customerAuth = { loginPath: "/login", expectedPathPrefix: "/dashboard", ...byRole.customer };

const MODE = process.argv[2]; // which chunk to run, so each invocation is short-lived

if (MODE === "admin-iphone13") {
  await runDevicePass({ slug: "iphone-13", ...devices["iPhone 13"] }, ADMIN_PAGES, adminAuth);
} else if (MODE === "admin-zfold") {
  await runDevicePass({ slug: "galaxy-z-fold-6", ...devices["Galaxy Z Fold 6"] }, ADMIN_PAGES, adminAuth);
} else if (MODE === "admin-ipad") {
  await runDevicePass({ slug: "ipad-gen7", ...devices["iPad (gen 7)"] }, ADMIN_PAGES, adminAuth);
} else if (MODE === "admin-pixel7-redo") {
  await runDevicePass({ slug: "pixel-7", ...devices["Pixel 7"] }, [
    { slug: "admin-visits", path: "/admin/visits" },
    { slug: "admin-tickets", path: "/admin/tickets" },
    { slug: "admin-website-manager", path: "/admin/website-manager" },
  ], adminAuth);
} else if (MODE === "admin-overview-tier2") {
  const TIER2 = [
    { slug: "iphone-se", ...devices["iPhone SE"] },
    { slug: "iphone-15-pro-max", ...devices["iPhone 15 Pro Max"] },
    { slug: "pixel-8-pro", ...devices["Pixel 8 Pro"] },
    { slug: "galaxy-s24", ...devices["Galaxy S24"] },
    { slug: "galaxy-tab-s9", ...devices["Galaxy Tab S9"] },
    { slug: "ipad-mini", ...devices["iPad Mini"] },
    { slug: "ipad-pro-11", ...devices["iPad Pro 11"] },
    { slug: "galaxy-z-flip-6", ...devices["Galaxy Z Flip 6"] },
  ];
  for (const dev of TIER2) {
    await runDevicePass(dev, [{ slug: "admin-overview", path: "/admin" }], adminAuth);
  }
} else if (MODE === "employee-iphone13-redo") {
  await runDevicePass({ slug: "iphone-13", ...devices["iPhone 13"] }, [
    { slug: "employee-messages", path: "/employee/messages" },
    { slug: "employee-onboarding", path: "/employee/onboarding" },
  ], employeeAuth);
} else if (MODE === "employee-ipadmini-redo") {
  await runDevicePass({ slug: "ipad-mini", ...devices["iPad Mini"] }, [
    { slug: "employee-dashboard", path: "/employee" },
  ], employeeAuth);
} else if (MODE === "customer-iphonese-redo") {
  await runDevicePass({ slug: "iphone-se", ...devices["iPhone SE"] }, [
    { slug: "dashboard", path: "/dashboard" },
  ], customerAuth);
} else if (MODE === "customer-galaxys24-redo") {
  await runDevicePass({ slug: "galaxy-s24", ...devices["Galaxy S24"] }, [
    { slug: "dashboard", path: "/dashboard" },
  ], customerAuth);
} else {
  console.error("Unknown mode:", MODE);
  process.exit(1);
}

console.log("Chunk done.");
