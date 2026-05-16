import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { SPOT_TYPE_VALUES, SPOT_TYPE_META, } from '../../../constants/spot-types';
export function MobileFilterSheet({ isOpen, onClose, dayNumbers, dayColors, cityNames, filter, onChange, spotTypes = null, typeBreakdown, onToggleSpotType, }) {
    return (_jsxs(_Fragment, { children: [isOpen && _jsx("div", { className: "sheet-backdrop", onClick: onClose }), _jsxs("div", { className: `mobile-filter-sheet ${isOpen ? 'is-open' : ''}`, children: [_jsx("div", { className: "sheet-handle", "aria-hidden": "true" }), _jsx("div", { className: "modal-header", children: _jsx("h3", { children: "\u5FEB\u901F\u7B5B\u9009" }) }), _jsxs("div", { className: "modal-body", children: [_jsxs("div", { className: "sheet-section", children: [_jsx("div", { className: "sheet-section-title", children: "\u5929\u6570" }), _jsxs("div", { className: "chip-row", children: [_jsx("button", { className: `filter-btn ${filter.day === null ? 'active' : ''}`, onClick: () => onChange({ ...filter, day: null }), children: "\u5168\u90E8" }), dayNumbers.map((d) => {
                                                const color = dayColors?.[d - 1];
                                                const isActive = filter.day === d;
                                                // active 时用 day color 填充 + 白字,跟地图 marker / day-chip 视觉一致
                                                const style = isActive && color
                                                    ? {
                                                        background: color,
                                                        borderColor: color,
                                                        color: '#fff',
                                                    }
                                                    : undefined;
                                                return (_jsxs("button", { className: `filter-btn ${isActive ? 'active' : ''}`, onClick: () => onChange({ ...filter, day: d }), style: style, children: ["Day ", d] }, d));
                                            })] })] }), cityNames.length > 0 ? (_jsxs("div", { className: "sheet-section", children: [_jsx("div", { className: "sheet-section-title", children: "\u57CE\u5E02" }), _jsxs("div", { className: "chip-row", children: [_jsx("button", { className: `filter-btn ${filter.city === null ? 'active' : ''}`, onClick: () => onChange({ ...filter, city: null }), children: "\u5168\u90E8" }), cityNames.map((c) => (_jsx("button", { className: `filter-btn ${filter.city === c ? 'active' : ''}`, onClick: () => onChange({ ...filter, city: c }), children: c }, c)))] })] })) : null, onToggleSpotType ? (_jsxs("div", { className: "sheet-section", children: [_jsx("div", { className: "sheet-section-title", children: "\u5206\u7C7B" }), _jsx("div", { className: "chip-row", children: SPOT_TYPE_VALUES.map((t) => {
                                            // null 状态等价于全部选中
                                            const isActive = !spotTypes || spotTypes.includes(t);
                                            const count = typeBreakdown?.[t] ?? 0;
                                            const isEmpty = count === 0;
                                            return (_jsxs("button", { className: `filter-btn ${isActive ? 'active' : ''} ${isEmpty ? 'is-empty' : ''}`, onClick: () => onToggleSpotType(t), title: isEmpty
                                                    ? `${SPOT_TYPE_META[t].label}(此行程暂无,但可设为偏好)`
                                                    : `${isActive ? '点击隐藏' : '点击显示'} ${count} 个${SPOT_TYPE_META[t].label}`, children: [_jsx("span", { "aria-hidden": "true", children: SPOT_TYPE_META[t].emoji }), _jsx("span", { children: SPOT_TYPE_META[t].label }), _jsxs("span", { style: { opacity: 0.7 }, children: ["(", count, ")"] })] }, t));
                                        }) })] })) : null, _jsx("div", { className: "sheet-section", children: _jsxs("div", { className: "filter-toggle-row", children: [_jsx("button", { className: `toggle-btn ${filter.mustOnly ? 'active' : ''}`, onClick: () => onChange({ ...filter, mustOnly: !filter.mustOnly }), children: "\u53EA\u770B\u5FC5\u53BB" }), _jsx("button", { className: `toggle-btn ${filter.nextOnly ? 'active' : ''}`, onClick: () => onChange({ ...filter, nextOnly: !filter.nextOnly }), children: "\u53EA\u770B\u4E0B\u4E00\u6BB5" })] }) }), _jsx("button", { id: "close-filter-sheet", className: "btn-primary", onClick: onClose, style: {
                                    width: '100%',
                                    marginTop: '24px',
                                    minHeight: '52px',
                                    borderRadius: '16px',
                                    border: 'none',
                                    background: 'var(--ocean)',
                                    color: '#fff',
                                    fontWeight: 800,
                                    fontSize: '1rem',
                                    boxShadow: '0 4px 12px var(--ocean-soft)',
                                }, children: "\u5B8C\u6210" })] })] })] }));
}
