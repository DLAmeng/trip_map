import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 手机端底部胶囊切换栏(Google Maps bottom pill 风格):
 * - 浮在底部安全区之上,position fixed + safe-area-inset-bottom
 * - 水平居中,白色半透明背景 + blur,大圆角
 * - 3 个选项:概况 / 列表 / 筛选
 * - 选中项背景变深色胶囊,标签加粗
 * - 每个按钮至少 48px 高,点击区域大
 *
 * 交互语义保留现有:
 *   - 概况 → 打开"行程概况"modal
 *   - 列表 → 展开底部 SpotList bottom sheet
 *   - 筛选 → 打开 MobileFilterSheet
 * 组件只管 UI + 回调,状态由 TripPage 统一托管。
 */
export function MobileTripBottomSwitcher({ activeMode, onSelectSummary, onSelectList, onSelectFilter, hasActiveFilter = false, }) {
    return (_jsxs("nav", { className: "mobile-trip-bottom-switcher", "aria-label": "\u884C\u7A0B\u89C6\u56FE\u5207\u6362", children: [_jsxs("button", { type: "button", className: `mobile-switcher-btn${activeMode === 'summary' ? ' is-active' : ''}`, onClick: onSelectSummary, "aria-pressed": activeMode === 'summary', children: [_jsx("span", { className: "mobile-switcher-icon", "aria-hidden": "true", children: _jsxs("svg", { viewBox: "0 0 20 20", width: "20", height: "20", fill: "none", children: [_jsx("rect", { x: "3", y: "4", width: "6", height: "6", rx: "1.2", stroke: "currentColor", strokeWidth: "1.6" }), _jsx("rect", { x: "11", y: "4", width: "6", height: "6", rx: "1.2", stroke: "currentColor", strokeWidth: "1.6" }), _jsx("rect", { x: "3", y: "12", width: "14", height: "4", rx: "1.2", stroke: "currentColor", strokeWidth: "1.6" })] }) }), _jsx("span", { className: "mobile-switcher-label", children: "\u6982\u51B5" })] }), _jsxs("button", { type: "button", className: `mobile-switcher-btn${activeMode === 'list' ? ' is-active' : ''}`, onClick: onSelectList, "aria-pressed": activeMode === 'list', children: [_jsx("span", { className: "mobile-switcher-icon", "aria-hidden": "true", children: _jsxs("svg", { viewBox: "0 0 20 20", width: "20", height: "20", fill: "none", children: [_jsx("rect", { x: "3", y: "4", width: "14", height: "2.4", rx: "1.2", fill: "currentColor" }), _jsx("rect", { x: "3", y: "8.8", width: "14", height: "2.4", rx: "1.2", fill: "currentColor" }), _jsx("rect", { x: "3", y: "13.6", width: "14", height: "2.4", rx: "1.2", fill: "currentColor" })] }) }), _jsx("span", { className: "mobile-switcher-label", children: "\u5217\u8868" })] }), _jsxs("button", { type: "button", className: `mobile-switcher-btn${activeMode === 'filter' ? ' is-active' : ''}`, onClick: onSelectFilter, "aria-pressed": activeMode === 'filter', children: [_jsxs("span", { className: "mobile-switcher-icon", "aria-hidden": "true", children: [_jsx("svg", { viewBox: "0 0 20 20", width: "20", height: "20", fill: "none", children: _jsx("path", { d: "M3 5h14M6 10h8M9 15h2", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }) }), hasActiveFilter ? _jsx("span", { className: "mobile-switcher-dot", "aria-hidden": "true" }) : null] }), _jsx("span", { className: "mobile-switcher-label", children: "\u7B5B\u9009" })] })] }));
}
