import { useEffect, useMemo, useRef } from 'react';
import type { SpotItem } from '../../types/trip';
import type { FilterState } from '../../selectors/filterState';
import { matchesFilter } from '../../selectors/filterState';

interface SpotListProps {
  spotsByDay: Map<number, SpotItem[]>;
  dayNumbers: number[];
  dayColors: string[];
  filter: FilterState;
  selectedSpotId: string | null;
  onSelect: (id: string) => void;
}

/**
 * 按 day 分 section 的景点列表,对应原生 .day-list-panel。
 *
 * 功能:
 * - 按 day 分桶,filter.day 命中的 day 展开,其他 day 折叠
 * - filter.mustOnly 过滤每个 day 的 spot
 * - selectedSpotId 命中的 spot 加 `.is-active` class
 * - selectedSpotId 变化时,如果命中的列表项在 DOM 里,调 scrollIntoView 让它滚入视口
 *
 * 第一版不做拖拽排序、不做右键菜单(那是 Phase 4 Admin 的事)。
 */
export function SpotList({
  spotsByDay,
  dayNumbers,
  dayColors,
  filter,
  selectedSpotId,
  onSelect,
}: SpotListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 缓存 day → 是否展开的判断:filter.day 为 null 时全展开;指定 day 时只展开该 day
  const expandedDay = filter.day;

  // 当前 filter 下,每个 day 实际可见的 spots
  const visibleByDay = useMemo(() => {
    const map = new Map<number, SpotItem[]>();
    for (const day of dayNumbers) {
      const dailySpots = spotsByDay.get(day) ?? [];
      const visible = dailySpots.filter((spot) => matchesFilter(spot, filter));
      map.set(day, visible);
    }
    return map;
  }, [dayNumbers, spotsByDay, filter]);

  // selectedSpotId 变化 → 把命中的列表项滚入视口
  useEffect(() => {
    if (!selectedSpotId || !containerRef.current) return;
    const node = containerRef.current.querySelector<HTMLButtonElement>(
      `[data-spot-id="${CSS.escape(selectedSpotId)}"]`,
    );
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedSpotId]);

  const fallbackColor = '#888';

  return (
    <aside className="day-list-panel" aria-label="景点列表" ref={containerRef}>
      {dayNumbers.length === 0 ? (
        <div className="day-empty">这个行程还没有任何景点。去编辑页添加第一个吧。</div>
      ) : (
        dayNumbers.map((day) => {
          const visible = visibleByDay.get(day) ?? [];
          const isExpanded = expandedDay === null || expandedDay === day;
          const dayColor = dayColors[day - 1] ?? fallbackColor;
          return (
            <section
              key={day}
              className={`day-panel${isExpanded ? '' : ' collapsed'}`}
              aria-expanded={isExpanded}
            >
              <div
                className="day-header"
                role="heading"
                aria-level={3}
                style={{ ['--day-color' as string]: dayColor }}
              >
                <div className="day-header-copy">
                  <span className="day-chip">Day {day}</span>
                  <span className="day-title">第 {day} 天</span>
                </div>
                <div className="day-header-meta">
                  <span>{visible.length} 个景点</span>
                </div>
              </div>
              {isExpanded ? (
                <div className="day-spots">
                  {visible.length === 0 ? (
                    <div className="day-empty">当前过滤条件下,这一天没有景点。</div>
                  ) : (
                    visible.map((spot, index) => {
                      const spotColor = dayColors[spot.day - 1] ?? fallbackColor;
                      const isActive = spot.id === selectedSpotId;
                      return (
                        <button
                          key={spot.id}
                          type="button"
                          data-spot-id={spot.id}
                          className={`spot-item${isActive ? ' is-active' : ''}`}
                          style={{ ['--spot-color' as string]: spotColor }}
                          onClick={() => onSelect(spot.id)}
                        >
                          <span className="spot-index">{index + 1}</span>
                          <div className="spot-copy">
                            <div className="spot-name">
                              <span>{spot.name}</span>
                              {spot.mustVisit ? (
                                <span className="must-badge">必去</span>
                              ) : null}
                            </div>
                            {spot.nameEn ? (
                              <div className="spot-name-en">{spot.nameEn}</div>
                            ) : null}
                            <div className="spot-meta">
                              {[spot.city, spot.area, spot.timeSlot]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}
            </section>
          );
        })
      )}
    </aside>
  );
}
