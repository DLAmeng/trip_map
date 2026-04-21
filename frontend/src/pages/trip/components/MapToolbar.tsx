interface MapToolbarProps {
  activeTool: string | null;
  onToggleTool: (tool: string) => void;
}

export function MapToolbar({ activeTool, onToggleTool }: MapToolbarProps) {
  return (
    <div className="map-toolbar" role="toolbar" aria-label="地图工具">
      <button
        className={`tool-btn ${activeTool === 'search' ? 'active' : ''}`}
        type="button"
        data-tool="search"
        onClick={() => onToggleTool('search')}
        aria-label="搜索地点"
        aria-pressed={activeTool === 'search'}
        title="搜索地点"
      >
        <span className="tool-icon">
          <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      <button
        className={`tool-btn ${activeTool === 'filter' ? 'active' : ''}`}
        type="button"
        data-tool="filter"
        onClick={() => onToggleTool('filter')}
        aria-label="筛选行程"
        aria-pressed={activeTool === 'filter'}
        title="筛选行程"
      >
        <span className="tool-icon">
          <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
            <path d="M3 5h14M5 10h10M8 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      <button
        className={`tool-btn ${activeTool === 'summary' ? 'active' : ''}`}
        type="button"
        data-tool="summary"
        onClick={() => onToggleTool('summary')}
        aria-label="行程概览"
        aria-pressed={activeTool === 'summary'}
        title="行程概览"
      >
        <span className="tool-icon">
          <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
            <rect x="3" y="4" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
            <rect x="11" y="4" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
            <rect x="3" y="12" width="14" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
      </button>
    </div>
  );
}
