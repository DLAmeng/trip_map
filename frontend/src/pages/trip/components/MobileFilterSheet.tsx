import type { FilterState } from '../../../selectors/filterState';

interface MobileFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  dayNumbers: number[];
  /** 每个 day 对应的 marker 颜色,用来给 day filter 按钮做强视觉提示 */
  dayColors?: string[];
  cityNames: string[];
  filter: FilterState;
  onChange: (filter: FilterState) => void;
}

export function MobileFilterSheet({
  isOpen,
  onClose,
  dayNumbers,
  dayColors,
  cityNames,
  filter,
  onChange,
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
