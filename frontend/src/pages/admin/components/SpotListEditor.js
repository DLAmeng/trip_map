import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { SpotEditorCard } from './SpotEditorCard';
export function SpotListEditor({ spots, onUpdateSpot, onDeleteSpot, onAddSpot }) {
    const handleAdd = () => {
        const lastSpot = spots[spots.length - 1];
        const newSpot = {
            id: `spot-${Date.now()}`,
            day: lastSpot ? lastSpot.day : 1,
            order: lastSpot ? lastSpot.order + 1 : 1,
            name: '新景点',
            city: lastSpot ? lastSpot.city : '',
            area: '',
            lat: lastSpot ? lastSpot.lat + 0.001 : 35.6895,
            lng: lastSpot ? lastSpot.lng + 0.001 : 139.6917,
            mustVisit: false,
            type: 'spot',
        };
        onAddSpot(newSpot);
    };
    return (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "panel-head", children: [_jsxs("h2", { children: ["\u666F\u70B9\u5217\u8868 (", spots.length, ")"] }), _jsx("button", { className: "btn btn-primary", onClick: handleAdd, children: "+ \u65B0\u589E\u666F\u70B9" })] }), _jsxs("div", { className: "card-list", children: [spots.map((spot) => (_jsx(SpotEditorCard, { spot: spot, onUpdate: (payload) => onUpdateSpot(spot.id, payload), onDelete: () => onDeleteSpot(spot.id) }, spot.id))), spots.length === 0 && (_jsx("div", { className: "empty-state", children: "\u8FD8\u6CA1\u6709\u666F\u70B9\uFF0C\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u6DFB\u52A0\u3002" }))] })] }));
}
