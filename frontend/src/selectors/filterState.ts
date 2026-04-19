import type { RouteSegment, SpotItem } from '../types/trip';

/**
 * Trip 页的 UI 过滤状态。第一版只保留 day + mustOnly,
 * city / showNextOnly 等 Phase 3.x 再补(原生 app.js state 里有)。
 */
export interface FilterState {
  /** null = 全部 */
  day: number | null;
  mustOnly: boolean;
}

export const DEFAULT_FILTER: FilterState = {
  day: null,
  mustOnly: false,
};

export function matchesFilter(spot: SpotItem, filter: FilterState): boolean {
  if (filter.day !== null && spot.day !== filter.day) return false;
  if (filter.mustOnly && !spot.mustVisit) return false;
  return true;
}

export function getVisibleSpotIds(spots: SpotItem[], filter: FilterState): Set<string> {
  const ids = new Set<string>();
  for (const spot of spots) {
    if (matchesFilter(spot, filter)) ids.add(spot.id);
  }
  return ids;
}

export function getVisibleSpots(spots: SpotItem[], filter: FilterState): SpotItem[] {
  return spots.filter((spot) => matchesFilter(spot, filter));
}

/**
 * 按 filter 返回 segment 里仍然命中的 id 集合。
 * - day 过滤:segment.day 和 filter.day 相等
 * - mustOnly 过滤:第一版不对 segment 生效(因为一段路只要 from/to 有任一 must 就保留会很复杂,留到 Phase 5)
 */
export function getVisibleSegmentIds(
  segments: RouteSegment[],
  filter: FilterState,
): Set<string> {
  const ids = new Set<string>();
  for (const segment of segments) {
    if (filter.day !== null && segment.day !== filter.day) continue;
    ids.add(segment.id);
  }
  return ids;
}
