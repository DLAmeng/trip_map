import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { SpotList } from '../SpotList';
export function MobileDrawer({ spotsByDay, dayNumbers, dayColors, filter, selectedSpotId, onSelect, }) {
    const [isOpen, setIsOpen] = useState(false);
    return (_jsxs("div", { className: `mobile-drawer ${isOpen ? 'is-open' : ''}`, children: [_jsx("div", { className: "drawer-handle-wrap", onClick: () => setIsOpen(!isOpen), children: _jsx("div", { className: "drawer-handle" }) }), _jsx("div", { className: "drawer-header", onClick: () => setIsOpen(!isOpen), children: _jsxs("div", { children: [_jsx("p", { className: "drawer-kicker", children: "\u884C\u7A0B\u62BD\u5C49" }), _jsx("p", { className: "drawer-day-label", children: filter.day ? `第 ${filter.day} 天` : '全部天数' })] }) }), _jsx("div", { className: "drawer-content", children: _jsx(SpotList, { spotsByDay: spotsByDay, dayNumbers: dayNumbers, dayColors: dayColors, filter: filter, selectedSpotId: selectedSpotId, onSelect: (id) => {
                        onSelect(id);
                        setIsOpen(false); // 选中后关闭抽屉? 或者保留? 原版通常保留或半收起。这里先简单处理。
                    } }) })] }));
}
