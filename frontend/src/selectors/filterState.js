export const DEFAULT_FILTER = {
    day: null,
    mustOnly: false,
};
export function matchesFilter(spot, filter) {
    if (filter.day !== null && spot.day !== filter.day)
        return false;
    if (filter.mustOnly && !spot.mustVisit)
        return false;
    return true;
}
export function getVisibleSpotIds(spots, filter) {
    const ids = new Set();
    for (const spot of spots) {
        if (matchesFilter(spot, filter))
            ids.add(spot.id);
    }
    return ids;
}
export function getVisibleSpots(spots, filter) {
    return spots.filter((spot) => matchesFilter(spot, filter));
}
/**
 * 按 filter 返回 segment 里仍然命中的 id 集合。
 * - day 过滤:segment.day 和 filter.day 相等
 * - mustOnly 过滤:第一版不对 segment 生效(因为一段路只要 from/to 有任一 must 就保留会很复杂,留到 Phase 5)
 */
export function getVisibleSegmentIds(segments, filter) {
    const ids = new Set();
    for (const segment of segments) {
        if (filter.day !== null && segment.day !== filter.day)
            continue;
        ids.add(segment.id);
    }
    return ids;
}
