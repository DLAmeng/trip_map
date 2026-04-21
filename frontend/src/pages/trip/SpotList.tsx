import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpotItem } from '../../types/trip';
import type { FilterState } from '../../selectors/filterState';

interface SpotListProps {
  spotsByDay: Map<number, SpotItem[]>;
  dayNumbers: number[];
  dayColors: string[];
  filter: FilterState;
  selectedSpotId: string | null;
  onSelect: (id: string) => void;
  onDayClick?: (day: number | null) => void;
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
  onDayClick,
}: SpotListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 缓存 day → 是否展开的判断:filter.day 为 null 时全展开;指定 day 时只展开该 day。
  const expandedDay = filter.day;

  /**
   * 用户手动折叠的 day 集合(override filter.day 的默认行为)。
   * 对齐旧版 `toggleDayPanel`:点击 day-header 时可以单独折叠 / 展开,
   * 不影响 filter.day。filter.day 变化时,保留 user override,
   * 让"切到这天"本身等价于"展开这天"(见 handleHeaderClick)。
   */
  const [userCollapsed, setUserCollapsed] = useState<Set<number>>(() => new Set());

  const handleHeaderClick = (day: number) => {
    // 已经是 filter.day → 仅切换 collapse 状态(不 unset filter)
    if (expandedDay === day) {
      setUserCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(day)) next.delete(day);
        else next.add(day);
        return next;
      });
      return;
    }
    // 不是当前 filter.day → 切 filter,同时清掉这天的手动折叠 override
    setUserCollapsed((prev) => {
      if (!prev.has(day)) return prev;
      const next = new Set(prev);
      next.delete(day);
      return next;
    });
    if (onDayClick) onDayClick(day);
  };

  // 当前 filter 下,每个 day 实际可见的 spots
  // 注意：在列表侧边栏中，我们只根据 mustOnly / city / nextOnly 过滤数量,
  // 而忽略 filter.day (天数过滤只用于控制列表的折叠/展开状态)，
  // 这样可以确保其他折叠的天数上依然显示正确的景点总数。
  const visibleByDay = useMemo(() => {
    const map = new Map<number, SpotItem[]>();
    for (const day of dayNumbers) {
      const dailySpots = spotsByDay.get(day) ?? [];
      const visible = dailySpots.filter((spot) => {
        if (filter.mustOnly && !spot.mustVisit) return false;
        if (filter.nextOnly && !spot.nextStopId) return false;
        if (filter.city !== null && spot.city !== filter.city) return false;
        return true;
      });
      map.set(day, visible);
    }
    return map;
  }, [dayNumbers, spotsByDay, filter.mustOnly, filter.nextOnly, filter.city]);

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
          const defaultExpanded = expandedDay === null || expandedDay === day;
          const isExpanded = userCollapsed.has(day) ? false : defaultExpanded;
          const dayColor = dayColors[day - 1] ?? fallbackColor;
          return (
            <section
              key={day}
              className={`day-panel${isExpanded ? '' : ' collapsed'}`}
              aria-expanded={isExpanded}
            >
              <div
                className="day-header"
                role="button"
                aria-level={3}
                style={{ ['--day-color' as string]: dayColor }}
                onClick={() => handleHeaderClick(day)}
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
                              {spot.nextStopId ? (
                                <span className="next-badge">下一段</span>
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
                            {spot.transportNote ? (
                              <div className="spot-note">
                                <span className="transport-badge">
                                  {spot.transportNote}
                                </span>
                              </div>
                            ) : null}
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
