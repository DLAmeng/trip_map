import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { RouteDetailContent } from './RouteDetailContent';
export function MobileRouteDetailSheet({ isOpen, segment, onClose, }) {
    if (!isOpen || !segment)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "sheet-backdrop", onClick: onClose }), _jsxs("div", { className: "mobile-route-detail-sheet", children: [_jsx("div", { className: "modal-header", children: _jsx("h3", { children: "\u8DEF\u7EBF\u8BF4\u660E" }) }), _jsxs("div", { className: "modal-body", children: [_jsx(RouteDetailContent, { segment: segment }), _jsx("button", { type: "button", className: "btn-primary route-detail-close-btn", onClick: onClose, children: "\u5B8C\u6210" })] })] })] }));
}
