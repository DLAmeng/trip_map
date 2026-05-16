import type { RouteSegment, SpotItem, TripFullPayload } from '../types/trip';
import { buildCompactDayMap, compactDayValue } from '../utils/trip-day-sequence';
import { type SpotType, coerceSpotType } from '../constants/spot-types';

/**
 * 把 TripFullPayload 派生成前端要用的各种索引。
 * 对齐原生 app.js 的 primeData() L533-579,保留纯函数特性,
 * React 这边在 TripPage 里用 useMemo 包住,Admin 页(Phase 4)也能直接复用。
 */

export interface NormalizedTrip {
  /** 仅 isDisplayAttractionStop 通过的景点,按 day/order 稳定排序 */
  spots: SpotItem[];
  /** 全部 entries(含 transport / accommodation / hideFromMap)按 id 查 */
  allEntriesById: Map<string, SpotItem>;
  /** 仅 spots 按 id 查 */
  spotById: Map<string, SpotItem>;
  /** spots 按 day 分桶,每桶内按 order 排序 */
  spotsByDay: Map<number, SpotItem[]>;
  /** 升序且唯一的 day 数组 */
  dayNumbers: number[];
  /** 升序且唯一的 city 数组 */
  cityNames: string[];
  /** 端点都是可见景点的 segments(端点被隐藏的 segment 已剔除) */
  routeSegments: RouteSegment[];
}

export interface NormalizeOptions {
  /**
   * P26: 按 spot.type 过滤(替代 P25 的 showLogistics 粗粒度开关)
   *  - undefined / null:不过滤,显示全部 6 类(默认)
   *  - 数组(可空):只显示数组里的 type;[] = 都不显示
   *
   * hideFromMap=true 的 entry 在任何模式下都不显示。
   */
  spotTypes?: SpotType[] | null;
}

export function normalizeTripData(
  payload: TripFullPayload,
  options: NormalizeOptions = {},
): NormalizedTrip {
  const { spotTypes = null } = options;
  // P26 过滤逻辑:hideFromMap 总是排除;否则按 spotTypes 数组判断
  const passes = (spot: SpotItem) => {
    if (spot.hideFromMap === true) return false;
    if (!spotTypes) return true;
    return spotTypes.includes(coerceSpotType(spot.type));
  };

  const allEntries = Array.isArray(payload.spots) ? payload.spots : [];
  const routeSegments = Array.isArray(payload.routeSegments) ? payload.routeSegments : [];
  const displayDayMap = buildCompactDayMap(
    allEntries.filter(passes).map((spot) => spot.day),
  );
  const remapSpotDay = (spot: SpotItem): SpotItem => ({
    ...spot,
    day: compactDayValue(spot.day, displayDayMap),
  });
  const allEntriesById = new Map<string, SpotItem>();
  for (const entry of allEntries) {
    allEntriesById.set(entry.id, remapSpotDay(entry));
  }
  const incomingSegmentBySpotId = new Map<string, RouteSegment>();
  for (const segment of routeSegments) {
    if (!incomingSegmentBySpotId.has(segment.toSpotId)) {
      incomingSegmentBySpotId.set(segment.toSpotId, segment);
    }
  }

  // P37: 全行程按 day+order 排序的完整列表,用来给 nextStopId 空的 spot 自动推「下一站」。
  // 旧数据 / 显式标了 nextStopId 的优先用显式;否则 fallback 到「同 day 下一个 / 跨 day 第一个」
  const sortedAllEntries = [...allEntries]
    .map((s) => remapSpotDay(s))
    .sort((a, b) => a.day - b.day || (a.order ?? 0) - (b.order ?? 0));
  const orderedIndexById = new Map<string, number>();
  sortedAllEntries.forEach((s, i) => orderedIndexById.set(s.id, i));
  function effectiveNextStop(spot: SpotItem): SpotItem | null {
    // 1. 显式标了 nextStopId → 用它(允许用户跨 day 跳转或人为打破默认顺序)
    if (spot.nextStopId) {
      const explicit = allEntriesById.get(spot.nextStopId);
      if (explicit) return explicit;
    }
    // 2. 自动推:行程完整顺序的下一个 entry(无论 type — 行程动线包括住宿/交通点)
    const idx = orderedIndexById.get(spot.id);
    if (idx === undefined || idx + 1 >= sortedAllEntries.length) return null;
    return sortedAllEntries[idx + 1];
  }

  const spots = allEntries
    .filter(passes)
    .map((spot) => {
      const displaySpot = remapSpotDay(spot);
      const nextStop = effectiveNextStop(spot);
      const incomingSegment = incomingSegmentBySpotId.get(spot.id) || null;
      const prevStop = incomingSegment ? allEntriesById.get(incomingSegment.fromSpotId) : null;
      return {
        ...displaySpot,
        // P37: 把推断出的 nextStopId 注入回 spot(原本可能是 null),让 popup-builder
        // / RouteDetailContent 等所有下游消费方都能拿到「下一站」
        nextStopId: nextStop?.id ?? null,
        nextStopName: nextStop?.name,
        nextStopLat: nextStop?.lat,
        nextStopLng: nextStop?.lng,
        prevStopName: prevStop?.name,
        prevStopLat: prevStop?.lat,
        prevStopLng: prevStop?.lng,
        prevSegmentLabel: incomingSegment?.label,
      };
    })
    .slice()
    .sort((a, b) => a.day - b.day || a.order - b.order);

  const spotById = new Map<string, SpotItem>();
  for (const spot of spots) spotById.set(spot.id, spot);

  const daySet = new Set<number>();
  for (const spot of spots) daySet.add(spot.day);
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

  // 端点任一侧被隐藏(transport / accommodation / hideFromMap)的 segment 直接剔除,
  // 地图上不画也不算路线端点。Day 13 新补的 s1→s2 两端都是可见景点,会保留。
  const visibleRouteSegments = routeSegments
    .filter((seg) => spotById.has(seg.fromSpotId) && spotById.has(seg.toSpotId))
    .map((segment) => {
      const fromSpot = spotById.get(segment.fromSpotId);
      const toSpot = spotById.get(segment.toSpotId);
      const numericSegmentDay = Number(segment.day);
      const mappedSegmentDay = displayDayMap.has(numericSegmentDay)
        ? compactDayValue(segment.day, displayDayMap)
        : fromSpot?.day ?? toSpot?.day ?? compactDayValue(segment.day, displayDayMap);
      return {
        ...segment,
        day: mappedSegmentDay,
      };
    });

  return {
    spots,
    allEntriesById,
    spotById,
    spotsByDay,
    dayNumbers,
    cityNames,
    routeSegments: visibleRouteSegments,
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

/**
 * P26: 简化为仅判断 hideFromMap。原来的 P25 名字关键词 fallback
 * (LOGISTICS_STOP_KEYWORDS / ATTRACTION_NAME_ALLOWLIST)整组删除 —
 * 新过滤逻辑完全靠 spot.type 字段(由 admin select 显式编辑,sanitizeSpotType
 * 兜底默认 'spot'),不再用脆弱的名字猜测。
 *
 * 保留 export 名字兼容旧代码 import,但 showLogistics 参数已废弃(忽略)。
 */
export function isDisplayAttractionStop(spot: SpotItem, _showLogistics = false): boolean {
  return spot.hideFromMap !== true;
}
