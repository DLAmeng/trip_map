import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function AdminToastStack({ items, onDismiss }) {
    if (!items.length)
        return null;
    return (_jsx("div", { className: "admin-toast-stack", "aria-live": "polite", children: items.map((item) => (_jsxs("div", { className: `admin-toast is-${item.tone}${item.action ? ' has-action' : ''}`, children: [_jsxs("div", { className: "admin-toast-copy", children: [_jsx("strong", { children: item.title }), item.detail ? _jsx("p", { children: item.detail }) : null] }), item.action ? (_jsx("button", { type: "button", className: "admin-toast-action", onClick: () => {
                        item.action.onAction();
                        onDismiss(item.id);
                    }, children: item.action.label })) : null, _jsx("button", { type: "button", className: "admin-toast-dismiss", onClick: () => onDismiss(item.id), children: "\u00D7" })] }, item.id))) }));
}
