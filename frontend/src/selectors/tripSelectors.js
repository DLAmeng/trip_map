export function normalizeTripData(payload) {
    const allEntries = Array.isArray(payload.spots) ? payload.spots : [];
    const allEntriesById = new Map();
    for (const entry of allEntries) {
        allEntriesById.set(entry.id, entry);
    }
    const spots = allEntries
        .filter((spot) => spot.type !== 'transport')
        .slice()
        .sort((a, b) => a.day - b.day || a.order - b.order);
    const spotById = new Map();
    for (const spot of spots)
        spotById.set(spot.id, spot);
    const daySet = new Set();
    for (const spot of allEntries)
        daySet.add(spot.day);
    const dayNumbers = [...daySet].sort((a, b) => a - b);
    const spotsByDay = new Map();
    for (const day of dayNumbers) {
        const daySpots = spots
            .filter((spot) => spot.day === day)
            .sort((a, b) => a.order - b.order);
        if (daySpots.length)
            spotsByDay.set(day, daySpots);
    }
    const citySet = new Set();
    for (const spot of spots)
        if (spot.city)
            citySet.add(spot.city);
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
export function computeStats(normalized) {
    return {
        days: normalized.dayNumbers.length,
        cities: normalized.cityNames.length,
        spots: normalized.spots.length,
    };
}
