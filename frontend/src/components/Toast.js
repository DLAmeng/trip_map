import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
/**
 * 轻量 Toast,由父组件通过 `message` 控制:
 *   - 传 string → 显示,并在 `autoDismissMs` 后触发 onDismiss
 *   - 传 null → 不渲染
 * onDismiss 用 ref 缓存,避免父组件每次重渲染都重置定时器。
 */
export function Toast({ message, tone = 'default', onDismiss, autoDismissMs = 2800, }) {
    const onDismissRef = useRef(onDismiss);
    useEffect(() => {
        onDismissRef.current = onDismiss;
    });
    useEffect(() => {
        if (!message)
            return;
        const timer = window.setTimeout(() => onDismissRef.current(), autoDismissMs);
        return () => window.clearTimeout(timer);
    }, [message, autoDismissMs]);
    if (!message)
        return null;
    const className = tone === 'error' ? 'toast is-error' : 'toast';
    return (_jsx("div", { className: className, role: "status", "aria-live": "polite", children: message }));
}
