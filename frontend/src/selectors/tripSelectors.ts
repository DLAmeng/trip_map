import type { RouteSegment, SpotItem, TripFullPayload } from '../types/trip';

/**
 * 把 TripFullPayload 派生成前端要用的各种索引。
 * 对齐原生 app.js 的 primeData() L533-579,保留纯函数特性,
 * React 这边在 TripPage 里用 useMemo 包住,Admin 页(Phase 4)也能直接复用。
 */

export interface NormalizedTrip {
  /** 仅 type !== 'transport' 的景点,按 day/order 稳定排序 */
  spots: SpotItem[];
  /** 全部 entries(含 transport)按 id 查 */
  allEntriesById: Map<string, SpotItem>;
  /** 仅 spots 按 id 查 */
  spotById: Map<string, SpotItem>;
  /** spots 按 day 分桶,每桶内按 order 排序 */
  spotsByDay: Map<number, SpotItem[]>;
  /** 升序且唯一的 day 数组 */
  dayNumbers: number[];
  /** 升序且唯一的 city 数组 */
  cityNames: string[];
  /** 原样 segments(不过滤) */
  routeSegments: RouteSegment[];
}

export function normalizeTripData(payload: TripFullPayload): NormalizedTrip {
  const allEntries = Array.isArray(payload.spots) ? payload.spots : [];
  const allEntriesById = new Map<string, SpotItem>();
  for (const entry of allEntries) {
    allEntriesById.set(entry.id, entry);
  }

  const spots = allEntries
    .filter((spot) => spot.type !== 'transport')
    .slice()
    .sort((a, b) => a.day - b.day || a.order - b.order);

  const spotById = new Map<string, SpotItem>();
  for (const spot of spots) spotById.set(spot.id, spot);

  const daySet = new Set<number>();
  for (const spot of allEntries) daySet.add(spot.day);
  const dayNumbers = [...daySet].sort((a, b) => a - b);

  const spotsByDay = new Map<number, SpotItem[]>();
  for (const day of dayNumbers) {
    const daySpots = spots
      .filter((spot) => spot.day === day)
      .sort((a, b) => a.order - b.order);
    if (daySpots.length) spotsByDay.set(day, daySpots);
  }

  const citySet = new Set<string>();
  for (const spot of spots) if (spot.city) citySet.add(spot.city);
  const cityNames = [...citySet].sort();

  const routeSegments = Array.isArray(payload.routeSegments) ? payload.routeSegments : [];

  return {
    spots,
    allEntriesById,
    spotById,
    spotsByDay,
    dayNumbers,
    cityNames,
    routeSegments,
  };
}

export interface TripStats {
  days: number;
  cities: number;
  spots: number;
}

export function computeStats(normalized: NormalizedTrip): TripStats {
  return {
    days: normalized.dayNumbers.length,
    cities: normalized.cityNames.length,
    spots: normalized.spots.length,
  };
}
