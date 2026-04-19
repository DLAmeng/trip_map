import L from 'leaflet';
import { buildRouteTooltipHtml } from '../shared/popup-builder';
/**
 * Leaflet 实现的 RouteLayer。
 *
 * 数据来源:RouteSegment.path(lat,lng 对数组);path 缺失或太短时用
 * fromSpot/toSpot 两端坐标兜底;第一版不走 hydrateRealRouteGeometries。
 *
 * 样式:参考原生 setRouteActiveState L2325-2343 的 opacity/weight,
 * 按 transportType 大致给个颜色,第一版不做图例里那些复杂花样。
 */
const TRANSPORT_COLOR = {
    walk: '#38bdf8',
    subway: '#f97316',
    metro: '#f97316',
    train: '#7c3aed',
    shinkansen: '#dc2626',
    bus: '#10b981',
    drive: '#475569',
};
function getRouteColor(transportType) {
    return TRANSPORT_COLOR[transportType?.toLowerCase?.()] ?? '#64748b';
}
function pointsFromSegment(segment, spotById) {
    if (Array.isArray(segment.path) && segment.path.length >= 2) {
        return segment.path.map(([lat, lng]) => [lat, lng]);
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
export function createLeafletRouteLayer({ map, }) {
    const entries = new Map();
    function removeAll() {
        entries.forEach((entry) => entry.polyline.remove());
        entries.clear();
    }
    function styleFor(segment, active) {
        const isIntercity = segment.scope === 'intercity';
        return {
            color: getRouteColor(segment.transportType),
            opacity: active ? (isIntercity ? 0.88 : 0.72) : (isIntercity ? 0.2 : 0.12),
            weight: active ? (isIntercity ? 3.8 : 3.4) : (isIntercity ? 2.8 : 2.2),
            lineJoin: 'round',
            lineCap: 'round',
        };
    }
    function render(segments, spotById) {
        removeAll();
        for (const segment of segments) {
            const points = pointsFromSegment(segment, spotById);
            if (points.length < 2)
                continue;
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
    function setActiveFilter(filter) {
        entries.forEach((entry) => {
            const matchesDay = filter.day === null || entry.segment.day === filter.day;
            const active = matchesDay;
            if (active === entry.active)
                return;
            entry.polyline.setStyle(styleFor(entry.segment, active));
            entry.active = active;
        });
    }
    function destroy() {
        removeAll();
    }
    return { render, setActiveFilter, destroy };
}
