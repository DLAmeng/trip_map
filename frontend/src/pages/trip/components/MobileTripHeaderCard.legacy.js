import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
/**
 * 手机端第二层浮层:**行程上下文条**(Secondary Floating Card)。
 *
 * 变更背景:顶部第一层改由 `MobileMapSearchBar`(搜索入口)占据,
 * 本卡片退到搜索栏下方,承担"行程名 + 路线摘要 + 返回/编辑快捷"的功能。
 * 视觉上是一条紧凑的上下文条,不再是页面主视觉。
 *
 * 信息取舍:
 *   - 保留:返回 Dashboard / 编辑 Trip / 行程标题 / 一行路线摘要(城市或日期区间)
 *   - 删除:独立 eyebrow 行、description 2 行长文案 —— 全压缩到 1 行副标题
 *   - 结果:卡片高度从 ~80px 降到 ~48-54px,跟搜索栏语言一致
 */
export function MobileTripHeaderCard({ meta, tripId, cityNames, }) {
    const title = meta.title?.trim() || '未命名行程';
    /**
     * 副标题"摘要路线"优先级:
     *   1. 城市接龙("东京 → 京都 → 大阪"),最能体现行程感
     *   2. 日期区间("2026-04-01 → 2026-04-14")
     *   3. 目的地单行("日本关西")
     *   4. description(截一行)
     */
    const subtitle = pickSubtitle(meta, cityNames);
    return (_jsxs("header", { className: "mobile-trip-context-card", "aria-label": "\u884C\u7A0B\u4FE1\u606F", children: [_jsx(Link, { className: "mobile-trip-ctx-btn", to: "/dashboard", "aria-label": "\u8FD4\u56DE\u5168\u90E8\u884C\u7A0B", children: _jsx("svg", { viewBox: "0 0 20 20", width: "18", height: "18", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M12 4 6 10l6 6", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) }) }), _jsxs("div", { className: "mobile-trip-ctx-copy", children: [_jsx("h1", { className: "mobile-trip-ctx-title", children: title }), subtitle ? (_jsx("p", { className: "mobile-trip-ctx-subtitle", children: subtitle })) : null] }), _jsx(Link, { className: "mobile-trip-ctx-btn mobile-trip-ctx-edit", to: `/admin?id=${encodeURIComponent(tripId)}`, "aria-label": "\u7F16\u8F91\u884C\u7A0B", children: _jsx("svg", { viewBox: "0 0 20 20", width: "16", height: "16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M4 14.5V16h1.5l8.3-8.3-1.5-1.5L4 14.5zM15.7 5.2a1 1 0 0 0 0-1.4l-1.5-1.5a1 1 0 0 0-1.4 0l-1 1 2.9 2.9 1-1z", fill: "currentColor" }) }) })] }));
}
function pickSubtitle(meta, cityNames) {
    if (cityNames.length >= 2) {
        // 城市多于 2 个时用箭头接起来,手机空间有限最多展示 4 个,其余用 "+N"
        const visible = cityNames.slice(0, 4);
        const rest = cityNames.length - visible.length;
        const joined = visible.join(' → ');
        return rest > 0 ? `${joined} · +${rest}` : joined;
    }
    if (meta.destination)
        return meta.destination.trim();
    if (meta.startDate && meta.endDate)
        return `${meta.startDate} → ${meta.endDate}`;
    if (meta.startDate)
        return meta.startDate;
    if (meta.description)
        return meta.description.trim();
    return '';
}
