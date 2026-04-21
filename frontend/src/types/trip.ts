// 与后端 trip-service.js / trip-template.js 的 payload 对齐的类型。
// Phase 3 收紧了 config / spots / routeSegments(之前是 Record<string, unknown>),
// 让 Trip 页、Phase 4 Admin 编辑器以及 map-adapter 都能吃到严格类型。

export interface TripSummary {
  spotCount: number;
  routeSegmentCount: number;
  startDay: number | null;
  endDay: number | null;
}

export interface TripMeta {
  title?: string;
  description?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
}

export interface TripListItem {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  meta: TripMeta;
  summary: TripSummary;
}

export interface TripSummaryResponse extends TripListItem {}

/**
 * Google Maps 相关配置。apiKey 会被后端 stripManagedSecrets 去掉,
 * 前端主要看 mapId / language / region / fallbackToLeaflet。
 */
export interface GoogleMapsConfig {
  apiKey?: string;
  mapId?: string;
  language?: string;
  region?: string;
  fallbackToLeaflet?: boolean;
}

export interface RoutingConfig {
  provider?: string;
  baseUrl?: string;
}

export interface TripConfig {
  mapProvider: 'googleMaps' | 'leaflet';
  centerLat: number;
  centerLng: number;
  defaultZoom: number;
  googleMaps?: GoogleMapsConfig;
  routing?: RoutingConfig;
  dayColors: string[];
}

/**
 * 单个景点。`type: 'transport'` 代表交通点(仅占位),
 * 真正显示在地图上的是 `type: 'spot'`。
 */
export interface SpotItem {
  id: string;
  day: number;
  city: string;
  area: string;
  name: string;
  nameEn?: string;
  timeSlot?: string;
  order: number;
  lat: number;
  lng: number;
  mustVisit: boolean;
  type: 'spot' | 'transport';
  description?: string;
  whyGo?: string;
  stayMinutes?: number;
  nextStopId?: string | null;
  nearNextTransport?: boolean;
  tags?: string[];
  transportNote?: string;
  photos?: string[];
  /** Google Places 自动填充字段(Admin 侧编辑 / 补全使用) */
  googleMapsUri?: string;
  googlePlaceId?: string;
  rating?: number | null;
  website?: string;
  phone?: string;
  openingHours?: string[];
}

/**
 * 一段路线。第一版只用 `path`(lat,lng 数组),
 * Phase 5 再考虑 hydrate 真实路径(走 routing 服务)后的几何。
 */
export interface RouteSegment {
  id: string;
  day: number;
  scope: 'city' | 'intercity';
  fromSpotId: string;
  toSpotId: string;
  transportType: string;
  label?: string;
  duration?: string;
  note?: string;
  path?: Array<[number, number]>;
}

export interface TripFullPayload {
  meta: TripMeta;
  config: TripConfig;
  spots: SpotItem[];
  routeSegments: RouteSegment[];
}

export interface CreateTripBody {
  name: string;
  destination?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  slug?: string;
  template?: 'empty' | 'current';
}

export interface CreateTripResult {
  ok: boolean;
  trip: {
    id: string;
    slug: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    meta: TripMeta;
    summary: TripSummary;
  };
}

export interface UpdateTripResult {
  ok: boolean;
  updatedAt: string;
  payload: TripFullPayload;
}
