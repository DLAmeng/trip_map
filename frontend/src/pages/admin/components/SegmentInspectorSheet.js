import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { parsePathInput } from '../../../utils/trip-normalize';
import { RouteDetailContent } from '../../trip/components/RouteDetailContent';
const TRANSPORT_OPTIONS = [
    'walk',
    'bus',
    'drive',
    'train',
    'metro',
    'subway',
    'jrrapid',
    'shinkansen',
    'nankai',
];
/**
 * Segment 详情编辑 sheet — 替代原 PlannerInspector 的 segment 模式。
 * 移动端 bottom sheet,桌面端右侧浮卡。
 */
export function SegmentInspectorSheet({ segment, spotById, onClose, onUpdateLeg, onResetLeg, onDeleteDetachedSegment, onFocusSpot, }) {
    const [pathOverrideText, setPathOverrideText] = useState('');
    const [pathError, setPathError] = useState(null);
    useEffect(() => {
        if (!segment) {
            setPathOverrideText('');
            setPathError(null);
            return;
        }
        setPathOverrideText(JSON.stringify(segment.path || [], null, 2));
        setPathError(null);
    }, [segment]);
    // Esc 关闭
    useEffect(() => {
        if (!segment)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [segment, onClose]);
    const endpoints = useMemo(() => {
        if (!segment)
            return null;
        return {
            from: spotById.get(segment.fromSpotId) || null,
            to: spotById.get(segment.toSpotId) || null,
        };
    }, [segment, spotById]);
    if (!segment)
        return null;
    const applyPathOverride = () => {
        try {
            const parsed = parsePathInput(pathOverrideText);
            onUpdateLeg(segment.key, { pathOverride: parsed });
            setPathError(null);
        }
        catch (err) {
            setPathError(err.message);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "admin-sheet-backdrop admin-sheet-backdrop-light", onClick: onClose }), _jsxs("aside", { className: "spot-inspector-sheet segment-inspector-sheet", role: "dialog", "aria-label": "\u8DEF\u7EBF\u8BBE\u7F6E", children: [_jsx("div", { className: "admin-sheet-handle", "aria-hidden": "true" }), _jsxs("header", { className: "admin-sheet-header", children: [_jsxs("div", { className: "spot-inspector-summary", children: [_jsx("strong", { children: segment.label || '未命名路线段' }), _jsxs("p", { children: ["Day ", segment.day, segment.detached ? ' · 兼容保留段' : ' · 自动生成段'] })] }), _jsx("button", { type: "button", className: "admin-sheet-close", onClick: onClose, "aria-label": "\u5173\u95ED", children: _jsx("svg", { viewBox: "0 0 16 16", width: "16", height: "16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" }) }) })] }), _jsxs("div", { className: "admin-sheet-body", children: [_jsx("div", { className: "spot-inspector-actions", children: segment.detached ? (_jsx("button", { type: "button", className: "btn btn-ghost btn-danger", onClick: () => {
                                        if (window.confirm('删除该兼容段?')) {
                                            onDeleteDetachedSegment(segment.id);
                                            onClose();
                                        }
                                    }, children: "\u5220\u9664\u517C\u5BB9\u6BB5" })) : (_jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => onResetLeg(segment.key), children: "\u6062\u590D\u81EA\u52A8\u8DEF\u7EBF" })) }), _jsxs("div", { className: "planner-leg-endpoints", children: [_jsxs("button", { type: "button", className: "planner-endpoint-chip", onClick: () => endpoints?.from && onFocusSpot(endpoints.from.id), children: ["\u8D77\u70B9: ", endpoints?.from?.name || segment.fromSpotId] }), _jsxs("button", { type: "button", className: "planner-endpoint-chip", onClick: () => endpoints?.to && onFocusSpot(endpoints.to.id), children: ["\u7EC8\u70B9: ", endpoints?.to?.name || segment.toSpotId] })] }), _jsxs("div", { className: "field-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { children: "\u4EA4\u901A\u65B9\u5F0F" }), _jsx("select", { value: segment.transportType || 'walk', onChange: (e) => onUpdateLeg(segment.key, { transportType: e.target.value }), children: TRANSPORT_OPTIONS.map((item) => (_jsx("option", { value: item, children: item }, item))) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u8303\u56F4" }), _jsxs("select", { value: segment.scope, onChange: (e) => onUpdateLeg(segment.key, { scope: e.target.value }), children: [_jsx("option", { value: "city", children: "\u5E02\u5185" }), _jsx("option", { value: "intercity", children: "\u8DE8\u57CE" })] })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u8DEF\u7EBF\u6807\u9898" }), _jsx("input", { type: "text", value: segment.label ?? '', onChange: (e) => onUpdateLeg(segment.key, { label: e.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u9884\u8BA1\u65F6\u957F" }), _jsx("input", { type: "text", value: segment.duration ?? '', onChange: (e) => onUpdateLeg(segment.key, { duration: e.target.value }), placeholder: "\u4F8B\u5982 35 \u5206\u949F / 2h 10m" })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u5907\u6CE8" }), _jsx("textarea", { rows: 3, value: segment.note ?? '', onChange: (e) => onUpdateLeg(segment.key, { note: e.target.value }) })] })] }), _jsx("div", { className: "planner-route-runtime", children: _jsx(RouteDetailContent, { segment: segment }) }), _jsxs("details", { className: "planner-advanced-details", children: [_jsx("summary", { children: "\u9AD8\u7EA7 \u00B7 \u8DEF\u5F84 JSON \u8986\u76D6" }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "path override JSON" }), _jsx("textarea", { rows: 6, value: pathOverrideText, onChange: (e) => setPathOverrideText(e.target.value), spellCheck: false }), pathError ? _jsx("p", { className: "planner-field-error", children: pathError }) : null] }), _jsxs("div", { className: "planner-inline-actions", children: [_jsx("button", { type: "button", className: "btn btn-ghost", onClick: applyPathOverride, children: "\u5E94\u7528\u8DEF\u5F84\u8986\u76D6" }), !segment.detached ? (_jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => onResetLeg(segment.key), children: "\u6E05\u9664\u8986\u76D6\u5E76\u6062\u590D\u81EA\u52A8\u751F\u6210" })) : null] })] })] })] })] }));
}
