import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { formatDestination, formatDurationChip, formatUpdatedAt, } from '../../utils/format';
/**
 * 单张行程卡片。保持与原生版 renderTripCard 相同的 class 结构,样式直接复用
 * pages/dashboard/dashboard.css。"打开地图" / "编辑" 用 <Link>,让 React
 * Router 接管跳转 —— 进入 Phase 2 占位的 /trip / /admin,显式暴露还没迁的页面。
 */
export function TripCard({ trip, onDuplicate, onDelete, duplicating, deleting }) {
    const isCurrent = trip.id === 'current';
    const spotCount = Number(trip.summary?.spotCount ?? 0);
    const routeCount = Number(trip.summary?.routeSegmentCount ?? 0);
    const isEmpty = spotCount === 0;
    const description = (trip.meta?.description || '').trim();
    const destination = formatDestination(trip);
    const updatedLabel = formatUpdatedAt(trip);
    const durationLabel = formatDurationChip(trip);
    const classes = ['trip-card'];
    if (isCurrent)
        classes.push('is-current');
    if (isEmpty)
        classes.push('is-empty');
    return (_jsxs("article", { className: classes.join(' '), "data-id": trip.id, children: [_jsxs("header", { className: "trip-card-head", children: [_jsxs("div", { className: "trip-card-title", children: [_jsx("h2", { children: trip.name || '未命名行程' }), destination ? _jsxs("p", { className: "trip-destination", children: ["\uD83D\uDCCD ", destination] }) : null] }), isCurrent ? _jsx("span", { className: "trip-badge trip-badge-current", children: "\u9ED8\u8BA4" }) : null] }), description ? (_jsx("p", { className: "trip-description", children: description })) : (_jsx("p", { className: "trip-description trip-description-placeholder", children: "\u8FD8\u6CA1\u6709\u63CF\u8FF0" })), _jsxs("div", { className: "trip-stats", children: [_jsxs("span", { className: "stat-chip", children: [_jsx("strong", { children: spotCount }), " \u666F\u70B9"] }), _jsxs("span", { className: "stat-chip", children: [_jsx("strong", { children: routeCount }), " \u8DEF\u7EBF"] }), _jsx("span", { className: "stat-chip", children: durationLabel })] }), _jsx("div", { className: "trip-meta-line", children: updatedLabel }), _jsxs("div", { className: "trip-actions", children: [_jsxs("div", { className: "trip-actions-main", children: [_jsx(Link, { className: "open-btn", to: `/trip?id=${encodeURIComponent(trip.id)}`, children: "\u6253\u5F00\u5730\u56FE" }), _jsx(Link, { className: "edit-btn", to: `/admin?id=${encodeURIComponent(trip.id)}`, children: "\u7F16\u8F91" })] }), _jsxs("div", { className: "trip-actions-side", children: [_jsx("button", { type: "button", className: "duplicate-btn", "aria-label": "\u590D\u5236\u884C\u7A0B", title: "\u590D\u5236\u6B64\u884C\u7A0B", disabled: duplicating, onClick: () => onDuplicate(trip), children: duplicating ? '...' : '⎘' }), isCurrent ? null : (_jsx("button", { type: "button", className: "delete-btn", "aria-label": "\u5220\u9664\u884C\u7A0B", disabled: deleting, onClick: () => onDelete(trip), children: "\u2715" }))] })] })] }));
}
