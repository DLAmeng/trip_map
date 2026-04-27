import { Link } from 'react-router-dom';
import type { TripMeta } from '../../types/trip';
import type { FilterState } from '../../selectors/filterState';
import type { TripStats } from '../../selectors/tripSelectors';

interface TripHeaderProps {
  meta: TripMeta;
  tripId: string;
  stats: TripStats;
  dayNumbers: number[];
  cityNames: string[];
  filter: FilterState;
  onDaySelect: (day: number | null) => void;
}

/**
 * Trip 顶部标题栏:
 * - 左侧:breadcrumb + eyebrow (destination · startDate → endDate) + 标题 + 描述
 * - 右侧:天数 / 城市 / 景点 三个统计胶囊 + Day 下拉
 *
 * 统计数据由 Trip 页 selectors 计算,header 只做展示。Day 下拉切换 `filter.day`,
 * 保持 URL 同步,和原版 `#today-btn` 语义一致。
 */
export function TripHeader({
  meta,
  tripId,
  stats,
  dayNumbers,
  cityNames,
  filter,
  onDaySelect,
}: TripHeaderProps) {
  const title = meta.title?.trim() || '未命名行程';
  const description = meta.description?.trim() || '';

  // eyebrow 优先展示 destination + 日期区间;都缺则 fallback 到城市列表,都没有就 "Trip Map"
  const eyebrowSegments: string[] = [];
  if (meta.destination) eyebrowSegments.push(meta.destination);
  if (meta.startDate && meta.endDate) {
    eyebrowSegments.push(`${meta.startDate} → ${meta.endDate}`);
  } else if (meta.startDate) {
    eyebrowSegments.push(meta.startDate);
  }
  const eyebrowText =
    eyebrowSegments.length > 0
      ? eyebrowSegments.join(' · ')
      : cityNames.length > 0
        ? cityNames.join(' → ')
        : 'Trip Map';

  return (
    <header className="site-header">
      <div className="header-copy">
        <nav className="header-breadcrumb" aria-label="导航">
          <Link className="back-link" to="/dashboard">
            ← 全部行程
          </Link>
          <Link className="edit-link" to={`/admin?id=${encodeURIComponent(tripId)}`}>
            编辑
          </Link>
        </nav>
        <span className="eyebrow">{eyebrowText}</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>

      <div className="header-stats-group">
        <div className="header-stats" aria-label="行程摘要">
          <div className="stat-pill">
            <span>{stats.days}</span>
            <small>
              {/* 日历图标:细描边,12px,与 small 文字基线对齐 */}
              <svg
                className="stat-icon"
                viewBox="0 0 14 14"
                width="12"
                height="12"
                fill="none"
                aria-hidden="true"
              >
                <rect x="2" y="3" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2 6h10" stroke="currentColor" strokeWidth="1.2" />
                <path d="M5 2v2M9 2v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              天数
            </small>
          </div>
          <div className="stat-pill">
            <span>{stats.cities}</span>
            <small>
              {/* 建筑/城市图标 */}
              <svg
                className="stat-icon"
                viewBox="0 0 14 14"
                width="12"
                height="12"
                fill="none"
                aria-hidden="true"
              >
                <path d="M2 12V5l3-2 3 2v7" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M8 12V7l3-1.5V12" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M1 12h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              城市
            </small>
          </div>
          <div className="stat-pill">
            <span>{stats.spots}</span>
            <small>
              {/* 地点 pin 图标 */}
              <svg
                className="stat-icon"
                viewBox="0 0 14 14"
                width="12"
                height="12"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M7 13c-2.5-3-4-5-4-7a4 4 0 1 1 8 0c0 2-1.5 4-4 7z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <circle cx="7" cy="6" r="1.4" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              景点
            </small>
          </div>
        </div>

        <div className="header-actions">
          <label className="sr-only" htmlFor="header-day-select">
            选择聚焦天数
          </label>
          <select
            id="header-day-select"
            className={`pill-select${filter.day !== null ? ' active' : ''}`}
            value={filter.day === null ? 'all' : String(filter.day)}
            onChange={(event) => {
              const raw = event.target.value;
              onDaySelect(raw === 'all' ? null : Number(raw));
            }}
          >
            <option value="all">全部天数</option>
            {dayNumbers.map((day) => (
              <option key={day} value={day}>
                第 {day} 天
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
