'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const repository = require('./trip-repository');
const { createEmptyTripPayload, slugify } = require('./trip-template');

const ROOT_DIR = __dirname;
const DEFAULT_TRIP_ID = 'current';
const DEFAULT_TRIP_SLUG = 'japan-final-trip';
const DEFAULT_TRIP_NAME = '日本最终行程表';
const LOCAL_ITINERARY_PATH = path.join(ROOT_DIR, 'itinerary.json');

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
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

function stripManagedSecrets(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  const nextPayload = cloneDeep(payload);
  if (nextPayload.config?.googleMaps && typeof nextPayload.config.googleMaps === 'object') {
    nextPayload.config.googleMaps.apiKey = '';
  }
  return nextPayload;
}

function applyRuntimeConfig(payload, { googleMapsApiKey } = {}) {
  const nextPayload = cloneDeep(payload);
  if (googleMapsApiKey) {
    nextPayload.config = nextPayload.config || {};
    nextPayload.config.googleMaps = nextPayload.config.googleMaps || {};
    nextPayload.config.googleMaps.apiKey = googleMapsApiKey;
  }
  return nextPayload;
}

function summarizePayload(payload) {
  const spots = Array.isArray(payload?.spots) ? payload.spots : [];
  const segments = Array.isArray(payload?.routeSegments) ? payload.routeSegments : [];
  const days = spots
    .map((spot) => Number(spot?.day))
    .filter((value) => Number.isFinite(value));
  return {
    spotCount: spots.length,
    routeSegmentCount: segments.length,
    startDay: days.length ? Math.min(...days) : null,
    endDay: days.length ? Math.max(...days) : null,
  };
}

function ensureUniqueSlug(baseSlug) {
  const existing = new Set(repository.listExistingSlugs());
  if (!existing.has(baseSlug)) return baseSlug;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${baseSlug}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${baseSlug}-${Date.now()}`;
}

function persistTrip({ id, slug, name, payload }) {
  const validPayload = validateTripPayload(stripManagedSecrets(payload));
  return repository.upsertTrip({
    id,
    slug,
    name,
    payloadJson: JSON.stringify(validPayload),
  });
}

function getTrip(id) {
  return repository.findTripById(id);
}

function getTripSummary(id) {
  const trip = repository.findTripById(id);
  if (!trip) return null;
  return {
    id: trip.id,
    slug: trip.slug,
    name: trip.name,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    meta: trip.payload?.meta || {},
    summary: summarizePayload(trip.payload),
  };
}

function listTripsWithSummary() {
  return repository.listTripRowsWithPayload().map((row) => {
    const payload = JSON.parse(row.payload_json);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      meta: payload?.meta || {},
      summary: summarizePayload(payload),
    };
  });
}

function deleteTrip(id) {
  if (id === DEFAULT_TRIP_ID) {
    throw new Error('默认行程 current 不可删除。');
  }
  return repository.deleteTripById(id);
}

function readLocalItineraryFile() {
  return JSON.parse(fs.readFileSync(LOCAL_ITINERARY_PATH, 'utf8'));
}

function writeLocalItineraryFile(payload) {
  const validPayload = validateTripPayload(stripManagedSecrets(payload));
  fs.writeFileSync(
    LOCAL_ITINERARY_PATH,
    `${JSON.stringify(validPayload, null, 2)}\n`,
    'utf8'
  );
  return LOCAL_ITINERARY_PATH;
}

function buildTemplatePayload({ template, meta }) {
  if (template === 'current') {
    const source = repository.findTripById(DEFAULT_TRIP_ID);
    if (!source) {
      throw new Error('无法基于 current 创建:当前没有默认行程。');
    }
    const cloned = cloneDeep(source.payload);
    cloned.meta = { ...meta };
    cloned.spots = [];
    cloned.routeSegments = [];
    return cloned;
  }
  return createEmptyTripPayload(meta);
}

function createTrip({ name, description, destination, startDate, endDate, slug, template = 'empty' } = {}) {
  const resolvedName = String(name || '').trim() || '未命名行程';
  const meta = {
    title: resolvedName,
    description: String(description || '').trim(),
    destination: String(destination || '').trim(),
    startDate: String(startDate || '').trim(),
    endDate: String(endDate || '').trim(),
  };
  const baseSlug = slugify(slug || resolvedName);
  const uniqueSlug = ensureUniqueSlug(baseSlug);
  const id = crypto.randomUUID();
  const payload = buildTemplatePayload({ template, meta });
  return persistTrip({ id, slug: uniqueSlug, name: resolvedName, payload });
}

function nextDuplicateName(name) {
  const base = String(name || '').trim() || '未命名行程';
  const match = base.match(/^(.*?) 副本(?: (\d+))?$/);
  if (match) {
    const stem = match[1];
    const nextN = match[2] ? Number(match[2]) + 1 : 2;
    return `${stem} 副本 ${nextN}`;
  }
  return `${base} 副本`;
}

function duplicateTrip(sourceId) {
  const source = repository.findTripById(sourceId);
  if (!source) {
    throw new Error('源行程不存在');
  }
  const newName = nextDuplicateName(source.name);
  const baseSlug = slugify(newName);
  const uniqueSlug = ensureUniqueSlug(baseSlug);
  const id = crypto.randomUUID();
  const payload = cloneDeep(source.payload);
  payload.meta = { ...(payload.meta || {}), title: newName };
  return persistTrip({ id, slug: uniqueSlug, name: newName, payload });
}

function updateTripFull(id, payload) {
  const existing = repository.findTripById(id);
  if (!existing) return null;
  return persistTrip({
    id,
    slug: existing.slug,
    name: payload?.meta?.title || existing.name,
    payload,
  });
}

function seedDatabaseIfEmpty() {
  const current = repository.findTripById(DEFAULT_TRIP_ID);
  if (current) return current;
  const localItinerary = readLocalItineraryFile();
  return persistTrip({
    id: DEFAULT_TRIP_ID,
    slug: DEFAULT_TRIP_SLUG,
    name: localItinerary?.meta?.title || DEFAULT_TRIP_NAME,
    payload: localItinerary,
  });
}

function syncCurrentFromLocal() {
  const localItinerary = readLocalItineraryFile();
  return persistTrip({
    id: DEFAULT_TRIP_ID,
    slug: DEFAULT_TRIP_SLUG,
    name: localItinerary?.meta?.title || DEFAULT_TRIP_NAME,
    payload: localItinerary,
  });
}

module.exports = {
  DEFAULT_TRIP_ID,
  LOCAL_ITINERARY_PATH,
  applyRuntimeConfig,
  createTrip,
  deleteTrip,
  duplicateTrip,
  getTrip,
  getTripSummary,
  listTripsWithSummary,
  seedDatabaseIfEmpty,
  summarizePayload,
  syncCurrentFromLocal,
  updateTripFull,
  writeLocalItineraryFile,
};
