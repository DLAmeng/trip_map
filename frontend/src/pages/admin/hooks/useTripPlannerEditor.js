import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { makeBlankSpot } from '../../../utils/trip-factory';
const STORAGE_PREFIX = 'trip-planner-editor-draft:';
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
function buildStorageKey(tripId) {
    return `${STORAGE_PREFIX}${tripId}`;
}
export function buildLegKey(fromSpotId, toSpotId) {
    return `${fromSpotId}__${toSpotId}`;
}
function createAutoSegmentId(fromSpotId, toSpotId) {
    return `seg-auto-${fromSpotId}__${toSpotId}`;
}
function sanitizeSpotType(type) {
    return String(type || '').trim() === 'transport' ? 'transport' : 'spot';
}
function createEditorSpot(spot, index = 0) {
    const fallback = makeBlankSpot({
        day: Number(spot.day) || 1,
        order: Number(spot.order) || index + 1,
        name: String(spot.name || '').trim() || '新景点',
        lat: Number(spot.lat) || 0,
        lng: Number(spot.lng) || 0,
        city: String(spot.city || '').trim(),
    });
    return {
        ...fallback,
        ...clone(spot || {}),
        id: String(spot.id || fallback.id),
        day: Number.isFinite(Number(spot.day)) ? Number(spot.day) : fallback.day,
        order: Number.isFinite(Number(spot.order)) ? Number(spot.order) : fallback.order,
        lat: Number.isFinite(Number(spot.lat)) ? Number(spot.lat) : fallback.lat,
        lng: Number.isFinite(Number(spot.lng)) ? Number(spot.lng) : fallback.lng,
        type: sanitizeSpotType(spot.type),
        mustVisit: Boolean(spot.mustVisit),
        nearNextTransport: Boolean(spot.nearNextTransport),
        nextStopId: spot.nextStopId ?? null,
        tags: Array.isArray(spot.tags) ? spot.tags.filter(Boolean) : [],
        photos: Array.isArray(spot.photos) ? spot.photos.filter(Boolean) : [],
        openingHours: Array.isArray(spot.openingHours) ? spot.openingHours.filter(Boolean) : [],
    };
}
function createLegDraft(segment) {
    if (!segment.fromSpotId || !segment.toSpotId)
        return null;
    const key = buildLegKey(segment.fromSpotId, segment.toSpotId);
    return {
        key,
        id: String(segment.id || createAutoSegmentId(segment.fromSpotId, segment.toSpotId)),
        day: Number(segment.day) || 1,
        fromSpotId: segment.fromSpotId,
        toSpotId: segment.toSpotId,
        scope: segment.scope === 'intercity' ? 'intercity' : 'city',
        transportType: String(segment.transportType || 'walk'),
        label: String(segment.label || ''),
        duration: String(segment.duration || ''),
        note: String(segment.note || ''),
        pathOverride: Array.isArray(segment.path) ? clone(segment.path) : [],
        realDistanceMeters: segment.realDistanceMeters === undefined ? null : segment.realDistanceMeters,
        realDurationSec: segment.realDurationSec === undefined ? null : segment.realDurationSec,
        realWarnings: Array.isArray(segment.realWarnings) ? clone(segment.realWarnings) : null,
        runtimeSource: segment.runtimeSource ?? null,
        runtimeTransitSummary: segment.runtimeTransitSummary ?? null,
        runtimeTransitLegs: Array.isArray(segment.runtimeTransitLegs)
            ? clone(segment.runtimeTransitLegs)
            : null,
    };
}
function createEditorState(payload) {
    const spots = Array.isArray(payload?.spots)
        ? payload.spots.map((spot, index) => createEditorSpot(spot, index))
        : [];
    const legDrafts = Object.fromEntries((Array.isArray(payload?.routeSegments) ? payload.routeSegments : [])
        .map((segment) => createLegDraft(segment))
        .filter((draft) => Boolean(draft))
        .map((draft) => [draft.key, draft]));
    return {
        meta: clone(payload.meta || {}),
        config: clone(payload.config || {}),
        spots,
        legDrafts,
    };
}
function groupSpotsByDay(spots) {
    const map = new Map();
    for (const spot of spots) {
        const day = Number(spot.day) || 1;
        const bucket = map.get(day) || [];
        bucket.push({ ...spot, day });
        map.set(day, bucket);
    }
    map.forEach((bucket) => {
        bucket.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
    });
    return map;
}
function resequenceGroupedSpots(grouped) {
    return Array.from(grouped.entries())
        .sort((a, b) => a[0] - b[0])
        .flatMap(([day, bucket]) => bucket.map((spot, index) => ({
        ...spot,
        day,
        order: index + 1,
    })));
}
function normalizePlannerSpots(spots) {
    const grouped = groupSpotsByDay(spots);
    return resequenceGroupedSpots(grouped);
}
function inferScope(from, to) {
    if (from.city && to.city && from.city !== to.city)
        return 'intercity';
    return 'city';
}
function buildSegmentFromDraft(from, to, draft) {
    const key = buildLegKey(from.id, to.id);
    const id = draft?.id || createAutoSegmentId(from.id, to.id);
    return {
        id,
        key,
        detached: false,
        generated: !draft,
        day: Number(from.day) || 1,
        scope: draft?.scope || inferScope(from, to),
        fromSpotId: from.id,
        toSpotId: to.id,
        transportType: draft?.transportType || 'walk',
        label: draft?.label || '',
        duration: draft?.duration || '',
        note: draft?.note || '',
        path: draft?.pathOverride?.length ? clone(draft.pathOverride) : [],
        realDistanceMeters: draft?.realDistanceMeters ?? null,
        realDurationSec: draft?.realDurationSec ?? null,
        realWarnings: draft?.realWarnings ?? null,
        runtimeSource: draft?.runtimeSource ?? null,
        runtimeTransitSummary: draft?.runtimeTransitSummary ?? null,
        runtimeTransitLegs: draft?.runtimeTransitLegs ?? null,
    };
}
function buildDetachedSegment(draft, spotById) {
    if (!spotById.has(draft.fromSpotId) || !spotById.has(draft.toSpotId)) {
        return null;
    }
    return {
        id: draft.id,
        key: draft.key,
        detached: true,
        generated: false,
        day: draft.day,
        scope: draft.scope,
        fromSpotId: draft.fromSpotId,
        toSpotId: draft.toSpotId,
        transportType: draft.transportType,
        label: draft.label,
        duration: draft.duration,
        note: draft.note,
        path: draft.pathOverride?.length ? clone(draft.pathOverride) : [],
        realDistanceMeters: draft.realDistanceMeters ?? null,
        realDurationSec: draft.realDurationSec ?? null,
        realWarnings: draft.realWarnings ?? null,
        runtimeSource: draft.runtimeSource ?? null,
        runtimeTransitSummary: draft.runtimeTransitSummary ?? null,
        runtimeTransitLegs: draft.runtimeTransitLegs ?? null,
    };
}
function sortSegmentsForPayload(segments, spotById) {
    return [...segments].sort((a, b) => {
        if (a.day !== b.day)
            return a.day - b.day;
        const fromA = spotById.get(a.fromSpotId)?.order ?? 9999;
        const fromB = spotById.get(b.fromSpotId)?.order ?? 9999;
        if (fromA !== fromB)
            return fromA - fromB;
        const detachedA = a.detached ? 1 : 0;
        const detachedB = b.detached ? 1 : 0;
        if (detachedA !== detachedB)
            return detachedA - detachedB;
        return a.id.localeCompare(b.id);
    });
}
function withDerivedNextStops(spots) {
    const grouped = groupSpotsByDay(spots);
    return Array.from(grouped.values()).flatMap((bucket) => bucket.map((spot, index) => ({
        ...spot,
        nextStopId: bucket[index + 1]?.id ?? null,
    })));
}
export function buildPlannerSnapshot(state) {
    const normalizedSpots = withDerivedNextStops(normalizePlannerSpots(state.spots));
    const spotById = new Map(normalizedSpots.map((spot) => [spot.id, spot]));
    const grouped = groupSpotsByDay(normalizedSpots);
    const usedKeys = new Set();
    const plannerDays = [];
    const adjacentSegments = [];
    Array.from(grouped.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([day, bucket]) => {
        const daySegments = [];
        for (let index = 0; index < bucket.length - 1; index += 1) {
            const from = bucket[index];
            const to = bucket[index + 1];
            const key = buildLegKey(from.id, to.id);
            usedKeys.add(key);
            const segment = buildSegmentFromDraft(from, to, state.legDrafts[key]);
            daySegments.push(segment);
            adjacentSegments.push(segment);
        }
        plannerDays.push({ day, spots: bucket, segments: daySegments });
    });
    const detachedSegments = Object.values(state.legDrafts)
        .filter((draft) => !usedKeys.has(draft.key))
        .map((draft) => buildDetachedSegment(draft, spotById))
        .filter((segment) => Boolean(segment));
    const sortedSegments = sortSegmentsForPayload([...adjacentSegments, ...detachedSegments], spotById);
    const payload = {
        meta: clone(state.meta),
        config: clone(state.config),
        spots: normalizedSpots.map((spot) => clone(spot)),
        routeSegments: sortedSegments.map(({ key, detached, generated, ...segment }) => clone(segment)),
    };
    const segmentById = new Map(sortedSegments.map((segment) => [segment.id, segment]));
    const segmentKeyById = new Map(sortedSegments.map((segment) => [segment.id, segment.key]));
    return {
        payload,
        days: plannerDays,
        dayNumbers: plannerDays.map((day) => day.day),
        spotById,
        segmentById,
        detachedSegments,
        adjacentSegmentIds: new Set(adjacentSegments.map((segment) => segment.id)),
        segmentKeyById,
    };
}
function distanceBetween(a, b) {
    const latDiff = (a.lat || 0) - (b.lat || 0);
    const lngDiff = (a.lng || 0) - (b.lng || 0);
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}
function sortDayByNearestNeighbor(daySpots) {
    if (daySpots.length <= 2)
        return daySpots;
    const [start, ...rest] = daySpots;
    const remaining = [...rest];
    const sorted = [start];
    while (remaining.length > 0) {
        const last = sorted[sorted.length - 1];
        let bestIndex = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        remaining.forEach((candidate, index) => {
            const nextDistance = distanceBetween(last, candidate);
            if (nextDistance < bestDistance) {
                bestDistance = nextDistance;
                bestIndex = index;
            }
        });
        sorted.push(remaining.splice(bestIndex, 1)[0]);
    }
    return sorted;
}
function duplicateSpotForDay(spot, day, order) {
    return {
        ...clone(spot),
        ...makeBlankSpot({
            day,
            order,
            name: spot.name,
            lat: spot.lat,
            lng: spot.lng,
            city: spot.city,
        }),
        day,
        order,
        name: spot.name,
        nameEn: spot.nameEn,
        city: spot.city,
        area: spot.area,
        timeSlot: spot.timeSlot,
        lat: spot.lat,
        lng: spot.lng,
        mustVisit: spot.mustVisit,
        type: spot.type,
        description: spot.description,
        whyGo: spot.whyGo,
        stayMinutes: spot.stayMinutes,
        nearNextTransport: spot.nearNextTransport,
        tags: Array.isArray(spot.tags) ? clone(spot.tags) : [],
        transportNote: spot.transportNote,
        photos: Array.isArray(spot.photos) ? clone(spot.photos) : [],
        googleMapsUri: spot.googleMapsUri,
        googlePlaceId: spot.googlePlaceId,
        rating: spot.rating ?? null,
        website: spot.website,
        phone: spot.phone,
        openingHours: Array.isArray(spot.openingHours) ? clone(spot.openingHours) : [],
        nextStopId: null,
    };
}
function cleanupLegDrafts(legDrafts, spots) {
    const spotIds = new Set(spots.map((spot) => spot.id));
    return Object.fromEntries(Object.entries(legDrafts).filter(([, draft]) => spotIds.has(draft.fromSpotId) && spotIds.has(draft.toSpotId)));
}
function createInitialHistory(initialData, tripId) {
    const initialPresent = createEditorState(initialData);
    if (typeof window === 'undefined') {
        return {
            history: { past: [], present: initialPresent, future: [] },
            restoredFromLocalDraft: false,
        };
    }
    try {
        const raw = window.localStorage.getItem(buildStorageKey(tripId));
        if (!raw) {
            return {
                history: { past: [], present: initialPresent, future: [] },
                restoredFromLocalDraft: false,
            };
        }
        const parsed = JSON.parse(raw);
        const restoredPresent = {
            meta: clone(parsed.meta || initialPresent.meta),
            config: clone(parsed.config || initialPresent.config),
            spots: Array.isArray(parsed.spots)
                ? parsed.spots.map((spot, index) => createEditorSpot(spot, index))
                : initialPresent.spots,
            legDrafts: parsed.legDrafts && typeof parsed.legDrafts === 'object'
                ? cleanupLegDrafts(parsed.legDrafts, parsed.spots || [])
                : initialPresent.legDrafts,
        };
        return {
            history: { past: [], present: restoredPresent, future: [] },
            restoredFromLocalDraft: true,
        };
    }
    catch {
        return {
            history: { past: [], present: initialPresent, future: [] },
            restoredFromLocalDraft: false,
        };
    }
}
function pushHistory(previous, nextPresent) {
    const prevJson = JSON.stringify(previous.present);
    const nextJson = JSON.stringify(nextPresent);
    if (prevJson === nextJson)
        return previous;
    return {
        past: [...previous.past, previous.present],
        present: nextPresent,
        future: [],
    };
}
export function useTripPlannerEditor(initialData, tripId) {
    const initialStateRef = useRef(createInitialHistory(initialData, tripId));
    const [history, setHistory] = useState(initialStateRef.current.history);
    const [restoredFromLocalDraft, setRestoredFromLocalDraft] = useState(initialStateRef.current.restoredFromLocalDraft);
    const baselinePayloadRef = useRef(JSON.stringify(buildPlannerSnapshot(history.present).payload));
    const snapshot = useMemo(() => buildPlannerSnapshot(history.present), [history.present]);
    const payload = snapshot.payload;
    const isDirty = JSON.stringify(payload) !== baselinePayloadRef.current;
    const canUndo = history.past.length > 0;
    const canRedo = history.future.length > 0;
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const storageKey = buildStorageKey(tripId);
        if (!isDirty) {
            window.localStorage.removeItem(storageKey);
            return;
        }
        window.localStorage.setItem(storageKey, JSON.stringify(history.present));
    }, [history.present, isDirty, tripId]);
    const commit = useCallback((mutator) => {
        setHistory((previous) => {
            const nextPresent = clone(previous.present);
            mutator(nextPresent);
            nextPresent.spots = normalizePlannerSpots(nextPresent.spots);
            nextPresent.legDrafts = cleanupLegDrafts(nextPresent.legDrafts, nextPresent.spots);
            return pushHistory(previous, nextPresent);
        });
    }, []);
    const undo = useCallback(() => {
        setHistory((previous) => {
            if (previous.past.length === 0)
                return previous;
            const nextPast = previous.past.slice(0, -1);
            const nextPresent = previous.past[previous.past.length - 1];
            return {
                past: nextPast,
                present: nextPresent,
                future: [previous.present, ...previous.future],
            };
        });
    }, []);
    const redo = useCallback(() => {
        setHistory((previous) => {
            if (previous.future.length === 0)
                return previous;
            const [nextPresent, ...nextFuture] = previous.future;
            return {
                past: [...previous.past, previous.present],
                present: nextPresent,
                future: nextFuture,
            };
        });
    }, []);
    const updateMeta = useCallback((meta) => {
        commit((draft) => {
            draft.meta = { ...draft.meta, ...meta };
        });
    }, [commit]);
    const addSpot = useCallback((day, partial, index) => {
        commit((draft) => {
            const grouped = groupSpotsByDay(draft.spots);
            const targetDay = Number(day) || 1;
            const bucket = grouped.get(targetDay) || [];
            const nextSpot = createEditorSpot({
                ...makeBlankSpot({
                    day: targetDay,
                    order: bucket.length + 1,
                    city: partial?.city,
                    lat: partial?.lat,
                    lng: partial?.lng,
                    name: partial?.name,
                }),
                ...partial,
                day: targetDay,
            }, bucket.length);
            const insertIndex = Number.isFinite(index)
                ? Math.max(0, Math.min(index, bucket.length))
                : bucket.length;
            bucket.splice(insertIndex, 0, nextSpot);
            grouped.set(targetDay, bucket);
            draft.spots = resequenceGroupedSpots(grouped);
        });
    }, [commit]);
    const addSpots = useCallback((spots) => {
        if (!Array.isArray(spots) || spots.length === 0)
            return;
        commit((draft) => {
            draft.spots = [
                ...draft.spots,
                ...spots.map((spot, index) => createEditorSpot(spot, draft.spots.length + index)),
            ];
        });
    }, [commit]);
    const updateSpot = useCallback((id, payload) => {
        commit((draft) => {
            draft.spots = draft.spots.map((spot) => (spot.id === id ? createEditorSpot({ ...spot, ...payload }) : spot));
        });
    }, [commit]);
    const deleteSpot = useCallback((id) => {
        commit((draft) => {
            draft.spots = draft.spots.filter((spot) => spot.id !== id);
        });
    }, [commit]);
    const moveSpot = useCallback((id, targetDay, targetIndex) => {
        commit((draft) => {
            const grouped = groupSpotsByDay(draft.spots);
            let movingSpot = null;
            grouped.forEach((bucket, day) => {
                const hitIndex = bucket.findIndex((spot) => spot.id === id);
                if (hitIndex >= 0) {
                    movingSpot = { ...bucket.splice(hitIndex, 1)[0], day: targetDay };
                    grouped.set(day, bucket);
                }
            });
            if (!movingSpot)
                return;
            const nextBucket = grouped.get(targetDay) || [];
            const safeIndex = Math.max(0, Math.min(targetIndex, nextBucket.length));
            nextBucket.splice(safeIndex, 0, { ...movingSpot, day: targetDay });
            grouped.set(targetDay, nextBucket);
            draft.spots = resequenceGroupedSpots(grouped);
        });
    }, [commit]);
    const duplicateDay = useCallback((day) => {
        commit((draft) => {
            const grouped = groupSpotsByDay(draft.spots);
            const source = grouped.get(day) || [];
            if (source.length === 0)
                return;
            const nextDay = Math.max(...Array.from(grouped.keys()), 0) + 1;
            grouped.set(nextDay, source.map((spot, index) => duplicateSpotForDay(spot, nextDay, index + 1)));
            draft.spots = resequenceGroupedSpots(grouped);
        });
    }, [commit]);
    const clearDay = useCallback((day) => {
        commit((draft) => {
            draft.spots = draft.spots.filter((spot) => spot.day !== day);
        });
    }, [commit]);
    const autoSortDay = useCallback((day) => {
        commit((draft) => {
            const grouped = groupSpotsByDay(draft.spots);
            const source = grouped.get(day);
            if (!source || source.length <= 2)
                return;
            grouped.set(day, sortDayByNearestNeighbor(source));
            draft.spots = resequenceGroupedSpots(grouped);
        });
    }, [commit]);
    const updateLeg = useCallback((key, payload) => {
        commit((draft) => {
            const { pathOverride: rawPathOverride, ...restPayload } = payload;
            const existing = draft.legDrafts[key];
            const [fromSpotId, toSpotId] = key.split('__');
            const fromSpot = draft.spots.find((spot) => spot.id === fromSpotId);
            const toSpot = draft.spots.find((spot) => spot.id === toSpotId);
            if (!fromSpot || !toSpot)
                return;
            draft.legDrafts[key] = {
                key,
                id: existing?.id || createAutoSegmentId(fromSpotId, toSpotId),
                day: fromSpot.day,
                fromSpotId,
                toSpotId,
                scope: existing?.scope || inferScope(fromSpot, toSpot),
                transportType: existing?.transportType || 'walk',
                label: existing?.label || '',
                duration: existing?.duration || '',
                note: existing?.note || '',
                realDistanceMeters: existing?.realDistanceMeters ?? null,
                realDurationSec: existing?.realDurationSec ?? null,
                realWarnings: existing?.realWarnings ?? null,
                runtimeSource: existing?.runtimeSource ?? null,
                runtimeTransitSummary: existing?.runtimeTransitSummary ?? null,
                runtimeTransitLegs: existing?.runtimeTransitLegs ?? null,
                ...restPayload,
                pathOverride: rawPathOverride
                    ? clone(rawPathOverride)
                    : existing?.pathOverride
                        ? clone(existing.pathOverride)
                        : [],
            };
        });
    }, [commit]);
    const resetLeg = useCallback((key) => {
        commit((draft) => {
            delete draft.legDrafts[key];
        });
    }, [commit]);
    const deleteDetachedSegment = useCallback((segmentId) => {
        commit((draft) => {
            const entry = Object.entries(draft.legDrafts).find(([, leg]) => leg.id === segmentId);
            if (!entry)
                return;
            delete draft.legDrafts[entry[0]];
        });
    }, [commit]);
    const moveSelectedToDay = useCallback((ids, targetDay) => {
        commit((draft) => {
            const selectedIds = new Set(ids);
            const grouped = groupSpotsByDay(draft.spots);
            const moving = [];
            grouped.forEach((bucket, day) => {
                const remaining = bucket.filter((spot) => {
                    if (selectedIds.has(spot.id)) {
                        moving.push({ ...spot, day: targetDay });
                        return false;
                    }
                    return true;
                });
                grouped.set(day, remaining);
            });
            const targetBucket = grouped.get(targetDay) || [];
            grouped.set(targetDay, [...targetBucket, ...moving.map((spot) => ({ ...spot, day: targetDay }))]);
            draft.spots = resequenceGroupedSpots(grouped);
        });
    }, [commit]);
    const copySelectedToDay = useCallback((ids, targetDay) => {
        commit((draft) => {
            const selectedIds = new Set(ids);
            const sourceSpots = normalizePlannerSpots(draft.spots).filter((spot) => selectedIds.has(spot.id));
            if (!sourceSpots.length)
                return;
            const grouped = groupSpotsByDay(draft.spots);
            const targetBucket = grouped.get(targetDay) || [];
            const copied = sourceSpots.map((spot, index) => duplicateSpotForDay(spot, targetDay, targetBucket.length + index + 1));
            grouped.set(targetDay, [...targetBucket, ...copied]);
            draft.spots = resequenceGroupedSpots(grouped);
        });
    }, [commit]);
    const setSelectedMustVisit = useCallback((ids, mustVisit) => {
        const selectedIds = new Set(ids);
        commit((draft) => {
            draft.spots = draft.spots.map((spot) => (selectedIds.has(spot.id) ? { ...spot, mustVisit } : spot));
        });
    }, [commit]);
    const appendTagToSelected = useCallback((ids, tag) => {
        const normalizedTag = String(tag || '').trim();
        if (!normalizedTag)
            return;
        const selectedIds = new Set(ids);
        commit((draft) => {
            draft.spots = draft.spots.map((spot) => {
                if (!selectedIds.has(spot.id))
                    return spot;
                const nextTags = new Set(Array.isArray(spot.tags) ? spot.tags : []);
                nextTags.add(normalizedTag);
                return { ...spot, tags: Array.from(nextTags) };
            });
        });
    }, [commit]);
    const deleteSelected = useCallback((ids) => {
        const selectedIds = new Set(ids);
        commit((draft) => {
            draft.spots = draft.spots.filter((spot) => !selectedIds.has(spot.id));
        });
    }, [commit]);
    const resetFromPayload = useCallback((payloadValue) => {
        const nextPresent = createEditorState(payloadValue);
        baselinePayloadRef.current = JSON.stringify(buildPlannerSnapshot(nextPresent).payload);
        setHistory({ past: [], present: nextPresent, future: [] });
        setRestoredFromLocalDraft(false);
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(buildStorageKey(tripId));
        }
    }, [tripId]);
    const acknowledgeSavedPayload = useCallback((payloadValue) => {
        resetFromPayload(payloadValue);
    }, [resetFromPayload]);
    const dismissLocalDraftFlag = useCallback(() => {
        setRestoredFromLocalDraft(false);
    }, []);
    return {
        present: history.present,
        snapshot,
        payload,
        isDirty,
        canUndo,
        canRedo,
        restoredFromLocalDraft,
        updateMeta,
        addSpot,
        addSpots,
        updateSpot,
        deleteSpot,
        moveSpot,
        duplicateDay,
        clearDay,
        autoSortDay,
        updateLeg,
        resetLeg,
        deleteDetachedSegment,
        moveSelectedToDay,
        copySelectedToDay,
        setSelectedMustVisit,
        appendTagToSelected,
        deleteSelected,
        undo,
        redo,
        resetFromPayload,
        acknowledgeSavedPayload,
        dismissLocalDraftFlag,
    };
}
