const TRANSPORT_LABELS = {
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
const ROUTE_SOURCE_LABELS = {
    google: 'Google 贴路',
    osrm: 'OSRM 贴路',
    'rapidapi-shape': 'RapidAPI 铁路几何',
    'rapidapi-route': 'RapidAPI 乘换摘要',
};
export function formatDistance(meters) {
    if (!Number.isFinite(meters ?? null))
        return null;
    if ((meters ?? 0) >= 1000) {
        return `${((meters ?? 0) / 1000).toFixed(1)} 公里`;
    }
    return `${Math.round(meters ?? 0)} 米`;
}
export function formatDuration(seconds) {
    if (!Number.isFinite(seconds ?? null))
        return null;
    const minutes = Math.round((seconds ?? 0) / 60);
    if (minutes < 60) {
        return `约 ${minutes} 分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes ? `约 ${hours} 小时 ${restMinutes} 分钟` : `约 ${hours} 小时`;
}
export function formatFareYen(fareYen) {
    if (!Number.isFinite(fareYen ?? null))
        return null;
    return `¥${Math.round(fareYen ?? 0)}`;
}
export function formatTransportType(transportType) {
    if (!transportType)
        return '路线';
    return TRANSPORT_LABELS[transportType.toLowerCase()] || transportType;
}
export function formatRouteSource(source) {
    if (!source)
        return null;
    return ROUTE_SOURCE_LABELS[source] || source;
}
export function buildRouteHeadline(segment) {
    return segment.label || formatTransportType(segment.transportType);
}
export function buildRouteMetaLine(segment) {
    const parts = [segment.duration, formatTransportType(segment.transportType)].filter((part) => Boolean(part));
    return Array.from(new Set(parts));
}
export function getRouteActualMeta(segment) {
    return [
        formatDistance(segment.realDistanceMeters),
        formatDuration(segment.realDurationSec),
    ].filter(Boolean);
}
export function getTransitSummaryBadges(summary) {
    if (!summary)
        return [];
    return [
        Number.isFinite(summary.transitCount ?? null) ? `换乘 ${summary.transitCount} 次` : null,
        formatDistance(summary.walkDistanceMeters)
            ? `步行 ${formatDistance(summary.walkDistanceMeters)}`
            : null,
        formatFareYen(summary.fareYen),
        formatDuration(summary.totalDurationSec),
    ].filter(Boolean);
}
export function formatTransitLegTitle(leg) {
    return leg.lineName || formatTransportType(leg.mode);
}
export function getTransitLegMeta(leg) {
    return [
        leg.fromName && leg.toName ? `${leg.fromName} → ${leg.toName}` : null,
        formatDuration(leg.durationSec),
        formatDistance(leg.distanceMeters),
        leg.companyName || null,
        formatFareYen(leg.fareYen),
    ].filter(Boolean);
}
