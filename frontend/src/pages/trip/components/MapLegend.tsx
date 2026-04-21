import { useState } from 'react';
import './MapLegend.css';

interface LegendItem {
  type: string;
  label: string;
  color: string;
  dash?: string;
}

interface MapLegendProps {
  dayColors: string[];
  isRouteBroken?: boolean;
  /** 当前地图是否为 Google Maps(为了只在 Google 引擎下显示 Google 官方的步行警告) */
  isGoogleMap?: boolean;
  /** 当前行程里是否存在 walk 类型的 segment */
  hasWalkSegment?: boolean;
}

const GOOGLE_WALK_WARNING =
  'Google 官方提醒：步行路线可能缺少部分人行道 / 步道信息,请现场留意。';

const LEGEND_ITEMS: LegendItem[] = [
  { type: 'walk', label: '步行', color: '#38bdf8', dash: '4, 4' },
  { type: 'subway', label: '地铁 / 电车', color: '#f97316' },
  { type: 'bus', label: '巴士', color: '#10b981', dash: '2, 2' },
  { type: 'shinkansen', label: '新干线', color: '#dc2626' },
  { type: 'train', label: 'JR / 私铁', color: '#7c3aed' },
  { type: 'drive', label: '自驾', color: '#475569' },
];

export function MapLegend({
  dayColors,
  isRouteBroken,
  isGoogleMap,
  hasWalkSegment,
}: MapLegendProps) {
  // 默认移动端折叠，桌面端展开 (1024px 为断点)
  const [isCollapsed, setIsCollapsed] = useState(() => window.innerWidth <= 1024);

  return (
    <div
      className={`map-legend tool-panel ${isCollapsed ? 'is-collapsed' : ''}`}
      style={{
        width: isCollapsed ? '44px' : '180px',
      }}
    >
      <div className="legend-header">
        <span className="legend-title">路线图例</span>
        <button
          className="legend-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? '显示图例' : '隐藏图例'}
        >
          {isCollapsed ? '+' : '−'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="legend-body">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.type} className="legend-row">
              <div className="legend-line-wrap">
                <svg width="24" height="4" className="legend-svg">
                  <line
                    x1="0"
                    y1="2"
                    x2="24"
                    y2="2"
                    stroke={item.color}
                    strokeWidth="3"
                    strokeDasharray={item.dash}
                    className={item.dash ? 'animated-dash' : ''}
                  />
                </svg>
              </div>
              <span className="legend-label">{item.label}</span>
            </div>
          ))}

          {isRouteBroken && (
            <p className="legend-note">
              部分路线已隐藏，可能存在跨天连线。
            </p>
          )}
          {isGoogleMap && hasWalkSegment ? (
            <p className="legend-note legend-note-warning">
              {GOOGLE_WALK_WARNING}
            </p>
          ) : null}

          <p className="legend-title legend-title-spaced">每日配色</p>
          <div className="legend-dots">
            {dayColors.map((color, i) => (
              <span
                key={i}
                className="legend-dot"
                style={{ backgroundColor: color }}
                title={`第 ${i + 1} 天`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
