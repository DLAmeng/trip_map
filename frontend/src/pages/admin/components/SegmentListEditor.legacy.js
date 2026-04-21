import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, } from '@dnd-kit/sortable';
import { SegmentEditorCard } from './SegmentEditorCard';
import { makeBlankSegment } from '../../../utils/trip-factory';
export function SegmentListEditor({ segments, spots, onUpdateSegment, onDeleteSegment, onAddSegment, onReorderSegments, onSortByDay, }) {
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
    }));
    const [dayFilter, setDayFilter] = useState('all');
    const [query, setQuery] = useState('');
    const dayOptions = useMemo(() => {
        const days = new Set();
        for (const s of segments)
            if (Number(s.day))
                days.add(Number(s.day));
        return Array.from(days).sort((a, b) => a - b);
    }, [segments]);
    const spotNameById = useMemo(() => {
        const map = new Map();
        for (const s of spots)
            map.set(s.id, s.name || s.id);
        return map;
    }, [spots]);
    const visibleSegments = useMemo(() => {
        const q = query.trim().toLowerCase();
        return segments.filter((segment) => {
            if (dayFilter !== 'all' && Number(segment.day) !== dayFilter)
                return false;
            if (!q)
                return true;
            const haystack = [
                segment.id,
                segment.label,
                segment.transportType,
                segment.scope,
                segment.fromSpotId,
                segment.toSpotId,
                spotNameById.get(segment.fromSpotId) ?? '',
                spotNameById.get(segment.toSpotId) ?? '',
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [segments, dayFilter, query, spotNameById]);
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = segments.findIndex((s) => s.id === active.id);
            const newIndex = segments.findIndex((s) => s.id === over.id);
            onReorderSegments(oldIndex, newIndex);
        }
    };
    const handleAdd = () => {
        const lastSeg = segments[segments.length - 1];
        onAddSegment(makeBlankSegment({
            day: lastSeg ? lastSeg.day : 1,
            transportType: lastSeg?.transportType || 'walk',
        }));
    };
    return (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "panel-head", children: [_jsxs("h2", { children: ["\u8DEF\u7EBF\u6BB5\u7BA1\u7406 (", segments.length, ")"] }), _jsxs("div", { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }, children: [onSortByDay ? (_jsx("button", { type: "button", className: "btn btn-ghost", onClick: onSortByDay, title: "\u6309 day \u5B57\u6BB5\u91CD\u65B0\u6392\u5217", children: "\u6309\u5929\u6570\u6574\u7406\u8DEF\u7EBF" })) : null, _jsx("button", { className: "btn btn-primary", onClick: handleAdd, children: "+ \u65B0\u589E\u8DEF\u7EBF\u6BB5" })] })] }), _jsxs("div", { className: "filters-row", style: {
                    display: 'grid',
                    gridTemplateColumns: '180px 1fr',
                    gap: 14,
                    marginBottom: 14,
                }, children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "\u6309\u5929\u6570\u7B5B\u9009" }), _jsxs("select", { value: String(dayFilter), onChange: (e) => setDayFilter(e.target.value === 'all' ? 'all' : Number(e.target.value)), children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u5929\u6570" }), dayOptions.map((d) => (_jsxs("option", { value: d, children: ["\u7B2C ", d, " \u5929"] }, d)))] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "\u641C\u7D22\u8DEF\u7EBF" }), _jsx("input", { type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "label / \u4EA4\u901A\u65B9\u5F0F / from / to / ID" })] })] }), _jsx("div", { className: "section-note", style: { fontSize: 13, color: 'var(--admin-muted)', marginBottom: 10 }, children: segments.length === 0
                    ? '还没有路线段。'
                    : `当前显示 ${visibleSegments.length} / ${segments.length} 段路线` }), _jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: _jsx(SortableContext, { items: visibleSegments.map((s) => s.id), strategy: verticalListSortingStrategy, children: _jsxs("div", { className: "card-list", children: [visibleSegments.map((seg) => (_jsx(SegmentEditorCard, { segment: seg, spots: spots, onUpdate: (payload) => onUpdateSegment(seg.id, payload), onDelete: () => onDeleteSegment(seg.id) }, seg.id))), segments.length === 0 ? (_jsx("div", { className: "empty-state", children: "\u8FD8\u6CA1\u6709\u8DEF\u7EBF\u6BB5\u3002" })) : visibleSegments.length === 0 ? (_jsx("div", { className: "empty-state", children: "\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u4E0B\u6CA1\u6709\u8DEF\u7EBF\u6BB5\u3002" })) : null] }) }) })] }));
}
