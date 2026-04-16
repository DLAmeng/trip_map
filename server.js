const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'travel-plans.sqlite');
const LOCAL_ITINERARY_PATH = path.join(ROOT_DIR, 'itinerary.json');
const DEFAULT_TRIP_ID = 'current';
const DEFAULT_TRIP_SLUG = 'japan-final-trip';
const DEFAULT_TRIP_NAME = '日本最终行程表';
const PORT = Number(process.env.PORT || 8080);
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

let database;

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function openDatabase() {
  ensureDataDir();
  database = new DatabaseSync(DB_PATH);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function readLocalItinerary() {
  const raw = fs.readFileSync(LOCAL_ITINERARY_PATH, 'utf8');
  return JSON.parse(raw);
}

function stripManagedSecrets(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const nextPayload = JSON.parse(JSON.stringify(payload));
  if (nextPayload.config?.googleMaps && typeof nextPayload.config.googleMaps === 'object') {
    nextPayload.config.googleMaps.apiKey = '';
  }
  return nextPayload;
}

function writeLocalItinerary(payload) {
  const validPayload = validateTripPayload(stripManagedSecrets(payload));
  fs.writeFileSync(
    LOCAL_ITINERARY_PATH,
    `${JSON.stringify(validPayload, null, 2)}\n`,
    'utf8'
  );
}

function applyRuntimeConfig(payload) {
  const nextPayload = JSON.parse(JSON.stringify(payload));
  if (GOOGLE_MAPS_API_KEY) {
    nextPayload.config = nextPayload.config || {};
    nextPayload.config.googleMaps = nextPayload.config.googleMaps || {};
    nextPayload.config.googleMaps.apiKey = GOOGLE_MAPS_API_KEY;
  }
  return nextPayload;
}

function validateTripPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('行程 payload 必须是对象。');
  }
  if (!payload.config || typeof payload.config !== 'object') {
    throw new Error('行程 payload 缺少 config。');
  }
  if (!Array.isArray(payload.spots)) {
    throw new Error('行程 payload 缺少 spots 数组。');
  }
  if (!Array.isArray(payload.routeSegments)) {
    throw new Error('行程 payload 缺少 routeSegments 数组。');
  }
  return payload;
}

function upsertTrip({ id, slug, name, payload }) {
  const validPayload = validateTripPayload(stripManagedSecrets(payload));
  const payloadJson = JSON.stringify(validPayload);
  const statement = database.prepare(`
    INSERT INTO trips (id, slug, name, payload_json)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      payload_json = excluded.payload_json,
      updated_at = CURRENT_TIMESTAMP
  `);
  statement.run(id, slug, name, payloadJson);
  return getTrip(id);
}

function getTrip(id = DEFAULT_TRIP_ID) {
  const row = database.prepare(`
    SELECT id, slug, name, payload_json, created_at, updated_at
    FROM trips
    WHERE id = ?
  `).get(id);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    payload: JSON.parse(row.payload_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function listTrips() {
  return database.prepare(`
    SELECT id, slug, name, created_at, updated_at
    FROM trips
    ORDER BY updated_at DESC, created_at DESC
  `).all().map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function seedDatabaseIfEmpty() {
  const current = getTrip(DEFAULT_TRIP_ID);
  if (current) {
    return current;
  }

  const localItinerary = readLocalItinerary();
  return upsertTrip({
    id: DEFAULT_TRIP_ID,
    slug: DEFAULT_TRIP_SLUG,
    name: localItinerary?.meta?.title || DEFAULT_TRIP_NAME,
    payload: localItinerary,
  });
}

function syncFromLocalFile() {
  const localItinerary = readLocalItinerary();
  return upsertTrip({
    id: DEFAULT_TRIP_ID,
    slug: DEFAULT_TRIP_SLUG,
    name: localItinerary?.meta?.title || DEFAULT_TRIP_NAME,
    payload: localItinerary,
  });
}

function createServer() {
  openDatabase();
  seedDatabaseIfEmpty();

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (request, response) => {
    response.json({
      ok: true,
      databasePath: DB_PATH,
      tripCount: listTrips().length,
    });
  });

  app.get('/api/trips', (request, response) => {
    response.json({ items: listTrips() });
  });

  app.get('/api/trips/current/full', (request, response) => {
    const trip = getTrip(DEFAULT_TRIP_ID);
    if (!trip) {
      response.status(404).json({ error: '当前没有可用行程。' });
      return;
    }
    response.json(applyRuntimeConfig(trip.payload));
  });

  app.put('/api/trips/current/full', (request, response) => {
    try {
      const updatedTrip = upsertTrip({
        id: DEFAULT_TRIP_ID,
        slug: DEFAULT_TRIP_SLUG,
        name: request.body?.meta?.title || DEFAULT_TRIP_NAME,
        payload: request.body,
      });
      response.json({
        ok: true,
        updatedAt: updatedTrip.updatedAt,
        payload: updatedTrip.payload,
      });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: error.message,
      });
    }
  });

  app.post('/api/trips/current/import-local', (request, response) => {
    try {
      const trip = syncFromLocalFile();
      response.json({
        ok: true,
        updatedAt: trip.updatedAt,
        payload: trip.payload,
      });
    } catch (error) {
      response.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  });

  app.post('/api/trips/current/export-local', (request, response) => {
    try {
      const trip = getTrip(DEFAULT_TRIP_ID);
      if (!trip) {
        response.status(404).json({
          ok: false,
          error: '当前没有可导出的行程。',
        });
        return;
      }
      writeLocalItinerary(trip.payload);
      response.json({
        ok: true,
        path: LOCAL_ITINERARY_PATH,
      });
    } catch (error) {
      response.status(500).json({
        ok: false,
        error: error.message,
      });
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

  app.get('/admin', (request, response) => {
    response.sendFile('admin.html', { root: ROOT_DIR });
  });

  app.use((request, response) => {
    response.status(404).json({
      ok: false,
      error: '未找到对应资源。',
    });
  });

  app.use((error, request, response, next) => {
    console.error(error);
    response.status(500).json({
      ok: false,
      error: '服务器内部错误。',
    });
  });

  return app;
}

createServer().listen(PORT, () => {
  console.log(`Japan trip server is running at http://127.0.0.1:${PORT}`);
});
