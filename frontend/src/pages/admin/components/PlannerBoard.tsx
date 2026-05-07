import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SpotItem } from '../../../types/trip';
import type { PlannerDay, PlannerSegment } from '../hooks/useTripPlannerEditor';
import { buildRouteHeadline, buildRouteMetaLine } from '../../../utils/route-detail';
import { PlaceSearchAutocomplete } from './PlaceSearchAutocomplete';

interface PlannerBoardProps {
  days: PlannerDay[];
  dayColors: string[];
  activeDay: number;
  selectedSpotId: string | null;
  selectedSegmentId: string | null;
  selectedSpotIds: string[];
  /**
   * P0-1: 根据 trip.meta.startDate/endDate 算出的"期望天数"。
   * 用户填了 06-01 → 06-05 = 5 天,即使 hook spots 只有 D1 也展开 D1-D5 5 个 tab。
   */
  expectedDayCount?: number;
  onSetActiveDay: (day: number) => void;
  onSelectSpot: (spotId: string) => void;
  onToggleSpotSelection: (spotId: string, checked: boolean) => void;
  onSelectSegment: (segmentId: string) => void;
  onAddSpot: (day: number, index?: number) => void;
  /** 顶部 Quick Add 搜索选中地点后:加到 activeDay 末尾(replaces PlannerToolbarPanel 的 Quick Add) */
  onQuickAddPlace: (place: { name: string; lat: number; lng: number }) => void;
  onMoveSpot: (spotId: string, targetDay: number, targetIndex: number) => void;
  onDuplicateDay: (day: number) => void;
  onClearDay: (day: number) => void;
  onAutoSortDay: (day: number) => void;
}

interface PlannerSpotCardProps {
  spot: SpotItem;
  index: number;
  dayColor: string;
  selected: boolean;
  checked: boolean;
  nextSegment?: PlannerSegment;
  onSelect: () => void;
  onToggleSelection: (checked: boolean) => void;
}

function PlannerSpotCard({
  spot,
  index,
  dayColor,
  selected,
  checked,
  nextSegment,
  onSelect,
  onToggleSelection,
}: PlannerSpotCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: spot.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 20 : 1,
  };

  const metaLine = buildRouteMetaLine({
    duration: nextSegment?.duration,
    transportType: nextSegment?.transportType || '',
  });

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`planner-spot-card${selected ? ' is-selected' : ''}${
        checked ? ' is-checked' : ''
      }`}
      onClick={onSelect}
    >
      <div className="planner-spot-card-top">
        <div
          className="planner-spot-drag"
          aria-label="拖拽景点"
          {...attributes}
          {...listeners}
        >
          ⠿
        </div>
        <label
          className="planner-spot-select"
          onClick={(event) => event.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onToggleSelection(event.target.checked)}
          />
        </label>
        <span className="planner-spot-order" style={{ backgroundColor: dayColor }}>
          {index + 1}
        </span>
        <div className="planner-spot-main">
          <div className="planner-spot-title-row">
            <strong>{spot.name || '未命名景点'}</strong>
            {spot.mustVisit ? <span className="planner-pill planner-pill-must">必去</span> : null}
            {spot.type === 'transport' ? (
              <span className="planner-pill planner-pill-muted">交通点</span>
            ) : null}
          </div>
          <div className="planner-spot-subline">
            {[spot.city, spot.area, spot.timeSlot].filter(Boolean).join(' · ') || '待补充'}
          </div>
        </div>
        {spot.photos?.[0] ? (
          <img className="planner-spot-thumb" src={spot.photos[0]} alt="" />
        ) : null}
      </div>

      <div className="planner-spot-meta-row">
        <span>{spot.stayMinutes ? `停留 ${spot.stayMinutes} 分钟` : '未设置停留时长'}</span>
        {spot.tags?.length ? <span>{spot.tags.join(' / ')}</span> : null}
      </div>

      {nextSegment ? (
        <div className="planner-next-leg-inline">
          <span className="planner-next-leg-label">{buildRouteHeadline(nextSegment)}</span>
          {metaLine.length ? <span>{metaLine.join(' · ')}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

function DayDropLane({
  day,
  active,
  children,
}: {
  day: number;
  active: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-drop-${day}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`planner-day-lane${active ? ' is-active' : ''}${isOver ? ' is-over' : ''}`}
    >
      {children}
    </div>
  );
}

export function PlannerBoard({
  days,
  dayColors,
  activeDay,
  selectedSpotId,
  selectedSegmentId,
  selectedSpotIds,
  onSetActiveDay,
  onSelectSpot,
  onToggleSpotSelection,
  onSelectSegment,
  onAddSpot,
  onQuickAddPlace,
  onMoveSpot,
  onDuplicateDay,
  onClearDay,
  onAutoSortDay,
  expectedDayCount,
}: PlannerBoardProps) {
  const [moreMenuDay, setMoreMenuDay] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const selectedIds = new Set(selectedSpotIds);
  const allDays = days.length > 0 ? days : [{ day: 1, spots: [], segments: [] }];

  /**
   * P0-2: 用户点"+ 加 day"扩展的最大 day 数。hook snapshot 是从 spots derive 的,
   * 没 spot 的 day 不会出现。这里用本地 state 记录用户期望的 day 数,DayTabs 合并渲染。
   * 用户在新 day 加 spot 后,hook 自然会 surface 该 day,本地 state 不再起作用。
   */
  const [extendedMaxDay, setExtendedMaxDay] = useState<number>(0);

  /**
   * 主区只渲染 activeDay 那一天的 lane,把 8000+px 的全展开页面收缩到 ~600px。
   * 其他 day 在顶部 DayTabs 切换。drag 跨 day 仍然 OK,因为顶部 tabs 自身
   * 也作为 drop zone 接收 spot,后续 onMoveSpot 触发即切到目标 day。
   */
  const displayDays = allDays.filter((d) => d.day === activeDay);
  /** 顶部 DayTabs 渲染所有 day(合并 hook derive + 用户扩展的空 day + 创建表单期望天数) */
  const hookMaxDay = Math.max(0, ...allDays.map((d) => d.day));
  const effectiveMaxDay = Math.max(hookMaxDay, extendedMaxDay, expectedDayCount ?? 0, 1);
  const allDayNumbers = Array.from({ length: effectiveMaxDay }, (_, i) => i + 1);
  const totalSpots = allDays.reduce((sum, d) => sum + d.spots.length, 0);

  /** "+ 加 day" 按钮:递增 extendedMaxDay,自动切到新 day */
  const handleAppendEmptyDay = () => {
    const next = effectiveMaxDay + 1;
    setExtendedMaxDay(next);
    onSetActiveDay(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    let targetDay = activeDay;
    let targetIndex = 0;

    if (overId.startsWith('day-drop-')) {
      targetDay = Number(overId.replace('day-drop-', '')) || activeDay;
      const targetBucket = displayDays.find((item) => item.day === targetDay)?.spots || [];
      targetIndex = targetBucket.length;
    } else {
      const hostDay = displayDays.find((item) => item.spots.some((spot) => spot.id === overId));
      if (!hostDay) return;
      targetDay = hostDay.day;
      targetIndex = hostDay.spots.findIndex((spot) => spot.id === overId);
    }

    onMoveSpot(activeId, targetDay, targetIndex);
    onSetActiveDay(targetDay);
  };

  return (
    <section className="panel planner-board-panel">
      <div className="panel-head planner-board-head">
        <div>
          <p className="panel-kicker">Day Planner</p>
          <h2>按天安排行程</h2>
        </div>
        <div className="planner-board-head-meta">
          <span>{allDays.length} 天</span>
          <span>{totalSpots} 个景点</span>
        </div>
      </div>

      {/* P6-B: Day Tabs — 横向滚动,点击切换 active day,右侧"+"加 day */}
      <div className="planner-day-tabs" role="tablist" aria-label="切换天数">
        {allDayNumbers.map((day) => {
          const dayIndex = day - 1;
          const dayColor = dayColors[dayIndex % dayColors.length] || '#b85c38';
          const isActive = day === activeDay;
          const dayMeta = allDays.find((d) => d.day === day);
          return (
            <button
              key={day}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`planner-day-tab${isActive ? ' is-active' : ''}`}
              style={{ '--planner-day-color': dayColor } as CSSProperties}
              onClick={() => onSetActiveDay(day)}
            >
              <span className="planner-day-tab-label">D{day}</span>
              <span className="planner-day-tab-count">{dayMeta?.spots.length ?? 0}</span>
            </button>
          );
        })}
        {/* P0-2: 末尾"+ 加 day"按钮 — 递增 effectiveMaxDay,自动切到新 day */}
        <button
          type="button"
          className="planner-day-tab planner-day-tab-add"
          onClick={handleAppendEmptyDay}
          aria-label="添加新的一天"
          title="添加新的一天"
        >
          <span className="planner-day-tab-label">+</span>
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="planner-day-grid">
          {displayDays.map((dayItem, dayIndex) => {
            const dayColor = dayColors[dayIndex % dayColors.length] || '#b85c38';
            const segmentByFromId = new Map(dayItem.segments.map((segment) => [segment.fromSpotId, segment]));
            return (
              <DayDropLane key={dayItem.day} day={dayItem.day} active={dayItem.day === activeDay}>
                <div className="planner-day-card">
                  <div className="planner-day-card-head">
                    <button
                      type="button"
                      className={`planner-day-chip${dayItem.day === activeDay ? ' is-active' : ''}`}
                      style={{ '--planner-day-color': dayColor } as CSSProperties}
                      onClick={() => onSetActiveDay(dayItem.day)}
                    >
                      Day {dayItem.day} · {dayItem.spots.length} 个景点
                    </button>
                    <div className="planner-day-more-wrap">
                      <button
                        type="button"
                        className="planner-day-more-btn"
                        onClick={() =>
                          setMoreMenuDay(moreMenuDay === dayItem.day ? null : dayItem.day)
                        }
                        aria-label="更多操作"
                        aria-expanded={moreMenuDay === dayItem.day}
                      >
                        ⋯
                      </button>
                      {moreMenuDay === dayItem.day ? (
                        <div className="planner-day-more-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onAutoSortDay(dayItem.day);
                              setMoreMenuDay(null);
                            }}
                          >
                            顺路排序
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onDuplicateDay(dayItem.day);
                              setMoreMenuDay(null);
                            }}
                          >
                            复制这天
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="is-danger"
                            onClick={() => {
                              onClearDay(dayItem.day);
                              setMoreMenuDay(null);
                            }}
                          >
                            清空这天
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Quick Add 搜索栏 — 替代原 PlannerToolbarPanel 的 Quick Add */}
                  {dayItem.day === activeDay ? (
                    <div className="planner-day-quick-add">
                      <PlaceSearchAutocomplete
                        onSelect={(place) => onQuickAddPlace(place)}
                        placeholder={`搜索景点加入 Day ${dayItem.day}...`}
                      />
                    </div>
                  ) : null}

                  <SortableContext items={dayItem.spots.map((spot) => spot.id)} strategy={verticalListSortingStrategy}>
                    <div className="planner-day-spot-list">
                      {dayItem.spots.map((spot, index) => {
                        const nextSegment = segmentByFromId.get(spot.id);
                        return (
                          <div key={spot.id} className="planner-day-spot-wrap">
                            <PlannerSpotCard
                              spot={spot}
                              index={index}
                              dayColor={dayColor}
                              selected={selectedSpotId === spot.id}
                              checked={selectedIds.has(spot.id)}
                              nextSegment={nextSegment}
                              onSelect={() => {
                                onSetActiveDay(dayItem.day);
                                onSelectSpot(spot.id);
                              }}
                              onToggleSelection={(checked) => onToggleSpotSelection(spot.id, checked)}
                            />

                            {nextSegment ? (
                              <div
                                className={`planner-leg-chip${selectedSegmentId === nextSegment.id ? ' is-selected' : ''}`}
                                onClick={() => {
                                  onSetActiveDay(dayItem.day);
                                  onSelectSegment(nextSegment.id);
                                }}
                              >
                                <div className="planner-leg-chip-main">
                                  <strong>{buildRouteHeadline(nextSegment)}</strong>
                                  <span>{buildRouteMetaLine(nextSegment).join(' · ') || '点击编辑路线说明'}</span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      {dayItem.spots.length === 0 ? (
                        <div className="planner-empty-day">
                          <p>这一天还没有景点，点地图或下方按钮开始添加。</p>
                        </div>
                      ) : null}
                    </div>
                  </SortableContext>

                  <button
                    type="button"
                    className="planner-add-spot-btn"
                    onClick={() => {
                      onSetActiveDay(dayItem.day);
                      onAddSpot(dayItem.day);
                    }}
                  >
                    + 添加景点到 Day {dayItem.day}
                  </button>
                </div>
              </DayDropLane>
            );
          })}
        </div>
      </DndContext>
    </section>
  );
}
