import { Link } from 'react-router-dom';
import type { TripListItem } from '../../types/trip';
import {
  formatDestination,
  formatDurationChip,
  formatUpdatedAt,
} from '../../utils/format';

export interface TripCardProps {
  trip: TripListItem;
  onDuplicate: (trip: TripListItem) => void;
  onDelete: (trip: TripListItem) => void;
  duplicating?: boolean;
  deleting?: boolean;
}

/**
 * 单张行程卡片。保持与原生版 renderTripCard 相同的 class 结构,样式直接复用
 * pages/dashboard/dashboard.css。"打开地图" / "编辑" 用 <Link>,让 React
 * Router 接管跳转 —— 进入 Phase 2 占位的 /trip / /admin,显式暴露还没迁的页面。
 */
export function TripCard({ trip, onDuplicate, onDelete, duplicating, deleting }: TripCardProps) {
  const isCurrent = trip.id === 'current';
  const spotCount = Number(trip.summary?.spotCount ?? 0);
  const routeCount = Number(trip.summary?.routeSegmentCount ?? 0);
  const isEmpty = spotCount === 0;
  const description = (trip.meta?.description || '').trim();
  const destination = formatDestination(trip);
  const updatedLabel = formatUpdatedAt(trip);
  const durationLabel = formatDurationChip(trip);

  const classes = ['trip-card'];
  if (isCurrent) classes.push('is-current');
  if (isEmpty) classes.push('is-empty');

  return (
    <article className={classes.join(' ')} data-id={trip.id}>
      <header className="trip-card-head">
        <div className="trip-card-title">
          <h2>{trip.name || '未命名行程'}</h2>
          {destination ? <p className="trip-destination">📍 {destination}</p> : null}
        </div>
        {isCurrent ? <span className="trip-badge trip-badge-current">默认</span> : null}
      </header>
      {description ? (
        <p className="trip-description">{description}</p>
      ) : (
        <p className="trip-description trip-description-placeholder">还没有描述</p>
      )}
      <div className="trip-stats">
        <span className="stat-chip">
          <strong>{spotCount}</strong> 景点
        </span>
        <span className="stat-chip">
          <strong>{routeCount}</strong> 路线
        </span>
        <span className="stat-chip">{durationLabel}</span>
      </div>
      <div className="trip-meta-line">{updatedLabel}</div>
      <div className="trip-actions">
        <div className="trip-actions-main">
          <Link className="open-btn" to={`/trip?id=${encodeURIComponent(trip.id)}`}>
            打开地图
          </Link>
          <Link className="edit-btn" to={`/admin?id=${encodeURIComponent(trip.id)}`}>
            编辑
          </Link>
        </div>
        <div className="trip-actions-side">
          <button
            type="button"
            className="duplicate-btn"
            aria-label="复制行程"
            title="复制此行程"
            disabled={duplicating}
            onClick={() => onDuplicate(trip)}
          >
            {duplicating ? '...' : '⎘'}
          </button>
          {isCurrent ? null : (
            <button
              type="button"
              className="delete-btn"
              aria-label="删除行程"
              disabled={deleting}
              onClick={() => onDelete(trip)}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
