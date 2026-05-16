import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect } from 'react';
import { PhotoUploader } from './PhotoUploader';
import { PlaceSearchAutocomplete } from './PlaceSearchAutocomplete';
import { SPOT_TYPE_VALUES, SPOT_TYPE_META } from '../../../constants/spot-types';
function csvToTags(value) {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}
function linesToList(value) {
    return value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
}
/**
 * Spot 详情编辑 sheet — 替代原 PlannerInspector 的 spot 模式。
 *
 * 移动端:bottom sheet,从底部滑入,max-height 88vh
 * 桌面端:右侧浮卡,fixed top: 100px right: 24px width: 360px
 *
 * 内容分两层:
 *   - 常显:名称 / 城市 / 区域 / 时段 / 停留时长 / 必去 / 类型 / 描述 / 为什么去 + 智能补全
 *   - 高级折叠:坐标 / 标签 / 交通备注 / Google Maps / Place ID / 评分 / 网站 / 电话 / 营业时间 / 照片
 *
 * 平时不渲染(spot=null),减小 admin 主页视觉权重。
 */
export function SpotInspectorSheet({ spot, onClose, onUpdateSpot, onDeleteSpot, }) {
    // Esc 关闭
    useEffect(() => {
        if (!spot)
            return;
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [spot, onClose]);
    if (!spot)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "admin-sheet-backdrop admin-sheet-backdrop-light", onClick: onClose }), _jsxs("aside", { className: "spot-inspector-sheet", role: "dialog", "aria-label": "\u666F\u70B9\u8BE6\u60C5", children: [_jsx("div", { className: "admin-sheet-handle", "aria-hidden": "true" }), _jsxs("header", { className: "admin-sheet-header", children: [_jsxs("div", { className: "spot-inspector-summary", children: [_jsx("strong", { children: spot.name || '未命名景点' }), _jsxs("p", { children: ["Day ", spot.day, " \u00B7 \u987A\u5E8F ", spot.order, " \u00B7 ", spot.city || '待补城市'] })] }), _jsx("button", { type: "button", className: "admin-sheet-close", onClick: onClose, "aria-label": "\u5173\u95ED", children: _jsx("svg", { viewBox: "0 0 16 16", width: "16", height: "16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round" }) }) })] }), _jsxs("div", { className: "admin-sheet-body", children: [_jsxs("div", { className: "spot-inspector-actions", children: [spot.googleMapsUri ? (_jsx("a", { className: "btn btn-ghost", href: spot.googleMapsUri, target: "_blank", rel: "noreferrer", children: "Google Maps" })) : null, _jsx("button", { type: "button", className: "btn btn-ghost btn-danger", onClick: () => {
                                            if (window.confirm(`删除景点"${spot.name || '未命名'}"?`)) {
                                                onDeleteSpot(spot.id);
                                                onClose();
                                            }
                                        }, children: "\u5220\u9664\u666F\u70B9" })] }), _jsxs("div", { className: "field-grid", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u667A\u80FD\u8865\u5168" }), _jsx(PlaceSearchAutocomplete, { onSelect: (place) => onUpdateSpot(spot.id, {
                                                    name: place.name,
                                                    lat: place.lat,
                                                    lng: place.lng,
                                                }), placeholder: "\u641C\u7D22\u5730\u70B9\u5E76\u5E26\u5165\u540D\u79F0\u4E0E\u5750\u6807..." })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u540D\u79F0" }), _jsx("input", { type: "text", value: spot.name ?? '', onChange: (e) => onUpdateSpot(spot.id, { name: e.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u57CE\u5E02" }), _jsx("input", { type: "text", value: spot.city ?? '', onChange: (e) => onUpdateSpot(spot.id, { city: e.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u533A\u57DF" }), _jsx("input", { type: "text", value: spot.area ?? '', onChange: (e) => onUpdateSpot(spot.id, { area: e.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u65F6\u6BB5" }), _jsx("input", { type: "text", value: spot.timeSlot ?? '', onChange: (e) => onUpdateSpot(spot.id, { timeSlot: e.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u505C\u7559 (\u5206\u949F)" }), _jsx("input", { type: "number", value: spot.stayMinutes ?? '', onChange: (e) => onUpdateSpot(spot.id, {
                                                    stayMinutes: e.target.value === '' ? undefined : Number.parseInt(e.target.value, 10),
                                                }) })] }), _jsxs("label", { className: "field checkbox-field", children: [_jsx("input", { type: "checkbox", checked: !!spot.mustVisit, onChange: (e) => onUpdateSpot(spot.id, { mustVisit: e.target.checked }) }), _jsx("span", { children: "\u6807\u8BB0\u4E3A\u5FC5\u53BB" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7C7B\u578B" }), _jsx("select", { value: spot.type ?? 'spot', onChange: (e) => onUpdateSpot(spot.id, { type: e.target.value }), children: SPOT_TYPE_VALUES.map((t) => (_jsxs("option", { value: t, children: [SPOT_TYPE_META[t].emoji, " ", SPOT_TYPE_META[t].label] }, t))) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u63CF\u8FF0" }), _jsx("textarea", { rows: 3, value: spot.description ?? '', onChange: (e) => onUpdateSpot(spot.id, { description: e.target.value }) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u4E3A\u4EC0\u4E48\u53BB" }), _jsx("textarea", { rows: 2, value: spot.whyGo ?? '', onChange: (e) => onUpdateSpot(spot.id, { whyGo: e.target.value }) })] })] }), _jsxs("details", { className: "planner-advanced-details", children: [_jsx("summary", { children: "\u9AD8\u7EA7 \u00B7 \u5750\u6807 / \u6807\u7B7E / \u8054\u7CFB\u4FE1\u606F / \u7167\u7247" }), _jsxs("div", { className: "field-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7EAC\u5EA6" }), _jsx("input", { type: "number", step: "any", value: spot.lat ?? '', onChange: (e) => onUpdateSpot(spot.id, {
                                                            lat: e.target.value === '' ? undefined : Number.parseFloat(e.target.value),
                                                        }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7ECF\u5EA6" }), _jsx("input", { type: "number", step: "any", value: spot.lng ?? '', onChange: (e) => onUpdateSpot(spot.id, {
                                                            lng: e.target.value === '' ? undefined : Number.parseFloat(e.target.value),
                                                        }) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u6807\u7B7E (\u9017\u53F7\u5206\u9694)" }), _jsx("input", { type: "text", value: spot.tags?.join(', ') ?? '', onChange: (e) => onUpdateSpot(spot.id, { tags: csvToTags(e.target.value) }) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u4EA4\u901A\u5907\u6CE8" }), _jsx("textarea", { rows: 2, value: spot.transportNote ?? '', onChange: (e) => onUpdateSpot(spot.id, { transportNote: e.target.value }) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "Google Maps \u94FE\u63A5" }), _jsx("input", { type: "url", value: spot.googleMapsUri ?? '', onChange: (e) => onUpdateSpot(spot.id, { googleMapsUri: e.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "Place ID" }), _jsx("input", { type: "text", value: spot.googlePlaceId ?? '', onChange: (e) => onUpdateSpot(spot.id, { googlePlaceId: e.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u8BC4\u5206" }), _jsx("input", { type: "number", step: "0.1", value: spot.rating ?? '', onChange: (e) => onUpdateSpot(spot.id, {
                                                            rating: e.target.value === '' ? null : Number.parseFloat(e.target.value),
                                                        }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7F51\u7AD9" }), _jsx("input", { type: "url", value: spot.website ?? '', onChange: (e) => onUpdateSpot(spot.id, { website: e.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7535\u8BDD" }), _jsx("input", { type: "text", value: spot.phone ?? '', onChange: (e) => onUpdateSpot(spot.id, { phone: e.target.value }) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u8425\u4E1A\u65F6\u95F4 (\u6BCF\u884C\u4E00\u6761)" }), _jsx("textarea", { rows: 3, value: spot.openingHours?.join('\n') ?? '', onChange: (e) => onUpdateSpot(spot.id, { openingHours: linesToList(e.target.value) }) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u7167\u7247" }), _jsx(PhotoUploader, { photos: spot.photos || [], onChange: (photos) => onUpdateSpot(spot.id, { photos }) })] })] })] })] })] })] }));
}
