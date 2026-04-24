import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
const TRANSPORT_OPTIONS = [
    'walk',
    'metro',
    'subway',
    'train',
    'shinkansen',
    'bus',
    'drive',
    'taxi',
    'ferry',
];
function resolveSpotName(spots, id) {
    const hit = spots.find((spot) => spot.id === id);
    return hit ? hit.name || hit.id : '';
}
export function SegmentEditorCard({ segment, spots, onUpdate, onDelete, }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, } = useSortable({ id: segment.id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
    };
    const [pathDraft, setPathDraft] = useState(() => JSON.stringify(segment.path ?? [], null, 2));
    const [pathError, setPathError] = useState(null);
    useEffect(() => {
        setPathDraft(JSON.stringify(segment.path ?? [], null, 2));
        setPathError(null);
    }, [segment.id, segment.path]);
    const commitPath = (raw) => {
        const trimmed = raw.trim();
        if (!trimmed) {
            onUpdate({ path: [] });
            setPathError(null);
            return;
        }
        try {
            const parsed = JSON.parse(trimmed);
            if (!Array.isArray(parsed)) {
                throw new Error('path 必须是 [[lat,lng], ...] 数组');
            }
            const cleaned = [];
            for (const pair of parsed) {
                if (!Array.isArray(pair) || pair.length < 2)
                    continue;
                const lat = Number(pair[0]);
                const lng = Number(pair[1]);
                if (!Number.isFinite(lat) || !Number.isFinite(lng))
                    continue;
                cleaned.push([lat, lng]);
            }
            onUpdate({ path: cleaned });
            setPathError(null);
        }
        catch (error) {
            setPathError(error instanceof Error ? error.message : String(error));
        }
    };
    const fromName = resolveSpotName(spots, segment.fromSpotId);
    const toName = resolveSpotName(spots, segment.toSpotId);
    return (_jsxs("div", { className: "editor-card", ref: setNodeRef, style: style, children: [_jsxs("div", { className: "card-head", children: [_jsx("div", { className: "drag-handle", ...attributes, ...listeners, title: "\u6309\u4F4F\u62D6\u62FD\u6392\u5E8F", children: "\u283F" }), _jsxs("div", { className: "card-title-wrap", style: { flex: 1, minWidth: 180 }, children: [_jsxs("div", { className: "card-badges", style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }, children: [_jsxs("span", { className: "badge", children: ["\u7B2C ", segment.day, " \u5929"] }), _jsx("span", { className: "badge", children: segment.scope || 'city' }), _jsx("span", { className: "badge", children: segment.transportType || '未设交通' })] }), _jsx("div", { className: "card-title", children: segment.label || '未命名路线' }), _jsxs("div", { className: "card-subtitle", style: { fontSize: '0.78rem', color: 'var(--admin-muted)', marginTop: 4 }, children: [fromName || segment.fromSpotId || '—', " \u2192 ", toName || segment.toSpotId || '—', " \u00B7 ID:", ' ', segment.id || '—'] })] }), _jsx("button", { type: "button", className: "btn btn-ghost btn-danger", onClick: onDelete, children: "\u5220\u9664" })] }), _jsxs("div", { className: "field-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { children: "ID" }), _jsx("input", { type: "text", value: segment.id ?? '', onChange: (event) => onUpdate({ id: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7B2C\u51E0\u5929" }), _jsx("input", { type: "number", value: segment.day ?? '', onChange: (event) => onUpdate({
                                    day: event.target.value === '' ? undefined : parseInt(event.target.value, 10),
                                }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u8303\u56F4 (scope)" }), _jsxs("select", { value: segment.scope ?? 'city', onChange: (event) => onUpdate({ scope: event.target.value }), children: [_jsx("option", { value: "city", children: "\u57CE\u5E02\u5185 (city)" }), _jsx("option", { value: "intercity", children: "\u8DE8\u57CE\u5E02 (intercity)" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u4EA4\u901A\u65B9\u5F0F (transportType)" }), _jsx("input", { type: "text", list: `transport-options-${segment.id}`, value: segment.transportType ?? '', onChange: (event) => onUpdate({ transportType: event.target.value }), placeholder: "walk / metro / bus..." }), _jsx("datalist", { id: `transport-options-${segment.id}`, children: TRANSPORT_OPTIONS.map((transportType) => (_jsx("option", { value: transportType }, transportType))) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u8D77\u70B9\u666F\u70B9" }), _jsxs("select", { value: segment.fromSpotId ?? '', onChange: (event) => onUpdate({ fromSpotId: event.target.value }), children: [_jsx("option", { value: "", children: "\u8BF7\u9009\u62E9\u8D77\u70B9" }), spots.map((spot) => (_jsxs("option", { value: spot.id, children: ["D", spot.day, " \u00B7 ", spot.name || spot.id] }, spot.id)))] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7EC8\u70B9\u666F\u70B9" }), _jsxs("select", { value: segment.toSpotId ?? '', onChange: (event) => onUpdate({ toSpotId: event.target.value }), children: [_jsx("option", { value: "", children: "\u8BF7\u9009\u62E9\u7EC8\u70B9" }), spots.map((spot) => (_jsxs("option", { value: spot.id, children: ["D", spot.day, " \u00B7 ", spot.name || spot.id] }, spot.id)))] })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u663E\u793A\u6807\u9898 (label)" }), _jsx("input", { type: "text", value: segment.label ?? '', onChange: (event) => onUpdate({ label: event.target.value }), placeholder: "\u5982: \u4E1C\u4EAC \u2192 \u4EAC\u90FD (\u65B0\u5E72\u7EBF Hikari)" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u65F6\u957F (duration)" }), _jsx("input", { type: "text", value: segment.duration ?? '', onChange: (event) => onUpdate({ duration: event.target.value }), placeholder: "\u5982: 2h 15min" })] })] }), _jsxs("details", { className: "card-advanced", style: { marginTop: 14 }, children: [_jsx("summary", { style: { cursor: 'pointer', color: 'var(--admin-muted)', fontSize: '0.85rem' }, children: "\u5C55\u5F00\u8BF4\u660E\u4E0E\u8DEF\u5F84 JSON" }), _jsxs("div", { className: "field-grid", style: { marginTop: 12 }, children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u8BF4\u660E (note)" }), _jsx("textarea", { rows: 3, value: segment.note ?? '', onChange: (event) => onUpdate({ note: event.target.value }), placeholder: "\u5177\u4F53\u7684\u6362\u4E58\u4FE1\u606F\u3001\u73ED\u6B21\u7B49..." })] }), _jsxs("div", { className: "field field-wide", children: [_jsxs("label", { children: ["\u8DEF\u5F84 JSON (path)", ' ', _jsx("small", { style: { color: 'var(--admin-muted)', fontWeight: 400 }, children: "[[lat, lng], ...] \u6570\u7EC4,\u7559\u7A7A\u5219\u7531\u8D77\u6B62\u70B9\u76F4\u8FDE" })] }), _jsx("textarea", { rows: 5, value: pathDraft, onChange: (event) => {
                                            setPathDraft(event.target.value);
                                        }, onBlur: (event) => commitPath(event.target.value), spellCheck: false, style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } }), pathError ? (_jsxs("small", { style: { color: '#b91c1c', fontWeight: 600 }, children: ["\u26A0 ", pathError] })) : (_jsxs("small", { style: { color: 'var(--admin-muted)' }, children: ["\u5F53\u524D ", segment.path?.length ?? 0, " \u4E2A\u70B9"] }))] })] })] })] }));
}
