import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { parsePathInput } from '../../../utils/trip-normalize';
import { RouteDetailContent } from '../../trip/components/RouteDetailContent';
import { BatchImportPanel } from './BatchImportPanel';
import { PhotoUploader } from './PhotoUploader';
import { PlaceSearchAutocomplete } from './PlaceSearchAutocomplete';
import { TripMetaForm } from './TripMetaForm';
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
export function PlannerInspector({ meta, spots, selectedSpot, selectedSegment, spotById, onUpdateMeta, onUpdateSpot, onDeleteSpot, onUpdateLeg, onResetLeg, onDeleteDetachedSegment, onFocusSpot, onAddImportedSpots, }) {
    const [pathOverrideText, setPathOverrideText] = useState('');
    const [pathError, setPathError] = useState(null);
    useEffect(() => {
        if (!selectedSegment) {
            setPathOverrideText('');
            setPathError(null);
            return;
        }
        setPathOverrideText(JSON.stringify(selectedSegment.path || [], null, 2));
        setPathError(null);
    }, [selectedSegment]);
    const segmentEndpoints = useMemo(() => {
        if (!selectedSegment)
            return null;
        return {
            from: spotById.get(selectedSegment.fromSpotId) || null,
            to: spotById.get(selectedSegment.toSpotId) || null,
        };
    }, [selectedSegment, spotById]);
    const applyPathOverride = () => {
        if (!selectedSegment)
            return;
        try {
            const pathOverride = parsePathInput(pathOverrideText);
            onUpdateLeg(selectedSegment.key, { pathOverride });
            setPathError(null);
        }
        catch (error) {
            setPathError(error instanceof Error ? error.message : String(error));
        }
    };
    return (_jsxs("aside", { className: "planner-inspector", children: [_jsxs("section", { className: "panel planner-inspector-panel", children: [_jsx("div", { className: "panel-head", children: _jsxs("div", { children: [_jsx("p", { className: "panel-kicker", children: "Inspector" }), _jsx("h2", { children: selectedSpot ? '景点详情' : selectedSegment ? '路线设置' : '当前未选中对象' })] }) }), selectedSpot ? (_jsxs("div", { className: "planner-inspector-body", children: [_jsxs("div", { className: "planner-inspector-summary", children: [_jsxs("div", { children: [_jsx("strong", { children: selectedSpot.name || '未命名景点' }), _jsxs("p", { children: ["Day ", selectedSpot.day, " \u00B7 \u987A\u5E8F ", selectedSpot.order, " \u00B7 ", selectedSpot.city || '待补城市'] })] }), _jsxs("div", { className: "planner-inspector-actions", children: [selectedSpot.googleMapsUri ? (_jsx("a", { className: "btn btn-ghost", href: selectedSpot.googleMapsUri, target: "_blank", rel: "noreferrer", children: "Google Maps" })) : null, _jsx("button", { type: "button", className: "btn btn-ghost btn-danger", onClick: () => onDeleteSpot(selectedSpot.id), children: "\u5220\u9664\u666F\u70B9" })] })] }), _jsxs("div", { className: "field-grid", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u667A\u80FD\u8865\u5168" }), _jsx(PlaceSearchAutocomplete, { onSelect: (place) => {
                                                    onUpdateSpot(selectedSpot.id, {
                                                        name: place.name,
                                                        lat: place.lat,
                                                        lng: place.lng,
                                                    });
                                                }, placeholder: "\u641C\u7D22\u5730\u70B9\u5E76\u5E26\u5165\u540D\u79F0\u4E0E\u5750\u6807..." })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u540D\u79F0" }), _jsx("input", { type: "text", value: selectedSpot.name ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, { name: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u57CE\u5E02" }), _jsx("input", { type: "text", value: selectedSpot.city ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, { city: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u533A\u57DF" }), _jsx("input", { type: "text", value: selectedSpot.area ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, { area: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u65F6\u6BB5" }), _jsx("input", { type: "text", value: selectedSpot.timeSlot ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, { timeSlot: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u505C\u7559\u65F6\u957F (\u5206\u949F)" }), _jsx("input", { type: "number", value: selectedSpot.stayMinutes ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, {
                                                    stayMinutes: event.target.value === '' ? undefined : Number.parseInt(event.target.value, 10),
                                                }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7EAC\u5EA6" }), _jsx("input", { type: "number", step: "any", value: selectedSpot.lat ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, {
                                                    lat: event.target.value === '' ? undefined : Number.parseFloat(event.target.value),
                                                }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7ECF\u5EA6" }), _jsx("input", { type: "number", step: "any", value: selectedSpot.lng ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, {
                                                    lng: event.target.value === '' ? undefined : Number.parseFloat(event.target.value),
                                                }) })] }), _jsxs("label", { className: "field checkbox-field", children: [_jsx("input", { type: "checkbox", checked: !!selectedSpot.mustVisit, onChange: (event) => onUpdateSpot(selectedSpot.id, { mustVisit: event.target.checked }) }), _jsx("span", { children: "\u6807\u8BB0\u4E3A\u5FC5\u53BB" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7C7B\u578B" }), _jsxs("select", { value: selectedSpot.type ?? 'spot', onChange: (event) => onUpdateSpot(selectedSpot.id, {
                                                    type: event.target.value,
                                                }), children: [_jsx("option", { value: "spot", children: "\u666F\u70B9 / \u505C\u7559\u70B9" }), _jsx("option", { value: "transport", children: "\u4EA4\u901A\u8282\u70B9" })] })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u63CF\u8FF0" }), _jsx("textarea", { rows: 4, value: selectedSpot.description ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, { description: event.target.value }) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u4E3A\u4EC0\u4E48\u53BB" }), _jsx("textarea", { rows: 3, value: selectedSpot.whyGo ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, { whyGo: event.target.value }) })] })] }), _jsxs("details", { className: "planner-advanced-details", children: [_jsx("summary", { children: "\u4F4E\u9891\u5B57\u6BB5\u4E0E\u5916\u94FE" }), _jsxs("div", { className: "field-grid", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u6807\u7B7E (\u9017\u53F7\u5206\u9694)" }), _jsx("input", { type: "text", value: selectedSpot.tags?.join(', ') ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, { tags: csvToTags(event.target.value) }) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u4EA4\u901A\u5907\u6CE8" }), _jsx("textarea", { rows: 3, value: selectedSpot.transportNote ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, { transportNote: event.target.value }) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "Google Maps \u94FE\u63A5" }), _jsx("input", { type: "url", value: selectedSpot.googleMapsUri ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, { googleMapsUri: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "Google Place ID" }), _jsx("input", { type: "text", value: selectedSpot.googlePlaceId ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, { googlePlaceId: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u8BC4\u5206" }), _jsx("input", { type: "number", step: "0.1", value: selectedSpot.rating ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, {
                                                            rating: event.target.value === '' ? null : Number.parseFloat(event.target.value),
                                                        }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7F51\u7AD9" }), _jsx("input", { type: "url", value: selectedSpot.website ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, { website: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7535\u8BDD" }), _jsx("input", { type: "text", value: selectedSpot.phone ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, { phone: event.target.value }) })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u8425\u4E1A\u65F6\u95F4 (\u6BCF\u884C\u4E00\u6761)" }), _jsx("textarea", { rows: 4, value: selectedSpot.openingHours?.join('\n') ?? '', onChange: (event) => onUpdateSpot(selectedSpot.id, {
                                                            openingHours: linesToList(event.target.value),
                                                        }) })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u7167\u7247" }), _jsx(PhotoUploader, { photos: selectedSpot.photos || [], onChange: (photos) => onUpdateSpot(selectedSpot.id, { photos }) })] })] })] })) : null, !selectedSpot && selectedSegment ? (_jsxs("div", { className: "planner-inspector-body", children: [_jsxs("div", { className: "planner-inspector-summary", children: [_jsxs("div", { children: [_jsx("strong", { children: selectedSegment.label || '未命名路线段' }), _jsxs("p", { children: ["Day ", selectedSegment.day, selectedSegment.detached ? ' · 兼容保留段' : ' · 自动生成段'] })] }), _jsx("div", { className: "planner-inspector-actions", children: selectedSegment.detached ? (_jsx("button", { type: "button", className: "btn btn-ghost btn-danger", onClick: () => onDeleteDetachedSegment(selectedSegment.id), children: "\u5220\u9664\u517C\u5BB9\u6BB5" })) : (_jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => onResetLeg(selectedSegment.key), children: "\u6062\u590D\u81EA\u52A8\u8DEF\u7EBF" })) })] }), _jsxs("div", { className: "planner-leg-endpoints", children: [_jsxs("button", { type: "button", className: "planner-endpoint-chip", onClick: () => segmentEndpoints?.from && onFocusSpot(segmentEndpoints.from.id), children: ["\u8D77\u70B9: ", segmentEndpoints?.from?.name || selectedSegment.fromSpotId] }), _jsxs("button", { type: "button", className: "planner-endpoint-chip", onClick: () => segmentEndpoints?.to && onFocusSpot(segmentEndpoints.to.id), children: ["\u7EC8\u70B9: ", segmentEndpoints?.to?.name || selectedSegment.toSpotId] })] }), _jsxs("div", { className: "field-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { children: "\u4EA4\u901A\u65B9\u5F0F" }), _jsx("select", { value: selectedSegment.transportType || 'walk', onChange: (event) => onUpdateLeg(selectedSegment.key, { transportType: event.target.value }), children: TRANSPORT_OPTIONS.map((item) => (_jsx("option", { value: item, children: item }, item))) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u8303\u56F4" }), _jsxs("select", { value: selectedSegment.scope, onChange: (event) => onUpdateLeg(selectedSegment.key, {
                                                    scope: event.target.value,
                                                }), children: [_jsx("option", { value: "city", children: "\u5E02\u5185" }), _jsx("option", { value: "intercity", children: "\u8DE8\u57CE" })] })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u8DEF\u7EBF\u6807\u9898" }), _jsx("input", { type: "text", value: selectedSegment.label ?? '', onChange: (event) => onUpdateLeg(selectedSegment.key, { label: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "\u9884\u8BA1\u65F6\u957F" }), _jsx("input", { type: "text", value: selectedSegment.duration ?? '', onChange: (event) => onUpdateLeg(selectedSegment.key, { duration: event.target.value }), placeholder: "\u4F8B\u5982 35 \u5206\u949F / 2h 10m" })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "\u5907\u6CE8" }), _jsx("textarea", { rows: 4, value: selectedSegment.note ?? '', onChange: (event) => onUpdateLeg(selectedSegment.key, { note: event.target.value }) })] })] }), _jsx("div", { className: "planner-route-runtime", children: _jsx(RouteDetailContent, { segment: selectedSegment }) }), _jsxs("details", { className: "planner-advanced-details", children: [_jsx("summary", { children: "\u9AD8\u7EA7\u8DEF\u5F84\u8986\u76D6" }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "path override JSON" }), _jsx("textarea", { rows: 8, value: pathOverrideText, onChange: (event) => setPathOverrideText(event.target.value), spellCheck: false }), pathError ? _jsx("p", { className: "planner-field-error", children: pathError }) : null] }), _jsxs("div", { className: "planner-inline-actions", children: [_jsx("button", { type: "button", className: "btn btn-ghost", onClick: applyPathOverride, children: "\u5E94\u7528\u8DEF\u5F84\u8986\u76D6" }), !selectedSegment.detached ? (_jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => onResetLeg(selectedSegment.key), children: "\u6E05\u9664\u8986\u76D6\u5E76\u6062\u590D\u81EA\u52A8\u751F\u6210" })) : null] })] })] })) : null, !selectedSpot && !selectedSegment ? (_jsxs("div", { className: "planner-empty-inspector", children: [_jsx("strong", { children: "\u4ECE\u5DE6\u4FA7\u6216\u5730\u56FE\u4E0A\u9009\u4E00\u4E2A\u666F\u70B9 / \u8DEF\u7EBF" }), _jsx("p", { children: "\u666F\u70B9\u987A\u5E8F\u51B3\u5B9A\u81EA\u52A8\u8DEF\u7EBF\uFF0C\u53F3\u4FA7\u53EA\u8D1F\u8D23\u8C03\u6574\u5F53\u524D\u5BF9\u8C61\u7684\u7EC6\u8282\u3002" })] })) : null] }), _jsxs("details", { className: "panel planner-side-panel", open: !selectedSpot && !selectedSegment, children: [_jsx("summary", { className: "planner-side-summary", children: "\u884C\u7A0B\u57FA\u7840\u4FE1\u606F" }), _jsx(TripMetaForm, { meta: meta, onChange: onUpdateMeta })] }), _jsxs("details", { className: "panel planner-side-panel", children: [_jsx("summary", { className: "planner-side-summary", children: "\u6279\u91CF\u5BFC\u5165 GPX / KML / Google Maps" }), _jsx(BatchImportPanel, { spots: spots, onAddSpots: onAddImportedSpots })] })] }));
}
