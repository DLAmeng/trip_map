import L from 'leaflet';
import type { RouteSegment, SpotItem } from '../../types/trip';
import type { RouteLayer, RouteFilter } from '../types';
import { buildRouteTooltipHtml } from '../shared/popup-builder';

interface RouteEntry {
  segment: RouteSegment;
  polyline: L.Polyline;
  active: boolean;
}

interface CreateRouteLayerParams {
  map: L.Map;
}

/**
 * Leaflet 实现的 RouteLayer。
 *
 * 数据来源:RouteSegment.path(lat,lng 对数组);path 缺失或太短时用
 * fromSpot/toSpot 两端坐标兜底;第一版不走 hydrateRealRouteGeometries。
 *
 * 样式:参考原生 setRouteActiveState L2325-2343 的 opacity/weight,
 * 按 transportType 大致给个颜色,第一版不做图例里那些复杂花样。
 */

const TRANSPORT_COLOR: Record<string, string> = {
  walk: '#38bdf8',
  subway: '#f97316',
  metro: '#f97316',
  train: '#7c3aed',
  shinkansen: '#dc2626',
  bus: '#10b981',
  drive: '#475569',
};

function getRouteColor(transportType: string): string {
  return TRANSPORT_COLOR[transportType?.toLowerCase?.()] ?? '#64748b';
}

function pointsFromSegment(
  segment: RouteSegment,
  spotById: Map<string, SpotItem>,
): L.LatLngExpression[] {
  if (Array.isArray(segment.path) && segment.path.length >= 2) {
    return segment.path.map(([lat, lng]) => [lat, lng] as L.LatLngTuple);
  }
  const from = spotById.get(segment.fromSpotId);
  const to = spotById.get(segment.toSpotId);
  if (from && to) {
    return [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ];
  }
  return [];
}

export function createLeafletRouteLayer({
  map,
}: CreateRouteLayerParams): RouteLayer & { destroy(): void } {
  const entries = new Map<string, RouteEntry>();

  function removeAll(): void {
    entries.forEach((entry) => entry.polyline.remove());
    entries.clear();
  }

  function styleFor(segment: RouteSegment, active: boolean): L.PathOptions {
    const isIntercity = segment.scope === 'intercity';
    const transportType = segment.transportType?.toLowerCase() || '';
    const isAnimated = transportType === 'walk' || transportType === 'bus';

    return {
      color: getRouteColor(segment.transportType),
      opacity: active ? (isIntercity ? 0.88 : 0.72) : (isIntercity ? 0.2 : 0.12),
      weight: active ? (isIntercity ? 3.8 : 3.4) : (isIntercity ? 2.8 : 2.2),
      lineJoin: 'round',
      lineCap: 'round',
      className: isAnimated ? 'route-path-animated' : '',
    };
  }

  function render(segments: RouteSegment[], spotById: Map<string, SpotItem>): void {
    removeAll();
    for (const segment of segments) {
      const points = pointsFromSegment(segment, spotById);
      if (points.length < 2) continue;
      const polyline = L.polyline(points, styleFor(segment, true));
      polyline.bindTooltip(buildRouteTooltipHtml(segment), {
        sticky: true,
        direction: 'top',
        opacity: 0.9,
      });
      polyline.addTo(map);
      entries.set(segment.id, { segment, polyline, active: true });
    }
  }

  function setActiveFilter(filter: RouteFilter): void {
    entries.forEach((entry) => {
      const matchesDay = filter.day === null || entry.segment.day === filter.day;
      const active = matchesDay;
      if (active === entry.active) return;
      entry.polyline.setStyle(styleFor(entry.segment, active));
      entry.active = active;
    });
  }

  function destroy(): void {
    removeAll();
  }

  return { render, setActiveFilter, destroy };
}
