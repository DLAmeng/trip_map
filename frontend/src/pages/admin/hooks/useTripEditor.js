import { useReducer, useCallback } from 'react';
function tripEditorReducer(state, action) {
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
                spots: state.spots.map((spot) => spot.id === action.id ? { ...spot, ...action.payload } : spot),
            };
        case 'ADD_SPOT':
            return {
                ...state,
                spots: [...state.spots, action.payload],
            };
        case 'DELETE_SPOT':
            return {
                ...state,
                spots: state.spots.filter((spot) => spot.id !== action.id),
            };
        case 'UPDATE_SEGMENT':
            return {
                ...state,
                routeSegments: state.routeSegments.map((seg) => seg.id === action.id ? { ...seg, ...action.payload } : seg),
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
        default:
            return state;
    }
}
export function useTripEditor(initialData) {
    const [draft, dispatch] = useReducer(tripEditorReducer, initialData);
    const updateMeta = useCallback((meta) => {
        dispatch({ type: 'UPDATE_META', payload: meta });
    }, []);
    const updateSpot = useCallback((id, payload) => {
        dispatch({ type: 'UPDATE_SPOT', id, payload });
    }, []);
    const addSpot = useCallback((spot) => {
        dispatch({ type: 'ADD_SPOT', payload: spot });
    }, []);
    const deleteSpot = useCallback((id) => {
        dispatch({ type: 'DELETE_SPOT', id });
    }, []);
    const updateSegment = useCallback((id, payload) => {
        dispatch({ type: 'UPDATE_SEGMENT', id, payload });
    }, []);
    const addSegment = useCallback((segment) => {
        dispatch({ type: 'ADD_SEGMENT', payload: segment });
    }, []);
    const deleteSegment = useCallback((id) => {
        dispatch({ type: 'DELETE_SEGMENT', id });
    }, []);
    const reset = useCallback((data) => {
        dispatch({ type: 'SET_INITIAL_DATA', payload: data });
    }, []);
    return {
        draft,
        updateMeta,
        updateSpot,
        addSpot,
        deleteSpot,
        updateSegment,
        addSegment,
        deleteSegment,
        reset,
    };
}
