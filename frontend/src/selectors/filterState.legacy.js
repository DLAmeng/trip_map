export const DEFAULT_FILTER = {
    day: null,
    city: null,
    mustOnly: false,
    nextOnly: false,
};
export function matchesFilter(spot, filter) {
    if (filter.day !== null && spot.day !== filter.day)
        return false;
    if (filter.city !== null && spot.city !== filter.city)
        return false;
    if (filter.mustOnly && !spot.mustVisit)
        return false;
    if (filter.nextOnly && !spot.nextStopId)
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
 * - city 过滤:需要 from/to 任意一端的 spot.city 命中
 * - mustOnly / nextOnly 不直接影响 segment(段连接的两端只要有一端可见就保留)
 */
export function getVisibleSegmentIds(segments, filter, spotById) {
    const ids = new Set();
    for (const segment of segments) {
        if (filter.day !== null && segment.day !== filter.day)
            continue;
        if (filter.city !== null) {
            if (!spotById)
                continue;
            const from = spotById.get(segment.fromSpotId);
            const to = spotById.get(segment.toSpotId);
            const hit = (from && from.city === filter.city) || (to && to.city === filter.city);
            if (!hit)
                continue;
        }
        ids.add(segment.id);
    }
    return ids;
}
