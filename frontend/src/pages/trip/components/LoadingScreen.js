import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 对齐旧版 `.loading-screen`:全屏居中的玻璃卡片,
 * 展示 eyebrow + 主标题 + 描述文案。用于 TripPage 首屏加载。
 */
export function LoadingScreen({ title = '正在生成行程地图...', message = '正在载入点位、路线和界面...', eyebrow = '正在整理路线', }) {
    return (_jsx("div", { className: "loading-screen", role: "status", "aria-live": "polite", children: _jsxs("div", { className: "loading-card", children: [_jsx("span", { className: "loading-eyebrow", children: eyebrow }), _jsx("strong", { className: "loading-title", children: title }), _jsx("p", { className: "loading-message", children: message })] }) }));
}
