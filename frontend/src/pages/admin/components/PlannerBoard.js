import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { buildRouteHeadline, buildRouteMetaLine } from '../../../utils/route-detail';
import { PlaceSearchAutocomplete } from './PlaceSearchAutocomplete';
function PlannerSpotCard({ spot, index, dayColor, selected, checked, nextSegment, onSelect, onToggleSelection, }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: spot.id,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        zIndex: isDragging ? 20 : 1,
    };
    const metaLine = buildRouteMetaLine({
        duration: nextSegment?.duration,
        transportType: nextSegment?.transportType || '',
    });
    return (_jsxs("article", { ref: setNodeRef, style: style, className: `planner-spot-card${selected ? ' is-selected' : ''}${checked ? ' is-checked' : ''}`, onClick: onSelect, children: [_jsxs("div", { className: "planner-spot-card-top", children: [_jsx("div", { className: "planner-spot-drag", "aria-label": "\u62D6\u62FD\u666F\u70B9", ...attributes, ...listeners, children: "\u283F" }), _jsx("label", { className: "planner-spot-select", onClick: (event) => event.stopPropagation(), children: _jsx("input", { type: "checkbox", checked: checked, onChange: (event) => onToggleSelection(event.target.checked) }) }), _jsx("span", { className: "planner-spot-order", style: { backgroundColor: dayColor }, children: index + 1 }), _jsxs("div", { className: "planner-spot-main", children: [_jsxs("div", { className: "planner-spot-title-row", children: [_jsx("strong", { children: spot.name || '未命名景点' }), spot.mustVisit ? _jsx("span", { className: "planner-pill planner-pill-must", children: "\u5FC5\u53BB" }) : null, spot.type === 'transport' ? (_jsx("span", { className: "planner-pill planner-pill-muted", children: "\u4EA4\u901A\u70B9" })) : null] }), _jsx("div", { className: "planner-spot-subline", children: [spot.city, spot.area, spot.timeSlot].filter(Boolean).join(' · ') || '待补充' })] }), spot.photos?.[0] ? (_jsx("img", { className: "planner-spot-thumb", src: spot.photos[0], alt: "" })) : null] }), _jsxs("div", { className: "planner-spot-meta-row", children: [_jsx("span", { children: spot.stayMinutes ? `停留 ${spot.stayMinutes} 分钟` : '未设置停留时长' }), spot.tags?.length ? _jsx("span", { children: spot.tags.join(' / ') }) : null] }), nextSegment ? (_jsxs("div", { className: "planner-next-leg-inline", children: [_jsx("span", { className: "planner-next-leg-label", children: buildRouteHeadline(nextSegment) }), metaLine.length ? _jsx("span", { children: metaLine.join(' · ') }) : null] })) : null] }));
}
function DayDropLane({ day, active, children, }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `day-drop-${day}`,
    });
    return (_jsx("div", { ref: setNodeRef, className: `planner-day-lane${active ? ' is-active' : ''}${isOver ? ' is-over' : ''}`, children: children }));
}
export function PlannerBoard({ days, dayColors, activeDay, selectedSpotId, selectedSegmentId, selectedSpotIds, onSetActiveDay, onSelectSpot, onToggleSpotSelection, onSelectSegment, onAddSpot, onQuickAddPlace, onMoveSpot, onDuplicateDay, onClearDay, onAutoSortDay, expectedDayCount, }) {
    const [moreMenuDay, setMoreMenuDay] = useState(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const selectedIds = new Set(selectedSpotIds);
    const allDays = days.length > 0 ? days : [{ day: 1, spots: [], segments: [] }];
    /**
     * P0-2: 用户点"+ 加 day"扩展的最大 day 数。hook snapshot 是从 spots derive 的,
     * 没 spot 的 day 不会出现。这里用本地 state 记录用户期望的 day 数,DayTabs 合并渲染。
     * 用户在新 day 加 spot 后,hook 自然会 surface 该 day,本地 state 不再起作用。
     */
    const [extendedMaxDay, setExtendedMaxDay] = useState(0);
    /**
     * 主区只渲染 activeDay 那一天的 lane,把 8000+px 的全展开页面收缩到 ~600px。
     * 其他 day 在顶部 DayTabs 切换。drag 跨 day 仍然 OK,因为顶部 tabs 自身
     * 也作为 drop zone 接收 spot,后续 onMoveSpot 触发即切到目标 day。
     */
    const displayDays = allDays.filter((d) => d.day === activeDay);
    /** 顶部 DayTabs 渲染所有 day(合并 hook derive + 用户扩展的空 day + 创建表单期望天数) */
    const hookMaxDay = Math.max(0, ...allDays.map((d) => d.day));
    const effectiveMaxDay = Math.max(hookMaxDay, extendedMaxDay, expectedDayCount ?? 0, 1);
    const allDayNumbers = Array.from({ length: effectiveMaxDay }, (_, i) => i + 1);
    const totalSpots = allDays.reduce((sum, d) => sum + d.spots.length, 0);
    /** "+ 加 day" 按钮:递增 extendedMaxDay,自动切到新 day */
    const handleAppendEmptyDay = () => {
        const next = effectiveMaxDay + 1;
        setExtendedMaxDay(next);
        onSetActiveDay(next);
    };
    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id)
            return;
        const activeId = String(active.id);
        const overId = String(over.id);
        let targetDay = activeDay;
        let targetIndex = 0;
        if (overId.startsWith('day-drop-')) {
            targetDay = Number(overId.replace('day-drop-', '')) || activeDay;
            const targetBucket = displayDays.find((item) => item.day === targetDay)?.spots || [];
            targetIndex = targetBucket.length;
        }
        else {
            const hostDay = displayDays.find((item) => item.spots.some((spot) => spot.id === overId));
            if (!hostDay)
                return;
            targetDay = hostDay.day;
            targetIndex = hostDay.spots.findIndex((spot) => spot.id === overId);
        }
        onMoveSpot(activeId, targetDay, targetIndex);
        onSetActiveDay(targetDay);
    };
    return (_jsxs("section", { className: "panel planner-board-panel", children: [_jsxs("div", { className: "panel-head planner-board-head", children: [_jsxs("div", { children: [_jsx("p", { className: "panel-kicker", children: "Day Planner" }), _jsx("h2", { children: "\u6309\u5929\u5B89\u6392\u884C\u7A0B" })] }), _jsxs("div", { className: "planner-board-head-meta", children: [_jsxs("span", { children: [allDays.length, " \u5929"] }), _jsxs("span", { children: [totalSpots, " \u4E2A\u666F\u70B9"] })] })] }), _jsxs("div", { className: "planner-day-tabs", role: "tablist", "aria-label": "\u5207\u6362\u5929\u6570", children: [allDayNumbers.map((day) => {
                        const dayIndex = day - 1;
                        const dayColor = dayColors[dayIndex % dayColors.length] || '#b85c38';
                        const isActive = day === activeDay;
                        const dayMeta = allDays.find((d) => d.day === day);
                        return (_jsxs("button", { type: "button", role: "tab", "aria-selected": isActive, className: `planner-day-tab${isActive ? ' is-active' : ''}`, style: { '--planner-day-color': dayColor }, onClick: () => onSetActiveDay(day), children: [_jsxs("span", { className: "planner-day-tab-label", children: ["D", day] }), _jsx("span", { className: "planner-day-tab-count", children: dayMeta?.spots.length ?? 0 })] }, day));
                    }), _jsx("button", { type: "button", className: "planner-day-tab planner-day-tab-add", onClick: handleAppendEmptyDay, "aria-label": "\u6DFB\u52A0\u65B0\u7684\u4E00\u5929", title: "\u6DFB\u52A0\u65B0\u7684\u4E00\u5929", children: _jsx("span", { className: "planner-day-tab-label", children: "+" }) })] }), _jsx(DndContext, { sensors: sensors, collisionDetection: closestCorners, onDragEnd: handleDragEnd, children: _jsx("div", { className: "planner-day-grid", children: displayDays.map((dayItem, dayIndex) => {
                        const dayColor = dayColors[dayIndex % dayColors.length] || '#b85c38';
                        const segmentByFromId = new Map(dayItem.segments.map((segment) => [segment.fromSpotId, segment]));
                        return (_jsx(DayDropLane, { day: dayItem.day, active: dayItem.day === activeDay, children: _jsxs("div", { className: "planner-day-card", children: [_jsxs("div", { className: "planner-day-card-head", children: [_jsxs("button", { type: "button", className: `planner-day-chip${dayItem.day === activeDay ? ' is-active' : ''}`, style: { '--planner-day-color': dayColor }, onClick: () => onSetActiveDay(dayItem.day), children: ["Day ", dayItem.day, " \u00B7 ", dayItem.spots.length, " \u4E2A\u666F\u70B9"] }), _jsxs("div", { className: "planner-day-more-wrap", children: [_jsx("button", { type: "button", className: "planner-day-more-btn", onClick: () => setMoreMenuDay(moreMenuDay === dayItem.day ? null : dayItem.day), "aria-label": "\u66F4\u591A\u64CD\u4F5C", "aria-expanded": moreMenuDay === dayItem.day, children: "\u22EF" }), moreMenuDay === dayItem.day ? (_jsxs("div", { className: "planner-day-more-menu", role: "menu", children: [_jsx("button", { type: "button", role: "menuitem", onClick: () => {
                                                                    onAutoSortDay(dayItem.day);
                                                                    setMoreMenuDay(null);
                                                                }, children: "\u987A\u8DEF\u6392\u5E8F" }), _jsx("button", { type: "button", role: "menuitem", onClick: () => {
                                                                    onDuplicateDay(dayItem.day);
                                                                    setMoreMenuDay(null);
                                                                }, children: "\u590D\u5236\u8FD9\u5929" }), _jsx("button", { type: "button", role: "menuitem", className: "is-danger", onClick: () => {
                                                                    onClearDay(dayItem.day);
                                                                    setMoreMenuDay(null);
                                                                }, children: "\u6E05\u7A7A\u8FD9\u5929" })] })) : null] })] }), dayItem.day === activeDay ? (_jsx("div", { className: "planner-day-quick-add", children: _jsx(PlaceSearchAutocomplete, { onSelect: (place) => onQuickAddPlace(place), placeholder: `搜索景点加入 Day ${dayItem.day}...` }) })) : null, _jsx(SortableContext, { items: dayItem.spots.map((spot) => spot.id), strategy: verticalListSortingStrategy, children: _jsxs("div", { className: "planner-day-spot-list", children: [dayItem.spots.map((spot, index) => {
                                                    const nextSegment = segmentByFromId.get(spot.id);
                                                    return (_jsxs("div", { className: "planner-day-spot-wrap", children: [_jsx(PlannerSpotCard, { spot: spot, index: index, dayColor: dayColor, selected: selectedSpotId === spot.id, checked: selectedIds.has(spot.id), nextSegment: nextSegment, onSelect: () => {
                                                                    onSetActiveDay(dayItem.day);
                                                                    onSelectSpot(spot.id);
                                                                }, onToggleSelection: (checked) => onToggleSpotSelection(spot.id, checked) }), nextSegment ? (_jsx("div", { className: `planner-leg-chip${selectedSegmentId === nextSegment.id ? ' is-selected' : ''}`, onClick: () => {
                                                                    onSetActiveDay(dayItem.day);
                                                                    onSelectSegment(nextSegment.id);
                                                                }, children: _jsxs("div", { className: "planner-leg-chip-main", children: [_jsx("strong", { children: buildRouteHeadline(nextSegment) }), _jsx("span", { children: buildRouteMetaLine(nextSegment).join(' · ') || '点击编辑路线说明' })] }) })) : null] }, spot.id));
                                                }), dayItem.spots.length === 0 ? (_jsx("div", { className: "planner-empty-day", children: _jsx("p", { children: "\u8FD9\u4E00\u5929\u8FD8\u6CA1\u6709\u666F\u70B9\u3002\u7528\u4E0A\u65B9\u641C\u7D22\u680F\u6DFB\u52A0\u5730\u56FE\u5730\u70B9\uFF0C\u6216\u4E0B\u65B9\u6309\u94AE\u81EA\u5B9A\u4E49\u3002" }) })) : null] }) }), _jsxs("button", { type: "button", className: "planner-add-spot-btn", onClick: () => {
                                            onSetActiveDay(dayItem.day);
                                            // P1-7: 不再创建占位"新景点"强制让用户进 inspector 改名,
                                            // 改成先 prompt 输入名字,空字符串则取消创建。
                                            const raw = window.prompt(`给 Day ${dayItem.day} 自定义一个景点(留空取消):\n例:酒店休息 / 自由活动 / 机场`, '');
                                            const name = (raw || '').trim();
                                            if (!name)
                                                return;
                                            onAddSpot(dayItem.day, undefined, { name });
                                        }, children: ["+ \u81EA\u5B9A\u4E49\u666F\u70B9\u5230 Day ", dayItem.day, "\uFF08\u65E0\u5730\u70B9\uFF09"] })] }) }, dayItem.day));
                    }) }) })] }));
}
