import { chromium, webkit } from "playwright";

const OUT = "reports/mobile-audit/screenshots/banner";
const targets = [
  { name: "desktop", browser: chromium, viewport: { width: 1440, height: 900 } },
  { name: "iphone13", browser: webkit, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: "ipad-air", browser: webkit, viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true },
];

const label = process.argv[2] || "after";

for (const t of targets) {
  const browser = await t.browser.launch();
  const context = await browser.newContext({
    viewport: t.viewport,
    isMobile: t.isMobile,
    hasTouch: t.hasTouch,
    deviceScaleFactor: t.isMobile ? 2 : 1,
  });
  const page = await context.newPage();
  await page.goto("http://localhost:8080/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200); // let carousel image settle
  await page.screenshot({ path: `${OUT}/home_${t.name}_${label}.png`, clip: { x: 0, y: 0, width: t.viewport.width, height: Math.min(500, t.viewport.height) } });
  await browser.close();
  console.log(`Captured ${t.name} (${label})`);
}
