import type { TripStats } from '../../../selectors/tripSelectors';

interface SummaryBarProps {
  stats: TripStats;
  isFiltered: boolean;
}

export function SummaryBar({ stats, isFiltered }: SummaryBarProps) {
  return (
    <div className="summary-bar tool-panel">
      <div className="summary-pill">
        <span>{stats.spots}</span>
        <small>景点</small>
      </div>
      <div className="summary-pill">
        <span>{stats.days}</span>
        <small>天数</small>
      </div>
      <div className="summary-pill">
        <span>{stats.cities}</span>
        <small>城市</small>
      </div>
      <p className="summary-active">
        {isFiltered ? '当前显示筛选后的路线。' : '当前显示完整路线。'}
      </p>
    </div>
  );
}
