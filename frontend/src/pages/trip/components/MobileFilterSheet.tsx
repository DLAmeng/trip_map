import type { FilterState } from '../../../selectors/filterState';
import {
  SPOT_TYPE_VALUES,
  SPOT_TYPE_META,
  type SpotType,
} from '../../../constants/spot-types';

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  dayNumbers: number[];
  /** 每个 day 对应的 marker 颜色,用来给 day filter 按钮做强视觉提示 */
  dayColors?: string[];
  cityNames: string[];
  filter: FilterState;
  onChange: (filter: FilterState) => void;
  /** P26: 当前显示的 spot 类型数组(null=显示全部 6 类) */
  spotTypes?: SpotType[] | null;
  /** P26: 每类 entry 数,给 chip 显示在 label 上,disabled 0 个的类 */
  typeBreakdown?: Record<SpotType, number>;
  /** P26: 切换某 type 的显示/隐藏 */
  onToggleSpotType?: (type: SpotType) => void;
}

export function MobileFilterSheet({
  isOpen,
  onClose,
  dayNumbers,
  dayColors,
  cityNames,
  filter,
  onChange,
  spotTypes = null,
  typeBreakdown,
  onToggleSpotType,
}: MobileFilterSheetProps) {
  return (
    <>
      {isOpen && <div className="sheet-backdrop" onClick={onClose} />}
      <div className={`mobile-filter-sheet ${isOpen ? 'is-open' : ''}`}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="modal-header">
          <h3>快速筛选</h3>
        </div>
        <div className="modal-body">
          <div className="sheet-section">
            <div className="sheet-section-title">天数</div>
            <div className="chip-row">
              <button
                className={`filter-btn ${filter.day === null ? 'active' : ''}`}
                onClick={() => onChange({ ...filter, day: null })}
              >
                全部
              </button>
              {dayNumbers.map((d) => {
                const color = dayColors?.[d - 1];
                const isActive = filter.day === d;
                // active 时用 day color 填充 + 白字,跟地图 marker / day-chip 视觉一致
                const style = isActive && color
                  ? {
                      background: color,
                      borderColor: color,
                      color: '#fff',
                    }
                  : undefined;
                return (
                  <button
                    key={d}
                    className={`filter-btn ${isActive ? 'active' : ''}`}
                    onClick={() => onChange({ ...filter, day: d })}
                    style={style}
                  >
                    Day {d}
                  </button>
                );
              })}
            </div>
          </div>

          {cityNames.length > 0 ? (
            <div className="sheet-section">
              <div className="sheet-section-title">城市</div>
              <div className="chip-row">
                <button
                  className={`filter-btn ${filter.city === null ? 'active' : ''}`}
                  onClick={() => onChange({ ...filter, city: null })}
                >
                  全部
                </button>
                {cityNames.map((c) => (
                  <button
                    key={c}
                    className={`filter-btn ${filter.city === c ? 'active' : ''}`}
                    onClick={() => onChange({ ...filter, city: c })}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* P26: 分类 chip 多选(替代 P25 的 showLogistics 总开关)
              P29: 移除 disabled={count===0} — 空数量的类也允许点击,语义是
              "我不想看这类",即使当前数据没这类,关掉它表示「以后有也不显示」 */}
          {onToggleSpotType ? (
            <div className="sheet-section">
              <div className="sheet-section-title">分类</div>
              <div className="chip-row">
                {SPOT_TYPE_VALUES.map((t) => {
                  // null 状态等价于全部选中
                  const isActive = !spotTypes || spotTypes.includes(t);
                  const count = typeBreakdown?.[t] ?? 0;
                  const isEmpty = count === 0;
                  return (
                    <button
                      key={t}
                      className={`filter-btn ${isActive ? 'active' : ''} ${isEmpty ? 'is-empty' : ''}`}
                      onClick={() => onToggleSpotType(t)}
                      title={
                        isEmpty
                          ? `${SPOT_TYPE_META[t].label}(此行程暂无,但可设为偏好)`
                          : `${isActive ? '点击隐藏' : '点击显示'} ${count} 个${SPOT_TYPE_META[t].label}`
                      }
                    >
                      <span aria-hidden="true">{SPOT_TYPE_META[t].emoji}</span>
                      <span>{SPOT_TYPE_META[t].label}</span>
                      <span style={{ opacity: 0.7 }}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="sheet-section">
            <div className="filter-toggle-row">
              <button
                className={`toggle-btn ${filter.mustOnly ? 'active' : ''}`}
                onClick={() => onChange({ ...filter, mustOnly: !filter.mustOnly })}
              >
                只看必去
              </button>
              <button
                className={`toggle-btn ${filter.nextOnly ? 'active' : ''}`}
                onClick={() => onChange({ ...filter, nextOnly: !filter.nextOnly })}
              >
                只看下一段
              </button>
            </div>
          </div>

          <button
            id="close-filter-sheet"
            className="btn-primary"
            onClick={onClose}
            style={{
              width: '100%',
              marginTop: '24px',
              minHeight: '52px',
              borderRadius: '16px',
              border: 'none',
              background: 'var(--ocean)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '1rem',
              boxShadow: '0 4px 12px var(--ocean-soft)',
            }}
          >
            完成
          </button>
        </div>
      </div>
    </>
  );
}
