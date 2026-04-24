export type MobileTripMode = 'summary' | 'list' | 'filter';

interface MobileTripBottomSwitcherProps {
  activeMode: MobileTripMode | null;
  onSelectSummary: () => void;
  onSelectList: () => void;
  onSelectFilter: () => void;
  /** 过滤器当前是否处于激活状态(非全量),用来显示小红点 */
  hasActiveFilter?: boolean;
}

/**
 * 手机端底部胶囊切换栏(Google Maps bottom pill 风格):
 * - 浮在底部安全区之上,position fixed + safe-area-inset-bottom
 * - 水平居中,白色半透明背景 + blur,大圆角
 * - 3 个选项:概况 / 列表 / 筛选
 * - 选中项背景变深色胶囊,标签加粗
 * - 每个按钮至少 48px 高,点击区域大
 *
 * 交互语义保留现有:
 *   - 概况 → 打开"行程概况"modal
 *   - 列表 → 展开底部 SpotList bottom sheet
 *   - 筛选 → 打开 MobileFilterSheet
 * 组件只管 UI + 回调,状态由 TripPage 统一托管。
 */
export function MobileTripBottomSwitcher({
  activeMode,
  onSelectSummary,
  onSelectList,
  onSelectFilter,
  hasActiveFilter = false,
}: MobileTripBottomSwitcherProps) {
  return (
    <nav className="mobile-trip-bottom-switcher" aria-label="行程视图切换">
      <button
        type="button"
        className={`mobile-switcher-btn${activeMode === 'summary' ? ' is-active' : ''}`}
        onClick={onSelectSummary}
        aria-pressed={activeMode === 'summary'}
      >
        <span className="mobile-switcher-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none">
            <rect x="3" y="4" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
            <rect x="11" y="4" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
            <rect x="3" y="12" width="14" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
        <span className="mobile-switcher-label">概况</span>
      </button>

      <button
        type="button"
        className={`mobile-switcher-btn${activeMode === 'list' ? ' is-active' : ''}`}
        onClick={onSelectList}
        aria-pressed={activeMode === 'list'}
      >
        <span className="mobile-switcher-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none">
            <rect x="3" y="4" width="14" height="2.4" rx="1.2" fill="currentColor" />
            <rect x="3" y="8.8" width="14" height="2.4" rx="1.2" fill="currentColor" />
            <rect x="3" y="13.6" width="14" height="2.4" rx="1.2" fill="currentColor" />
          </svg>
        </span>
        <span className="mobile-switcher-label">列表</span>
      </button>

      <button
        type="button"
        className={`mobile-switcher-btn${activeMode === 'filter' ? ' is-active' : ''}`}
        onClick={onSelectFilter}
        aria-pressed={activeMode === 'filter'}
      >
        <span className="mobile-switcher-icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none">
            <path
              d="M3 5h14M6 10h8M9 15h2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          {hasActiveFilter ? <span className="mobile-switcher-dot" aria-hidden="true" /> : null}
        </span>
        <span className="mobile-switcher-label">筛选</span>
      </button>
    </nav>
  );
}
