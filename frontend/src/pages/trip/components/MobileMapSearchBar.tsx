interface MobileMapSearchBarProps {
  /** 占位文本。保持"地图 App 搜索入口"的语气,而不是表单 input */
  placeholder?: string;
  /** 点击搜索区域的回调(激活搜索面板) */
  onActivate: () => void;
  /** 右侧次要按钮回调(当前作为占位,后续接"更多 / 个人") */
  onMenuClick?: () => void;
  /** 当前是否处于搜索激活态(用于视觉高亮 + aria-pressed) */
  isActive?: boolean;
}

/**
 * 顶部悬浮搜索栏 —— 视觉参考 Google Maps 手机端的顶部搜索入口。
 *
 * 这一版故意**不用 `<input>`**,而是用一个大型按钮 + 占位文字。
 * 理由:
 *   1. 避免点击后唤出移动端键盘影响地图操作
 *   2. 保持"入口→面板"两段式交互:点击后复用现有的 MapSearch 弹层(activeTool='search')
 *   3. 结构稳定:后续接"搜索地点 / 搜索行程 spot / 搜索城市"时,替换 onActivate 的行为即可
 *
 * 层级:
 *   顶部第一层,贴顶安全区,白色圆角胶囊,浮在地图 + 行程卡片之上。
 */
export function MobileMapSearchBar({
  placeholder = '搜索地点 · 景点 · 城市',
  onActivate,
  onMenuClick,
  isActive = false,
}: MobileMapSearchBarProps) {
  return (
    <div
      className={`mobile-map-search-bar${isActive ? ' is-active' : ''}`}
      role="search"
      aria-label="地图搜索"
    >
      <button
        type="button"
        className="mobile-search-trigger"
        onClick={onActivate}
        aria-pressed={isActive}
      >
        <span className="mobile-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M16.5 16.5 21 21"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="mobile-search-placeholder">{placeholder}</span>
      </button>

      {/* 右侧次要按钮:视觉上等同 Google Maps 头像位置,现在是占位 menu */}
      {onMenuClick ? (
        <button
          type="button"
          className="mobile-search-menu"
          onClick={onMenuClick}
          aria-label="更多操作"
          title="更多"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <circle cx="5" cy="12" r="1.6" fill="currentColor" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
            <circle cx="19" cy="12" r="1.6" fill="currentColor" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
