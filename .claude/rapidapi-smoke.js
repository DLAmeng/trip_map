const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_PORT = 8083;
const RAPIDAPI_MOCK_PORT = 8094;
const RAPIDAPI_ROUTER_BASE_URL = `http://127.0.0.1:${RAPIDAPI_MOCK_PORT}`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(url, timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // keep polling
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function createShapeTransitPayload(kind = 'shape') {
  if (kind === 'route-fallback') {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            ways: 'walk',
            route_no: '1',
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [139.7006, 35.6896],
              [139.7011, 35.6899],
            ],
          },
        },
      ],
    };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          ways: 'walk',
          route_no: '1',
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [135.4959, 34.7025],
            [135.4971, 34.7038],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {
          ways: 'transport',
          route_no: '1',
          transport_type: 'railway',
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [135.4978, 34.7029],
            [135.5009, 34.6972],
            [135.5009, 34.6909],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {
          ways: 'transport',
          route_no: '1',
          transport_type: 'railway',
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [135.5009, 34.6909],
            [135.5011, 34.6814],
            [135.5013, 34.6687],
          ],
        },
      },
    ],
  };
}

function createRouteTransitPayload() {
  return {
    items: [
      {
        summary: {
          move: {
            time: 22,
            distance: 4738,
          },
        },
        sections: [
          { type: 'point', coord: { lat: 34.7025, lon: 135.4959 }, name: 'start' },
          { type: 'move', move: 'walk', line_name: '徒歩' },
          { type: 'point', coord: { lat: 34.70378, lon: 135.497093 }, name: '梅田（Osaka Metro）' },
          { type: 'move', move: 'local_train', line_name: 'OsakaMetro御堂筋線' },
          { type: 'point', coord: { lat: 34.6687, lon: 135.5013 }, name: 'なんば〔Osaka Metro〕' },
          { type: 'move', move: 'walk', line_name: '徒歩' },
          { type: 'point', coord: { lat: 34.6656, lon: 135.5019 }, name: 'goal' },
        ],
      },
    ],
  };
}

function createRapidApiMockServer(requestLog) {
  return http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    requestLog.push({
      method: request.method,
      pathname: url.pathname,
      start: url.searchParams.get('start'),
      goal: url.searchParams.get('goal'),
      format: url.searchParams.get('format'),
      options: url.searchParams.get('options'),
    });

    response.setHeader('Content-Type', 'application/json');

    if (url.pathname === '/shape_transit') {
      const start = url.searchParams.get('start');
      const payload = start?.startsWith('35.6896,139.7006')
        ? createShapeTransitPayload('route-fallback')
        : createShapeTransitPayload('shape');
      response.end(JSON.stringify(payload));
      return;
    }

    if (url.pathname === '/route_transit') {
      response.end(JSON.stringify(createRouteTransitPayload()));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ message: 'not found' }));
  });
}

async function requestRailSegment(port, body) {
  const response = await fetch(`http://127.0.0.1:${port}/api/routing/rapidapi/rail-segment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function run() {
  const requestLog = [];
  const cachePath = path.join(ROOT_DIR, 'data', 'rapidapi-rail-cache.json');
  try {
    fs.unlinkSync(cachePath);
  } catch {
    // ignore missing cache file
  }
  const mockServer = createRapidApiMockServer(requestLog);
  await new Promise((resolve) => mockServer.listen(RAPIDAPI_MOCK_PORT, '127.0.0.1', resolve));

  const backend = spawn('node', ['--env-file=.env', 'server.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      RAPIDAPI_ROUTER_KEY: 'mock-key',
      RAPIDAPI_ROUTER_HOST: 'navitime-route-totalnavi.p.rapidapi.com',
      RAPIDAPI_ROUTER_BASE_URL,
      RAPIDAPI_ROUTER_TIMEOUT_MS: '5000',
    },
    stdio: 'pipe',
  });

  try {
    await waitFor(`http://127.0.0.1:${BACKEND_PORT}/api/health`);

    const health = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/health`).then((r) => r.json());
    if (!health?.rapidApi?.enabled) {
      throw new Error(`rapidapi runtime not enabled: ${JSON.stringify(health)}`);
    }

    const shapeSegment = await requestRailSegment(BACKEND_PORT, {
      segmentId: `seg-shape-${Date.now()}`,
      origin: { lat: 34.7025, lng: 135.4959, label: '大阪站' },
      destination: { lat: 34.6656, lng: 135.5019, label: '难波' },
      transportType: 'metro',
    });
    if (!shapeSegment.ok || !Array.isArray(shapeSegment.geometry?.path) || shapeSegment.geometry.path.length < 3) {
      throw new Error(`unexpected shape_transit result: ${JSON.stringify(shapeSegment)}`);
    }
    if (shapeSegment.geometry?.source !== 'rapidapi-shape') {
      throw new Error(`expected rapidapi-shape source, got ${JSON.stringify(shapeSegment)}`);
    }

    const routeFallbackSegment = await requestRailSegment(BACKEND_PORT, {
      segmentId: `seg-route-${Date.now()}`,
      origin: { lat: 35.6896, lng: 139.7006, label: '新宿' },
      destination: { lat: 35.7111, lng: 139.7964, label: '浅草' },
      transportType: 'metro',
    });
    if (!routeFallbackSegment.ok || !Array.isArray(routeFallbackSegment.geometry?.path) || routeFallbackSegment.geometry.path.length < 2) {
      throw new Error(`unexpected route_transit fallback result: ${JSON.stringify(routeFallbackSegment)}`);
    }
    if (routeFallbackSegment.debug?.endpoint !== 'route_transit') {
      throw new Error(`expected route_transit fallback, got ${JSON.stringify(routeFallbackSegment)}`);
    }
    if (routeFallbackSegment.geometry?.source !== 'rapidapi-route') {
      throw new Error(`expected rapidapi-route source, got ${JSON.stringify(routeFallbackSegment)}`);
    }
    if (!routeFallbackSegment.geometry?.transitSummary || !Array.isArray(routeFallbackSegment.geometry?.transitLegs)) {
      throw new Error(`expected transit detail payload, got ${JSON.stringify(routeFallbackSegment)}`);
    }
    if (routeFallbackSegment.geometry.transitLegs.length < 1) {
      throw new Error(`expected parsed transit legs, got ${JSON.stringify(routeFallbackSegment)}`);
    }

    const shapeCalls = requestLog.filter((entry) => entry.pathname === '/shape_transit');
    const routeCalls = requestLog.filter((entry) => entry.pathname === '/route_transit');
    if (shapeCalls.length < 2) {
      throw new Error(`expected shape_transit calls, got ${JSON.stringify(requestLog)}`);
    }
    if (routeCalls.length < 1) {
      throw new Error(`expected route_transit fallback call, got ${JSON.stringify(requestLog)}`);
    }

    const trip = await fetch(`http://127.0.0.1:${BACKEND_PORT}/api/trips/current/full`).then((r) => r.json());
    if (!trip?.config?.routing?.rapidApi?.enabled) {
      throw new Error('trip runtime config did not expose enabled RapidAPI runtime');
    }

    console.log('rapidapi smoke ok');
  } finally {
    backend.kill('SIGINT');
    await new Promise((resolve) => backend.once('exit', resolve));
    await new Promise((resolve) => mockServer.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
