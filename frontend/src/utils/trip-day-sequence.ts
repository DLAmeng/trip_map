import type { RouteSegment, SpotItem, TripFullPayload } from '../types/trip';

export function buildCompactDayMap(days: Array<number | null | undefined>): Map<number, number> {
  const uniqueDays = Array.from(
    new Set(
      days
        .map((day) => Number(day))
        .filter((day) => Number.isFinite(day) && day > 0),
    ),
  ).sort((a, b) => a - b);

  return new Map(uniqueDays.map((day, index) => [day, index + 1]));
}

export function compactDayValue(day: number | null | undefined, dayMap: Map<number, number>): number {
  const numericDay = Number(day);
  if (!Number.isFinite(numericDay) || numericDay <= 0) return 1;
  return dayMap.get(numericDay) ?? numericDay;
}

export function compactTripPayloadDays(payload: TripFullPayload): TripFullPayload {
  const spots = Array.isArray(payload?.spots) ? payload.spots : [];
  const routeSegments = Array.isArray(payload?.routeSegments) ? payload.routeSegments : [];
  const dayMap = buildCompactDayMap(spots.map((spot) => spot.day));
  if (dayMap.size === 0) return payload;

  const originalSpotById = new Map(spots.map((spot) => [spot.id, spot]));
  const compactedSpots: SpotItem[] = spots.map((spot) => ({
    ...spot,
    day: compactDayValue(spot.day, dayMap),
  }));

  const compactedSegments: RouteSegment[] = routeSegments.map((segment) => {
    const fromSpot = originalSpotById.get(segment.fromSpotId);
    const toSpot = originalSpotById.get(segment.toSpotId);
    const fallbackDay = fromSpot?.day ?? toSpot?.day ?? segment.day;
    return {
      ...segment,
      day: compactDayValue(
        dayMap.has(Number(segment.day)) ? segment.day : fallbackDay,
        dayMap,
      ),
    };
  });

  return {
    ...payload,
    spots: compactedSpots,
    routeSegments: compactedSegments,
  };
}
