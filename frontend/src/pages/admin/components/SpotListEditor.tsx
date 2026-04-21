import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { PlaceSearchAutocomplete } from './PlaceSearchAutocomplete';
import { SpotEditorCard } from './SpotEditorCard';
import type { SpotItem } from '../../../types/trip';
import { makeBlankSpot } from '../../../utils/trip-factory';

interface SpotListEditorProps {
  spots: SpotItem[];
  onUpdateSpot: (id: string, payload: Partial<SpotItem>) => void;
  onDeleteSpot: (id: string) => void;
  onAddSpot: (spot: SpotItem) => void;
  onReorderSpots: (oldIndex: number, newIndex: number) => void;
  onInsertAfterSpot?: (anchorId: string) => void;
  onSortByDayOrder?: () => void;
}

export function SpotListEditor({
  spots,
  onUpdateSpot,
  onDeleteSpot,
  onAddSpot,
  onReorderSpots,
  onInsertAfterSpot,
  onSortByDayOrder,
}: SpotListEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 筛选 state:day filter(all / 具体天数) + 文本搜索(name/city/area/id/tags/timeSlot)
  const [dayFilter, setDayFilter] = useState<'all' | number>('all');
  const [query, setQuery] = useState('');

  const dayOptions = useMemo(() => {
    const days = new Set<number>();
    for (const s of spots) if (Number(s.day)) days.add(Number(s.day));
    return Array.from(days).sort((a, b) => a - b);
  }, [spots]);

  const visibleSpots = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spots.filter((spot) => {
      if (dayFilter !== 'all' && Number(spot.day) !== dayFilter) return false;
      if (!q) return true;
      const haystack = [
        spot.id,
        spot.name,
        spot.nameEn,
        spot.city,
        spot.area,
        spot.timeSlot,
        ...(Array.isArray(spot.tags) ? spot.tags : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [spots, dayFilter, query]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      // 拖拽排序作用于完整列表,而不是筛选后的视图:
      // 找到两个 id 在原 spots 里的真实下标,避免筛选视图下拖错位。
      const oldIndex = spots.findIndex((s) => s.id === active.id);
      const newIndex = spots.findIndex((s) => s.id === over.id);
      onReorderSpots(oldIndex, newIndex);
    }
  };

  const handleAdd = () => {
    const lastSpot = spots[spots.length - 1];
    onAddSpot(
      makeBlankSpot({
        day: lastSpot ? lastSpot.day : 1,
        order: lastSpot ? (lastSpot.order ?? spots.length) + 1 : 1,
        city: lastSpot?.city,
        lat: lastSpot ? lastSpot.lat + 0.001 : 35.6895,
        lng: lastSpot ? lastSpot.lng + 0.001 : 139.6917,
      }),
    );
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>景点列表 ({spots.length})</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <PlaceSearchAutocomplete
            onSelect={(place) => {
              const lastSpot = spots[spots.length - 1];
              onAddSpot(
                makeBlankSpot({
                  day: lastSpot ? lastSpot.day : 1,
                  order: lastSpot ? (lastSpot.order ?? spots.length) + 1 : 1,
                  name: place.name,
                  lat: place.lat,
                  lng: place.lng,
                }),
              );
            }}
            placeholder="搜索并快速添加景点..."
          />
          {onSortByDayOrder ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onSortByDayOrder}
              title="按 day + order 字段重新排列"
            >
              按天数+顺序整理
            </button>
          ) : null}
          <button className="btn btn-primary" onClick={handleAdd}>
            + 空白节点
          </button>
        </div>
      </div>

      <div
        className="filters-row"
        style={{
          display: 'grid',
          gridTemplateColumns: '180px 1fr',
          gap: 14,
          marginBottom: 14,
        }}
      >
        <label className="field">
          <span>按天数筛选</span>
          <select
            value={String(dayFilter)}
            onChange={(e) =>
              setDayFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
          >
            <option value="all">全部天数</option>
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                第 {d} 天
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>搜索景点</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名称 / 城市 / 区域 / ID / 标签 / 时段"
          />
        </label>
      </div>

      <div
        className="section-note"
        style={{
          fontSize: 13,
          color: 'var(--admin-muted)',
          marginBottom: 10,
        }}
      >
        {spots.length === 0
          ? '还没有景点。'
          : `当前显示 ${visibleSpots.length} / ${spots.length} 个景点`}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleSpots.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="card-list">
            {visibleSpots.map((spot) => (
              <SpotEditorCard
                key={spot.id}
                spot={spot}
                allSpots={spots}
                onUpdate={(payload) => onUpdateSpot(spot.id, payload)}
                onDelete={() => onDeleteSpot(spot.id)}
                onInsertAfter={
                  onInsertAfterSpot ? () => onInsertAfterSpot(spot.id) : undefined
                }
              />
            ))}
            {spots.length === 0 ? (
              <div className="empty-state">还没有景点，点击上方按钮添加。</div>
            ) : visibleSpots.length === 0 ? (
              <div className="empty-state">当前筛选条件下没有景点。</div>
            ) : null}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
