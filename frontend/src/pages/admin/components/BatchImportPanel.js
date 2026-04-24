import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, useState } from 'react';
import { makeBlankSpot } from '../../../utils/trip-factory';
import { parseImportFile, parseImportUrls, } from '../../../utils/trip-import';
/**
 * 批量导入面板:
 * - 支持上传多个 GPX / KML 文件
 * - 支持粘贴 Google Maps 链接(每行一条)
 * - 解析后弹出预览,让用户选"导入到第几天"
 * - 确认导入时调 onAddSpots,用 makeBlankSpot 填全字段
 */
export function BatchImportPanel({ spots, onAddSpots }) {
    const fileInputRef = useRef(null);
    const [urlInput, setUrlInput] = useState('');
    const [pending, setPending] = useState(null);
    const [parseError, setParseError] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [targetDay, setTargetDay] = useState(1);
    const dayOptions = useMemo(() => {
        const days = Array.from(new Set(spots.map((s) => Number(s.day) || 0).filter(Boolean)))
            .sort((a, b) => a - b);
        // 保证有 1..max+1 的选项,方便"追加到新的一天"
        if (days.length === 0)
            return [1];
        const max = days[days.length - 1];
        const extended = new Set(days);
        extended.add(max + 1);
        return Array.from(extended).sort((a, b) => a - b);
    }, [spots]);
    // 如果当前 targetDay 不在可选范围里,拉回到第一个
    const effectiveDay = dayOptions.includes(targetDay) ? targetDay : dayOptions[0];
    const handleParse = async () => {
        setIsParsing(true);
        setParseError(null);
        try {
            const collected = [];
            const files = Array.from(fileInputRef.current?.files ?? []);
            for (const file of files) {
                const parsed = await parseImportFile(file);
                collected.push(...parsed);
            }
            collected.push(...parseImportUrls(urlInput));
            setPending(collected);
            if (collected.length === 0) {
                setParseError('没有解析到任何地点。请检查文件或链接格式。');
            }
        }
        catch (err) {
            setParseError(err instanceof Error ? err.message : String(err));
            setPending(null);
        }
        finally {
            setIsParsing(false);
        }
    };
    const handleConfirm = () => {
        if (!pending || pending.length === 0)
            return;
        const day = effectiveDay;
        const sameDay = spots.filter((s) => Number(s.day) === day);
        let nextOrder = sameDay.length
            ? Math.max(...sameDay.map((s) => Number(s.order) || 0)) + 1
            : 1;
        const newSpots = pending.map((p) => {
            const spot = makeBlankSpot({
                day,
                order: nextOrder++,
                name: p.name,
                lat: p.lat,
                lng: p.lng,
            });
            if (p.description) {
                spot.description = p.description;
            }
            return spot;
        });
        onAddSpots(newSpots);
        // reset UI
        setPending(null);
        setUrlInput('');
        if (fileInputRef.current)
            fileInputRef.current.value = '';
    };
    const handleCancel = () => {
        setPending(null);
        setParseError(null);
    };
    return (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "panel-head", children: [_jsxs("div", { children: [_jsx("p", { className: "panel-kicker", children: "\u6279\u91CF\u5BFC\u5165" }), _jsx("h2", { children: "GPX / KML \u6587\u4EF6 \u6216 Google Maps \u94FE\u63A5" })] }), _jsxs("div", { style: { display: 'flex', gap: 10, flexWrap: 'wrap' }, children: [_jsx("button", { type: "button", className: "btn btn-ghost", onClick: handleParse, disabled: isParsing, children: isParsing ? '解析中...' : '解析文件 / 链接' }), pending && pending.length > 0 ? (_jsxs("button", { type: "button", className: "btn btn-primary", onClick: handleConfirm, children: ["\u786E\u8BA4\u5BFC\u5165 ", pending.length, " \u4E2A\u666F\u70B9"] })) : null] })] }), _jsxs("div", { className: "import-grid", style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 16,
                }, children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u4E0A\u4F20 GPX / KML \u6587\u4EF6 (\u53EF\u591A\u9009)" }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".gpx,.kml,.kmz", multiple: true }), _jsx("small", { style: { color: 'var(--admin-muted)' }, children: "GPX \u8BFB\u53D6 <wpt>,KML \u8BFB\u53D6 <Placemark> \u91CC\u7684 Point \u5750\u6807\u3002" })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "Google Maps \u94FE\u63A5 (\u6BCF\u884C\u4E00\u6761)" }), _jsx("textarea", { rows: 4, value: urlInput, onChange: (e) => setUrlInput(e.target.value), placeholder: 'https://maps.google.com/maps?q=35.68,139.76\nhttps://www.google.com/maps/place/Shibuya+Crossing/@35.659,139.700', spellCheck: false, style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 } })] })] }), _jsx("div", { className: "import-day-row", style: { marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }, children: _jsxs("label", { className: "field", style: { maxWidth: 200 }, children: [_jsx("span", { children: "\u5BFC\u5165\u5230\u7B2C\u51E0\u5929" }), _jsx("select", { value: effectiveDay, onChange: (e) => setTargetDay(Number(e.target.value)), children: dayOptions.map((d) => (_jsxs("option", { value: d, children: ["\u7B2C ", d, " \u5929"] }, d))) })] }) }), parseError ? (_jsxs("div", { className: "import-error", style: {
                    marginTop: 14,
                    padding: 12,
                    background: '#fee2e2',
                    color: '#991b1b',
                    border: '1px solid #fca5a5',
                    borderRadius: 12,
                    fontSize: 13,
                }, children: ["\u26A0 ", parseError] })) : null, pending && pending.length > 0 ? (_jsxs("div", { className: "import-preview", style: {
                    marginTop: 16,
                    background: '#fff',
                    border: '1px solid var(--admin-line)',
                    borderRadius: 16,
                    padding: 16,
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 10,
                        }, children: [_jsxs("strong", { children: ["\u9884\u89C8:\u89E3\u6790\u5230 ", pending.length, " \u4E2A\u5730\u70B9,\u5C06\u5BFC\u5165\u5230\u7B2C ", effectiveDay, " \u5929"] }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: handleCancel, style: { padding: '4px 12px', minHeight: 'auto' }, children: "\u53D6\u6D88" })] }), _jsx("ul", { className: "import-list", style: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }, children: pending.map((p, i) => (_jsxs("li", { style: {
                                display: 'flex',
                                gap: 12,
                                alignItems: 'baseline',
                                padding: '8px 10px',
                                background: 'var(--admin-bg)',
                                borderRadius: 10,
                                fontSize: 13,
                            }, children: [_jsx("span", { style: {
                                        fontSize: 11,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        color: 'var(--admin-accent)',
                                        minWidth: 60,
                                    }, children: p.source }), _jsx("strong", { style: { flex: 1 }, children: p.name }), p.lat || p.lng ? (_jsxs("span", { style: { color: 'var(--admin-muted)', fontFamily: 'monospace' }, children: [p.lat.toFixed(4), ", ", p.lng.toFixed(4)] })) : (_jsx("span", { style: { color: '#b91c1c' }, children: "\u672A\u89E3\u6790\u5230\u5750\u6807" }))] }, i))) })] })) : null] }));
}
