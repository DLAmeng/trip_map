import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DndContext, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { buildRouteHeadline, buildRouteMetaLine } from '../../../utils/route-detail';
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
export function PlannerBoard({ days, dayColors, activeDay, selectedSpotId, selectedSegmentId, selectedSpotIds, onSetActiveDay, onSelectSpot, onToggleSpotSelection, onSelectSegment, onAddSpot, onMoveSpot, onDuplicateDay, onClearDay, onAutoSortDay, }) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const selectedIds = new Set(selectedSpotIds);
    const allDays = days.length > 0 ? days : [{ day: 1, spots: [], segments: [] }];
    /**
     * 主区只渲染 activeDay 那一天的 lane,把 8000+px 的全展开页面收缩到 ~600px。
     * 其他 day 在顶部 DayTabs 切换。drag 跨 day 仍然 OK,因为顶部 tabs 自身
     * 也作为 drop zone 接收 spot,后续 onMoveSpot 触发即切到目标 day。
     */
    const displayDays = allDays.filter((d) => d.day === activeDay);
    /** 顶部 DayTabs 渲染所有 day */
    const allDayNumbers = allDays.map((d) => d.day);
    const totalSpots = allDays.reduce((sum, d) => sum + d.spots.length, 0);
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
    return (_jsxs("section", { className: "panel planner-board-panel", children: [_jsxs("div", { className: "panel-head planner-board-head", children: [_jsxs("div", { children: [_jsx("p", { className: "panel-kicker", children: "Day Planner" }), _jsx("h2", { children: "\u6309\u5929\u5B89\u6392\u884C\u7A0B" })] }), _jsxs("div", { className: "planner-board-head-meta", children: [_jsxs("span", { children: [allDays.length, " \u5929"] }), _jsxs("span", { children: [totalSpots, " \u4E2A\u666F\u70B9"] })] })] }), _jsx("div", { className: "planner-day-tabs", role: "tablist", "aria-label": "\u5207\u6362\u5929\u6570", children: allDayNumbers.map((day) => {
                    const dayIndex = day - 1;
                    const dayColor = dayColors[dayIndex % dayColors.length] || '#b85c38';
                    const isActive = day === activeDay;
                    const dayMeta = allDays.find((d) => d.day === day);
                    return (_jsxs("button", { type: "button", role: "tab", "aria-selected": isActive, className: `planner-day-tab${isActive ? ' is-active' : ''}`, style: { '--planner-day-color': dayColor }, onClick: () => onSetActiveDay(day), children: [_jsxs("span", { className: "planner-day-tab-label", children: ["D", day] }), _jsx("span", { className: "planner-day-tab-count", children: dayMeta?.spots.length ?? 0 })] }, day));
                }) }), _jsx(DndContext, { sensors: sensors, collisionDetection: closestCorners, onDragEnd: handleDragEnd, children: _jsx("div", { className: "planner-day-grid", children: displayDays.map((dayItem, dayIndex) => {
                        const dayColor = dayColors[dayIndex % dayColors.length] || '#b85c38';
                        const segmentByFromId = new Map(dayItem.segments.map((segment) => [segment.fromSpotId, segment]));
                        return (_jsx(DayDropLane, { day: dayItem.day, active: dayItem.day === activeDay, children: _jsxs("div", { className: "planner-day-card", children: [_jsxs("div", { className: "planner-day-card-head", children: [_jsxs("button", { type: "button", className: `planner-day-chip${dayItem.day === activeDay ? ' is-active' : ''}`, style: { '--planner-day-color': dayColor }, onClick: () => onSetActiveDay(dayItem.day), children: ["Day ", dayItem.day] }), _jsxs("div", { className: "planner-day-actions", children: [_jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => onAutoSortDay(dayItem.day), children: "\u987A\u8DEF\u6392\u5E8F" }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => onDuplicateDay(dayItem.day), children: "\u590D\u5236\u8FD9\u5929" }), _jsx("button", { type: "button", className: "btn btn-ghost btn-danger", onClick: () => onClearDay(dayItem.day), children: "\u6E05\u7A7A" })] })] }), _jsx(SortableContext, { items: dayItem.spots.map((spot) => spot.id), strategy: verticalListSortingStrategy, children: _jsxs("div", { className: "planner-day-spot-list", children: [dayItem.spots.map((spot, index) => {
                                                    const nextSegment = segmentByFromId.get(spot.id);
                                                    return (_jsxs("div", { className: "planner-day-spot-wrap", children: [_jsx(PlannerSpotCard, { spot: spot, index: index, dayColor: dayColor, selected: selectedSpotId === spot.id, checked: selectedIds.has(spot.id), nextSegment: nextSegment, onSelect: () => {
                                                                    onSetActiveDay(dayItem.day);
                                                                    onSelectSpot(spot.id);
                                                                }, onToggleSelection: (checked) => onToggleSpotSelection(spot.id, checked) }), nextSegment ? (_jsxs("div", { className: `planner-leg-chip${selectedSegmentId === nextSegment.id ? ' is-selected' : ''}`, onClick: () => {
                                                                    onSetActiveDay(dayItem.day);
                                                                    onSelectSegment(nextSegment.id);
                                                                }, children: [_jsxs("div", { className: "planner-leg-chip-main", children: [_jsx("strong", { children: buildRouteHeadline(nextSegment) }), _jsx("span", { children: buildRouteMetaLine(nextSegment).join(' · ') || '点击编辑路线说明' })] }), _jsx("button", { type: "button", className: "planner-inline-insert", onClick: (event) => {
                                                                            event.stopPropagation();
                                                                            onAddSpot(dayItem.day, index + 1);
                                                                        }, children: "+ \u5728\u8FD9\u91CC\u63D2\u5165\u666F\u70B9" })] })) : null] }, spot.id));
                                                }), dayItem.spots.length === 0 ? (_jsx("div", { className: "planner-empty-day", children: _jsx("p", { children: "\u8FD9\u4E00\u5929\u8FD8\u6CA1\u6709\u666F\u70B9\uFF0C\u70B9\u5730\u56FE\u6216\u4E0B\u65B9\u6309\u94AE\u5F00\u59CB\u6DFB\u52A0\u3002" }) })) : null] }) }), _jsxs("button", { type: "button", className: "planner-add-spot-btn", onClick: () => {
                                            onSetActiveDay(dayItem.day);
                                            onAddSpot(dayItem.day);
                                        }, children: ["+ \u6DFB\u52A0\u666F\u70B9\u5230 Day ", dayItem.day] })] }) }, dayItem.day));
                    }) }) })] }));
}
