function toStringValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value);
}
export function normalizeText(value) {
    return toStringValue(value)
        .normalize('NFKC')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}
export function includesText(haystack, query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
        return true;
    }
    return normalizeText(haystack).includes(normalizedQuery);
}
function buildSpotSearchEntry(spot) {
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
function buildRouteSearchEntry(segment, spotNameById) {
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
function scoreSearchEntry(entry, normalizedQuery) {
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
export function buildSearchIndex(spots, routeSegments) {
    const filteredSpots = spots.filter((spot) => spot?.type !== 'transport');
    const spotNameById = new Map(filteredSpots.map((spot) => [spot.id, spot.name || spot.id || '']));
    const spotEntries = filteredSpots.map(buildSpotSearchEntry);
    const routeEntries = routeSegments.map((segment) => buildRouteSearchEntry(segment, spotNameById));
    const allEntries = [...spotEntries, ...routeEntries];
    return {
        spotEntries,
        routeEntries,
        allEntries,
        spotNameById,
    };
}
export function searchTripData(index, query) {
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
