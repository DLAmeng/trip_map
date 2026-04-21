import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function SummaryBar({ stats, isFiltered }) {
    return (_jsxs("div", { className: "summary-bar tool-panel", children: [_jsxs("div", { className: "summary-pill", children: [_jsx("span", { children: stats.spots }), _jsx("small", { children: "\u666F\u70B9" })] }), _jsxs("div", { className: "summary-pill", children: [_jsx("span", { children: stats.days }), _jsx("small", { children: "\u5929\u6570" })] }), _jsxs("div", { className: "summary-pill", children: [_jsx("span", { children: stats.cities }), _jsx("small", { children: "\u57CE\u5E02" })] }), _jsx("p", { className: "summary-active", children: isFiltered ? '当前显示筛选后的路线。' : '当前显示完整路线。' })] }));
}
