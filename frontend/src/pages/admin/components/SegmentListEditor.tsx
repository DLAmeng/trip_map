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
import { SegmentEditorCard } from './SegmentEditorCard';
import type { RouteSegment, SpotItem } from '../../../types/trip';
import { makeBlankSegment } from '../../../utils/trip-factory';

interface SegmentListEditorProps {
  segments: RouteSegment[];
  spots: SpotItem[];
  onUpdateSegment: (id: string, payload: Partial<RouteSegment>) => void;
  onDeleteSegment: (id: string) => void;
  onAddSegment: (segment: RouteSegment) => void;
  onReorderSegments: (oldIndex: number, newIndex: number) => void;
  onSortByDay?: () => void;
}

export function SegmentListEditor({
  segments,
  spots,
  onUpdateSegment,
  onDeleteSegment,
  onAddSegment,
  onReorderSegments,
  onSortByDay,
}: SegmentListEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [dayFilter, setDayFilter] = useState<'all' | number>('all');
  const [query, setQuery] = useState('');

  const dayOptions = useMemo(() => {
    const days = new Set<number>();
    for (const s of segments) if (Number(s.day)) days.add(Number(s.day));
    return Array.from(days).sort((a, b) => a - b);
  }, [segments]);

  const spotNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of spots) map.set(s.id, s.name || s.id);
    return map;
  }, [spots]);

  const visibleSegments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return segments.filter((segment) => {
      if (dayFilter !== 'all' && Number(segment.day) !== dayFilter) return false;
      if (!q) return true;
      const haystack = [
        segment.id,
        segment.label,
        segment.transportType,
        segment.scope,
        segment.fromSpotId,
        segment.toSpotId,
        spotNameById.get(segment.fromSpotId) ?? '',
        spotNameById.get(segment.toSpotId) ?? '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [segments, dayFilter, query, spotNameById]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = segments.findIndex((s) => s.id === active.id);
      const newIndex = segments.findIndex((s) => s.id === over.id);
      onReorderSegments(oldIndex, newIndex);
    }
  };

  const handleAdd = () => {
    const lastSeg = segments[segments.length - 1];
    onAddSegment(
      makeBlankSegment({
        day: lastSeg ? lastSeg.day : 1,
        transportType: lastSeg?.transportType || 'walk',
      }),
    );
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>路线段管理 ({segments.length})</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {onSortByDay ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onSortByDay}
              title="按 day 字段重新排列"
            >
              按天数整理路线
            </button>
          ) : null}
          <button className="btn btn-primary" onClick={handleAdd}>
            + 新增路线段
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
          <span>搜索路线</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="label / 交通方式 / from / to / ID"
          />
        </label>
      </div>

      <div
        className="section-note"
        style={{ fontSize: 13, color: 'var(--admin-muted)', marginBottom: 10 }}
      >
        {segments.length === 0
          ? '还没有路线段。'
          : `当前显示 ${visibleSegments.length} / ${segments.length} 段路线`}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleSegments.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="card-list">
            {visibleSegments.map((seg) => (
              <SegmentEditorCard
                key={seg.id}
                segment={seg}
                spots={spots}
                onUpdate={(payload) => onUpdateSegment(seg.id, payload)}
                onDelete={() => onDeleteSegment(seg.id)}
              />
            ))}
            {segments.length === 0 ? (
              <div className="empty-state">还没有路线段。</div>
            ) : visibleSegments.length === 0 ? (
              <div className="empty-state">当前筛选条件下没有路线段。</div>
            ) : null}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
