import { useState } from 'react';
import './MapLegend.css';

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

// P30: 之前按 transportType 显示颜色图例(步行蓝/地铁橙/新干线红...),
// 现在路线按 day 着色,transport 颜色图例不再准确,改为「每日配色」为主、
// transport 文字提示放在 popup / RouteDetailSheet 里。
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
          {isCollapsed ? (
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
              <path
                d="M3 5.5h5.5M11.5 5.5H17M5 10h10M3 14.5h4.5M10 14.5H17"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          ) : '−'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="legend-body">
          {/* P30: 每日配色为主,路线 + 景点都按这套色 */}
          <p className="legend-hint">
            颜色按天数区分。点路线 / 景点查看交通方式 + 详情。
          </p>
          <div className="legend-dots">
            {dayColors.map((color, i) => (
              <span
                key={i}
                className="legend-dot legend-dot-labeled"
                style={{ backgroundColor: color }}
                title={`第 ${i + 1} 天`}
                aria-label={`第 ${i + 1} 天`}
              >
                <span className="legend-dot-num">{i + 1}</span>
              </span>
            ))}
          </div>

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
        </div>
      )}
    </div>
  );
}
