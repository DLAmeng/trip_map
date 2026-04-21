import type { FilterState } from '../../../selectors/filterState';

interface FiltersCardProps {
  dayNumbers: number[];
  cityNames: string[];
  filter: FilterState;
  onChange: (filter: FilterState) => void;
}

export function FiltersCard({
  dayNumbers,
  cityNames,
  filter,
  onChange,
}: FiltersCardProps) {
  return (
    <div className="filters-card tool-panel">
      <div className="filter-group">
        <span className="filter-label">天数</span>
        <button
          className={`filter-btn ${filter.day === null ? 'active' : ''}`}
          onClick={() => onChange({ ...filter, day: null })}
        >
          全部
        </button>
        {dayNumbers.map((d) => (
          <button
            key={d}
            className={`filter-btn ${filter.day === d ? 'active' : ''}`}
            onClick={() => onChange({ ...filter, day: d })}
          >
            Day {d}
          </button>
        ))}
      </div>

      {cityNames.length > 0 ? (
        <div className="filter-group">
          <span className="filter-label">城市</span>
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
      ) : null}

      <div className="filter-group">
        <span className="filter-label">偏好</span>
        <button
          className={`filter-btn ${filter.mustOnly ? 'active' : ''}`}
          onClick={() => onChange({ ...filter, mustOnly: !filter.mustOnly })}
        >
          只看必去
        </button>
        <button
          className={`filter-btn ${filter.nextOnly ? 'active' : ''}`}
          onClick={() => onChange({ ...filter, nextOnly: !filter.nextOnly })}
        >
          只看下一段
        </button>
      </div>
    </div>
  );
}
