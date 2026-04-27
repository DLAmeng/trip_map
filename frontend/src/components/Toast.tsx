import { useEffect, useRef } from 'react';

export interface ToastProps {
  message: string | null;
  tone?: 'default' | 'error';
  onDismiss: () => void;
  autoDismissMs?: number;
}

/**
 * 轻量 Toast,由父组件通过 `message` 控制:
 *   - 传 string → 显示,并在 `autoDismissMs` 后触发 onDismiss
 *   - 传 null → 不渲染
 * onDismiss 用 ref 缓存,避免父组件每次重渲染都重置定时器。
 */
export function Toast({
  message,
  tone = 'default',
  onDismiss,
  autoDismissMs = 2800,
}: ToastProps) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => onDismissRef.current(), autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [message, autoDismissMs]);

  if (!message) return null;
  const className = tone === 'error' ? 'toast is-error' : 'toast';
  // 状态图标 — error 用 ✕,default 用 ✓,与项目已有 SVG 图标风格一致
  const icon = tone === 'error' ? (
    <svg
      className="toast-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg
      className="toast-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 8.2l3 3 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
  return (
    <div className={className} role="status" aria-live="polite">
      {icon}
      <span className="toast-message">{message}</span>
    </div>
  );
}
