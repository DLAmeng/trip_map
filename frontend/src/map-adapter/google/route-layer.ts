import type { RouteSegment, SpotItem } from '../../types/trip';
import type { RouteClickAnchor, RouteLayer, RouteFilter } from '../types';

interface GoogleRouteRef {
  /** 顶层本体:承载颜色 + click 事件 */
  bodyLine: google.maps.Polyline;
  /** 底层 casing:深色外描边,clickable:false 不拦截 */
  casingLine: google.maps.Polyline;
  segmentId: string;
  day: number;
  cities: Set<string>;
}

interface CreateGoogleRouteLayerParams {
  onRouteClick?: (segmentId: string, anchor: RouteClickAnchor) => void;
  /** P30: 按 day 着色用 — 与 marker / SpotList 共享同一份 dayColors */
  dayColors?: string[];
}

export function createGoogleRouteLayer({ onRouteClick, dayColors = [] }: CreateGoogleRouteLayerParams = {}) {
  let map: google.maps.Map | null = null;
  let routeRefs: GoogleRouteRef[] = [];
  let currentFilter: RouteFilter = { day: null, city: null };

  // 缓冲逻辑
  let pendingSegments: RouteSegment[] | null = null;
  let pendingSpotById: Map<string, SpotItem> | null = null;

  // P30: 之前按 transportType 着色(步行蓝 / 地铁橙 / 新干线红),
  // 用户反馈「同一天路线颜色应该一致 + 跟景点颜色对应」,改为完全按 day 着色。
  // 14 个内置 fallback 颜色覆盖最长行程,不够时用 hash hue 兜底。
  const DAY_COLOR_FALLBACK = [
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
    '#3498db', '#9b59b6', '#8e44ad', '#c0392b', '#d35400',
    '#27ae60', '#2980b9', '#16a085', '#7f8c8d',
  ];
  function getDayColor(day: number): string {
    const idx = Math.max(0, (day || 1) - 1);
    return dayColors[idx] || DAY_COLOR_FALLBACK[idx % DAY_COLOR_FALLBACK.length];
  }

  function destroy() {
    routeRefs.forEach((ref) => {
      ref.bodyLine.setMap(null);
      ref.casingLine.setMap(null);
    });
    routeRefs = [];
  }

  function applyVisibility() {
    routeRefs.forEach((ref) => {
      const dayMatches =
        !currentFilter.visibleDays ||
        currentFilter.visibleDays.size === 0 ||
        currentFilter.visibleDays.has(ref.day);
      const cityMatches =
        currentFilter.city === null ||
        !currentFilter.visibleCities ||
        currentFilter.visibleCities.size === 0 ||
        [...ref.cities].some((city) => currentFilter.visibleCities?.has(city));
      const isVisible = dayMatches && cityMatches;
      // 两层都做 show/hide,避免过滤时只剩描边或只剩本体
      ref.bodyLine.setMap(isVisible ? map : null);
      ref.casingLine.setMap(isVisible ? map : null);
    });
  }

  const layer: RouteLayer & { init: (m: google.maps.Map) => void; destroy: () => void } = {
    init(m: google.maps.Map) {
      map = m;
      if (pendingSegments && pendingSpotById) {
        layer.render(pendingSegments, pendingSpotById);
      }
      applyVisibility();
    },

    render(segments: RouteSegment[], spotById: Map<string, SpotItem>) {
      pendingSegments = segments;
      pendingSpotById = spotById;
      destroy();
      if (!map) return;

      routeRefs = segments.map((seg) => {
        const fromSpot = spotById.get(seg.fromSpotId);
        const toSpot = spotById.get(seg.toSpotId);

        let path: google.maps.LatLngLiteral[] = [];
        if (seg.path && seg.path.length > 0) {
          path = seg.path.map(([lat, lng]) => ({ lat, lng }));
        } else if (fromSpot && toSpot) {
          path = [
            { lat: fromSpot.lat, lng: fromSpot.lng },
            { lat: toSpot.lat, lng: toSpot.lng },
          ];
        }

        // P30: 路线颜色 = 该 day 的颜色(与 marker / SpotList 同步),不再按 transportType
        const bodyColor = getDayColor(seg.day);
        // 先建 casing(底层描边),zIndex 更低,clickable:false 不拦截事件
        const casingLine = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#1a1a1a',
          strokeOpacity: 0.45,
          strokeWeight: 8,
          clickable: false,
          zIndex: 1,
          map: map!,
        });
        const bodyLine = new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: bodyColor,
          strokeOpacity: 0.85,
          strokeWeight: 4,
          clickable: true,
          zIndex: 2,
          map: map!,
        });

        bodyLine.addListener('click', (event: google.maps.PolyMouseEvent) => {
          const domEvent = event.domEvent as MouseEvent | undefined;
          domEvent?.stopPropagation?.();
          domEvent?.preventDefault?.();
          onRouteClick?.(seg.id, {
            clientX: domEvent?.clientX ?? 0,
            clientY: domEvent?.clientY ?? 0,
            lat: event.latLng?.lat(),
            lng: event.latLng?.lng(),
          });
        });

        // Google Maps Tooltip (Simple Title)
        // const tooltip = buildRouteTooltipHtml(seg);
        // Note: Google Polylines don't have built-in easy tooltips like Leaflet,
        // we could use InfoWindow on click, but keeping it simple for now.

        const cities = new Set<string>();
        if (fromSpot?.city) cities.add(fromSpot.city);
        if (toSpot?.city) cities.add(toSpot.city);

        return {
          bodyLine,
          casingLine,
          segmentId: seg.id,
          day: seg.day,
          cities,
        };
      });

      applyVisibility();
    },

    setActiveFilter(filter: RouteFilter) {
      currentFilter = filter;
      applyVisibility();
    },

    destroy() {
      destroy();
    },
  };

  return layer;
}
