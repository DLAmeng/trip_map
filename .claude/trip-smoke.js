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

function assertDestinationOnlyNavHref(rawHref, label) {
  if (!rawHref) {
    throw new Error(`${label} navigation button is missing href`);
  }
  const navUrl = new URL(rawHref);
  const origin = navUrl.searchParams.get('origin');
  const destination = navUrl.searchParams.get('destination');
  if (origin || !destination) {
    throw new Error(`${label} navigation link should rely on current location and destination only: ${rawHref}`);
  }
}

async function openLeafletFallbackPage(browser, mode = 'desktop', osrmRequests = []) {
  const context = mode === 'mobile'
    ? await browser.newContext({ ...devices['iPhone 13'] })
    : await browser.newContext({ viewport: { width: 1365, height: 768 } });
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('router.project-osrm.org')) {
      osrmRequests.push(url);
      return route.abort();
    }
    if (shouldAbortGoogleMaps(url)) {
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
  for (let index = 1; index < Math.min(markerCount, 12); index += 1) {
    await markers.nth(index).dispatchEvent('click');
    const navButton = page.locator('.leaflet-popup-content .popup-current-btn[href]').first();
    const nextButton = page.locator('.leaflet-popup-content .popup-next-btn:not(.is-disabled):not(:disabled)').first();
    try {
      await navButton.waitFor({ state: 'visible', timeout: 1000 });
      await nextButton.waitFor({ state: 'visible', timeout: 1000 });
      await page.waitForTimeout(800);
      if (!(await page.locator('.leaflet-popup-content .popup-shell').first().isVisible())) {
        throw new Error('spot popup disappeared after marker click');
      }
      await assertSearchParamPresent(page, 'spot', 'marker click did not keep spot query');
      return { navButton, nextButton };
    } catch {
      // keep trying later markers until we find one with both popup actions enabled
    }
  }
  throw new Error('failed to find a marker popup with navigation details');
}

async function assertNextStopButtonSelectsNextSpot(page, nextButton) {
  const beforeSpot = new URL(page.url()).searchParams.get('spot');
  if (!beforeSpot) {
    throw new Error('next stop test requires an active spot before clicking');
  }
  const href = await nextButton.getAttribute('href');
  if (href) {
    throw new Error(`next stop button should select the next spot in-app, not open Google Maps: ${href}`);
  }
  await nextButton.click();
  await page.waitForFunction(
    (previousSpot) => {
      const nextSpot = new URL(window.location.href).searchParams.get('spot');
      return Boolean(nextSpot && nextSpot !== previousSpot);
    },
    beforeSpot,
    { timeout: 5000 },
  );
  await page.locator('.leaflet-popup-content .popup-shell').first().waitFor({
    state: 'visible',
    timeout: 5000,
  });
}

async function assertMarkerPopupPersistsAfterRealClick(page) {
  const marker = page.locator('.spot-marker').first();
  await marker.click({ force: true, timeout: 3000 });
  await page.locator('.leaflet-popup-content .popup-shell').waitFor({ state: 'visible', timeout: 1500 });
  await assertSearchParamPresent(page, 'spot', 'real marker click did not sync spot query');
  await page.waitForTimeout(900);
  if (!(await page.locator('.leaflet-popup-content .popup-shell').first().isVisible())) {
    throw new Error('spot popup disappeared after a real marker click');
  }
  await page.locator('.leaflet-popup-close-button').click();
  await page.waitForFunction(
    () => !new URL(window.location.href).searchParams.has('spot'),
    null,
    { timeout: 5000 },
  );
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

async function assertClusterClickDoesNotSelectSpot(page) {
  const clusters = page.locator('.marker-cluster');
  if (!(await clusters.count())) return;
  await clusters.first().click({ force: true });
  await page.waitForTimeout(700);
  const spotParam = new URL(page.url()).searchParams.get('spot');
  if (spotParam) {
    throw new Error(`cluster click should not select a spot, got spot=${spotParam}`);
  }
  if (await page.locator('.leaflet-popup-content .popup-shell, .spot-marker.is-active').count()) {
    throw new Error('cluster click unexpectedly opened a spot popup or active marker');
  }
}

async function assertGoogleMarkerPopupPersists(page) {
  if (!(await page.locator('.gm-style').count())) return;
  await page.goto('http://127.0.0.1:5173/trip?id=current&day=1', { waitUntil: 'networkidle' });
  await page.waitForSelector('.gm-style', { timeout: 20000 });
  await page.waitForTimeout(1500);

  const clusters = page.locator('gmp-advanced-marker[title^="Cluster"]');
  if (await clusters.count()) {
    await clusters.first().click({ force: true, timeout: 5000 });
    await page.waitForTimeout(1200);
  }

  const marker = page.locator('gmp-advanced-marker:not([title^="Cluster"])').first();
  if (!(await marker.count())) return;
  await marker.click({ force: true, timeout: 5000 });
  await page.waitForURL((url) => url.searchParams.has('spot'), { timeout: 5000 });
  await page.locator('.gm-style-iw .popup-shell, .popup-shell').first().waitFor({
    state: 'visible',
    timeout: 5000,
  });
  await page.waitForTimeout(1200);
  if (!(await page.locator('.gm-style-iw .popup-shell, .popup-shell').first().isVisible())) {
    throw new Error('Google marker popup disappeared after marker click');
  }

  await page.mouse.click(900, 650);
  await page.waitForFunction(
    () => !new URL(window.location.href).searchParams.has('spot'),
    null,
    { timeout: 5000 },
  );
}

async function run() {
  const desktopBrowser = await chromium.launch({ headless: true });
  const desktopPage = await desktopBrowser.newPage({ viewport: { width: 1365, height: 768 } });
  const osrmRequests = [];
  const routingRequests = [];
  desktopPage.on('request', (request) => {
    const url = request.url();
    if (url.includes('router.project-osrm.org')) {
      osrmRequests.push(url);
    }
    if (
      url.includes('routes.googleapis.com') ||
      url.includes('computeRoutes') ||
      url.includes('rapidapi.com')
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
  const firstDayOption = desktopPage.locator('#header-day-select option').nth(1);
  const firstDayValue = await firstDayOption.getAttribute('value');
  if (firstDayValue !== '1') {
    throw new Error(`day selector should start at Day 1, got value=${firstDayValue}`);
  }
  await desktopPage.locator('#header-day-select').selectOption({ index: 1 });
  await desktopPage.waitForURL((url) => url.searchParams.has('day'), { timeout: 15000 });
  await assertSearchParam(desktopPage, 'day', '1', 'desktop day query did not sync from Day 1');
  await desktopPage.locator('#header-day-select').selectOption('all');
  await desktopPage.waitForFunction(() => !new URL(window.location.href).searchParams.has('day'));
  await assertGoogleMarkerPopupPersists(desktopPage);

  const { context: desktopFallbackContext, page: desktopFallbackPage } = await openLeafletFallbackPage(
    desktopBrowser,
    'desktop',
    osrmRequests,
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
    osrmRequests,
  );
  await mobileFallbackPage.locator('.mobile-trip-bottom-switcher').waitFor({ state: 'visible', timeout: 15000 });
  await assertClusterClickDoesNotSelectSpot(mobileFallbackPage);
  await ensureLeafletSpotMarkers(mobileFallbackPage);
  await assertMarkerPopupPersistsAfterRealClick(mobileFallbackPage);
  await mobileFallbackPage.goto('http://127.0.0.1:5173/trip?id=current', { waitUntil: 'networkidle' });
  await mobileFallbackPage.locator('.mobile-trip-bottom-switcher').waitFor({ state: 'visible', timeout: 15000 });
  await ensureLeafletSpotMarkers(mobileFallbackPage);
  const { navButton, nextButton } = await clickMarkerWithNavigation(mobileFallbackPage);
  await assertSearchParamPresent(mobileFallbackPage, 'spot', 'mobile marker did not sync spot query');
  if (await mobileFallbackPage.locator('.mobile-drawer').isVisible()) {
    throw new Error('mobile marker click unexpectedly opened the list drawer');
  }
  const navHref = await navButton.getAttribute('href');
  assertDestinationOnlyNavHref(navHref, 'spot popup');
  await assertNextStopButtonSelectsNextSpot(mobileFallbackPage, nextButton);
  await mobileFallbackPage.locator('.leaflet-popup-close-button').click();
  await mobileFallbackPage.waitForFunction(
    () => !new URL(window.location.href).searchParams.has('spot'),
    null,
    { timeout: 5000 },
  );
  if (await mobileFallbackPage.locator('.spot-marker.is-active, .spot-item.is-active').count()) {
    throw new Error('closing popup did not clear active marker/list state');
  }

  const { context: mobileRouteContext, page: mobileRoutePage } = await openLeafletFallbackPage(
    mobileBrowser,
    'mobile',
    osrmRequests,
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

  if (osrmRequests.length > 0) {
    throw new Error(`OSRM requests should not be emitted: ${osrmRequests.slice(0, 3).join(', ')}`);
  }

  console.log('trip smoke ok');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
