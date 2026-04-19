import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
/**
 * 纯展示组件:标题 / 描述 / 3 个统计 pill + back-link / edit-link。
 *
 * 对应原生 index.html 里的 `.site-header`(styles.css L97-257)。
 * 第一版不做 header-actions 的 day select 和 mustOnly(那些在 TripFilters 里),
 * 这里只保留信息 + 导航链接,边界清晰。
 */
export function TripHeader({ meta, stats, tripId }) {
    const title = meta.title?.trim() || '未命名行程';
    const description = meta.description?.trim() || '';
    return (_jsxs("header", { className: "site-header", children: [_jsxs("div", { className: "header-copy", children: [_jsxs("nav", { className: "header-breadcrumb", "aria-label": "\u5BFC\u822A", children: [_jsx(Link, { className: "back-link", to: "/dashboard", children: "\u2190 \u5168\u90E8\u884C\u7A0B" }), _jsx(Link, { className: "edit-link", to: `/admin?id=${encodeURIComponent(tripId)}`, children: "\u7F16\u8F91" })] }), _jsx("span", { className: "eyebrow", children: "Trip Map" }), _jsx("h1", { children: title }), description ? _jsx("p", { children: description }) : null] }), _jsxs("div", { className: "header-stats", children: [_jsxs("div", { className: "stat-pill", "aria-label": `${stats.days} 天`, children: [_jsx("span", { children: stats.days }), _jsx("small", { children: "\u5929\u6570" })] }), _jsxs("div", { className: "stat-pill", "aria-label": `${stats.cities} 座城市`, children: [_jsx("span", { children: stats.cities }), _jsx("small", { children: "\u57CE\u5E02" })] }), _jsxs("div", { className: "stat-pill", "aria-label": `${stats.spots} 个景点`, children: [_jsx("span", { children: stats.spots }), _jsx("small", { children: "\u666F\u70B9" })] })] })] }));
}
