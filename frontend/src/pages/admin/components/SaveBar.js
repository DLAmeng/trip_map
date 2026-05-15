import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
/**
 * 简化后的 SaveBar(P-final 移动优先重设计):
 *   - 撤销 / 重做(常用) — 一组
 *   - 设置 ⚙(打开 AdminSettingsSheet,放重载/导入/导出/Meta/批量导入)
 *   - 冲突 🔔 + N(issueCount>0 时显示红点,触发 ConflictsModal)
 *   - 重置 / 保存更改 — 主按钮组
 *
 * 删除的按钮(已移到 AdminSettingsSheet):重载最新 / 导入本地 / 导出本地
 */
export function SaveBar({ onSave, onReset, onUndo, onRedo, onOpenSettings, onOpenConflicts, issueCount, isSaving, isSyncing, isReloading, isDirty, canUndo, canRedo, restoredFromLocalDraft, inlineMessage, }) {
    const isBusy = isSaving || isSyncing || isReloading;
    // P4-3: 重置按钮"二次轻点确认" — 替代 window.confirm,移动端 PWA 友好
    // 第一次点:进入 confirming 状态(变红 + 改文字 + 抖动);2.5s 内再点才执行 reset
    const [confirmingReset, setConfirmingReset] = useState(false);
    const confirmTimerRef = useRef(null);
    useEffect(() => () => {
        if (confirmTimerRef.current)
            window.clearTimeout(confirmTimerRef.current);
    }, []);
    const handleResetClick = () => {
        if (!isDirty || isBusy)
            return;
        if (confirmingReset) {
            // 第二次点 — 执行
            if (confirmTimerRef.current)
                window.clearTimeout(confirmTimerRef.current);
            setConfirmingReset(false);
            if (typeof navigator !== 'undefined' && navigator.vibrate)
                navigator.vibrate(20);
            onReset();
            return;
        }
        // 第一次点 — 进入待确认
        setConfirmingReset(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate)
            navigator.vibrate(10);
        confirmTimerRef.current = window.setTimeout(() => setConfirmingReset(false), 2500);
    };
    return (_jsxs("div", { className: "save-bar", children: [_jsxs("div", { className: "save-bar-info", children: [_jsx("span", { className: isDirty ? 'save-status-dirty' : 'save-status-clean', children: isDirty ? '● 您有未保存的更改' : '所有更改已保存' }), restoredFromLocalDraft ? (_jsx("span", { className: "save-status-draft", children: "\u5DF2\u6062\u590D\u672C\u5730\u8349\u7A3F" })) : null, inlineMessage ? _jsx("span", { className: "save-status-inline", children: inlineMessage }) : null] }), _jsxs("div", { className: "save-bar-actions", children: [_jsxs("div", { className: "save-bar-group", children: [_jsx("button", { className: "btn btn-ghost", onClick: onUndo, disabled: !canUndo || isBusy, title: "\u64A4\u9500\u4E0A\u4E00\u6B65", "aria-label": "\u64A4\u9500", children: "\u64A4\u9500" }), _jsx("button", { className: "btn btn-ghost", onClick: onRedo, disabled: !canRedo || isBusy, title: "\u6062\u590D\u521A\u624D\u64A4\u9500\u7684\u66F4\u6539", "aria-label": "\u91CD\u505A", children: "\u91CD\u505A" })] }), _jsxs("div", { className: "save-bar-group", children: [_jsxs("button", { type: "button", className: `btn btn-ghost save-bar-conflict-btn${issueCount > 0 ? ' has-issues' : ''}`, onClick: onOpenConflicts, title: issueCount > 0 ? `${issueCount} 处冲突,点击查看` : '检查行程冲突', "aria-label": issueCount > 0 ? `${issueCount} 处冲突` : '冲突检查', children: ["\u51B2\u7A81", issueCount > 0 ? _jsx("span", { className: "save-bar-issue-badge", children: issueCount }) : null] }), _jsx("button", { type: "button", className: "btn btn-ghost save-bar-settings-btn", onClick: onOpenSettings, title: "\u8BBE\u7F6E / \u6279\u91CF\u5BFC\u5165 / \u672C\u5730 JSON", "aria-label": "\u8BBE\u7F6E", children: "\u8BBE\u7F6E" })] }), _jsxs("div", { className: "save-bar-group save-bar-group-primary", children: [_jsx("button", { className: `btn btn-ghost btn-danger${confirmingReset ? ' is-confirming' : ''}`, onClick: handleResetClick, disabled: !isDirty || isBusy, title: confirmingReset ? '再点一次确认重置(2.5s 内有效)' : '丢弃未保存的所有更改', children: confirmingReset ? '再点确认' : '重置' }), _jsx("button", { className: "btn btn-primary btn-save", onClick: onSave, disabled: !isDirty || isBusy, children: isSaving ? '正在保存...' : '保存更改' })] })] })] }));
}
