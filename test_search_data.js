function toStringValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

function normalizeText(value) {
  return toStringValue(value)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
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

const spots = [
  {
    id: "s1", type: "spot", day: 1, city: "东京", area: "", name: "浅草寺", order: 1, lat: 0, lng: 0, mustVisit: false
  }
];

const filteredSpots = spots.filter(spot => spot?.type !== 'transport');
const spotNameById = new Map(filteredSpots.map(spot => [spot.id, spot.name || spot.id || '']));
const spotEntries = filteredSpots.map(buildSpotSearchEntry);
const allEntries = [...spotEntries];

const normalizedQuery = normalizeText("东京");

const results = (allEntries || [])
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

console.log("Results length:", results.length);
if (results.length > 0) {
  console.log("First result title:", results[0].title);
}
