import type { RouteSegment, SpotItem } from '../types/trip';

export interface SearchEntry {
  id: string;
  type: 'spot' | 'route' | 'external';
  day: number;
  title: string;
  subtitle: string;
  searchText: string;
  data: any;
  score?: number;
}

export interface SearchIndex {
  spotEntries: SearchEntry[];
  routeEntries: SearchEntry[];
  allEntries: SearchEntry[];
  spotNameById: Map<string, string>;
}

function toStringValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

export function normalizeText(value: any): string {
  return toStringValue(value)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function includesText(haystack: string, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }
  return normalizeText(haystack).includes(normalizedQuery);
}

function buildSpotSearchEntry(spot: SpotItem): SearchEntry {
  const tags = Array.isArray(spot?.tags) ? spot.tags : [];
  const searchText = normalizeText([
    spot?.id,
    spot?.name,
    spot?.nameEn,
    spot?.city,
    spot?.area,
    spot?.timeSlot,
    spot?.description,
    spot?.whyGo,
    ...tags,
  ].join(' '));

  return {
    id: spot?.id || '',
    type: 'spot',
    day: Number(spot?.day) || 0,
    title: spot?.name || spot?.id || '未命名景点',
    subtitle: [spot?.city, spot?.area].filter(Boolean).join(' · '),
    searchText,
    data: spot,
  };
}

function buildRouteSearchEntry(segment: RouteSegment, spotNameById: Map<string, string>): SearchEntry {
  const fromName = segment?.fromSpotId ? spotNameById.get(segment.fromSpotId) || '' : '';
  const toName = segment?.toSpotId ? spotNameById.get(segment.toSpotId) || '' : '';
  const searchText = normalizeText([
    segment?.id,
    segment?.label,
    segment?.scope,
    segment?.transportType,
    segment?.fromSpotId,
    segment?.toSpotId,
    fromName,
    toName,
    segment?.duration,
    segment?.note,
  ].join(' '));

  return {
    id: segment?.id || '',
    type: 'route',
    day: Number(segment?.day) || 0,
    title: segment?.label || segment?.id || '未命名路线',
    subtitle: [fromName, toName].filter(Boolean).join(' → '),
    searchText,
    data: segment,
  };
}

function scoreSearchEntry(entry: SearchEntry, normalizedQuery: string): number {
  if (!normalizedQuery || !entry?.searchText) {
    return Number.NEGATIVE_INFINITY;
  }

  if (entry.searchText === normalizedQuery) {
    return 400;
  }

  if (normalizeText(entry.title) === normalizedQuery) {
    return 320;
  }

  if (normalizeText(entry.title).startsWith(normalizedQuery)) {
    return 260;
  }

  if (entry.searchText.includes(normalizedQuery)) {
    return 140;
  }

  return Number.NEGATIVE_INFINITY;
}

export function buildSearchIndex(spots: SpotItem[], routeSegments: RouteSegment[]): SearchIndex {
  const filteredSpots = spots.filter((spot: SpotItem) => spot?.type !== 'transport');
  const spotNameById = new Map<string, string>(filteredSpots.map((spot: SpotItem) => [spot.id, spot.name || spot.id || '']));
  const spotEntries = filteredSpots.map(buildSpotSearchEntry);
  const routeEntries = routeSegments.map((segment: RouteSegment) => buildRouteSearchEntry(segment, spotNameById));
  const allEntries = [...spotEntries, ...routeEntries];

  return {
    spotEntries,
    routeEntries,
    allEntries,
    spotNameById,
  };
}

export function searchTripData(index: SearchIndex, query: string): SearchEntry[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return [];
  }

  return (index?.allEntries || [])
    .map((entry) => ({
      entry,
      score: scoreSearchEntry(entry, normalizedQuery),
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((first, second) => {
      if (first.score !== second.score) {
        return (second.score || 0) - (first.score || 0);
      }
      if (first.entry.type !== second.entry.type) {
        return first.entry.type === 'spot' ? -1 : 1;
      }
      if (first.entry.day !== second.entry.day) {
        return first.entry.day - second.entry.day;
      }
      return first.entry.title.localeCompare(second.entry.title, 'zh-Hans-CN');
    })
    .map(({ entry, score }) => ({ ...entry, score }));
}
