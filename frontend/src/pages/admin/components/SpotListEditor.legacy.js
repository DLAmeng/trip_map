import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, } from '@dnd-kit/sortable';
import { PlaceSearchAutocomplete } from './PlaceSearchAutocomplete';
import { SpotEditorCard } from './SpotEditorCard';
import { makeBlankSpot } from '../../../utils/trip-factory';
export function SpotListEditor({ spots, onUpdateSpot, onDeleteSpot, onAddSpot, onReorderSpots, onInsertAfterSpot, onSortByDayOrder, }) {
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
    }));
    // 筛选 state:day filter(all / 具体天数) + 文本搜索(name/city/area/id/tags/timeSlot)
    const [dayFilter, setDayFilter] = useState('all');
    const [query, setQuery] = useState('');
    const dayOptions = useMemo(() => {
        const days = new Set();
        for (const s of spots)
            if (Number(s.day))
                days.add(Number(s.day));
        return Array.from(days).sort((a, b) => a - b);
    }, [spots]);
    const visibleSpots = useMemo(() => {
        const q = query.trim().toLowerCase();
        return spots.filter((spot) => {
            if (dayFilter !== 'all' && Number(spot.day) !== dayFilter)
                return false;
            if (!q)
                return true;
            const haystack = [
                spot.id,
                spot.name,
                spot.nameEn,
                spot.city,
                spot.area,
                spot.timeSlot,
                ...(Array.isArray(spot.tags) ? spot.tags : []),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }, [spots, dayFilter, query]);
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            // 拖拽排序作用于完整列表,而不是筛选后的视图:
            // 找到两个 id 在原 spots 里的真实下标,避免筛选视图下拖错位。
            const oldIndex = spots.findIndex((s) => s.id === active.id);
            const newIndex = spots.findIndex((s) => s.id === over.id);
            onReorderSpots(oldIndex, newIndex);
        }
    };
    const handleAdd = () => {
        const lastSpot = spots[spots.length - 1];
        onAddSpot(makeBlankSpot({
            day: lastSpot ? lastSpot.day : 1,
            order: lastSpot ? (lastSpot.order ?? spots.length) + 1 : 1,
            city: lastSpot?.city,
            lat: lastSpot ? lastSpot.lat + 0.001 : 35.6895,
            lng: lastSpot ? lastSpot.lng + 0.001 : 139.6917,
        }));
    };
    return (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "panel-head", children: [_jsxs("h2", { children: ["\u666F\u70B9\u5217\u8868 (", spots.length, ")"] }), _jsxs("div", { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx(PlaceSearchAutocomplete, { onSelect: (place) => {
                                    const lastSpot = spots[spots.length - 1];
                                    onAddSpot(makeBlankSpot({
                                        day: lastSpot ? lastSpot.day : 1,
                                        order: lastSpot ? (lastSpot.order ?? spots.length) + 1 : 1,
                                        name: place.name,
                                        lat: place.lat,
                                        lng: place.lng,
                                    }));
                                }, placeholder: "\u641C\u7D22\u5E76\u5FEB\u901F\u6DFB\u52A0\u666F\u70B9..." }), onSortByDayOrder ? (_jsx("button", { type: "button", className: "btn btn-ghost", onClick: onSortByDayOrder, title: "\u6309 day + order \u5B57\u6BB5\u91CD\u65B0\u6392\u5217", children: "\u6309\u5929\u6570+\u987A\u5E8F\u6574\u7406" })) : null, _jsx("button", { className: "btn btn-primary", onClick: handleAdd, children: "+ \u7A7A\u767D\u8282\u70B9" })] })] }), _jsxs("div", { className: "filters-row", style: {
                    display: 'grid',
                    gridTemplateColumns: '180px 1fr',
                    gap: 14,
                    marginBottom: 14,
                }, children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "\u6309\u5929\u6570\u7B5B\u9009" }), _jsxs("select", { value: String(dayFilter), onChange: (e) => setDayFilter(e.target.value === 'all' ? 'all' : Number(e.target.value)), children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u5929\u6570" }), dayOptions.map((d) => (_jsxs("option", { value: d, children: ["\u7B2C ", d, " \u5929"] }, d)))] })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "\u641C\u7D22\u666F\u70B9" }), _jsx("input", { type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "\u540D\u79F0 / \u57CE\u5E02 / \u533A\u57DF / ID / \u6807\u7B7E / \u65F6\u6BB5" })] })] }), _jsx("div", { className: "section-note", style: {
                    fontSize: 13,
                    color: 'var(--admin-muted)',
                    marginBottom: 10,
                }, children: spots.length === 0
                    ? '还没有景点。'
                    : `当前显示 ${visibleSpots.length} / ${spots.length} 个景点` }), _jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: _jsx(SortableContext, { items: visibleSpots.map((s) => s.id), strategy: verticalListSortingStrategy, children: _jsxs("div", { className: "card-list", children: [visibleSpots.map((spot) => (_jsx(SpotEditorCard, { spot: spot, allSpots: spots, onUpdate: (payload) => onUpdateSpot(spot.id, payload), onDelete: () => onDeleteSpot(spot.id), onInsertAfter: onInsertAfterSpot ? () => onInsertAfterSpot(spot.id) : undefined }, spot.id))), spots.length === 0 ? (_jsx("div", { className: "empty-state", children: "\u8FD8\u6CA1\u6709\u666F\u70B9\uFF0C\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u6DFB\u52A0\u3002" })) : visibleSpots.length === 0 ? (_jsx("div", { className: "empty-state", children: "\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u4E0B\u6CA1\u6709\u666F\u70B9\u3002" })) : null] }) }) })] }));
}
