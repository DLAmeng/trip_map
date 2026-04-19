import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef } from 'react';
import { matchesFilter } from '../../selectors/filterState';
/**
 * 按 day 分 section 的景点列表,对应原生 .day-list-panel。
 *
 * 功能:
 * - 按 day 分桶,filter.day 命中的 day 展开,其他 day 折叠
 * - filter.mustOnly 过滤每个 day 的 spot
 * - selectedSpotId 命中的 spot 加 `.is-active` class
 * - selectedSpotId 变化时,如果命中的列表项在 DOM 里,调 scrollIntoView 让它滚入视口
 *
 * 第一版不做拖拽排序、不做右键菜单(那是 Phase 4 Admin 的事)。
 */
export function SpotList({ spotsByDay, dayNumbers, dayColors, filter, selectedSpotId, onSelect, }) {
    const containerRef = useRef(null);
    // 缓存 day → 是否展开的判断:filter.day 为 null 时全展开;指定 day 时只展开该 day
    const expandedDay = filter.day;
    // 当前 filter 下,每个 day 实际可见的 spots
    const visibleByDay = useMemo(() => {
        const map = new Map();
        for (const day of dayNumbers) {
            const dailySpots = spotsByDay.get(day) ?? [];
            const visible = dailySpots.filter((spot) => matchesFilter(spot, filter));
            map.set(day, visible);
        }
        return map;
    }, [dayNumbers, spotsByDay, filter]);
    // selectedSpotId 变化 → 把命中的列表项滚入视口
    useEffect(() => {
        if (!selectedSpotId || !containerRef.current)
            return;
        const node = containerRef.current.querySelector(`[data-spot-id="${CSS.escape(selectedSpotId)}"]`);
        if (node) {
            node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedSpotId]);
    const fallbackColor = '#888';
    return (_jsx("aside", { className: "day-list-panel", "aria-label": "\u666F\u70B9\u5217\u8868", ref: containerRef, children: dayNumbers.length === 0 ? (_jsx("div", { className: "day-empty", children: "\u8FD9\u4E2A\u884C\u7A0B\u8FD8\u6CA1\u6709\u4EFB\u4F55\u666F\u70B9\u3002\u53BB\u7F16\u8F91\u9875\u6DFB\u52A0\u7B2C\u4E00\u4E2A\u5427\u3002" })) : (dayNumbers.map((day) => {
            const visible = visibleByDay.get(day) ?? [];
            const isExpanded = expandedDay === null || expandedDay === day;
            const dayColor = dayColors[day - 1] ?? fallbackColor;
            return (_jsxs("section", { className: `day-panel${isExpanded ? '' : ' collapsed'}`, "aria-expanded": isExpanded, children: [_jsxs("div", { className: "day-header", role: "heading", "aria-level": 3, style: { ['--day-color']: dayColor }, children: [_jsxs("div", { className: "day-header-copy", children: [_jsxs("span", { className: "day-chip", children: ["Day ", day] }), _jsxs("span", { className: "day-title", children: ["\u7B2C ", day, " \u5929"] })] }), _jsx("div", { className: "day-header-meta", children: _jsxs("span", { children: [visible.length, " \u4E2A\u666F\u70B9"] }) })] }), isExpanded ? (_jsx("div", { className: "day-spots", children: visible.length === 0 ? (_jsx("div", { className: "day-empty", children: "\u5F53\u524D\u8FC7\u6EE4\u6761\u4EF6\u4E0B,\u8FD9\u4E00\u5929\u6CA1\u6709\u666F\u70B9\u3002" })) : (visible.map((spot, index) => {
                            const spotColor = dayColors[spot.day - 1] ?? fallbackColor;
                            const isActive = spot.id === selectedSpotId;
                            return (_jsxs("button", { type: "button", "data-spot-id": spot.id, className: `spot-item${isActive ? ' is-active' : ''}`, style: { ['--spot-color']: spotColor }, onClick: () => onSelect(spot.id), children: [_jsx("span", { className: "spot-index", children: index + 1 }), _jsxs("div", { className: "spot-copy", children: [_jsxs("div", { className: "spot-name", children: [_jsx("span", { children: spot.name }), spot.mustVisit ? (_jsx("span", { className: "must-badge", children: "\u5FC5\u53BB" })) : null] }), spot.nameEn ? (_jsx("div", { className: "spot-name-en", children: spot.nameEn })) : null, _jsx("div", { className: "spot-meta", children: [spot.city, spot.area, spot.timeSlot]
                                                    .filter(Boolean)
                                                    .join(' · ') })] })] }, spot.id));
                        })) })) : null] }, day));
        })) }));
}
