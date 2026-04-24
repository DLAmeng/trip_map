const { chromium, devices } = require('playwright');

function shouldAbortGoogleMaps(url) {
  return (
    url.includes('maps.googleapis.com') ||
    url.includes('maps.gstatic.com') ||
    url.includes('/maps/api/js')
  );
}

async function assertVisible(locator, message) {
  if (!(await locator.isVisible())) {
    throw new Error(message);
  }
}

async function assertSearchParam(page, name, expected, message) {
  const actual = new URL(page.url()).searchParams.get(name);
  if (actual !== expected) {
    throw new Error(`${message}: expected ${name}=${expected}, got ${actual}`);
  }
}

async function assertSearchParamPresent(page, name, message) {
  const actual = new URL(page.url()).searchParams.get(name);
  if (!actual) {
    throw new Error(`${message}: missing ${name}`);
  }
}

async function openLeafletFallbackPage(browser, mode = 'desktop') {
  const context = mode === 'mobile'
    ? await browser.newContext({ ...devices['iPhone 13'] })
    : await browser.newContext({ viewport: { width: 1365, height: 768 } });
  await context.route('**/*', (route) => {
    if (shouldAbortGoogleMaps(route.request().url())) {
      return route.abort();
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/trip?id=current', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const hasMarker = document.querySelector('.spot-marker');
    const hasRoute = document.querySelector('path.leaflet-interactive');
    return Boolean(hasMarker || hasRoute);
  }, { timeout: 15000 });
  const loadingOverlay = page.locator('.map-loading-overlay');
  if (await loadingOverlay.count()) {
    await loadingOverlay.waitFor({ state: 'hidden', timeout: 15000 });
  }
  return { context, page };
}

async function openLeafletRouteDetail(page, detailSelector) {
  const routes = page.locator('path.leaflet-interactive');
  const routeCount = await routes.count();
  for (let index = 0; index < Math.min(routeCount, 12); index += 1) {
    const route = routes.nth(index);
    try {
      await route.dispatchEvent('click');
      await page.locator(detailSelector).waitFor({ state: 'visible', timeout: 1500 });
      return;
    } catch {
      // try next interactive path
    }
  }
  throw new Error(`failed to open route detail for selector ${detailSelector}`);
}

async function clickMarkerWithNavigation(page) {
  const markers = page.locator('.spot-marker');
  const markerCount = await markers.count();
  for (let index = 1; index < Math.min(markerCount, 8); index += 1) {
    await markers.nth(index).dispatchEvent('click');
    const navButton = page.locator('.leaflet-popup-content .popup-nav-btn').first();
    try {
      await navButton.waitFor({ state: 'visible', timeout: 1000 });
      return navButton;
    } catch {
      // keep trying later markers until we find one with an incoming route
    }
  }
  throw new Error('failed to find a marker popup with navigation details');
}

async function ensureLeafletSpotMarkers(page) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await page.locator('.spot-marker').count()) {
      return;
    }
    const clusters = page.locator('.marker-cluster');
    if (!(await clusters.count())) {
      break;
    }
    await clusters.first().click({ force: true });
    await page.waitForTimeout(700);
  }
  throw new Error('failed to expand marker clusters into spot markers');
}

async function run() {
  const desktopBrowser = await chromium.launch({ headless: true });
  const desktopPage = await desktopBrowser.newPage({ viewport: { width: 1365, height: 768 } });
  const routingRequests = [];
  desktopPage.on('request', (request) => {
    const url = request.url();
    if (
      url.includes('router.project-osrm.org') ||
      url.includes('routes.googleapis.com') ||
      url.includes('computeRoutes')
    ) {
      routingRequests.push(url);
    }
  });

  await desktopPage.goto('http://127.0.0.1:5173/trip?id=current', { waitUntil: 'networkidle' });
  await desktopPage.locator('h1').first().waitFor({ state: 'visible', timeout: 15000 });
  await desktopPage.locator('.spot-item').first().waitFor({ state: 'visible', timeout: 15000 });
  await desktopPage.waitForTimeout(1500);

  await assertVisible(
    desktopPage.getByRole('heading', { name: '日本最终行程表' }),
    'desktop title not visible',
  );
  await assertVisible(
    desktopPage.locator('.spot-item').first(),
    'desktop spot list did not render',
  );
  await assertVisible(
    desktopPage.getByRole('button', { name: /重置视角/ }),
    'desktop map controls missing',
  );
  await desktopPage.locator('#header-day-select').selectOption({ index: 1 });
  await desktopPage.waitForURL((url) => url.searchParams.has('day'), { timeout: 15000 });
  await assertSearchParamPresent(desktopPage, 'day', 'desktop day query did not sync');
  await desktopPage.locator('#header-day-select').selectOption('all');
  await desktopPage.waitForFunction(() => !new URL(window.location.href).searchParams.has('day'));
  if (routingRequests.length === 0) {
    throw new Error('route hydration requests were not observed');
  }

  const { context: desktopFallbackContext, page: desktopFallbackPage } = await openLeafletFallbackPage(
    desktopBrowser,
    'desktop',
  );
  await openLeafletRouteDetail(desktopFallbackPage, '.route-detail-popover');
  await assertVisible(
    desktopFallbackPage.locator('.route-detail-popover .route-detail-title'),
    'desktop route detail did not open',
  );
  await desktopFallbackPage.locator('.route-detail-dismiss').dispatchEvent('click');
  await desktopFallbackPage.locator('.route-detail-popover').waitFor({ state: 'hidden', timeout: 5000 });
  await desktopFallbackContext.close();
  await desktopBrowser.close();

  const mobileBrowser = await chromium.launch({ headless: true });
  const mobileContext = await mobileBrowser.newContext({ ...devices['iPhone 13'] });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto('http://127.0.0.1:5173/trip?id=current', { waitUntil: 'networkidle' });
  await mobilePage.locator('.mobile-trip-bottom-switcher').waitFor({ state: 'visible', timeout: 15000 });
  await assertVisible(
    mobilePage.getByRole('heading', { name: '日本最终行程表' }),
    'mobile title not visible',
  );

  await mobilePage.getByRole('button', { name: /列表/ }).click();
  await mobilePage.locator('.mobile-drawer').waitFor({ state: 'visible', timeout: 15000 });

  await mobilePage.getByRole('button', { name: /筛选/ }).click();
  await mobilePage.locator('.mobile-filter-sheet.is-open').waitFor({ state: 'visible', timeout: 15000 });
  const cityButtons = mobilePage.locator('.mobile-filter-sheet .sheet-section').nth(1).locator('.filter-btn');
  if (await cityButtons.count() > 1) {
    await cityButtons.nth(1).click();
  }
  await mobilePage.getByRole('button', { name: '只看下一段' }).click();
  await mobilePage.getByRole('button', { name: '完成' }).click();
  await mobilePage.locator('.mobile-filter-sheet.is-open').waitFor({ state: 'hidden', timeout: 15000 });
  await assertSearchParamPresent(mobilePage, 'city', 'mobile city query did not sync');
  await assertSearchParam(mobilePage, 'nextOnly', 'true', 'mobile nextOnly query did not sync');
  await mobileContext.close();

  const { context: mobileFallbackContext, page: mobileFallbackPage } = await openLeafletFallbackPage(
    mobileBrowser,
    'mobile',
  );
  await mobileFallbackPage.locator('.mobile-trip-bottom-switcher').waitFor({ state: 'visible', timeout: 15000 });
  await ensureLeafletSpotMarkers(mobileFallbackPage);
  const navButton = await clickMarkerWithNavigation(mobileFallbackPage);
  await assertSearchParamPresent(mobileFallbackPage, 'spot', 'mobile marker did not sync spot query');
  if (await mobileFallbackPage.locator('.mobile-drawer').isVisible()) {
    throw new Error('mobile marker click unexpectedly opened the list drawer');
  }
  const navHref = await navButton.getAttribute('href');
  if (!navHref) {
    throw new Error('spot popup navigation button is missing href');
  }
  const navUrl = new URL(navHref);
  const origin = navUrl.searchParams.get('origin');
  const destination = navUrl.searchParams.get('destination');
  if (!origin || !destination || origin === destination) {
    throw new Error(`spot popup navigation link is invalid: ${navHref}`);
  }

  const { context: mobileRouteContext, page: mobileRoutePage } = await openLeafletFallbackPage(
    mobileBrowser,
    'mobile',
  );
  await openLeafletRouteDetail(mobileRoutePage, '.mobile-route-detail-sheet');
  await assertVisible(
    mobileRoutePage.locator('.mobile-route-detail-sheet .route-detail-title'),
    'mobile route detail sheet did not open',
  );
  await mobileRoutePage.locator('.mobile-route-detail-sheet .route-detail-close-btn').click();
  await mobileRoutePage.locator('.mobile-route-detail-sheet').waitFor({ state: 'hidden', timeout: 5000 });

  await mobileRouteContext.close();
  await mobileFallbackContext.close();
  await mobileBrowser.close();

  console.log('trip smoke ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
