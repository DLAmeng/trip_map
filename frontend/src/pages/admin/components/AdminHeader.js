import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
function buildHeaderCopy(meta) {
    const hints = [];
    if (meta.destination)
        hints.push(meta.destination);
    if (meta.startDate && meta.endDate)
        hints.push(`${meta.startDate} → ${meta.endDate}`);
    else if (meta.startDate)
        hints.push(meta.startDate);
    return hints.join(' · ') || meta.description || '直接改标题、景点、路线和顺序，保存后前端地图会自动读取最新行程。';
}
export function AdminHeader({ title, tripId, meta, isDefaultTrip, stats }) {
    return (_jsxs(_Fragment, { children: [_jsxs("header", { className: "admin-header", children: [_jsxs("div", { children: [_jsxs("p", { className: "eyebrow", children: [_jsx(Link, { className: "admin-back", to: "/dashboard", children: "\u2190 \u5168\u90E8\u884C\u7A0B" }), _jsx("span", { className: "admin-eyebrow-divider", children: "\u00B7" }), _jsx("span", { className: "admin-trip-badge", children: isDefaultTrip ? '默认行程' : '行程编辑' })] }), _jsx("h1", { className: "admin-header-title", children: title || '未命名行程' }), _jsx("p", { className: "admin-header-desc", children: buildHeaderCopy(meta) })] }), _jsx("div", { className: "header-actions", children: _jsx(Link, { to: `/trip?id=${encodeURIComponent(tripId)}`, target: "_blank", className: "btn btn-ghost", children: "\u6253\u5F00\u524D\u53F0\u5730\u56FE" }) })] }), _jsx("section", { className: "topbar", children: _jsxs("div", { className: "summary-grid", children: [_jsxs("div", { className: "summary-card", children: [_jsx("span", { children: stats.days }), _jsx("small", { children: "\u5929\u6570" })] }), _jsxs("div", { className: "summary-card", children: [_jsx("span", { children: stats.spots }), _jsx("small", { children: "\u666F\u70B9" })] }), _jsxs("div", { className: "summary-card", children: [_jsx("span", { children: stats.segments }), _jsx("small", { children: "\u8DEF\u7EBF" })] })] }) })] }));
}
