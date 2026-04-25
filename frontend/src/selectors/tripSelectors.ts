import type { RouteSegment, SpotItem, TripFullPayload } from '../types/trip';
import { buildCompactDayMap, compactDayValue } from '../utils/trip-day-sequence';

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

export function normalizeTripData(payload: TripFullPayload): NormalizedTrip {
  const allEntries = Array.isArray(payload.spots) ? payload.spots : [];
  const routeSegments = Array.isArray(payload.routeSegments) ? payload.routeSegments : [];
  const displayDayMap = buildCompactDayMap(
    allEntries.filter(isDisplayAttractionStop).map((spot) => spot.day),
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

  const spots = allEntries
    .filter(isDisplayAttractionStop)
    .map((spot) => {
      const displaySpot = remapSpotDay(spot);
      const nextStop = spot.nextStopId ? allEntriesById.get(spot.nextStopId) : null;
      const incomingSegment = incomingSegmentBySpotId.get(spot.id) || null;
      const prevStop = incomingSegment ? allEntriesById.get(incomingSegment.fromSpotId) : null;
      return {
        ...displaySpot,
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

const LOGISTICS_STOP_KEYWORDS = [
  '酒店',
  '旅馆',
  '入住',
  '出发',
  '收尾',
  '站周边',
  '车站周边',
  '机场',
  '轻松活动',
  '回到',
];

const ATTRACTION_NAME_ALLOWLIST = [
  '表参道',
  '秋叶原',
  '心斋桥',
  '难波',
  '道顿堀',
  '电电城',
  '老街',
  '本町通',
  '丸之内',
  '角色街',
  '台场',
  'PARCO',
  'Namba Parks',
];

function hasLogisticsName(spot: SpotItem): boolean {
  const name = spot.name || '';
  return LOGISTICS_STOP_KEYWORDS.some((keyword) => name.includes(keyword));
}

function isKnownAttractionName(spot: SpotItem): boolean {
  const name = spot.name || '';
  return ATTRACTION_NAME_ALLOWLIST.some((keyword) => name.includes(keyword));
}

/**
 * 判断一条 entry 是否作为"可点击景点"在地图 marker + 列表 + 路线端点上展示。
 * 规则按当前日本行程语义收敛:
 *   1. 显式 hideFromMap === true      → false  (数据层明确打标,最高优先)
 *   2. type === 'transport'           → false  (换乘/车站/机场)
 *   3. type === 'accommodation'       → false  (酒店/温泉旅馆)
 *   4. 名称像入住/出发/收尾/机场等物流点 → false
 *   5. 商圈/街区/景点类 spot             → true
 */
export function isDisplayAttractionStop(spot: SpotItem): boolean {
  if (spot.hideFromMap === true) return false;
  if (spot.type === 'transport') return false;
  if (spot.type === 'accommodation') return false;
  if (hasLogisticsName(spot)) return false;
  if (isKnownAttractionName(spot)) return true;
  return true;
}
