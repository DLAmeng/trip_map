import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import './MapLegend.css';
const GOOGLE_WALK_WARNING = 'Google 官方提醒：步行路线可能缺少部分人行道 / 步道信息,请现场留意。';
const LEGEND_ITEMS = [
    { type: 'walk', label: '步行', color: '#38bdf8', dash: '4, 4' },
    { type: 'subway', label: '地铁 / 电车', color: '#f97316' },
    { type: 'bus', label: '巴士', color: '#10b981', dash: '2, 2' },
    { type: 'shinkansen', label: '新干线', color: '#dc2626' },
    { type: 'train', label: 'JR / 私铁', color: '#7c3aed' },
    { type: 'drive', label: '自驾', color: '#475569' },
];
export function MapLegend({ dayColors, isRouteBroken, isGoogleMap, hasWalkSegment, }) {
    // 默认移动端折叠，桌面端展开 (1024px 为断点)
    const [isCollapsed, setIsCollapsed] = useState(() => window.innerWidth <= 1024);
    return (_jsxs("div", { className: `map-legend tool-panel ${isCollapsed ? 'is-collapsed' : ''}`, style: {
            width: isCollapsed ? '44px' : '180px',
        }, children: [_jsxs("div", { className: "legend-header", children: [_jsx("span", { className: "legend-title", children: "\u8DEF\u7EBF\u56FE\u4F8B" }), _jsx("button", { className: "legend-toggle", onClick: () => setIsCollapsed(!isCollapsed), title: isCollapsed ? '显示图例' : '隐藏图例', children: isCollapsed ? (_jsx("svg", { viewBox: "0 0 20 20", width: "16", height: "16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M3 5.5h5.5M11.5 5.5H17M5 10h10M3 14.5h4.5M10 14.5H17", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }) })) : '−' })] }), !isCollapsed && (_jsxs("div", { className: "legend-body", children: [LEGEND_ITEMS.map((item) => (_jsxs("div", { className: "legend-row", children: [_jsx("div", { className: "legend-line-wrap", children: _jsx("svg", { width: "24", height: "4", className: "legend-svg", children: _jsx("line", { x1: "0", y1: "2", x2: "24", y2: "2", stroke: item.color, strokeWidth: "3", strokeDasharray: item.dash }) }) }), _jsx("span", { className: "legend-label", children: item.label })] }, item.type))), isRouteBroken && (_jsx("p", { className: "legend-note", children: "\u90E8\u5206\u8DEF\u7EBF\u5DF2\u9690\u85CF\uFF0C\u53EF\u80FD\u5B58\u5728\u8DE8\u5929\u8FDE\u7EBF\u3002" })), isGoogleMap && hasWalkSegment ? (_jsx("p", { className: "legend-note legend-note-warning", children: GOOGLE_WALK_WARNING })) : null, _jsx("p", { className: "legend-title legend-title-spaced", children: "\u6BCF\u65E5\u914D\u8272" }), _jsx("div", { className: "legend-dots", children: dayColors.map((color, i) => (_jsx("span", { className: "legend-dot", style: { backgroundColor: color }, title: `第 ${i + 1} 天` }, i))) })] }))] }));
}
