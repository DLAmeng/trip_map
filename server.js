const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const repository = require('./trip-repository');
const tripService = require('./trip-service');

const app = express();
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'travel-plans.sqlite');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const PORT = Number(process.env.PORT || 8080);
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || GOOGLE_MAPS_API_KEY;

async function searchPlaces({ query, lat, lng }) {
  if (!GOOGLE_PLACES_API_KEY) throw new Error('未配置 Google Places API Key');
  const body = { textQuery: query, languageCode: 'zh-CN', regionCode: 'JP', pageSize: 5 };
  if (lat && lng) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
  }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.websiteUri,places.nationalPhoneNumber,places.regularOpeningHours,places.editorialSummary,places.googleMapsUri',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || '搜索失败');
  return data.places || [];
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
    response.json(tripService.applyRuntimeConfig(trip.payload, { googleMapsApiKey: GOOGLE_MAPS_API_KEY }));
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

  app.use(express.static(ROOT_DIR, {
    index: false,
    extensions: ['html'],
  }));

  app.get('/runtime-config.js', (request, response) => {
    response.type('application/javascript');
    response.send(`window.GOOGLE_MAPS_API_KEY = ${JSON.stringify(GOOGLE_MAPS_API_KEY)};\n`);
  });

  app.get('/', (request, response) => {
    response.sendFile('index.html', { root: ROOT_DIR });
  });

  app.get('/dashboard', (request, response) => {
    response.sendFile('dashboard.html', { root: ROOT_DIR });
  });

  app.get('/trip', (request, response) => {
    response.sendFile('index.html', { root: ROOT_DIR });
  });

  app.get('/admin', (request, response) => {
    response.sendFile('admin.html', { root: ROOT_DIR });
  });

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
