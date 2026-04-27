import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
/**
 * Trip 顶部标题栏:
 * - 左侧:breadcrumb + eyebrow (destination · startDate → endDate) + 标题 + 描述
 * - 右侧:天数 / 城市 / 景点 三个统计胶囊 + Day 下拉
 *
 * 统计数据由 Trip 页 selectors 计算,header 只做展示。Day 下拉切换 `filter.day`,
 * 保持 URL 同步,和原版 `#today-btn` 语义一致。
 */
export function TripHeader({ meta, tripId, stats, dayNumbers, cityNames, filter, onDaySelect, }) {
    const title = meta.title?.trim() || '未命名行程';
    const description = meta.description?.trim() || '';
    // eyebrow 优先展示 destination + 日期区间;都缺则 fallback 到城市列表,都没有就 "Trip Map"
    const eyebrowSegments = [];
    if (meta.destination)
        eyebrowSegments.push(meta.destination);
    if (meta.startDate && meta.endDate) {
        eyebrowSegments.push(`${meta.startDate} → ${meta.endDate}`);
    }
    else if (meta.startDate) {
        eyebrowSegments.push(meta.startDate);
    }
    const eyebrowText = eyebrowSegments.length > 0
        ? eyebrowSegments.join(' · ')
        : cityNames.length > 0
            ? cityNames.join(' → ')
            : 'Trip Map';
    return (_jsxs("header", { className: "site-header", children: [_jsxs("div", { className: "header-copy", children: [_jsxs("nav", { className: "header-breadcrumb", "aria-label": "\u5BFC\u822A", children: [_jsx(Link, { className: "back-link", to: "/dashboard", children: "\u2190 \u5168\u90E8\u884C\u7A0B" }), _jsx(Link, { className: "edit-link", to: `/admin?id=${encodeURIComponent(tripId)}`, children: "\u7F16\u8F91" })] }), _jsx("span", { className: "eyebrow", children: eyebrowText }), _jsx("h1", { children: title }), description ? _jsx("p", { children: description }) : null] }), _jsxs("div", { className: "header-stats-group", children: [_jsxs("div", { className: "header-stats", "aria-label": "\u884C\u7A0B\u6458\u8981", children: [_jsxs("div", { className: "stat-pill", children: [_jsx("span", { children: stats.days }), _jsxs("small", { children: [_jsxs("svg", { className: "stat-icon", viewBox: "0 0 14 14", width: "12", height: "12", fill: "none", "aria-hidden": "true", children: [_jsx("rect", { x: "2", y: "3", width: "10", height: "9", rx: "1.5", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M2 6h10", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M5 2v2M9 2v2", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }), "\u5929\u6570"] })] }), _jsxs("div", { className: "stat-pill", children: [_jsx("span", { children: stats.cities }), _jsxs("small", { children: [_jsxs("svg", { className: "stat-icon", viewBox: "0 0 14 14", width: "12", height: "12", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M2 12V5l3-2 3 2v7", stroke: "currentColor", strokeWidth: "1.2", strokeLinejoin: "round" }), _jsx("path", { d: "M8 12V7l3-1.5V12", stroke: "currentColor", strokeWidth: "1.2", strokeLinejoin: "round" }), _jsx("path", { d: "M1 12h12", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }), "\u57CE\u5E02"] })] }), _jsxs("div", { className: "stat-pill", children: [_jsx("span", { children: stats.spots }), _jsxs("small", { children: [_jsxs("svg", { className: "stat-icon", viewBox: "0 0 14 14", width: "12", height: "12", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M7 13c-2.5-3-4-5-4-7a4 4 0 1 1 8 0c0 2-1.5 4-4 7z", stroke: "currentColor", strokeWidth: "1.2", strokeLinejoin: "round" }), _jsx("circle", { cx: "7", cy: "6", r: "1.4", stroke: "currentColor", strokeWidth: "1.2" })] }), "\u666F\u70B9"] })] })] }), _jsxs("div", { className: "header-actions", children: [_jsx("label", { className: "sr-only", htmlFor: "header-day-select", children: "\u9009\u62E9\u805A\u7126\u5929\u6570" }), _jsxs("select", { id: "header-day-select", className: `pill-select${filter.day !== null ? ' active' : ''}`, value: filter.day === null ? 'all' : String(filter.day), onChange: (event) => {
                                    const raw = event.target.value;
                                    onDaySelect(raw === 'all' ? null : Number(raw));
                                }, children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u5929\u6570" }), dayNumbers.map((day) => (_jsxs("option", { value: day, children: ["\u7B2C ", day, " \u5929"] }, day)))] })] })] })] }));
}
