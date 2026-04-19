import type { RouteSegment, SpotItem } from '../../../types/trip';

interface SegmentEditorCardProps {
  segment: RouteSegment;
  spots: SpotItem[];
  onUpdate: (payload: Partial<RouteSegment>) => void;
  onDelete: () => void;
}

export function SegmentEditorCard({ segment, spots, onUpdate, onDelete }: SegmentEditorCardProps) {
  return (
    <div className="editor-card">
      <div className="card-head">
        <div className="card-title">路线段: {segment.transportType || '未指定交通'}</div>
        <button className="btn btn-ghost" style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }} onClick={onDelete}>
          删除
        </button>
      </div>
      <div className="field-grid">
        <div className="field">
          <label>第几天</label>
          <input
            type="number"
            value={segment.day ?? ''}
            onChange={(e) => onUpdate({ day: e.target.value === '' ? (undefined as any) : parseInt(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>交通方式 (walk/metro/bus/shinkansen...)</label>
          <input
            type="text"
            value={segment.transportType ?? ''}
            onChange={(e) => onUpdate({ transportType: e.target.value })}
          />
        </div>
        <div className="field">
          <label>起点景点</label>
          <select
            value={segment.fromSpotId ?? ''}
            onChange={(e) => onUpdate({ fromSpotId: e.target.value })}
          >
            <option value="">请选择起点</option>
            {spots.map(s => (
              <option key={s.id} value={s.id}>D{s.day} - {s.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>终点景点</label>
          <select
            value={segment.toSpotId ?? ''}
            onChange={(e) => onUpdate({ toSpotId: e.target.value })}
          >
            <option value="">请选择终点</option>
            {spots.map(s => (
              <option key={s.id} value={s.id}>D{s.day} - {s.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>范围 (Scope)</label>
          <select
            value={segment.scope ?? 'city'}
            onChange={(e) => onUpdate({ scope: e.target.value as 'city' | 'intercity' })}
          >
            <option value="city">城市内 (City)</option>
            <option value="intercity">跨城市 (Intercity)</option>
          </select>
        </div>
        <div className="field field-wide">
          <label>备注 (Note)</label>
          <textarea
            value={segment.note ?? ''}
            onChange={(e) => onUpdate({ note: e.target.value })}
            placeholder="具体的换乘信息、班次等..."
          />
        </div>
      </div>
    </div>
  );
}
