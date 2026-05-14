import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { TripMetaForm } from './TripMetaForm';
import { BatchImportPanel } from './BatchImportPanel';
/**
 * 容纳从主流程移走的低频功能:
 *   - 行程 Meta 编辑(标题/描述/目的地/起止/标签/dayColors)
 *   - 批量导入(CSV / JSON / Google Maps URL)
 *   - 本地 itinerary.json 重载/导入/导出 (仅 isDefaultTrip)
 *
 * 移动端:bottom sheet 风格,从底部滑入,max-height 88vh
 * 桌面端:右侧 360px 抽屉(同 backdrop)
 */
export function AdminSettingsSheet({ isOpen, onClose, meta, spots, isDefaultTrip, onUpdateMeta, onAddImportedSpots, onReload, onImport, onExport, onImportFromFile, isReloading, isSaving, isSyncing, }) {
    // Esc 关闭
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
    // P19: file input ref + 上传处理
    const fileInputRef = useRef(null);
    const handleFilePicked = async (event) => {
        const file = event.target.files?.[0];
        // 处理完清空 value,让用户能连续上传同名文件
        event.target.value = '';
        if (!file)
            return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            // 最小验证:必须有 spots 数组和 config 对象
            if (!parsed || typeof parsed !== 'object') {
                window.alert('文件不是合法 JSON,请检查内容。');
                return;
            }
            if (!Array.isArray(parsed.spots) || !parsed.config) {
                window.alert('JSON 缺少必要字段(spots / config),不是合法 itinerary。');
                return;
            }
            // 二次确认:覆盖当前 trip 是破坏性操作
            const ok = window.confirm(`确定用上传的文件覆盖当前行程吗?\n` +
                `上传:${parsed.spots.length} 个景点 / ${parsed.routeSegments?.length || 0} 条路线\n` +
                `此操作会丢弃当前未保存的修改,但你可以"撤销"或重新加载。`);
            if (!ok)
                return;
            onImportFromFile(parsed);
        }
        catch (err) {
            window.alert(`文件解析失败:${err.message}`);
        }
    };
    if (!isOpen)
        return null;
    const isBusy = isReloading || isSaving || isSyncing;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "admin-sheet-backdrop", onClick: onClose }), _jsxs("aside", { className: "admin-settings-sheet", role: "dialog", "aria-label": "\u884C\u7A0B\u8BBE\u7F6E", children: [_jsx("div", { className: "admin-sheet-handle", "aria-hidden": "true" }), _jsxs("header", { className: "admin-sheet-header", children: [_jsx("h2", { children: "\u884C\u7A0B\u8BBE\u7F6E" }), _jsx("button", { type: "button", className: "admin-sheet-close", onClick: onClose, "aria-label": "\u5173\u95ED\u8BBE\u7F6E", children: _jsx("svg", { viewBox: "0 0 16 16", width: "16", height: "16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" }) }) })] }), _jsxs("div", { className: "admin-sheet-body", children: [_jsxs("section", { className: "admin-sheet-section", children: [_jsx("h3", { className: "admin-sheet-section-title", children: "\u57FA\u7840\u4FE1\u606F" }), _jsx(TripMetaForm, { meta: meta, onChange: onUpdateMeta })] }), _jsxs("section", { className: "admin-sheet-section", children: [_jsx("h3", { className: "admin-sheet-section-title", children: "\u6279\u91CF\u5BFC\u5165" }), _jsx("p", { className: "admin-sheet-section-desc", children: "\u4ECE CSV / JSON / Google Maps URL \u4E00\u6B21\u6DFB\u52A0\u591A\u4E2A\u666F\u70B9\u3002" }), _jsx(BatchImportPanel, { spots: spots, onAddSpots: onAddImportedSpots })] }), _jsxs("section", { className: "admin-sheet-section", children: [_jsx("h3", { className: "admin-sheet-section-title", children: "\u4ECE\u6587\u4EF6\u5BFC\u5165\u884C\u7A0B" }), _jsxs("p", { className: "admin-sheet-section-desc", children: ["\u9009\u62E9\u7535\u8111\u4E0A\u7684 itinerary.json \u6587\u4EF6,\u8986\u76D6\u5F53\u524D\u884C\u7A0B\u3002", _jsx("br", {}), "\u6587\u4EF6\u9700\u7B26\u5408\u884C\u7A0B\u6570\u636E\u683C\u5F0F(meta / config / spots / routeSegments)\u3002"] }), _jsx("input", { ref: fileInputRef, type: "file", accept: "application/json,.json", style: { display: 'none' }, onChange: handleFilePicked }), _jsx("div", { className: "admin-sheet-actions", children: _jsx("button", { type: "button", className: "btn btn-primary", onClick: () => fileInputRef.current?.click(), disabled: isBusy, title: "\u4ECE\u7535\u8111\u4E0A\u4F20\u4E00\u4E2A itinerary.json \u6587\u4EF6", children: "\u9009\u62E9 JSON \u6587\u4EF6\u2026" }) })] }), isDefaultTrip ? (_jsxs("section", { className: "admin-sheet-section", children: [_jsx("h3", { className: "admin-sheet-section-title", children: "\u672C\u5730\u6570\u636E \u00B7 \u9AD8\u7EA7" }), _jsx("p", { className: "admin-sheet-section-desc", children: "\u4E0E\u9879\u76EE\u6839\u76EE\u5F55\u7684 itinerary.json \u4E92\u901A,\u4EC5\u9ED8\u8BA4\u884C\u7A0B\u53EF\u7528\u3002" }), _jsxs("div", { className: "admin-sheet-actions", children: [_jsx("button", { type: "button", className: "btn btn-ghost", onClick: onReload, disabled: isBusy, title: "\u4ECE\u6570\u636E\u5E93\u91CD\u65B0\u8F7D\u5165,\u4E22\u5F03\u672A\u4FDD\u5B58\u6539\u52A8", children: isReloading ? '重载中…' : '重载最新' }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: onImport, disabled: isBusy, title: "\u628A\u672C\u5730 itinerary.json \u5185\u5BB9\u5BFC\u5165", children: "\u5BFC\u5165\u672C\u5730 JSON" }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: onExport, disabled: isBusy, title: "\u628A\u5F53\u524D\u884C\u7A0B\u5BFC\u51FA\u5230\u672C\u5730 itinerary.json", children: "\u5BFC\u51FA\u672C\u5730 JSON" })] })] })) : null] })] })] }));
}
