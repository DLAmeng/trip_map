import { importLibrary, loadGoogleMapsLibrary } from '../map-adapter/google/loader';
import type {
  RouteSegment,
  RouteTransitLeg,
  RouteTransitSummary,
  SpotItem,
  TripConfig,
} from '../types/trip';

export interface ResolvedRouteGeometry {
  path: Array<[number, number]>;
  distanceMeters: number | null;
  durationSec: number | null;
  warnings: string[] | null;
  source?: string | null;
  transitSummary?: RouteTransitSummary | null;
  transitLegs?: RouteTransitLeg[] | null;
}

interface RapidApiRailRouteRequest {
  segmentId: string;
  origin: {
    lat: number;
    lng: number;
    label?: string;
  };
  destination: {
    lat: number;
    lng: number;
    label?: string;
  };
  language?: string;
  transportType?: string;
  label?: string;
}

interface RapidApiRailRouteResponse {
  ok: boolean;
  geometry?: ResolvedRouteGeometry;
  error?: string;
}

export interface HydrateRealRouteGeometriesOptions {
  segments: RouteSegment[];
  spotById: Map<string, SpotItem>;
  config: Pick<TripConfig, 'googleMaps' | 'routing'>;
  routingEngine: 'google' | 'leaflet';
  signal?: AbortSignal;
  onResolved?: (segmentId: string, geometry: ResolvedRouteGeometry) => void;
}

const LEAFLET_ROUTING_DEFAULTS = {
  concurrency: 4,
};

const RAPIDAPI_RAIL_DEFAULTS = {
  endpoint: '/api/routing/rapidapi/rail-segment',
  timeoutMs: 5_000,
  concurrency: 6,
};

const GOOGLE_ROUTING_DEFAULTS = {
  concurrency: 2,
  timeoutMs: 3_000,
  japanTransitTimeoutMs: 1_200,
  travelModes: {
    walk: 'WALKING',
    bus: 'DRIVING',
    drive: 'DRIVING',
    metro: 'TRANSIT',
    subway: 'TRANSIT',
    train: 'TRANSIT',
    jrrapid: 'TRANSIT',
    shinkansen: 'TRANSIT',
    nankai: 'TRANSIT',
  } as Record<string, string>,
  transitPreferences: {
    metro: {
      allowedTransitModes: ['SUBWAY', 'TRAIN', 'LIGHT_RAIL', 'RAIL'],
      routingPreference: 'LESS_WALKING',
    },
    subway: {
      allowedTransitModes: ['SUBWAY', 'TRAIN', 'LIGHT_RAIL', 'RAIL'],
      routingPreference: 'LESS_WALKING',
    },
    train: {
      allowedTransitModes: ['TRAIN', 'RAIL'],
      routingPreference: 'FEWER_TRANSFERS',
    },
    jrrapid: {
      allowedTransitModes: ['TRAIN', 'RAIL'],
      routingPreference: 'FEWER_TRANSFERS',
    },
    shinkansen: {
      allowedTransitModes: ['TRAIN', 'RAIL'],
      routingPreference: 'FEWER_TRANSFERS',
    },
    nankai: {
      allowedTransitModes: ['TRAIN', 'RAIL'],
      routingPreference: 'FEWER_TRANSFERS',
    },
  } as Record<string, Record<string, unknown>>,
};

const TRANSIT_STATION_OVERRIDES: Record<string, { origin: [number, number]; destination: [number, number] }> = {
  'seg-d2-1': {
    origin: [35.6905, 139.7007],
    destination: [35.7107, 139.7982],
  },
  'seg-d2-4': {
    origin: [35.7118, 139.7982],
    destination: [35.7138, 139.7774],
  },
  'seg-d2-5': {
    origin: [35.7138, 139.7774],
    destination: [35.6986, 139.7731],
  },
  'seg-d2-6': {
    origin: [35.6986, 139.7731],
    destination: [35.6905, 139.7007],
  },
  'seg-d3-2': {
    origin: [35.6812, 139.7671],
    destination: [35.625, 139.7757],
  },
  'seg-d4-3': {
    origin: [35.658, 139.7016],
    destination: [35.6905, 139.7007],
  },
  'seg-d5-2': {
    origin: [35.5041, 138.7569],
    destination: [35.5006, 138.8081],
  },
  'seg-d7-1': {
    origin: [34.9858, 135.7585],
    destination: [34.9675, 135.7729],
  },
  'seg-d7-2': {
    origin: [34.9685, 135.7708],
    destination: [35.0036, 135.7723],
  },
  'seg-d8-1': {
    origin: [34.9858, 135.7585],
    destination: [35.017, 135.6814],
  },
  'seg-d10-1': {
    origin: [34.9858, 135.7585],
    destination: [34.8903, 135.7997],
  },
  'seg-d10-4': {
    origin: [34.947, 135.7995],
    destination: [34.9858, 135.7585],
  },
  'seg-d11-2': {
    origin: [34.7025, 135.4977],
    destination: [34.6656, 135.5019],
  },
  'seg-d12-1': {
    origin: [34.6656, 135.5019],
    destination: [34.6812, 135.5208],
  },
  'seg-d12-2': {
    origin: [34.6812, 135.5208],
    destination: [34.6765, 135.5005],
  },
  'seg-d14-1': {
    origin: [34.6678, 135.5],
    destination: [34.4362, 135.2439],
  },
};

const TRANSIT_ROUTE_OVERRIDES: Record<string, Record<string, unknown>> = {
  'seg-d2-1': {
    allowedTransitModes: ['SUBWAY', 'TRAIN', 'RAIL'],
    routingPreference: 'FEWER_TRANSFERS',
  },
  'seg-d2-4': {
    allowedTransitModes: ['SUBWAY', 'TRAIN', 'RAIL'],
    routingPreference: 'FEWER_TRANSFERS',
  },
  'seg-d2-5': {
    allowedTransitModes: ['TRAIN', 'RAIL'],
    routingPreference: 'FEWER_TRANSFERS',
  },
  'seg-d2-6': {
    allowedTransitModes: ['TRAIN', 'RAIL'],
    routingPreference: 'FEWER_TRANSFERS',
  },
  'seg-d7-2': {
    allowedTransitModes: ['TRAIN', 'RAIL'],
    routingPreference: 'FEWER_TRANSFERS',
  },
  'seg-d14-1': {
    allowedTransitModes: ['TRAIN', 'RAIL'],
    routingPreference: 'FEWER_TRANSFERS',
  },
};

const routeGeometryCache = new Map<string, ResolvedRouteGeometry | null>();

export function isTransitTransportType(transportType?: string | null): boolean {
  if (!transportType) return false;
  return ['metro', 'subway', 'train', 'jrrapid', 'shinkansen', 'nankai'].includes(
    transportType.toLowerCase(),
  );
}

export function isRapidApiRailRuntimeEnabled(config: Pick<TripConfig, 'routing'>): boolean {
  return config.routing?.rapidApi?.enabled === true;
}

export function isRapidApiRailSegmentCached(
  segment: Pick<RouteSegment, 'id'>,
  config: Pick<TripConfig, 'routing'>,
): boolean {
  return Boolean(
    segment.id &&
      config.routing?.rapidApi?.cachedSegmentIds?.includes(segment.id),
  );
}

function isJapanRegion(config: Pick<TripConfig, 'googleMaps'>): boolean {
  return config.googleMaps?.region?.toUpperCase() === 'JP';
}

export function isJapanTransitHydrationUnsupported(
  config: Pick<TripConfig, 'googleMaps'>,
): boolean {
  // Google 官方 FAQ 标明 Routes API 的 transit 不支持日本合作方，
  // 所以日本区铁路段无法拿到真实 transit polyline。
  return isJapanRegion(config);
}

export function shouldAwaitInitialRailHydration(
  segment: RouteSegment,
  config: Pick<TripConfig, 'googleMaps' | 'routing'>,
): boolean {
  return (
    isTransitTransportType(segment.transportType) &&
    isJapanTransitHydrationUnsupported(config) &&
    isRapidApiRailRuntimeEnabled(config) &&
    !isRapidApiRailSegmentCached(segment, config)
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function resolveRouteEndpoints(
  segment: RouteSegment,
  spotById: Map<string, SpotItem>,
): Array<[number, number]> {
  const from = spotById.get(segment.fromSpotId);
  const to = spotById.get(segment.toSpotId);
  if (!from || !to) return [];
  return [
    [from.lat, from.lng],
    [to.lat, to.lng],
  ];
}

function getRapidApiRailAdapterUrl(config: Pick<TripConfig, 'routing'>): string {
  return config.routing?.rapidApi?.endpoint || RAPIDAPI_RAIL_DEFAULTS.endpoint;
}

function getRapidApiRailTimeoutMs(config: Pick<TripConfig, 'routing'>): number {
  return config.routing?.rapidApi?.timeoutMs || RAPIDAPI_RAIL_DEFAULTS.timeoutMs;
}

function canUseRapidApiRailFallback(
  segment: RouteSegment,
  config: Pick<TripConfig, 'routing'>,
): boolean {
  return (
    isTransitTransportType(segment.transportType) &&
    isRapidApiRailRuntimeEnabled(config) &&
    !isRapidApiRailSegmentCached(segment, config)
  );
}

function getGoogleTravelMode(transportType?: string | null): string | null {
  if (!transportType) return null;
  return GOOGLE_ROUTING_DEFAULTS.travelModes[transportType.toLowerCase()] || null;
}

function getGoogleTransitPreference(transportType?: string | null): Record<string, unknown> | null {
  if (!transportType) return null;
  return GOOGLE_ROUTING_DEFAULTS.transitPreferences[transportType.toLowerCase()] || null;
}

function getGoogleRouteTimeoutMs(
  segment: RouteSegment,
  config: Pick<TripConfig, 'googleMaps'>,
): number {
  if (isJapanTransitHydrationUnsupported(config) && isTransitTransportType(segment.transportType)) {
    return GOOGLE_ROUTING_DEFAULTS.japanTransitTimeoutMs;
  }
  return GOOGLE_ROUTING_DEFAULTS.timeoutMs;
}

function isGoogleTransitMode(travelMode: string | null): boolean {
  return travelMode === 'TRANSIT';
}

function normalizeGooglePathPoint(point: { lat: number | (() => number); lng: number | (() => number) }): [number, number] {
  const lat = typeof point.lat === 'function' ? point.lat() : point.lat;
  const lng = typeof point.lng === 'function' ? point.lng() : point.lng;
  return [lat, lng];
}

function extractGoogleRoutePath(route: any, transportType = ''): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  const transitOnly = ['metro', 'subway', 'train', 'jrrapid', 'shinkansen', 'nankai'].includes(
    transportType.toLowerCase(),
  );

  route.legs?.forEach((leg: any) => {
    leg.steps?.forEach((step: any) => {
      if (transitOnly && step.travelMode && step.travelMode !== 'TRANSIT') {
        return;
      }
      step.path?.forEach((point: any) => {
        const normalized = normalizeGooglePathPoint(point);
        const last = points[points.length - 1];
        if (!last || last[0] !== normalized[0] || last[1] !== normalized[1]) {
          points.push(normalized);
        }
      });
    });
  });

  if (points.length > 0) {
    return points;
  }

  return Array.isArray(route.path) ? route.path.map(normalizeGooglePathPoint) : [];
}

function getDistanceMetersBetweenPoints([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const earthRadius = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function maybeAttachAccessPoint(
  points: Array<[number, number]>,
  point: [number, number] | undefined,
  position: 'start' | 'end',
): Array<[number, number]> {
  if (!points.length || !point) return points;

  const edgePoint = position === 'start' ? points[0] : points[points.length - 1];
  if (getDistanceMetersBetweenPoints(edgePoint, point) < 18) {
    return points;
  }

  return position === 'start' ? [point, ...points] : [...points, point];
}

function mergeTransitAccessPoints(
  segment: RouteSegment,
  resolvedPoints: Array<[number, number]>,
  routingPoints: Array<[number, number]>,
  spotById: Map<string, SpotItem>,
): Array<[number, number]> {
  const endpoints = resolveRouteEndpoints(segment, spotById);
  if (endpoints.length < 2 || routingPoints.length < 2) {
    return resolvedPoints;
  }

  let merged = [...resolvedPoints];
  if (getDistanceMetersBetweenPoints(endpoints[0], routingPoints[0]) > 18) {
    merged = maybeAttachAccessPoint(merged, endpoints[0], 'start');
  }
  if (getDistanceMetersBetweenPoints(endpoints[1], routingPoints[routingPoints.length - 1]) > 18) {
    merged = maybeAttachAccessPoint(merged, endpoints[1], 'end');
  }
  return merged;
}

function getGoogleRoutingPoints(
  segment: RouteSegment,
  spotById: Map<string, SpotItem>,
  travelMode: string | null,
): Array<[number, number]> {
  if (isGoogleTransitMode(travelMode)) {
    const endpoints = resolveRouteEndpoints(segment, spotById);
    if (endpoints.length < 2) return [];
    const override = TRANSIT_STATION_OVERRIDES[segment.id];
    return [
      override?.origin || endpoints[0],
      override?.destination || endpoints[1],
    ];
  }

  return resolveRouteEndpoints(segment, spotById);
}

function buildRoutingCacheKey(
  segment: RouteSegment,
  points: Array<[number, number]>,
  routingEngine: 'google' | 'leaflet',
  config: Pick<TripConfig, 'routing'>,
): string {
  const serialized = points.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const rapidApiKey = canUseRapidApiRailFallback(segment, config)
    ? getRapidApiRailAdapterUrl(config)
    : '';
  return `${routingEngine}:${segment.transportType}:${rapidApiKey}:${serialized}`;
}

function shouldHydrateRoute(
  segment: RouteSegment,
  options: Pick<HydrateRealRouteGeometriesOptions, 'config' | 'routingEngine'>,
): boolean {
  if (isRapidApiRailSegmentCached(segment, options.config)) {
    return false;
  }

  if (getGoogleTravelMode(segment.transportType) && options.config.googleMaps?.apiKey) {
    return true;
  }

  return canUseRapidApiRailFallback(segment, options.config);
}

function getTokyoDateParts(): { year: string; month: string; day: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  return {
    year: parts.find((part) => part.type === 'year')?.value || '1970',
    month: parts.find((part) => part.type === 'month')?.value || '01',
    day: parts.find((part) => part.type === 'day')?.value || '01',
  };
}

function buildRapidApiRailRequest(
  segment: RouteSegment,
  spotById: Map<string, SpotItem>,
  config: Pick<TripConfig, 'googleMaps'>,
): RapidApiRailRouteRequest | null {
  const originSpot = spotById.get(segment.fromSpotId);
  const destinationSpot = spotById.get(segment.toSpotId);
  if (!originSpot || !destinationSpot) return null;

  return {
    segmentId: segment.id,
    origin: {
      lat: originSpot.lat,
      lng: originSpot.lng,
      label: originSpot.name || segment.fromSpotId,
    },
    destination: {
      lat: destinationSpot.lat,
      lng: destinationSpot.lng,
      label: destinationSpot.name || segment.toSpotId,
    },
    language: config.googleMaps?.language || 'ja',
    transportType: segment.transportType,
    label: segment.label,
  };
}

async function fetchRapidApiRailRouteGeometry(
  segment: RouteSegment,
  spotById: Map<string, SpotItem>,
  config: Pick<TripConfig, 'googleMaps' | 'routing'>,
  signal?: AbortSignal,
): Promise<ResolvedRouteGeometry | null> {
  const request = buildRapidApiRailRequest(segment, spotById, config);
  if (!request) return null;

  const controller = new AbortController();
  const timeoutMs = getRapidApiRailTimeoutMs(config);
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const handleAbort = () => controller.abort();
  signal?.addEventListener('abort', handleAbort, { once: true });

  try {
    const response = await fetch(getRapidApiRailAdapterUrl(config), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload = await response.json() as RapidApiRailRouteResponse;
    if (!payload.ok || !payload.geometry?.path?.length) {
      return null;
    }

    const cleanedPath = payload.geometry.path.filter(
      (point): point is [number, number] =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]),
    );
    if (cleanedPath.length < 2) return null;

    return {
      ...payload.geometry,
      path: mergeTransitAccessPoints(
        segment,
        cleanedPath,
        resolveRouteEndpoints(segment, spotById),
        spotById,
      ),
    };
  } catch (error) {
    if (!isAbortError(error)) {
      console.warn('[routing-api] RapidAPI rail fetch failed:', error);
    }
    return null;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', handleAbort);
  }
}

async function getGoogleRoutesApi(
  config: Pick<TripConfig, 'googleMaps'>,
): Promise<any | null> {
  const apiKey = config.googleMaps?.apiKey;
  if (!apiKey) return null;

  await loadGoogleMapsLibrary({
    apiKey,
    language: config.googleMaps?.language,
    region: config.googleMaps?.region,
  });
  await importLibrary('routes');

  return (google.maps as any)?.routes?.Route || null;
}

function getGoogleTransitDepartureTime(): Date {
  const { year, month, day } = getTokyoDateParts();
  return new Date(`${year}-${month}-${day}T10:00:00+09:00`);
}

async function fetchGoogleRouteGeometry(
  segment: RouteSegment,
  spotById: Map<string, SpotItem>,
  config: Pick<TripConfig, 'googleMaps'>,
  signal?: AbortSignal,
): Promise<ResolvedRouteGeometry | null> {
  const RouteApi = await getGoogleRoutesApi(config);
  const travelMode = getGoogleTravelMode(segment.transportType);
  if (!RouteApi?.computeRoutes || !travelMode || signal?.aborted) {
    return null;
  }

  const routingPoints = getGoogleRoutingPoints(segment, spotById, travelMode);
  if (routingPoints.length < 2) return null;

  const request: Record<string, unknown> = {
    origin: { location: { lat: routingPoints[0][0], lng: routingPoints[0][1] } },
    destination: {
      location: {
        lat: routingPoints[routingPoints.length - 1][0],
        lng: routingPoints[routingPoints.length - 1][1],
      },
    },
    travelMode,
    fields: ['path', 'legs', 'distanceMeters', 'durationMillis', 'warnings'],
    polylineQuality: 'HIGH_QUALITY',
  };

  if (isGoogleTransitMode(travelMode)) {
    request.departureTime = getGoogleTransitDepartureTime();
    request.transitPreference =
      TRANSIT_ROUTE_OVERRIDES[segment.id] ||
      getGoogleTransitPreference(segment.transportType) || {
        allowedTransitModes: ['SUBWAY', 'TRAIN', 'LIGHT_RAIL', 'RAIL'],
        routingPreference: 'LESS_WALKING',
      };
  } else if (routingPoints.length > 2) {
    request.intermediates = routingPoints.slice(1, -1).map(([lat, lng]) => ({
      location: { lat, lng },
      via: true,
    }));
  }

  try {
    let timeoutId: number | null = null;
    const response = await Promise.race<any | null>([
      RouteApi.computeRoutes(request),
      new Promise<null>((resolve) => {
        timeoutId = window.setTimeout(
          () => resolve(null),
          getGoogleRouteTimeoutMs(segment, config),
        );
      }),
    ]);
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
    if (signal?.aborted) return null;

    const route = response?.routes?.[0];
    if (!route?.path?.length) {
      return null;
    }

    const resolvedPoints = extractGoogleRoutePath(route, segment.transportType);
    const path = isGoogleTransitMode(travelMode)
      ? mergeTransitAccessPoints(segment, resolvedPoints, routingPoints, spotById)
      : resolvedPoints;

    return {
      path,
      distanceMeters: route.distanceMeters || null,
      durationSec: route.durationMillis ? route.durationMillis / 1000 : null,
      warnings: Array.isArray(route.warnings) ? route.warnings.filter(Boolean) : null,
      source: 'google',
      transitSummary: null,
      transitLegs: null,
    };
  } catch (error) {
    if (!isAbortError(error)) {
      console.warn('[routing-api] Google Routes fetch failed:', error);
    }
    return null;
  }
}

async function resolveRouteGeometry(
  segment: RouteSegment,
  spotById: Map<string, SpotItem>,
  options: Pick<HydrateRealRouteGeometriesOptions, 'config' | 'routingEngine' | 'signal'>,
): Promise<ResolvedRouteGeometry | null> {
  const googleTravelMode = getGoogleTravelMode(segment.transportType);
  const canAttemptGoogle = Boolean(googleTravelMode && options.config.googleMaps?.apiKey);
  const googlePoints = canAttemptGoogle
    ? getGoogleRoutingPoints(segment, spotById, googleTravelMode)
    : [];
  const fallbackPoints = resolveRouteEndpoints(segment, spotById);
  const cacheKey = buildRoutingCacheKey(
    segment,
    googlePoints.length > 0 ? googlePoints : fallbackPoints,
    options.routingEngine,
    options.config,
  );

  if (routeGeometryCache.has(cacheKey)) {
    return routeGeometryCache.get(cacheKey) || null;
  }

  let resolved: ResolvedRouteGeometry | null = null;

  // Google 优先，只有 Google 没拿到路线时才回退 RapidAPI。
  if (canAttemptGoogle && googleTravelMode) {
    resolved = await fetchGoogleRouteGeometry(segment, spotById, options.config, options.signal);
  }

  if (!resolved && canUseRapidApiRailFallback(segment, options.config)) {
    resolved = await fetchRapidApiRailRouteGeometry(segment, spotById, options.config, options.signal);
  }

  routeGeometryCache.set(cacheKey, resolved);
  return resolved;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.allSettled(runners);
}

function getHydrationConcurrency(
  targets: RouteSegment[],
  options: Pick<HydrateRealRouteGeometriesOptions, 'config' | 'routingEngine'>,
): number {
  if (targets.some((segment) => shouldAwaitInitialRailHydration(segment, options.config))) {
    return RAPIDAPI_RAIL_DEFAULTS.concurrency;
  }

  return options.routingEngine === 'google'
    ? GOOGLE_ROUTING_DEFAULTS.concurrency
    : LEAFLET_ROUTING_DEFAULTS.concurrency;
}

export async function hydrateRealRouteGeometries(
  options: HydrateRealRouteGeometriesOptions,
): Promise<Record<string, ResolvedRouteGeometry>> {
  const targets = options.segments.filter((segment) => shouldHydrateRoute(segment, options));
  const concurrency = getHydrationConcurrency(targets, options);
  const resolved: Record<string, ResolvedRouteGeometry> = {};

  await runWithConcurrency(targets, concurrency, async (segment) => {
    if (options.signal?.aborted) return;

    try {
      const geometry = await resolveRouteGeometry(segment, options.spotById, options);
      if (!geometry || options.signal?.aborted) return;
      resolved[segment.id] = geometry;
      options.onResolved?.(segment.id, geometry);
    } catch (error) {
      if (!isAbortError(error)) {
        console.warn('[routing-api] hydrateRealRouteGeometries failed:', segment.id, error);
      }
    }
  });

  return resolved;
}
