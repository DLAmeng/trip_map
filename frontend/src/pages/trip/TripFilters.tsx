import type { FilterState } from '../../selectors/filterState';

interface TripFiltersProps {
  dayNumbers: number[];
  filter: FilterState;
  onChange: (next: FilterState) => void;
}

/**
 * Trip 页第一版过滤面板:day 下拉 + "只看必去" 切换。
 *
 * 对应原生 app.js + index.html 里的 header-actions 和 mobile-filter-sheet 的子集。
 * 保持 receipt-neutral 的 props 签名:所有状态走 FilterState,onChange 整体替换,
 * 避免内部状态漂移(和 Dashboard 用的 setState 一致)。
 *
 * city / nextOnly / legend 第一版不做(plan 非目标)。
 */
export function TripFilters({ dayNumbers, filter, onChange }: TripFiltersProps) {
  const handleDayChange = (raw: string) => {
    const next = raw === '' ? null : Number.parseInt(raw, 10);
    onChange({
      ...filter,
      day: Number.isFinite(next) ? next : null,
    });
  };

  const toggleMustOnly = () => {
    onChange({ ...filter, mustOnly: !filter.mustOnly });
  };

  return (
    <div className="header-actions" role="group" aria-label="过滤行程">
      <label className="sr-only" htmlFor="trip-filter-day">
        按天过滤
      </label>
      <select
        id="trip-filter-day"
        className={`pill-select${filter.day !== null ? ' active' : ''}`}
        value={filter.day ?? ''}
        onChange={(event) => handleDayChange(event.target.value)}
      >
        <option value="">全部天数</option>
        {dayNumbers.map((day) => (
          <option key={day} value={day}>
            第 {day} 天
          </option>
        ))}
      </select>

      <button
        type="button"
        className={`toggle-btn${filter.mustOnly ? ' active' : ''}`}
        aria-pressed={filter.mustOnly}
        onClick={toggleMustOnly}
      >
        ★ 只看必去
      </button>
    </div>
  );
}
