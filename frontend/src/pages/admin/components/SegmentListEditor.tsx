import { SegmentEditorCard } from './SegmentEditorCard';
import type { RouteSegment, SpotItem } from '../../../types/trip';

interface SegmentListEditorProps {
  segments: RouteSegment[];
  spots: SpotItem[];
  onUpdateSegment: (id: string, payload: Partial<RouteSegment>) => void;
  onDeleteSegment: (id: string) => void;
  onAddSegment: (segment: RouteSegment) => void;
}

export function SegmentListEditor({
  segments,
  spots,
  onUpdateSegment,
  onDeleteSegment,
  onAddSegment
}: SegmentListEditorProps) {
  const handleAdd = () => {
    const lastSeg = segments[segments.length - 1];
    const newSeg: RouteSegment = {
      id: `seg-${Date.now()}`,
      day: lastSeg ? lastSeg.day : 1,
      transportType: 'walk',
      fromSpotId: '',
      toSpotId: '',
      scope: 'city',
    };
    onAddSegment(newSeg);
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>路线段管理 ({segments.length})</h2>
        <button className="btn btn-primary" onClick={handleAdd}>+ 新增路线段</button>
      </div>
      <div className="card-list">
        {segments.map((seg) => (
          <SegmentEditorCard
            key={seg.id}
            segment={seg}
            spots={spots}
            onUpdate={(payload) => onUpdateSegment(seg.id, payload)}
            onDelete={() => onDeleteSegment(seg.id)}
          />
        ))}
        {segments.length === 0 && (
          <div className="empty-state">还没有路线段。</div>
        )}
      </div>
    </section>
  );
}
