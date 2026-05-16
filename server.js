const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const repository = require('./trip-repository');
const rapidApiRouting = require('./rapidapi-routing');
const tripService = require('./trip-service');



const app = express();
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'travel-plans.sqlite');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const PORT = Number(process.env.PORT || 8080);
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || GOOGLE_MAPS_API_KEY;
const RAPIDAPI_ROUTER_KEY = process.env.RAPIDAPI_ROUTER_KEY || '';
const RAPIDAPI_ROUTER_HOST =
  process.env.RAPIDAPI_ROUTER_HOST || rapidApiRouting.DEFAULT_RAPIDAPI_HOST;
const RAPIDAPI_ROUTER_BASE_URL =
  process.env.RAPIDAPI_ROUTER_BASE_URL || rapidApiRouting.DEFAULT_RAPIDAPI_BASE_URL;
const RAPIDAPI_ROUTER_TIMEOUT_MS = Number(
  process.env.RAPIDAPI_ROUTER_TIMEOUT_MS || rapidApiRouting.DEFAULT_RAPIDAPI_TIMEOUT_MS,
);

function getRapidApiRuntimeConfig() {
  return {
    enabled: Boolean(RAPIDAPI_ROUTER_KEY),
    endpoint: '/api/routing/rapidapi/rail-segment',
    timeoutMs: Number.isFinite(RAPIDAPI_ROUTER_TIMEOUT_MS)
      ? RAPIDAPI_ROUTER_TIMEOUT_MS
      : rapidApiRouting.DEFAULT_RAPIDAPI_TIMEOUT_MS,
  };
}

async function searchPlaces({ query, lat, lng }) {
  if (!GOOGLE_PLACES_API_KEY) throw new Error('未配置 Google Places API Key');
  // P0-3 fix: 之前写死 regionCode: 'JP' 让非日本行程(如巴黎/伦敦)搜不到任何景点。
  // 移除 regionCode 让 Google 全球范围匹配;有 lat/lng 时仍 locationBias 提示局部相关。
  const body = { textQuery: query, languageCode: 'zh-CN', pageSize: 5 };
  if (lat && lng) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
  }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber,places.regularOpeningHours,places.editorialSummary,places.googleMapsUri,places.primaryType',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || '搜索失败');
  // P0-3 fix: 把 Google Places API 原始格式 mapping 成前端 PlaceSearchAutocomplete 期望的扁平格式。
  // 之前直接返回 Google 原始字段(displayName 是 LocalizedString {text}, location 是 {latitude/longitude}),
  // 前端按 r.name/r.lat/r.lng 取拿不到值,显示为空白。
  const rawPlaces = data.places || [];
  return rawPlaces.map((p) => ({
    placeId: p.id || '',
    name: typeof p.displayName === 'string' ? p.displayName : (p.displayName?.text || ''),
    address: p.formattedAddress || '',
    lat: typeof p.location?.latitude === 'number' ? p.location.latitude : 0,
    lng: typeof p.location?.longitude === 'number' ? p.location.longitude : 0,
    primaryType: p.primaryType || '',
  }));
}

async function getPlaceDetails(placeId) {
  if (!GOOGLE_PLACES_API_KEY) throw new Error('未配置 Google Places API Key');
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=zh-CN`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,websiteUri,nationalPhoneNumber,regularOpeningHours,editorialSummary,googleMapsUri',
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || '获取详情失败');
  return data;
}

function createServer() {
  repository.init(DB_PATH);
  tripService.seedDatabaseIfEmpty();
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });

  app.use(express.json({ limit: '10mb' }));
  app.use('/photos', express.static(PHOTOS_DIR));

  app.get('/api/health', (request, response) => {
    response.json({
      ok: true,
      databasePath: DB_PATH,
      tripCount: tripService.listTripsWithSummary().length,
      rapidApi: {
        enabled: Boolean(RAPIDAPI_ROUTER_KEY),
        host: RAPIDAPI_ROUTER_HOST,
        baseUrl: RAPIDAPI_ROUTER_BASE_URL,
      },
    });
  });

  app.get('/api/trips', (request, response) => {
    response.json({ items: tripService.listTripsWithSummary() });
  });

  app.post('/api/trips', (request, response) => {
    try {
      const created = tripService.createTrip({
        name: request.body?.name,
        description: request.body?.description,
        destination: request.body?.destination,
        startDate: request.body?.startDate,
        endDate: request.body?.endDate,
        slug: request.body?.slug,
        template: request.body?.template,
      });
      response.status(201).json({
        ok: true,
        trip: {
          id: created.id,
          slug: created.slug,
          name: created.name,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
          meta: created.payload?.meta || {},
          summary: tripService.summarizePayload(created.payload),
        },
      });
    } catch (error) {
      response.status(400).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/trips/:id', (request, response) => {
    const summary = tripService.getTripSummary(request.params.id);
    if (!summary) {
      response.status(404).json({ ok: false, error: '未找到该行程。' });
      return;
    }
    response.json(summary);
  });

  app.get('/api/trips/:id/full', (request, response) => {
    const trip = tripService.getTrip(request.params.id);
    if (!trip) {
      response.status(404).json({ error: '未找到该行程。' });
      return;
    }
    const runtimePayload = tripService.applyRuntimeConfig(trip.payload, {
      googleMapsApiKey: GOOGLE_MAPS_API_KEY,
      rapidApiRail: getRapidApiRuntimeConfig(),
    });
    const cachedSegmentIds = rapidApiRouting.hydrateTripPayloadWithCache(runtimePayload);
    runtimePayload.config.routing.rapidApi.cachedSegmentIds = cachedSegmentIds;
    response.json(runtimePayload);
  });

  app.put('/api/trips/:id/full', (request, response) => {
    try {
      const updated = tripService.updateTripFull(request.params.id, request.body);
      if (!updated) {
        response.status(404).json({ ok: false, error: '未找到该行程。' });
        return;
      }
      response.json({
        ok: true,
        updatedAt: updated.updatedAt,
        payload: updated.payload,
      });
    } catch (error) {
      response.status(400).json({ ok: false, error: error.message });
    }
  });

  /**
   * P32: 持久化前端 hydrate 出来的 route path / 距离 / 时长 / 运行时来源。
   *
   * Body: { updates: Array<{ segmentId, path: [[lat,lng],...], distanceMeters?, durationSec?, runtimeSource? }> }
   *
   * 设计:
   *  - 只接受非空 path(length >= 2),小 path 跳过(过滤直线 fallback)
   *  - 幂等:同样 path 多次写不变化
   *  - 静默成功:即使 0 个 segment 改动也返回 200(避免前端无意义重试)
   *  - 不修改 spot / meta / config,只更新指定 segment 的 path 相关字段
   */
  app.post('/api/trips/:id/persist-paths', (request, response) => {
    try {
      const updates = Array.isArray(request.body?.updates) ? request.body.updates : [];
      const result = tripService.persistSegmentPaths(request.params.id, updates);
      if (!result) {
        response.status(404).json({ ok: false, error: '未找到该行程。' });
        return;
      }
      response.json(result);
    } catch (error) {
      response.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/trips/:id/duplicate', (request, response) => {
    try {
      const created = tripService.duplicateTrip(request.params.id);
      response.status(201).json({
        ok: true,
        trip: {
          id: created.id,
          slug: created.slug,
          name: created.name,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
          meta: created.payload?.meta || {},
          summary: tripService.summarizePayload(created.payload),
        },
      });
    } catch (error) {
      response.status(400).json({ ok: false, error: error.message });
    }
  });

  app.delete('/api/trips/:id', (request, response) => {
    try {
      const removed = tripService.deleteTrip(request.params.id);
      if (!removed) {
        response.status(404).json({ ok: false, error: '未找到该行程。' });
        return;
      }
      response.json({ ok: true });
    } catch (error) {
      response.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/trips/current/import-local', (request, response) => {
    try {
      const trip = tripService.syncCurrentFromLocal();
      response.json({
        ok: true,
        updatedAt: trip.updatedAt,
        payload: trip.payload,
      });
    } catch (error) {
      response.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/trips/current/export-local', (request, response) => {
    try {
      const trip = tripService.getTrip(tripService.DEFAULT_TRIP_ID);
      if (!trip) {
        response.status(404).json({ ok: false, error: '当前没有可导出的行程。' });
        return;
      }
      const filePath = tripService.writeLocalItineraryFile(trip.payload);
      response.json({ ok: true, path: filePath });
    } catch (error) {
      response.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/places/search', async (request, response) => {
    try {
      const { query, lat, lng } = request.body || {};
      if (!query) { response.status(400).json({ ok: false, error: '缺少 query 参数' }); return; }
      const places = await searchPlaces({ query, lat, lng });
      response.json({ ok: true, places });
    } catch (error) {
      response.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/places/details/:placeId', async (request, response) => {
    try {
      const place = await getPlaceDetails(request.params.placeId);
      response.json({ ok: true, place });
    } catch (error) {
      response.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/routing/rapidapi/rail-segment', async (request, response) => {
    if (!RAPIDAPI_ROUTER_KEY) {
      response.status(503).json({ ok: false, error: '未配置 RAPIDAPI_ROUTER_KEY。' });
      return;
    }

    try {
      const resolved = await rapidApiRouting.fetchRapidApiRailSegment({
        apiKey: RAPIDAPI_ROUTER_KEY,
        host: RAPIDAPI_ROUTER_HOST,
        baseUrl: RAPIDAPI_ROUTER_BASE_URL,
        requestBody: request.body,
        timeoutMs: Number.isFinite(RAPIDAPI_ROUTER_TIMEOUT_MS)
          ? RAPIDAPI_ROUTER_TIMEOUT_MS
          : rapidApiRouting.DEFAULT_RAPIDAPI_TIMEOUT_MS,
      }).catch((error) => {
        if (error?.statusCode === 403) {
          error.statusCode = 403;
          error.message = error.message || 'RapidAPI key 未订阅目标路由服务。';
        }
        throw error;
      });

      if (!resolved) {
        response.status(404).json({ ok: false, error: 'RapidAPI 未返回可用的铁路路线。' });
        return;
      }

      response.json({ ok: true, ...resolved });
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
      response.status(statusCode).json({
        ok: false,
        error: error.message || 'RapidAPI 路由查询失败。',
      });
    }
  });

  app.post('/api/photos/upload', express.raw({ type: 'image/*', limit: '8mb' }), (request, response) => {
    try {
      const ext = (request.headers['content-type'] || 'image/jpeg').split('/')[1].replace('jpeg', 'jpg');
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      fs.writeFileSync(path.join(PHOTOS_DIR, filename), request.body);
      response.json({ ok: true, url: `/photos/${filename}` });
    } catch (error) {
      response.status(500).json({ ok: false, error: error.message });
    }
  });

  const FRONTEND_DIST = path.resolve(ROOT_DIR, 'frontend', 'dist');
  console.log('Frontend Dist Path:', FRONTEND_DIST);

  // 1. 静态资源托管：优先匹配 frontend/dist 中的物理文件
  app.use(express.static(FRONTEND_DIST));

  // 2. 旧版运行时配置(兼容性保留，React 版通常从 API 获取 Key)
  app.get('/runtime-config.js', (request, response) => {
    response.type('application/javascript');
    response.send(`window.GOOGLE_MAPS_API_KEY = ${JSON.stringify(GOOGLE_MAPS_API_KEY)};\n`);
  });

  // 3. 核心入口路由由 React 接管
  const serveIndex = (req, res) => {
    res.sendFile('index.html', { root: FRONTEND_DIST }, (err) => {
      if (err && !res.headersSent) {
        console.error('SendFile Error:', err);
        res.status(500).json({ ok: false, error: '无法加载前端入口文件' });
      }
    });
  };

  app.get('/', serveIndex);
  app.get('/dashboard', serveIndex);
  app.get('/trip', serveIndex);
  app.get('/admin', serveIndex);

  app.use((request, response) => {
    response.status(404).json({ ok: false, error: '未找到对应资源。' });
  });

  app.use((error, request, response, next) => {
    console.error(error);
    response.status(500).json({ ok: false, error: '服务器内部错误。' });
  });

  return app;
}

createServer().listen(PORT, () => {
  console.log(`trip_map server is running at http://127.0.0.1:${PORT}`);
});
