import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
/**
 * 浮层批量操作工具栏 — 替代原 Bulk Actions 工具栏。
 * 仅在 selectedCount > 0 时渲染:
 *   - 移动端:固定底部浮(bottom + safe-area),主轴可滚
 *   - 桌面端:固定 SaveBar 下方 sticky
 *
 * 内容:N 个已选 + 移动到 Day▾ + 复制到 Day▾ + ★ 必去 + 🗑 删除 + ✕ 取消
 *
 * "进入选择模式" = PlannerBoard 内 spot 长按 1s,触发 onToggleSpotSelection,
 * selectedSpotIds 变化驱动本组件渲染。
 */
export function BulkActionsToolbar({ selectedCount, dayOptions, onMoveToDay, onCopyToDay, onSetMustVisit, onDelete, onClearSelection, }) {
    const [targetDay, setTargetDay] = useState(dayOptions[0] || 1);
    if (selectedCount === 0)
        return null;
    return (_jsxs("div", { className: "bulk-actions-toolbar", role: "toolbar", "aria-label": "\u6279\u91CF\u64CD\u4F5C", children: [_jsxs("div", { className: "bulk-actions-count", children: [_jsx("strong", { children: selectedCount }), _jsx("span", { children: "\u5DF2\u9009\u4E2D" })] }), _jsxs("div", { className: "bulk-actions-main", children: [_jsx("select", { className: "bulk-actions-day-select", value: targetDay, onChange: (e) => setTargetDay(Number(e.target.value)), "aria-label": "\u76EE\u6807\u5929\u6570", children: dayOptions.map((d) => (_jsxs("option", { value: d, children: ["Day ", d] }, d))) }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => onMoveToDay(targetDay), children: "\u79FB\u52A8" }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => onCopyToDay(targetDay), children: "\u590D\u5236" }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => onSetMustVisit(true), title: "\u6807\u4E3A\u5FC5\u53BB", children: "\u2605 \u5FC5\u53BB" }), _jsx("button", { type: "button", className: "btn btn-ghost btn-danger", onClick: onDelete, children: "\uD83D\uDDD1 \u5220\u9664" })] }), _jsx("button", { type: "button", className: "bulk-actions-cancel", onClick: onClearSelection, "aria-label": "\u53D6\u6D88\u9009\u62E9", children: _jsx("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" }) }) })] }));
}
