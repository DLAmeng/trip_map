import { Link } from 'react-router-dom';
import type { TripMeta } from '../../types/trip';
import type { TripStats } from '../../selectors/tripSelectors';

interface TripHeaderProps {
  meta: TripMeta;
  stats: TripStats;
  tripId: string;
}

/**
 * 纯展示组件:标题 / 描述 / 3 个统计 pill + back-link / edit-link。
 *
 * 对应原生 index.html 里的 `.site-header`(styles.css L97-257)。
 * 第一版不做 header-actions 的 day select 和 mustOnly(那些在 TripFilters 里),
 * 这里只保留信息 + 导航链接,边界清晰。
 */
export function TripHeader({ meta, stats, tripId }: TripHeaderProps) {
  const title = meta.title?.trim() || '未命名行程';
  const description = meta.description?.trim() || '';

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
        <span className="eyebrow">Trip Map</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>

      <div className="header-stats">
        <div className="stat-pill" aria-label={`${stats.days} 天`}>
          <span>{stats.days}</span>
          <small>天数</small>
        </div>
        <div className="stat-pill" aria-label={`${stats.cities} 座城市`}>
          <span>{stats.cities}</span>
          <small>城市</small>
        </div>
        <div className="stat-pill" aria-label={`${stats.spots} 个景点`}>
          <span>{stats.spots}</span>
          <small>景点</small>
        </div>
      </div>
    </header>
  );
}
