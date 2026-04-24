import type {
  RouteSegment,
  RouteTransitLeg,
  RouteTransitSummary,
} from '../types/trip';

const TRANSPORT_LABELS: Record<string, string> = {
  walk: '步行',
  subway: '地铁',
  metro: '地铁 / 电车',
  train: 'JR / 私铁',
  jrrapid: 'JR 快速',
  shinkansen: '新干线',
  nankai: '南海电铁',
  bus: '巴士',
  drive: '自驾',
  rapid_train: '快速列车',
  local_train: '普通列车',
};

const ROUTE_SOURCE_LABELS: Record<string, string> = {
  google: 'Google 贴路',
  osrm: 'OSRM 贴路',
  'rapidapi-shape': 'RapidAPI 铁路几何',
  'rapidapi-route': 'RapidAPI 乘换摘要',
};

export function formatDistance(meters?: number | null): string | null {
  if (!Number.isFinite(meters ?? null)) return null;
  if ((meters ?? 0) >= 1000) {
    return `${((meters ?? 0) / 1000).toFixed(1)} 公里`;
  }
  return `${Math.round(meters ?? 0)} 米`;
}

export function formatDuration(seconds?: number | null): string | null {
  if (!Number.isFinite(seconds ?? null)) return null;
  const minutes = Math.round((seconds ?? 0) / 60);
  if (minutes < 60) {
    return `约 ${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `约 ${hours} 小时 ${restMinutes} 分钟` : `约 ${hours} 小时`;
}

export function formatFareYen(fareYen?: number | null): string | null {
  if (!Number.isFinite(fareYen ?? null)) return null;
  return `¥${Math.round(fareYen ?? 0)}`;
}

export function formatTransportType(transportType?: string | null): string {
  if (!transportType) return '路线';
  return TRANSPORT_LABELS[transportType.toLowerCase()] || transportType;
}

export function formatRouteSource(source?: string | null): string | null {
  if (!source) return null;
  return ROUTE_SOURCE_LABELS[source] || source;
}

export function buildRouteHeadline(segment: Pick<RouteSegment, 'label' | 'duration' | 'transportType'>): string {
  return segment.label || formatTransportType(segment.transportType);
}

export function buildRouteMetaLine(segment: Pick<RouteSegment, 'duration' | 'transportType'>): string[] {
  const parts = [segment.duration, formatTransportType(segment.transportType)].filter(
    (part): part is string => Boolean(part),
  );
  return Array.from(new Set(parts));
}

export function getRouteActualMeta(segment: Pick<RouteSegment, 'realDistanceMeters' | 'realDurationSec'>): string[] {
  return [
    formatDistance(segment.realDistanceMeters),
    formatDuration(segment.realDurationSec),
  ].filter(Boolean) as string[];
}

export function getTransitSummaryBadges(summary?: RouteTransitSummary | null): string[] {
  if (!summary) return [];
  return [
    Number.isFinite(summary.transitCount ?? null) ? `换乘 ${summary.transitCount} 次` : null,
    formatDistance(summary.walkDistanceMeters)
      ? `步行 ${formatDistance(summary.walkDistanceMeters)}`
      : null,
    formatFareYen(summary.fareYen),
    formatDuration(summary.totalDurationSec),
  ].filter(Boolean) as string[];
}

export function formatTransitLegTitle(leg: RouteTransitLeg): string {
  return leg.lineName || formatTransportType(leg.mode);
}

export function getTransitLegMeta(leg: RouteTransitLeg): string[] {
  return [
    leg.fromName && leg.toName ? `${leg.fromName} → ${leg.toName}` : null,
    formatDuration(leg.durationSec),
    formatDistance(leg.distanceMeters),
    leg.companyName || null,
    formatFareYen(leg.fareYen),
  ].filter(Boolean) as string[];
}
