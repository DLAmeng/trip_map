import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Trip 页第一版过滤面板:day 下拉 + "只看必去" 切换。
 *
 * 对应原生 app.js + index.html 里的 header-actions 和 mobile-filter-sheet 的子集。
 * 保持 receipt-neutral 的 props 签名:所有状态走 FilterState,onChange 整体替换,
 * 避免内部状态漂移(和 Dashboard 用的 setState 一致)。
 *
 * city / nextOnly / legend 第一版不做(plan 非目标)。
 */
export function TripFilters({ dayNumbers, filter, onChange }) {
    const handleDayChange = (raw) => {
        const next = raw === '' ? null : Number.parseInt(raw, 10);
        onChange({
            ...filter,
            day: Number.isFinite(next) ? next : null,
        });
    };
    const toggleMustOnly = () => {
        onChange({ ...filter, mustOnly: !filter.mustOnly });
    };
    return (_jsxs("div", { className: "header-actions", role: "group", "aria-label": "\u8FC7\u6EE4\u884C\u7A0B", children: [_jsx("label", { className: "sr-only", htmlFor: "trip-filter-day", children: "\u6309\u5929\u8FC7\u6EE4" }), _jsxs("select", { id: "trip-filter-day", className: `pill-select${filter.day !== null ? ' active' : ''}`, value: filter.day ?? '', onChange: (event) => handleDayChange(event.target.value), children: [_jsx("option", { value: "", children: "\u5168\u90E8\u5929\u6570" }), dayNumbers.map((day) => (_jsxs("option", { value: day, children: ["\u7B2C ", day, " \u5929"] }, day)))] }), _jsx("button", { type: "button", className: `toggle-btn${filter.mustOnly ? ' active' : ''}`, "aria-pressed": filter.mustOnly, onClick: toggleMustOnly, children: "\u2605 \u53EA\u770B\u5FC5\u53BB" })] }));
}
