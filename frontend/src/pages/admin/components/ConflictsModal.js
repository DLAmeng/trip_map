import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from 'react';
import { TripAnalysisReport } from './TripAnalysisReport';
/**
 * 冲突详情 modal — 替代原 TripAnalysisReport 的常驻位置。
 * 由 SaveBar 上的红点按钮触发,平时不渲染不占视觉。
 */
export function ConflictsModal({ isOpen, onClose, trip, onSelectIssue, }) {
    useEffect(() => {
        if (!isOpen)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);
    if (!isOpen)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "admin-sheet-backdrop", onClick: onClose }), _jsxs("div", { className: "conflicts-modal", role: "dialog", "aria-label": "\u884C\u7A0B\u51B2\u7A81", children: [_jsxs("header", { className: "admin-sheet-header", children: [_jsx("h2", { children: "\u884C\u7A0B\u51B2\u7A81\u68C0\u67E5" }), _jsx("button", { type: "button", className: "admin-sheet-close", onClick: onClose, "aria-label": "\u5173\u95ED", children: _jsx("svg", { viewBox: "0 0 16 16", width: "16", height: "16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" }) }) })] }), _jsx("div", { className: "admin-sheet-body", children: _jsx(TripAnalysisReport, { trip: trip, onSelectIssue: (issue) => {
                                onSelectIssue?.(issue);
                                onClose(); // 定位后自动关闭 modal,焦点跳转到对应 spot
                            } }) })] })] }));
}
