import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { SegmentEditorCard } from './SegmentEditorCard';
export function SegmentListEditor({ segments, spots, onUpdateSegment, onDeleteSegment, onAddSegment }) {
    const handleAdd = () => {
        const lastSeg = segments[segments.length - 1];
        const newSeg = {
            id: `seg-${Date.now()}`,
            day: lastSeg ? lastSeg.day : 1,
            transportType: 'walk',
            fromSpotId: '',
            toSpotId: '',
            scope: 'city',
        };
        onAddSegment(newSeg);
    };
    return (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "panel-head", children: [_jsxs("h2", { children: ["\u8DEF\u7EBF\u6BB5\u7BA1\u7406 (", segments.length, ")"] }), _jsx("button", { className: "btn btn-primary", onClick: handleAdd, children: "+ \u65B0\u589E\u8DEF\u7EBF\u6BB5" })] }), _jsxs("div", { className: "card-list", children: [segments.map((seg) => (_jsx(SegmentEditorCard, { segment: seg, spots: spots, onUpdate: (payload) => onUpdateSegment(seg.id, payload), onDelete: () => onDeleteSegment(seg.id) }, seg.id))), segments.length === 0 && (_jsx("div", { className: "empty-state", children: "\u8FD8\u6CA1\u6709\u8DEF\u7EBF\u6BB5\u3002" }))] })] }));
}
