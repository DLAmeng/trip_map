import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { SpotList } from '../SpotList';
function getDrawerMetrics() {
    const height = Math.min(window.innerHeight - 12, Math.max(420, window.innerHeight * 0.88));
    const collapsedPeek = window.innerHeight < 760 ? 60 : 68;
    const halfVisible = Math.min(height - 20, Math.max(320, height * 0.52));
    return {
        height,
        collapsed: Math.max(0, height - collapsedPeek),
        half: Math.max(0, height - halfVisible),
        full: 0,
    };
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function resolveNearestState(translateY, metrics) {
    const candidates = [
        { state: 'full', offset: metrics.full },
        { state: 'half', offset: metrics.half },
        { state: 'collapsed', offset: metrics.collapsed },
    ];
    candidates.sort((a, b) => Math.abs(a.offset - translateY) - Math.abs(b.offset - translateY));
    return candidates[0]?.state ?? 'half';
}
export function MobileDrawer({ isOpen, spotsByDay, dayNumbers, dayColors, filter, selectedSpotId, onSelect, onDayClick, onClose, }) {
    const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
    const [drawerState, setDrawerState] = useState('half');
    const [translateY, setTranslateY] = useState(() => getDrawerMetrics().half);
    const dragStateRef = useRef(null);
    const rootRef = useRef(null);
    const metrics = useMemo(() => getDrawerMetrics(), [viewportHeight]);
    useEffect(() => {
        if (!isOpen)
            return;
        setDrawerState(selectedSpotId ? 'full' : 'half');
    }, [isOpen, selectedSpotId]);
    useEffect(() => {
        if (!isOpen)
            return;
        setTranslateY(metrics[drawerState]);
    }, [drawerState, isOpen, metrics]);
    useEffect(() => {
        const handleResize = () => setViewportHeight(window.innerHeight);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const handlePointerDown = (event) => {
        dragStateRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startTranslateY: translateY,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const handlePointerMove = (event) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId)
            return;
        const nextTranslateY = clamp(dragState.startTranslateY + (event.clientY - dragState.startY), metrics.full, metrics.collapsed);
        setTranslateY(nextTranslateY);
    };
    const handlePointerEnd = (event) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId)
            return;
        dragStateRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        setDrawerState(resolveNearestState(translateY, metrics));
    };
    const handleHeaderClick = () => {
        setDrawerState((prev) => {
            if (prev === 'collapsed')
                return 'half';
            if (prev === 'half')
                return 'full';
            return 'collapsed';
        });
    };
    const drawerDayLabel = filter.day !== null ? `第 ${filter.day} 天` : '全部天数';
    const drawerNextStop = (() => {
        if (filter.day === null)
            return '';
        const daySpots = spotsByDay.get(filter.day) ?? [];
        const lastSpot = daySpots[daySpots.length - 1];
        return lastSpot?.transportNote ?? '';
    })();
    if (!isOpen)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "sheet-backdrop", onClick: onClose }), _jsxs("div", { ref: rootRef, className: "mobile-drawer", "aria-label": "\u884C\u7A0B\u62BD\u5C49", style: { height: `${metrics.height}px`, transform: `translateY(${translateY}px)` }, children: [_jsx("div", { className: "drawer-handle-wrap", onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerEnd, onPointerCancel: handlePointerEnd, children: _jsx("div", { className: "drawer-handle" }) }), _jsx("div", { className: "modal-header drawer-header", onClick: handleHeaderClick, children: _jsx("h3", { children: "\u884C\u7A0B\u5217\u8868" }) }), _jsxs("div", { className: "drawer-context-row", onClick: handleHeaderClick, children: [_jsx("p", { className: "drawer-day-label", children: drawerDayLabel }), drawerNextStop ? _jsx("p", { className: "drawer-next-stop", children: drawerNextStop }) : null] }), _jsx("div", { className: "modal-body drawer-content", children: _jsx(SpotList, { spotsByDay: spotsByDay, dayNumbers: dayNumbers, dayColors: dayColors, filter: filter, selectedSpotId: selectedSpotId, onSelect: onSelect, onDayClick: onDayClick }) })] })] }));
}
