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
export function AdminSettingsSheet({ isOpen, onClose, meta, spots, isDefaultTrip, onUpdateMeta, onAddImportedSpots, onReload, onImport, onExport, onImportFromFile, onAutoLocateSpots, missingLocationCount, isAutoLocating, isReloading, isSaving, isSyncing, }) {
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
    /**
     * P19-2: 校验每个 spot 是否能被地图识别。
     * 地图渲染 marker 的条件:Number.isFinite(lat) && Number.isFinite(lng) && day 是有效数字。
     * 任一缺失,该 spot 不会出现在地图上(仅在列表显示)。
     */
    const analyzeImportPayload = (parsed) => {
        const spots = Array.isArray(parsed.spots) ? parsed.spots : [];
        const valid = [];
        const invalid = [];
        for (const spot of spots) {
            const reasons = [];
            if (!Number.isFinite(spot?.lat))
                reasons.push('缺 lat');
            if (!Number.isFinite(spot?.lng))
                reasons.push('缺 lng');
            if (!Number.isFinite(spot?.day))
                reasons.push('缺 day');
            if (reasons.length === 0)
                valid.push(spot);
            else
                invalid.push({ spot, reasons });
        }
        return { valid, invalid, total: spots.length };
    };
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
            // P19-2: 预扫描所有 spot,统计地图可识别 / 不可识别
            const { valid, invalid, total } = analyzeImportPayload(parsed);
            // 全 0 景点 → 友好阻止
            if (total === 0) {
                window.alert('文件里 spots 数组是空的,导入后地图上看不到任何景点。请检查文件。');
                return;
            }
            // 全部 spot 字段都缺 → 阻止(数据格式不对)
            if (valid.length === 0) {
                const samples = invalid.slice(0, 3).map((it) => `  · ${it.spot?.name || '<未命名>'}:${it.reasons.join(' / ')}`).join('\n');
                window.alert(`文件里 ${total} 个景点全部缺关键字段(lat / lng / day),地图无法识别。\n\n` +
                    `前 3 个示例:\n${samples}\n\n` +
                    `请检查 JSON 格式是否正确。每个 spot 需要 lat / lng / day 三个数字字段。`);
                return;
            }
            // 部分 invalid 加警告;全 valid 给绿光
            const warnLine = invalid.length > 0
                ? `\n⚠ ${invalid.length} 个景点缺字段(列表可见,但地图不显示 marker)`
                : '\n✓ 所有景点位置完整,地图可全部识别';
            const ok = window.confirm(`确定用上传的文件覆盖当前行程吗?\n\n` +
                `上传:${total} 个景点 / ${parsed.routeSegments?.length || 0} 条路线\n` +
                `✓ ${valid.length} 个景点有完整位置(lat / lng / day)${warnLine}\n\n` +
                `此操作会丢弃当前未保存的修改,但你可以"撤销"或重新加载恢复。`);
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
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "admin-sheet-backdrop", onClick: onClose }), _jsxs("aside", { className: "admin-settings-sheet", role: "dialog", "aria-label": "\u884C\u7A0B\u8BBE\u7F6E", children: [_jsx("div", { className: "admin-sheet-handle", "aria-hidden": "true" }), _jsxs("header", { className: "admin-sheet-header", children: [_jsx("h2", { children: "\u884C\u7A0B\u8BBE\u7F6E" }), _jsx("button", { type: "button", className: "admin-sheet-close", onClick: onClose, "aria-label": "\u5173\u95ED\u8BBE\u7F6E", children: _jsx("svg", { viewBox: "0 0 16 16", width: "16", height: "16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" }) }) })] }), _jsxs("div", { className: "admin-sheet-body", children: [_jsxs("section", { className: "admin-sheet-section", children: [_jsx("h3", { className: "admin-sheet-section-title", children: "\u57FA\u7840\u4FE1\u606F" }), _jsx(TripMetaForm, { meta: meta, onChange: onUpdateMeta })] }), _jsxs("section", { className: "admin-sheet-section", children: [_jsx("h3", { className: "admin-sheet-section-title", children: "\u6279\u91CF\u5BFC\u5165" }), _jsx("p", { className: "admin-sheet-section-desc", children: "\u4ECE CSV / JSON / Google Maps URL \u4E00\u6B21\u6DFB\u52A0\u591A\u4E2A\u666F\u70B9\u3002" }), _jsx(BatchImportPanel, { spots: spots, onAddSpots: onAddImportedSpots })] }), _jsxs("section", { className: "admin-sheet-section", children: [_jsx("h3", { className: "admin-sheet-section-title", children: "\u4ECE\u6587\u4EF6\u5BFC\u5165\u884C\u7A0B" }), _jsxs("p", { className: "admin-sheet-section-desc", children: ["\u9009\u62E9\u7535\u8111\u4E0A\u7684 itinerary.json \u6587\u4EF6,\u8986\u76D6\u5F53\u524D\u884C\u7A0B\u3002", _jsx("br", {}), _jsx("strong", { children: "\u5730\u56FE\u8BC6\u522B\u8981\u6C42" }), ":\u6BCF\u4E2A spot \u9700\u8981 ", _jsx("code", { children: "lat / lng / day" }), ' ', "\u4E09\u4E2A\u6570\u5B57\u5B57\u6BB5\u624D\u80FD\u5728\u5730\u56FE\u4E0A\u663E\u793A marker\u3002", _jsx("br", {}), "\u7F3A\u5B57\u6BB5\u7684 spot \u4ECD\u4F1A\u5728\u5217\u8868\u663E\u793A,\u4F46\u5730\u56FE\u4E0D\u4F1A\u753B\u5B83\u3002"] }), _jsx("input", { ref: fileInputRef, type: "file", accept: "application/json,.json", style: { display: 'none' }, onChange: handleFilePicked }), _jsx("div", { className: "admin-sheet-actions", children: _jsx("button", { type: "button", className: "btn btn-primary", onClick: () => fileInputRef.current?.click(), disabled: isBusy, title: "\u4ECE\u7535\u8111\u4E0A\u4F20\u4E00\u4E2A itinerary.json \u6587\u4EF6", children: "\u9009\u62E9 JSON \u6587\u4EF6\u2026" }) })] }), _jsxs("section", { className: "admin-sheet-section", children: [_jsxs("h3", { className: "admin-sheet-section-title", children: ["\u4FEE\u590D\u7F3A\u4F4D\u7F6E\u666F\u70B9", missingLocationCount > 0 ? (_jsxs("span", { style: {
                                                    marginLeft: 8,
                                                    fontSize: '0.72rem',
                                                    background: 'rgba(234, 88, 12, 0.12)',
                                                    color: '#c2410c',
                                                    padding: '2px 8px',
                                                    borderRadius: 999,
                                                    fontWeight: 700,
                                                    letterSpacing: '0.02em',
                                                }, children: [missingLocationCount, " \u4E2A\u5F85\u4FEE"] })) : null] }), _jsxs("p", { className: "admin-sheet-section-desc", children: ["\u5982\u679C\u5BFC\u5165\u7684 JSON \u91CC\u666F\u70B9\u540D\u5B57\u5199\u5BF9\u4E86\u4F46\u7F3A ", _jsx("code", { children: "lat/lng" }), ", \u8FD9\u91CC\u53EF\u4EE5**\u81EA\u52A8\u7528 Google Places \u53CD\u67E5**(\u6839\u636E name + \u57CE\u5E02)\u586B\u56DE\u3002", _jsx("br", {}), _jsx("strong", { children: "\u6CE8\u610F" }), ":\u540C\u540D\u5730\u70B9\u591A\u4E2A\u65F6,\u53EF\u80FD\u5B9A\u4F4D\u5230\u9519\u7684(\u6BD4\u5982\"\u4E2D\u592E\u516C\u56ED\" \u5728\u591A\u4E2A\u57CE\u5E02\u90FD\u6709)\u3002\u4FEE\u590D\u540E\u8BF7\u53BB SpotInspector \u590D\u6838,\u5931\u8D25\u7684\u53EF\u624B\u52A8\u641C\u7D22\u3002"] }), _jsx("div", { className: "admin-sheet-actions", children: _jsx("button", { type: "button", className: "btn btn-primary", onClick: () => onAutoLocateSpots(), disabled: isBusy || isAutoLocating || missingLocationCount === 0, title: missingLocationCount === 0
                                                ? '所有景点已有经纬度'
                                                : `用 Google Places 自动定位 ${missingLocationCount} 个缺位置景点`, children: isAutoLocating
                                                ? '反查中…'
                                                : missingLocationCount === 0
                                                    ? '所有景点已有位置'
                                                    : `自动定位 ${missingLocationCount} 个景点` }) })] }), isDefaultTrip ? (_jsxs("section", { className: "admin-sheet-section", children: [_jsx("h3", { className: "admin-sheet-section-title", children: "\u672C\u5730\u6570\u636E \u00B7 \u9AD8\u7EA7" }), _jsx("p", { className: "admin-sheet-section-desc", children: "\u4E0E\u9879\u76EE\u6839\u76EE\u5F55\u7684 itinerary.json \u4E92\u901A,\u4EC5\u9ED8\u8BA4\u884C\u7A0B\u53EF\u7528\u3002" }), _jsxs("div", { className: "admin-sheet-actions", children: [_jsx("button", { type: "button", className: "btn btn-ghost", onClick: onReload, disabled: isBusy, title: "\u4ECE\u6570\u636E\u5E93\u91CD\u65B0\u8F7D\u5165,\u4E22\u5F03\u672A\u4FDD\u5B58\u6539\u52A8", children: isReloading ? '重载中…' : '重载最新' }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: onImport, disabled: isBusy, title: "\u628A\u672C\u5730 itinerary.json \u5185\u5BB9\u5BFC\u5165", children: "\u5BFC\u5165\u672C\u5730 JSON" }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: onExport, disabled: isBusy, title: "\u628A\u5F53\u524D\u884C\u7A0B\u5BFC\u51FA\u5230\u672C\u5730 itinerary.json", children: "\u5BFC\u51FA\u672C\u5730 JSON" })] })] })) : null] })] })] }));
}
