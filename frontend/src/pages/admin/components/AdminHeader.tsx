import type { TripMeta } from '../../../types/trip';
import { Link } from 'react-router-dom';

interface AdminHeaderProps {
  title: string;
  tripId: string;
  meta: TripMeta;
  isDefaultTrip: boolean;
  stats: {
    days: number;
    spots: number;
    segments: number;
  };
}

function buildHeaderCopy(meta: TripMeta): string {
  const hints: string[] = [];
  if (meta.destination) hints.push(meta.destination);
  if (meta.startDate && meta.endDate) hints.push(`${meta.startDate} → ${meta.endDate}`);
  else if (meta.startDate) hints.push(meta.startDate);
  return hints.join(' · ') || meta.description || '直接改标题、景点、路线和顺序，保存后前端地图会自动读取最新行程。';
}

export function AdminHeader({ title, tripId, meta, isDefaultTrip, stats }: AdminHeaderProps) {
  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">
            <Link className="admin-back" to="/dashboard">← 全部行程</Link>
            <span className="admin-eyebrow-divider">·</span>
            <span className="admin-trip-badge">{isDefaultTrip ? '默认行程' : '行程编辑'}</span>
          </p>
          <h1 className="admin-header-title">{title || '未命名行程'}</h1>
          <p className="admin-header-desc">
            {buildHeaderCopy(meta)}
          </p>
        </div>
        <div className="header-actions">
          <Link
            to={`/trip?id=${encodeURIComponent(tripId)}`}
            target="_blank"
            className="btn btn-ghost"
          >
            打开前台地图
          </Link>
        </div>
      </header>

      <section className="topbar">
        <div className="summary-grid">
          <div className="summary-card">
            <span>{stats.days}</span>
            <small>天数</small>
          </div>
          <div className="summary-card">
            <span>{stats.spots}</span>
            <small>景点</small>
          </div>
          <div className="summary-card">
            <span>{stats.segments}</span>
            <small>路线</small>
          </div>
        </div>
      </section>
    </>
  );
}
