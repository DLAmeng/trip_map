import L from 'leaflet';
import type { RouteSegment, SpotItem } from '../../types/trip';
import type { RouteClickAnchor, RouteLayer, RouteFilter } from '../types';
import { buildRouteTooltipHtml } from '../shared/popup-builder';

interface RouteEntry {
  segment: RouteSegment;
  /** 顶层本体:承载 tooltip / click / hover,样式由 styleFor 决定 */
  bodyLine: L.Polyline;
  /** 底层 casing:深色外描边,interactive: false,不拦截事件 */
  casingLine: L.Polyline;
  active: boolean;
  cities: Set<string>;
  detachDomListener?: () => void;
}

interface CreateRouteLayerParams {
  map: L.Map;
  onRouteClick?: (segmentId: string, anchor: RouteClickAnchor) => void;
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
  jrrapid: '#7c3aed',
  shinkansen: '#dc2626',
  nankai: '#0f766e',
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
  onRouteClick,
}: CreateRouteLayerParams): RouteLayer & { destroy(): void } {
  const entries = new Map<string, RouteEntry>();

  function removeAll(): void {
    entries.forEach((entry) => {
      entry.detachDomListener?.();
      entry.bodyLine.remove();
      entry.casingLine.remove();
    });
    entries.clear();
  }

  function styleFor(segment: RouteSegment, active: boolean): L.PathOptions {
    const isIntercity = segment.scope === 'intercity';

    return {
      color: getRouteColor(segment.transportType),
      opacity: active ? (isIntercity ? 0.88 : 0.72) : (isIntercity ? 0.2 : 0.12),
      weight: active ? (isIntercity ? 3.8 : 3.4) : (isIntercity ? 2.8 : 2.2),
      lineJoin: 'round',
      lineCap: 'round',
    };
  }

  /**
   * 底层 casing 样式(描边):深色、更粗、半透明,interactive:false 不拦截事件。
   * 与 body 同步激活 / 淡化,维持视觉层次但不改变用户交互。
   */
  function casingStyleFor(segment: RouteSegment, active: boolean): L.PathOptions {
    const body = styleFor(segment, active);
    const bodyWeight = typeof body.weight === 'number' ? body.weight : 3;
    return {
      color: '#1a1a1a',
      opacity: active ? 0.5 : 0.15,
      weight: bodyWeight + 4,
      lineJoin: 'round',
      lineCap: 'round',
      interactive: false,
    };
  }

  function render(segments: RouteSegment[], spotById: Map<string, SpotItem>): void {
    removeAll();
    for (const segment of segments) {
      const points = pointsFromSegment(segment, spotById);
      if (points.length < 2) continue;
      // 先画底层 casing(描边),后画顶层 body;Leaflet 的 DOM 叠加顺序按 addTo 顺序,
      // 后加的在上层,这样 body 的颜色会盖在深色描边之上,形成"双色"效果。
      const casingLine = L.polyline(points, casingStyleFor(segment, true)).addTo(map);
      const bodyLine = L.polyline(points, styleFor(segment, true));
      const emitRouteClick = (clientX: number, clientY: number, lat?: number, lng?: number) => {
        onRouteClick?.(segment.id, {
          clientX,
          clientY,
          lat,
          lng,
        });
      };
      bodyLine.bindTooltip(buildRouteTooltipHtml(segment), {
        sticky: true,
        direction: 'top',
        opacity: 0.9,
      });
      bodyLine.on('click', (event: L.LeafletMouseEvent) => {
        const originalEvent = event.originalEvent as MouseEvent | undefined;
        originalEvent?.stopPropagation?.();
        originalEvent?.preventDefault?.();
        emitRouteClick(
          originalEvent?.clientX ?? 0,
          originalEvent?.clientY ?? 0,
          event.latlng?.lat,
          event.latlng?.lng,
        );
      });
      let detachDomListener: (() => void) | undefined;
      const attachDomListener = () => {
        const polylineElement = bodyLine.getElement();
        if (!polylineElement) return;
        const handleDomClick = (event: Event) => {
          const mouseEvent = event as MouseEvent;
          mouseEvent.stopPropagation();
          mouseEvent.preventDefault();
          const latLng = map.mouseEventToLatLng(mouseEvent);
          emitRouteClick(mouseEvent.clientX, mouseEvent.clientY, latLng?.lat, latLng?.lng);
        };
        polylineElement.addEventListener('click', handleDomClick);
        detachDomListener = () => {
          bodyLine.off('add', attachDomListener);
          polylineElement.removeEventListener('click', handleDomClick);
        };
      };
      bodyLine.once('add', attachDomListener);
      bodyLine.addTo(map);
      const cities = new Set<string>();
      const from = spotById.get(segment.fromSpotId);
      const to = spotById.get(segment.toSpotId);
      if (from?.city) cities.add(from.city);
      if (to?.city) cities.add(to.city);
      entries.set(segment.id, { segment, bodyLine, casingLine, active: true, cities, detachDomListener });
    }
  }

  function setActiveFilter(filter: RouteFilter): void {
    entries.forEach((entry) => {
      const matchesDay =
        !filter.visibleDays ||
        filter.visibleDays.size === 0 ||
        filter.visibleDays.has(entry.segment.day);
      const matchesCity =
        filter.city === null ||
        !filter.visibleCities ||
        filter.visibleCities.size === 0 ||
        [...entry.cities].some((city) => filter.visibleCities?.has(city));
      const active = matchesDay && matchesCity;
      if (active === entry.active) return;
      entry.bodyLine.setStyle(styleFor(entry.segment, active));
      entry.casingLine.setStyle(casingStyleFor(entry.segment, active));
      entry.active = active;
    });
  }

  function destroy(): void {
    removeAll();
  }

  return { render, setActiveFilter, destroy };
}
