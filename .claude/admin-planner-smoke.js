const { chromium } = require('playwright');

async function assertVisible(locator, message) {
  if (!(await locator.isVisible())) {
    throw new Error(message);
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  page.on('pageerror', (error) => {
    throw error;
  });

  await page.goto('http://127.0.0.1:5173/admin?id=current', { waitUntil: 'networkidle' });
  await page.locator('.planner-board-panel').waitFor({ state: 'visible', timeout: 15000 });

  await assertVisible(page.locator('.planner-board-panel'), 'planner board missing');
  await assertVisible(page.locator('.planner-inspector-panel'), 'planner inspector missing');
  await assertVisible(page.locator('.admin-trip-map-canvas'), 'admin map missing');

  const initialSpotCount = await page.locator('.planner-spot-card').count();
  if (initialSpotCount < 2) {
    throw new Error(`expected at least 2 planner spots, got ${initialSpotCount}`);
  }

  await page.locator('.planner-spot-card').first().click();
  await assertVisible(
    page.locator('.planner-inspector-panel').getByRole('heading', { name: '景点详情' }),
    'spot inspector did not open',
  );

  await page.locator('.planner-leg-chip').first().click();
  await assertVisible(
    page.locator('.planner-inspector-panel').getByRole('heading', { name: '路线设置' }),
    'route inspector did not open',
  );

  await page.locator('.planner-spot-select input').nth(0).check();
  await page.locator('.planner-spot-select input').nth(1).check();
  const bulkCount = await page.locator('.planner-bulk-count').textContent();
  if (!bulkCount || !bulkCount.includes('2')) {
    throw new Error(`bulk selection count did not update: ${bulkCount}`);
  }

  await page.getByRole('button', { name: '地图新增模式' }).click();
  const mapCanvas = page.locator('.admin-trip-map-canvas');
  const box = await mapCanvas.boundingBox();
  if (!box) {
    throw new Error('map canvas has no bounding box');
  }
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.5);
  await page.waitForFunction(
    (count) => document.querySelectorAll('.planner-spot-card').length === count + 1,
    initialSpotCount,
    { timeout: 10000 },
  );

  await page.getByRole('button', { name: '撤销' }).click();
  await page.waitForFunction(
    (count) => document.querySelectorAll('.planner-spot-card').length === count,
    initialSpotCount,
    { timeout: 10000 },
  );

  const jumpButtons = page.locator('.issue-jump-btn');
  if (await jumpButtons.count()) {
    await jumpButtons.first().click();
    await page.waitForFunction(() => {
      return Boolean(
        document.querySelector('.planner-spot-card.is-selected') ||
        document.querySelector('.planner-leg-chip.is-selected'),
      );
    }, { timeout: 8000 });
  }

  await browser.close();
  console.log('admin planner smoke ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
