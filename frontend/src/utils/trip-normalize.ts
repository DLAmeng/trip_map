import type {
  RouteSegment,
  SpotItem,
  TripFullPayload,
  TripMeta,
} from '../types/trip';

/**
 * 保存前的 trip payload 归一化:
 * - 字符串字段 trim,空值统一
 * - 数字字段 Number 解析,NaN 回退到合理默认值
 * - 布尔字段 Boolean() 包一层
 * - tags 支持数组 / CSV 字符串两种输入
 * - path 支持 [[lat,lng], ...] 数组,或手工粘贴的 JSON 字符串
 *
 * 目标:UI 里受控输入保留用户原始字符串(含前后空格、空字符串),
 * 但保存到数据库前统一清洗,避免脏数据流入。
 */

function toStr(value: unknown): string {
  return String(value ?? '').trim();
}

function toNullableStr(value: unknown): string | null {
  const next = toStr(value);
  return next ? next : null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === '' || value === null || value === undefined) return fallback;
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function parseCsvTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(toStr).filter(Boolean);
  }
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parsePathInput(value: unknown): Array<[number, number]> {
  if (Array.isArray(value)) {
    return value
      .map((pair) => {
        if (!Array.isArray(pair) || pair.length < 2) return null;
        const lat = Number(pair[0]);
        const lng = Number(pair[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return [lat, lng] as [number, number];
      })
      .filter((pair): pair is [number, number] => pair !== null);
  }
  const raw = toStr(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return parsePathInput(parsed);
  } catch {
    throw new Error('路径必须是合法 JSON 数组,如 [[35.68, 139.76], ...]');
  }
}

export function normalizeSpot(spot: Partial<SpotItem>): SpotItem {
  const typeRaw = toStr(spot.type) || 'spot';
  const type: SpotItem['type'] = typeRaw === 'transport' ? 'transport' : 'spot';

  return {
    id: toStr(spot.id),
    day: toNumber(spot.day, 1),
    city: toStr(spot.city),
    area: toStr(spot.area),
    name: toStr(spot.name),
    nameEn: toStr(spot.nameEn),
    timeSlot: toStr(spot.timeSlot),
    order: toNumber(spot.order, 1),
    lat: toNumber(spot.lat, 0),
    lng: toNumber(spot.lng, 0),
    mustVisit: Boolean(spot.mustVisit),
    type,
    description: toStr(spot.description),
    whyGo: toStr(spot.whyGo),
    stayMinutes: toNumber(spot.stayMinutes, 0),
    nextStopId: toNullableStr(spot.nextStopId),
    nearNextTransport: Boolean(spot.nearNextTransport),
    tags: parseCsvTags(spot.tags),
    transportNote: toStr(spot.transportNote),
    photos: Array.isArray(spot.photos) ? spot.photos.map(toStr).filter(Boolean) : [],
    googleMapsUri: toStr(spot.googleMapsUri),
    googlePlaceId: toStr(spot.googlePlaceId),
    rating:
      spot.rating === null || spot.rating === undefined
        ? null
        : toNumber(spot.rating, 0),
    website: toStr(spot.website),
    phone: toStr(spot.phone),
    openingHours: Array.isArray(spot.openingHours)
      ? spot.openingHours.map(toStr).filter(Boolean)
      : [],
  };
}

export function normalizeSegment(segment: Partial<RouteSegment>): RouteSegment {
  const scopeRaw = toStr(segment.scope) || 'city';
  const scope: RouteSegment['scope'] = scopeRaw === 'intercity' ? 'intercity' : 'city';

  let path: Array<[number, number]> = [];
  if (segment.path !== undefined && segment.path !== null) {
    path = parsePathInput(segment.path);
  }

  return {
    id: toStr(segment.id),
    day: toNumber(segment.day, 1),
    scope,
    fromSpotId: toStr(segment.fromSpotId),
    toSpotId: toStr(segment.toSpotId),
    transportType: toStr(segment.transportType),
    label: toStr(segment.label),
    duration: toStr(segment.duration),
    note: toStr(segment.note),
    path,
  };
}

export function normalizeMeta(meta: Partial<TripMeta> | undefined): TripMeta {
  return {
    title: toStr(meta?.title),
    description: toStr(meta?.description),
    destination: toStr(meta?.destination),
    startDate: toStr(meta?.startDate),
    endDate: toStr(meta?.endDate),
  };
}

/**
 * 校验异常:每条记录哪一行哪一字段出错,便于在 UI 上定位。
 */
export interface NormalizeIssue {
  kind: 'spot' | 'segment';
  index: number;
  id?: string;
  field: string;
  message: string;
}

export interface NormalizeResult {
  payload: TripFullPayload;
  issues: NormalizeIssue[];
}

export function normalizeTripForSave(trip: TripFullPayload): NormalizeResult {
  const issues: NormalizeIssue[] = [];

  const spots = trip.spots.map((spot, index) => {
    try {
      return normalizeSpot(spot);
    } catch (err) {
      issues.push({
        kind: 'spot',
        index,
        id: spot.id,
        field: 'unknown',
        message: err instanceof Error ? err.message : String(err),
      });
      return spot;
    }
  });

  const routeSegments = trip.routeSegments.map((segment, index) => {
    try {
      return normalizeSegment(segment);
    } catch (err) {
      issues.push({
        kind: 'segment',
        index,
        id: segment.id,
        field: 'path',
        message: err instanceof Error ? err.message : String(err),
      });
      return segment;
    }
  });

  const payload: TripFullPayload = {
    ...trip,
    meta: normalizeMeta(trip.meta),
    spots,
    routeSegments,
  };

  return { payload, issues };
}
