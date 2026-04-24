import { jsx as _jsx } from "react/jsx-runtime";
/**
 * 在地图上方显示一条提示条,用于离线 / 降级 / API 失败等场景。
 *
 * 不接 onClose:关闭由上层根据运行态(例如重新 online)自动卸载。
 */
export function MapNotice({ message, tone = 'warning' }) {
    return (_jsx("div", { className: `map-notice map-notice-${tone}`, role: "status", "aria-live": "polite", children: message }));
}
