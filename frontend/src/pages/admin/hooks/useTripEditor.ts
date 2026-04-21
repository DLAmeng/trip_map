import { useReducer, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { TripFullPayload, SpotItem, RouteSegment, TripMeta } from '../../../types/trip';
import { makeBlankSpot, makeBlankSegment } from '../../../utils/trip-factory';

type TripEditorState = TripFullPayload;

type TripEditorAction =
  | { type: 'SET_INITIAL_DATA'; payload: TripFullPayload }
  | { type: 'UPDATE_META'; payload: Partial<TripMeta> }
  | { type: 'UPDATE_SPOT'; id: string; payload: Partial<SpotItem> }
  | { type: 'ADD_SPOT'; payload: SpotItem }
  | { type: 'ADD_SPOTS'; payload: SpotItem[] }
  | { type: 'INSERT_AFTER_SPOT'; anchorId: string }
  | { type: 'DELETE_SPOT'; id: string }
  | { type: 'REORDER_SPOTS'; oldIndex: number; newIndex: number }
  | { type: 'SORT_SPOTS_BY_DAY_ORDER' }
  | { type: 'UPDATE_SEGMENT'; id: string; payload: Partial<RouteSegment> }
  | { type: 'ADD_SEGMENT'; payload: RouteSegment }
  | { type: 'DELETE_SEGMENT'; id: string }
  | { type: 'REORDER_SEGMENTS'; oldIndex: number; newIndex: number }
  | { type: 'SORT_SEGMENTS_BY_DAY' };

function tripEditorReducer(state: TripEditorState, action: TripEditorAction): TripEditorState {
  switch (action.type) {
    case 'SET_INITIAL_DATA':
      return action.payload;

    case 'UPDATE_META':
      return {
        ...state,
        meta: { ...state.meta, ...action.payload },
      };

    case 'UPDATE_SPOT':
      return {
        ...state,
        spots: state.spots.map((spot) =>
          spot.id === action.id ? { ...spot, ...action.payload } : spot
        ),
      };

    case 'ADD_SPOT':
      return {
        ...state,
        spots: [...state.spots, action.payload],
      };

    case 'ADD_SPOTS':
      return {
        ...state,
        spots: [...state.spots, ...action.payload],
      };

    case 'INSERT_AFTER_SPOT': {
      // 对齐旧版 admin.js insertAfterSpot:保持 nextStopId 链 + 自动拆分 segment
      const anchorIdx = state.spots.findIndex((s) => s.id === action.anchorId);
      if (anchorIdx < 0) return state;
      const anchor = state.spots[anchorIdx];
      const oldNextId = anchor.nextStopId ?? null;
      const nextSpot = oldNextId ? state.spots.find((s) => s.id === oldNextId) : null;
      const currentOrder = Number(anchor.order) || anchorIdx + 1;
      const nextOrder = nextSpot ? (Number(nextSpot.order) || currentOrder + 1) : currentOrder + 1;
      const midOrder = (currentOrder + nextOrder) / 2;

      const inserted = makeBlankSpot({
        day: anchor.day,
        order: midOrder,
        nextStopId: oldNextId,
        city: anchor.city,
      });

      // 修正 nextStopId 链
      const updatedSpots = state.spots.map((s) =>
        s.id === anchor.id ? { ...s, nextStopId: inserted.id } : s,
      );
      updatedSpots.splice(anchorIdx + 1, 0, inserted);

      // 修正 segment:原来的 anchor → oldNext 段改成 inserted → oldNext;
      // 同时新增 anchor → inserted 段(transportType 继承)
      let nextSegments = state.routeSegments;
      if (oldNextId) {
        const existingSegIdx = state.routeSegments.findIndex(
          (seg) => seg.fromSpotId === anchor.id && seg.toSpotId === oldNextId,
        );
        if (existingSegIdx >= 0) {
          const existing = state.routeSegments[existingSegIdx];
          const newSeg: RouteSegment = makeBlankSegment({
            day: anchor.day,
            fromSpotId: inserted.id,
            toSpotId: oldNextId,
            scope: existing.scope,
            transportType: existing.transportType || 'walk',
          });
          nextSegments = [
            ...state.routeSegments.slice(0, existingSegIdx),
            { ...existing, toSpotId: inserted.id },
            ...state.routeSegments.slice(existingSegIdx + 1),
            newSeg,
          ];
        } else {
          nextSegments = [
            ...state.routeSegments,
            makeBlankSegment({
              day: anchor.day,
              fromSpotId: anchor.id,
              toSpotId: inserted.id,
              transportType: 'walk',
            }),
            makeBlankSegment({
              day: anchor.day,
              fromSpotId: inserted.id,
              toSpotId: oldNextId,
              transportType: 'walk',
            }),
          ];
        }
      }

      return { ...state, spots: updatedSpots, routeSegments: nextSegments };
    }

    case 'DELETE_SPOT':
      return {
        ...state,
        spots: state.spots.filter((spot) => spot.id !== action.id),
      };

    case 'REORDER_SPOTS': {
      const nextSpots = arrayMove(state.spots, action.oldIndex, action.newIndex);
      // 自动修正 order 字段（基于数组下标 1-indexed）
      const fixedSpots = nextSpots.map((s, i) => ({ ...s, order: i + 1 }));
      return { ...state, spots: fixedSpots };
    }

    case 'SORT_SPOTS_BY_DAY_ORDER': {
      const sorted = [...state.spots].sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
        return a.id.localeCompare(b.id);
      });
      return { ...state, spots: sorted };
    }

    case 'UPDATE_SEGMENT':
      return {
        ...state,
        routeSegments: state.routeSegments.map((seg) =>
          seg.id === action.id ? { ...seg, ...action.payload } : seg
        ),
      };

    case 'ADD_SEGMENT':
      return {
        ...state,
        routeSegments: [...state.routeSegments, action.payload],
      };

    case 'DELETE_SEGMENT':
      return {
        ...state,
        routeSegments: state.routeSegments.filter((seg) => seg.id !== action.id),
      };

    case 'REORDER_SEGMENTS':
      return {
        ...state,
        routeSegments: arrayMove(state.routeSegments, action.oldIndex, action.newIndex),
      };

    case 'SORT_SEGMENTS_BY_DAY': {
      const indexed = state.routeSegments.map((segment, index) => ({ segment, index }));
      indexed.sort((a, b) => {
        if (a.segment.day !== b.segment.day) return a.segment.day - b.segment.day;
        return a.index - b.index;
      });
      return { ...state, routeSegments: indexed.map((entry) => entry.segment) };
    }

    default:
      return state;
  }
}

export function useTripEditor(initialData: TripFullPayload) {
  const [draft, dispatch] = useReducer(tripEditorReducer, initialData);

  const updateMeta = useCallback((meta: Partial<TripMeta>) => {
    dispatch({ type: 'UPDATE_META', payload: meta });
  }, []);

  const updateSpot = useCallback((id: string, payload: Partial<SpotItem>) => {
    dispatch({ type: 'UPDATE_SPOT', id, payload });
  }, []);

  const addSpot = useCallback((spot: SpotItem) => {
    dispatch({ type: 'ADD_SPOT', payload: spot });
  }, []);

  const addSpots = useCallback((spots: SpotItem[]) => {
    dispatch({ type: 'ADD_SPOTS', payload: spots });
  }, []);

  const insertAfterSpot = useCallback((anchorId: string) => {
    dispatch({ type: 'INSERT_AFTER_SPOT', anchorId });
  }, []);

  const deleteSpot = useCallback((id: string) => {
    dispatch({ type: 'DELETE_SPOT', id });
  }, []);

  const reorderSpots = useCallback((oldIndex: number, newIndex: number) => {
    dispatch({ type: 'REORDER_SPOTS', oldIndex, newIndex });
  }, []);

  const sortSpotsByDayOrder = useCallback(() => {
    dispatch({ type: 'SORT_SPOTS_BY_DAY_ORDER' });
  }, []);

  const updateSegment = useCallback((id: string, payload: Partial<RouteSegment>) => {
    dispatch({ type: 'UPDATE_SEGMENT', id, payload });
  }, []);

  const addSegment = useCallback((segment: RouteSegment) => {
    dispatch({ type: 'ADD_SEGMENT', payload: segment });
  }, []);

  const deleteSegment = useCallback((id: string) => {
    dispatch({ type: 'DELETE_SEGMENT', id });
  }, []);

  const reorderSegments = useCallback((oldIndex: number, newIndex: number) => {
    dispatch({ type: 'REORDER_SEGMENTS', oldIndex, newIndex });
  }, []);

  const sortSegmentsByDay = useCallback(() => {
    dispatch({ type: 'SORT_SEGMENTS_BY_DAY' });
  }, []);

  const reset = useCallback((data: TripFullPayload) => {
    dispatch({ type: 'SET_INITIAL_DATA', payload: data });
  }, []);

  return {
    draft,
    updateMeta,
    updateSpot,
    addSpot,
    addSpots,
    insertAfterSpot,
    deleteSpot,
    updateSegment,
    addSegment,
    deleteSegment,
    reorderSpots,
    reorderSegments,
    sortSpotsByDayOrder,
    sortSegmentsByDay,
    reset,
  };
}
