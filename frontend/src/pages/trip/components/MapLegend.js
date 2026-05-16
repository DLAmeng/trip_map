import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import './MapLegend.css';
const GOOGLE_WALK_WARNING = 'Google 官方提醒：步行路线可能缺少部分人行道 / 步道信息,请现场留意。';
// P30: 之前按 transportType 显示颜色图例(步行蓝/地铁橙/新干线红...),
// 现在路线按 day 着色,transport 颜色图例不再准确,改为「每日配色」为主、
// transport 文字提示放在 popup / RouteDetailSheet 里。
export function MapLegend({ dayColors, isRouteBroken, isGoogleMap, hasWalkSegment, }) {
    // 默认移动端折叠，桌面端展开 (1024px 为断点)
    const [isCollapsed, setIsCollapsed] = useState(() => window.innerWidth <= 1024);
    return (_jsxs("div", { className: `map-legend tool-panel ${isCollapsed ? 'is-collapsed' : ''}`, style: {
            width: isCollapsed ? '44px' : '180px',
        }, children: [_jsxs("div", { className: "legend-header", children: [_jsx("span", { className: "legend-title", children: "\u8DEF\u7EBF\u56FE\u4F8B" }), _jsx("button", { className: "legend-toggle", onClick: () => setIsCollapsed(!isCollapsed), title: isCollapsed ? '显示图例' : '隐藏图例', children: isCollapsed ? (_jsx("svg", { viewBox: "0 0 20 20", width: "16", height: "16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M3 5.5h5.5M11.5 5.5H17M5 10h10M3 14.5h4.5M10 14.5H17", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }) })) : '−' })] }), !isCollapsed && (_jsxs("div", { className: "legend-body", children: [_jsx("p", { className: "legend-hint", children: "\u989C\u8272\u6309\u5929\u6570\u533A\u5206\u3002\u70B9\u8DEF\u7EBF / \u666F\u70B9\u67E5\u770B\u4EA4\u901A\u65B9\u5F0F + \u8BE6\u60C5\u3002" }), _jsx("div", { className: "legend-dots", children: dayColors.map((color, i) => (_jsx("span", { className: "legend-dot legend-dot-labeled", style: { backgroundColor: color }, title: `第 ${i + 1} 天`, "aria-label": `第 ${i + 1} 天`, children: _jsx("span", { className: "legend-dot-num", children: i + 1 }) }, i))) }), isRouteBroken && (_jsx("p", { className: "legend-note", children: "\u90E8\u5206\u8DEF\u7EBF\u5DF2\u9690\u85CF\uFF0C\u53EF\u80FD\u5B58\u5728\u8DE8\u5929\u8FDE\u7EBF\u3002" })), isGoogleMap && hasWalkSegment ? (_jsx("p", { className: "legend-note legend-note-warning", children: GOOGLE_WALK_WARNING })) : null] }))] }));
}
