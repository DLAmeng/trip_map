const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const OUTPUT_DIR = '/tmp/trip-ui-regression';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function getRect(page, selector) {
  return page.$eval(selector, (node) => {
    const rect = node.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const mobile = await browser.newContext({ ...devices['iPhone 13'] });

  try {
    const dashboardDesktop = await desktop.newPage();
    await dashboardDesktop.goto('http://127.0.0.1:5173/dashboard', { waitUntil: 'networkidle' });
    await dashboardDesktop.locator('.trip-card').first().waitFor({ state: 'visible', timeout: 15000 });
    await dashboardDesktop.screenshot({ path: path.join(OUTPUT_DIR, 'dashboard-desktop.png'), fullPage: true });
    const dashShell = await getRect(dashboardDesktop, '.dash-shell');
    assert(dashShell.width >= 1400, `dashboard shell should span the viewport, got width=${dashShell.width}`);
    assert(
      await dashboardDesktop.locator('.trip-actions-main').first().isVisible(),
      'dashboard trip card main action group missing',
    );
    assert(
      await dashboardDesktop.locator('.trip-actions-side').first().isVisible(),
      'dashboard trip card side action group missing',
    );
    await dashboardDesktop.close();

    const dashboardMobile = await mobile.newPage();
    await dashboardMobile.goto('http://127.0.0.1:5173/dashboard', { waitUntil: 'networkidle' });
    await dashboardMobile.locator('.dash-header-actions').waitFor({ state: 'visible', timeout: 15000 });
    await dashboardMobile.screenshot({ path: path.join(OUTPUT_DIR, 'dashboard-mobile.png'), fullPage: true });
    const headerCopy = await getRect(dashboardMobile, '.dash-header-copy');
    const headerActions = await getRect(dashboardMobile, '.dash-header-actions');
    assert(
      headerActions.top - headerCopy.bottom < 80,
      `dashboard mobile header gap is too large: ${headerActions.top - headerCopy.bottom}px`,
    );
    await dashboardMobile.close();

    const tripMobile = await mobile.newPage();
    await tripMobile.goto('http://127.0.0.1:5173/trip?id=current', { waitUntil: 'networkidle' });
    await tripMobile.locator('.mobile-trip-bottom-switcher').waitFor({ state: 'visible', timeout: 15000 });
    const loadingOverlay = tripMobile.locator('.map-loading-overlay');
    if (await loadingOverlay.count()) {
      await loadingOverlay.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    }
    await tripMobile.screenshot({ path: path.join(OUTPUT_DIR, 'trip-mobile.png'), fullPage: true });
    const switcherRect = await getRect(tripMobile, '.mobile-trip-bottom-switcher');
    assert(
      switcherRect.height <= 72,
      `trip mobile bottom switcher is too tall: ${switcherRect.height}px`,
    );
    const fabRects = await tripMobile.$$eval('.mobile-map-fab', (nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    );
    assert(fabRects.length >= 3, 'trip mobile floating actions are missing');
    fabRects.forEach((rect, index) => {
      assert(rect.width <= 42 && rect.height <= 42, `trip mobile fab #${index} is too large: ${rect.width}x${rect.height}`);
    });
    await tripMobile.close();

    const adminDesktop = await desktop.newPage();
    await adminDesktop.goto('http://127.0.0.1:5173/admin?id=current', { waitUntil: 'networkidle' });
    await adminDesktop.locator('.save-bar').waitFor({ state: 'visible', timeout: 15000 });
    const initialDesktopSaveBar = await getRect(adminDesktop, '.save-bar');
    await adminDesktop.screenshot({ path: path.join(OUTPUT_DIR, 'admin-desktop.png'), fullPage: false });
    await adminDesktop.evaluate(() => window.scrollTo(0, 900));
    await adminDesktop.waitForTimeout(200);
    const saveBarAfterScroll = await getRect(adminDesktop, '.save-bar');
    assert(
      saveBarAfterScroll.top < initialDesktopSaveBar.top - 200,
      `admin save bar should move with the page instead of sticking: initialTop=${initialDesktopSaveBar.top}, currentTop=${saveBarAfterScroll.top}`,
    );
    await adminDesktop.close();

    const adminMobile = await mobile.newPage();
    await adminMobile.goto('http://127.0.0.1:5173/admin?id=current', { waitUntil: 'networkidle' });
    await adminMobile.locator('.save-bar').waitFor({ state: 'visible', timeout: 15000 });
    const initialMobileSaveBar = await getRect(adminMobile, '.save-bar');
    await adminMobile.screenshot({ path: path.join(OUTPUT_DIR, 'admin-mobile.png'), fullPage: true });
    await adminMobile.evaluate(() => window.scrollTo(0, 520));
    await adminMobile.waitForTimeout(200);
    const mobileSaveBar = await getRect(adminMobile, '.save-bar');
    assert(
      mobileSaveBar.top < initialMobileSaveBar.top - 120,
      `admin mobile save bar should move with the page instead of staying fixed: initialTop=${initialMobileSaveBar.top}, currentTop=${mobileSaveBar.top}`,
    );
    await adminMobile.close();

    console.log(`ui regression smoke ok (${OUTPUT_DIR})`);
  } finally {
    await mobile.close();
    await desktop.close();
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
