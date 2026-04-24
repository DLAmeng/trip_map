import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function AdminToastStack({ items, onDismiss }) {
    if (!items.length)
        return null;
    return (_jsx("div", { className: "admin-toast-stack", "aria-live": "polite", children: items.map((item) => (_jsxs("div", { className: `admin-toast is-${item.tone}`, children: [_jsxs("div", { className: "admin-toast-copy", children: [_jsx("strong", { children: item.title }), item.detail ? _jsx("p", { children: item.detail }) : null] }), _jsx("button", { type: "button", className: "admin-toast-dismiss", onClick: () => onDismiss(item.id), children: "\u00D7" })] }, item.id))) }));
}
