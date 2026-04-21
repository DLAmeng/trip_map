import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
/**
 * 对齐旧版 `legacy/old-frontend/index.html` 的 `.site-header`:
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
    return (_jsxs("header", { className: "site-header", children: [_jsxs("div", { className: "header-copy", children: [_jsxs("nav", { className: "header-breadcrumb", "aria-label": "\u5BFC\u822A", children: [_jsx(Link, { className: "back-link", to: "/dashboard", children: "\u2190 \u5168\u90E8\u884C\u7A0B" }), _jsx(Link, { className: "edit-link", to: `/admin?id=${encodeURIComponent(tripId)}`, children: "\u7F16\u8F91" })] }), _jsx("span", { className: "eyebrow", children: eyebrowText }), _jsx("h1", { children: title }), description ? _jsx("p", { children: description }) : null] }), _jsxs("div", { className: "header-stats", "aria-label": "\u884C\u7A0B\u6458\u8981", children: [_jsxs("div", { className: "stat-pill", children: [_jsx("span", { children: stats.days }), _jsx("small", { children: "\u5929\u6570" })] }), _jsxs("div", { className: "stat-pill", children: [_jsx("span", { children: stats.cities }), _jsx("small", { children: "\u57CE\u5E02" })] }), _jsxs("div", { className: "stat-pill stat-pill-wide", children: [_jsx("span", { children: stats.spots }), _jsx("small", { children: "\u666F\u70B9" })] })] }), _jsxs("div", { className: "header-actions", children: [_jsx("label", { className: "sr-only", htmlFor: "header-day-select", children: "\u9009\u62E9\u805A\u7126\u5929\u6570" }), _jsxs("select", { id: "header-day-select", className: `pill-select${filter.day !== null ? ' active' : ''}`, value: filter.day === null ? 'all' : String(filter.day), onChange: (event) => {
                            const raw = event.target.value;
                            onDaySelect(raw === 'all' ? null : Number(raw));
                        }, children: [_jsx("option", { value: "all", children: "\u5168\u90E8\u5929\u6570" }), dayNumbers.map((day) => (_jsxs("option", { value: day, children: ["\u7B2C ", day, " \u5929"] }, day)))] })] })] }));
}
