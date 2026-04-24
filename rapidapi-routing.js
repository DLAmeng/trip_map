'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_RAPIDAPI_TIMEOUT_MS = 5_000;
const DEFAULT_RAPIDAPI_HOST = 'navitime-route-totalnavi.p.rapidapi.com';
const DEFAULT_RAPIDAPI_BASE_URL = `https://${DEFAULT_RAPIDAPI_HOST}`;
const DEFAULT_ROUTE_TERM_MINUTES = 1_440;
const DEFAULT_ROUTE_LIMIT = 1;
const RAPIDAPI_RAIL_CACHE_PATH = path.join(__dirname, 'data', 'rapidapi-rail-cache.json');
const TRANSIT_TRANSPORT_TYPES = new Set(['metro', 'subway', 'train', 'jrrapid', 'shinkansen', 'nankai']);
let railCache = null;

function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function ensureCacheLoaded() {
  if (railCache) return railCache;
  try {
    const raw = fs.readFileSync(RAPIDAPI_RAIL_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    railCache = parsed && typeof parsed === 'object' ? parsed : { entries: {} };
  } catch {
    railCache = { entries: {} };
  }
  if (!railCache.entries || typeof railCache.entries !== 'object') {
    railCache.entries = {};
  }
  return railCache;
}

function persistCache() {
  const nextCache = ensureCacheLoaded();
  fs.mkdirSync(path.dirname(RAPIDAPI_RAIL_CACHE_PATH), { recursive: true });
  fs.writeFileSync(RAPIDAPI_RAIL_CACHE_PATH, `${JSON.stringify(nextCache, null, 2)}\n`, 'utf8');
}

function normalizeCoordPart(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(6) : '0.000000';
}

function createRailCacheKey(requestBody) {
  const origin = requestBody?.origin || {};
  const destination = requestBody?.destination || {};
  return [
    requestBody?.segmentId || '',
    String(requestBody?.transportType || '').toLowerCase(),
    normalizeCoordPart(origin.lat),
    normalizeCoordPart(origin.lng),
    normalizeCoordPart(destination.lat),
    normalizeCoordPart(destination.lng),
  ].join('|');
}

function getCachedRailSegment(requestBody) {
  const cache = ensureCacheLoaded();
  const key = createRailCacheKey(requestBody);
  return cache.entries[key] || null;
}

function setCachedRailSegment(requestBody, resolved) {
  const cache = ensureCacheLoaded();
  const key = createRailCacheKey(requestBody);
  cache.entries[key] = {
    ...resolved,
    cachedAt: new Date().toISOString(),
  };
  persistCache();
}

function normalizePath(points) {
  if (!Array.isArray(points)) return [];

  const normalized = [];
  for (const point of points) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const lng = Number(point[0]);
    const lat = Number(point[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const candidate = [lat, lng];
    const prev = normalized[normalized.length - 1];
    if (!prev || prev[0] !== candidate[0] || prev[1] !== candidate[1]) {
      normalized.push(candidate);
    }
  }
  return normalized;
}

function toNullableNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function extractFareYen(fare) {
  return toNullableNumber(fare?.unit_0);
}

function appendFeatureCoordinates(path, feature) {
  const geometry = feature?.geometry || null;
  if (geometry?.type !== 'LineString') return;

  const nextPoints = normalizePath(geometry.coordinates || []);
  for (const point of nextPoints) {
    const prev = path[path.length - 1];
    if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) {
      path.push(point);
    }
  }
}

function extractShapeTransitGeometry(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  if (!features.length) return null;

  const transportFeatures = features.filter((feature) => feature?.properties?.ways === 'transport');
  if (transportFeatures.length === 0) {
    return null;
  }

  const path = [];
  for (const feature of transportFeatures) {
    appendFeatureCoordinates(path, feature);
  }

  if (path.length < 2) return null;
  const moveTypes = [
    ...new Set(
      transportFeatures
        .map((feature) => feature?.properties?.transport_type)
        .filter(Boolean),
    ),
  ];

  return {
    geometry: {
      path,
      distanceMeters: null,
      durationSec: null,
      warnings: null,
      source: 'rapidapi-shape',
      transitSummary: moveTypes.length ? { moveTypes } : null,
      transitLegs: null,
    },
    debug: {
      source: 'rapidapi-navitime',
      endpoint: 'shape_transit',
      usedTransportOnly: true,
      featureCount: transportFeatures.length,
    },
  };
}

function findNearestPointSection(sections, startIndex, direction) {
  let index = startIndex;
  while (index >= 0 && index < sections.length) {
    const section = sections[index];
    if (section?.type === 'point') {
      return section;
    }
    index += direction;
  }
  return null;
}

function extractTransitLegs(sections) {
  const legs = [];
  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    if (section?.type !== 'move') continue;
    const fromPoint = findNearestPointSection(sections, index - 1, -1);
    const toPoint = findNearestPointSection(sections, index + 1, 1);
    legs.push({
      mode: section?.move || null,
      lineName: section?.line_name || section?.transport?.name || null,
      fromName: fromPoint?.name || null,
      toName: toPoint?.name || null,
      durationSec: toNullableNumber(section?.time) ? Number(section.time) * 60 : null,
      distanceMeters: toNullableNumber(section?.distance),
      companyName: section?.transport?.company?.name || null,
      fareYen: extractFareYen(section?.transport?.fare),
    });
  }
  return legs;
}

function extractRouteTransitFallback(payload) {
  const item = Array.isArray(payload?.items) ? payload.items[0] : null;
  if (!item) return null;

  const path = [];
  for (const section of item.sections || []) {
    if (section?.type !== 'point') continue;
    const lat = Number(section?.coord?.lat);
    const lng = Number(section?.coord?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const prev = path[path.length - 1];
    if (!prev || prev[0] !== lat || prev[1] !== lng) {
      path.push([lat, lng]);
    }
  }

  if (path.length < 2) return null;

  const move = item?.summary?.move || {};
  const transitSummary = {
    transitCount: toNullableNumber(move.transit_count),
    walkDistanceMeters: toNullableNumber(move.walk_distance),
    totalDistanceMeters: toNullableNumber(move.distance),
    totalDurationSec: toNullableNumber(move.time) ? Number(move.time) * 60 : null,
    moveTypes: Array.isArray(move.move_type) ? move.move_type.filter(Boolean) : null,
    fareYen: extractFareYen(move.fare),
  };
  const transitLegs = extractTransitLegs(item.sections || []);
  return {
    geometry: {
      path,
      distanceMeters: Number.isFinite(move.distance) ? move.distance : null,
      durationSec: Number.isFinite(move.time) ? move.time * 60 : null,
      warnings: null,
      source: 'rapidapi-route',
      transitSummary,
      transitLegs,
    },
    debug: {
      source: 'rapidapi-navitime',
      endpoint: 'route_transit',
      fallback: true,
    },
  };
}

function getTokyoDepartureTimeString() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value || '1970';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}T10:00:00`;
}

function buildBaseQuery(requestBody) {
  return {
    start: `${requestBody.origin.lat},${requestBody.origin.lng}`,
    goal: `${requestBody.destination.lat},${requestBody.destination.lng}`,
    datum: 'wgs84',
    term: String(DEFAULT_ROUTE_TERM_MINUTES),
    limit: String(DEFAULT_ROUTE_LIMIT),
    start_time: requestBody.departureAt || getTokyoDepartureTimeString(),
    coord_unit: 'degree',
  };
}

function buildRapidApiUrl(baseUrl, endpointPath, query) {
  const url = new URL(endpointPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function callRapidApi({
  apiKey,
  host = DEFAULT_RAPIDAPI_HOST,
  baseUrl = DEFAULT_RAPIDAPI_BASE_URL,
  endpointPath,
  query,
  timeoutMs = DEFAULT_RAPIDAPI_TIMEOUT_MS,
}) {
  if (!apiKey) {
    throw new Error('未配置 RAPIDAPI_ROUTER_KEY。');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildRapidApiUrl(baseUrl, endpointPath, query), {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': host,
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message = payload?.message || payload?.error || `RapidAPI 请求失败 (${response.status})`;
      const error = new Error(message);
      error.statusCode = response.status;
      throw error;
    }

    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRapidApiRailSegment({
  apiKey,
  host = DEFAULT_RAPIDAPI_HOST,
  baseUrl = DEFAULT_RAPIDAPI_BASE_URL,
  requestBody,
  timeoutMs = DEFAULT_RAPIDAPI_TIMEOUT_MS,
}) {
  const origin = requestBody?.origin;
  const destination = requestBody?.destination;
  if (!origin || !destination) {
    throw new Error('缺少 origin / destination。');
  }

  const cached = getCachedRailSegment(requestBody);
  if (cached?.geometry?.path?.length >= 2) {
    return {
      ...cached,
      debug: {
        ...(cached.debug || {}),
        cacheHit: true,
      },
    };
  }

  const baseQuery = buildBaseQuery(requestBody);

  try {
    const shapePayload = await callRapidApi({
      apiKey,
      host,
      baseUrl,
      endpointPath: '/shape_transit',
      query: {
        ...baseQuery,
        format: 'geojson',
        options: 'transport_shape',
        shape_color: 'railway_line',
      },
      timeoutMs,
    });

    const resolved = extractShapeTransitGeometry(shapePayload);
    if (resolved) {
      setCachedRailSegment(requestBody, resolved);
      return resolved;
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (error?.statusCode === 403 || error?.statusCode === 429) {
      throw error;
    }
  }

  const routePayload = await callRapidApi({
    apiKey,
    host,
    baseUrl,
    endpointPath: '/route_transit',
    query: baseQuery,
    timeoutMs,
  });

  const resolved = extractRouteTransitFallback(routePayload);
  if (resolved) {
    setCachedRailSegment(requestBody, resolved);
  }
  return resolved;
}

function buildSegmentRequestBody(segment, spotById) {
  const origin = spotById.get(segment.fromSpotId);
  const destination = spotById.get(segment.toSpotId);
  if (!origin || !destination) return null;

  return {
    segmentId: segment.id,
    origin: {
      lat: origin.lat,
      lng: origin.lng,
      label: origin.name || segment.fromSpotId,
    },
    destination: {
      lat: destination.lat,
      lng: destination.lng,
      label: destination.name || segment.toSpotId,
    },
    transportType: segment.transportType,
    label: segment.label,
  };
}

function applyGeometryToSegment(segment, geometry) {
  segment.path = geometry.path;
  segment.realDistanceMeters = geometry.distanceMeters ?? null;
  segment.realDurationSec = geometry.durationSec ?? null;
  segment.realWarnings = geometry.warnings ?? null;
  segment.runtimeSource = geometry.source ?? null;
  segment.runtimeTransitSummary = geometry.transitSummary ?? null;
  segment.runtimeTransitLegs = geometry.transitLegs ?? null;
}

function hydrateTripPayloadWithCache(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const spots = Array.isArray(payload.spots) ? payload.spots : [];
  const routeSegments = Array.isArray(payload.routeSegments) ? payload.routeSegments : [];
  const spotById = new Map(spots.map((spot) => [spot.id, spot]));
  const cachedSegmentIds = [];

  for (const segment of routeSegments) {
    if (!TRANSIT_TRANSPORT_TYPES.has(String(segment?.transportType || '').toLowerCase())) {
      continue;
    }

    const requestBody = buildSegmentRequestBody(segment, spotById);
    if (!requestBody) continue;

    const cached = getCachedRailSegment(requestBody);
    if (!cached?.geometry?.path?.length) continue;

    applyGeometryToSegment(segment, cached.geometry);
    cachedSegmentIds.push(segment.id);
  }

  return cachedSegmentIds;
}

module.exports = {
  DEFAULT_RAPIDAPI_TIMEOUT_MS,
  DEFAULT_RAPIDAPI_HOST,
  DEFAULT_RAPIDAPI_BASE_URL,
  RAPIDAPI_RAIL_CACHE_PATH,
  fetchRapidApiRailSegment,
  hydrateTripPayloadWithCache,
};
