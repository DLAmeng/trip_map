interface LoadingScreenProps {
  title?: string;
  message?: string;
  eyebrow?: string;
}

/**
 * 对齐旧版 `.loading-screen`:全屏居中的玻璃卡片,
 * 展示 eyebrow + 主标题 + 描述文案。用于 TripPage 首屏加载。
 */
export function LoadingScreen({
  title = '正在生成行程地图...',
  message = '正在载入点位、路线和界面...',
  eyebrow = '正在整理路线',
}: LoadingScreenProps) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-card">
        <span className="loading-eyebrow">{eyebrow}</span>
        <strong className="loading-title">{title}</strong>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
}
