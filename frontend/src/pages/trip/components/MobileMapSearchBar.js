import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 顶部悬浮搜索栏 —— 视觉参考 Google Maps 手机端的顶部搜索入口。
 *
 * 这一版故意**不用 `<input>`**,而是用一个大型按钮 + 占位文字。
 * 理由:
 *   1. 避免点击后唤出移动端键盘影响地图操作
 *   2. 保持"入口→面板"两段式交互:点击后复用现有的 MapSearch 弹层(activeTool='search')
 *   3. 结构稳定:后续接"搜索地点 / 搜索行程 spot / 搜索城市"时,替换 onActivate 的行为即可
 *
 * 层级:
 *   顶部第一层,贴顶安全区,白色圆角胶囊,浮在地图 + 行程卡片之上。
 */
export function MobileMapSearchBar({ placeholder = '搜索地点 · 景点 · 城市', onActivate, onMenuClick, isActive = false, }) {
    return (_jsxs("div", { className: `mobile-map-search-bar${isActive ? ' is-active' : ''}`, role: "search", "aria-label": "\u5730\u56FE\u641C\u7D22", children: [_jsxs("button", { type: "button", className: "mobile-search-trigger", onClick: onActivate, "aria-pressed": isActive, children: [_jsx("span", { className: "mobile-search-icon", "aria-hidden": "true", children: _jsxs("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", children: [_jsx("circle", { cx: "11", cy: "11", r: "7", stroke: "currentColor", strokeWidth: "1.8" }), _jsx("path", { d: "M16.5 16.5 21 21", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" })] }) }), _jsx("span", { className: "mobile-search-placeholder", children: placeholder })] }), onMenuClick ? (_jsx("button", { type: "button", className: "mobile-search-menu", onClick: onMenuClick, "aria-label": "\u66F4\u591A\u64CD\u4F5C", title: "\u66F4\u591A", children: _jsxs("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "5", cy: "12", r: "1.6", fill: "currentColor" }), _jsx("circle", { cx: "12", cy: "12", r: "1.6", fill: "currentColor" }), _jsx("circle", { cx: "19", cy: "12", r: "1.6", fill: "currentColor" })] }) })) : null] }));
}
