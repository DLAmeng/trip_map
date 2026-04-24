import type { RouteSegment, SpotItem } from '../types/trip';

/**
 * Trip 页的 UI 过滤状态。
 * - day:按天数过滤(null = 全部)
 * - city:按城市名过滤(null = 全部)
 * - mustOnly:只看 mustVisit=true
 * - nextOnly:只看 nextStopId 非空(即"只看下一段")
 */
export interface FilterState {
  /** null = 全部 */
  day: number | null;
  /** null = 全部 */
  city: string | null;
  mustOnly: boolean;
  nextOnly: boolean;
}

export const DEFAULT_FILTER: FilterState = {
  day: null,
  city: null,
  mustOnly: false,
  nextOnly: false,
};

export function matchesFilter(spot: SpotItem, filter: FilterState): boolean {
  if (filter.day !== null && spot.day !== filter.day) return false;
  if (filter.city !== null && spot.city !== filter.city) return false;
  if (filter.mustOnly && !spot.mustVisit) return false;
  if (filter.nextOnly && !spot.nextStopId) return false;
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

export interface VisibleRouteContext {
  visibleDays: Set<number>;
  visibleCities: Set<string>;
}

/**
 * 对齐旧版 `getVisibleRouteContext`:
 * - day/city 过滤来自当前命中的 spots
 * - 同时把显式选中的 day/city 也补回上下文，避免“无结果时 routes 全灭”
 */
export function getVisibleRouteContext(
  spots: SpotItem[],
  filter: FilterState,
): VisibleRouteContext {
  const visibleDays = new Set<number>();
  const visibleCities = new Set<string>();

  for (const spot of getVisibleSpots(spots, filter)) {
    visibleDays.add(spot.day);
    if (spot.city) visibleCities.add(spot.city);
  }

  if (filter.day !== null) {
    visibleDays.add(filter.day);
  }

  if (filter.city !== null) {
    visibleCities.add(filter.city);
  }

  return { visibleDays, visibleCities };
}

/**
 * 按 filter 返回 segment 里仍然命中的 id 集合。
 * - day 过滤:segment.day 和 filter.day 相等
 * - city 过滤:需要 from/to 任意一端的 spot.city 命中
 * - mustOnly / nextOnly 不直接影响 segment(段连接的两端只要有一端可见就保留)
 */
export function getVisibleSegmentIds(
  segments: RouteSegment[],
  filter: FilterState,
  spotById?: Map<string, SpotItem>,
): Set<string> {
  const { visibleDays, visibleCities } = getVisibleRouteContext(
    spotById ? [...spotById.values()] : [],
    filter,
  );
  const ids = new Set<string>();
  for (const segment of segments) {
    const dayMatches =
      visibleDays.size === 0 || visibleDays.has(segment.day);
    if (!dayMatches) continue;

    if (filter.city !== null) {
      if (!spotById) continue;
      const from = spotById.get(segment.fromSpotId);
      const to = spotById.get(segment.toSpotId);
      const hit =
        (from?.city && visibleCities.has(from.city)) ||
        (to?.city && visibleCities.has(to.city));
      if (!hit) continue;
    }
    ids.add(segment.id);
  }
  return ids;
}
