import type { SpotItem } from '../../../types/trip';

interface SpotEditorCardProps {
  spot: SpotItem;
  onUpdate: (payload: Partial<SpotItem>) => void;
  onDelete: () => void;
}

export function SpotEditorCard({ spot, onUpdate, onDelete }: SpotEditorCardProps) {
  return (
    <div className="editor-card">
      <div className="card-head">
        <div className="card-title">{spot.name || '未命名景点'}</div>
        <button className="btn btn-ghost" style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }} onClick={onDelete}>
          删除
        </button>
      </div>
      <div className="field-grid">
        <div className="field">
          <label>第几天</label>
          <input
            type="number"
            value={spot.day ?? ''}
            onChange={(e) => onUpdate({ day: e.target.value === '' ? (undefined as any) : parseInt(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>排序</label>
          <input
            type="number"
            value={spot.order ?? ''}
            onChange={(e) => onUpdate({ order: e.target.value === '' ? (undefined as any) : parseInt(e.target.value) })}
          />
        </div>
        <div className="field field-wide">
          <label>名称</label>
          <input
            type="text"
            value={spot.name ?? ''}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>城市</label>
          <input
            type="text"
            value={spot.city ?? ''}
            onChange={(e) => onUpdate({ city: e.target.value })}
          />
        </div>
        <div className="field">
          <label>区域</label>
          <input
            type="text"
            value={spot.area ?? ''}
            onChange={(e) => onUpdate({ area: e.target.value })}
          />
        </div>
        <div className="field">
          <label>纬度 (Lat)</label>
          <input
            type="number"
            step="any"
            value={spot.lat ?? ''}
            onChange={(e) => onUpdate({ lat: e.target.value === '' ? (undefined as any) : parseFloat(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>经度 (Lng)</label>
          <input
            type="number"
            step="any"
            value={spot.lng ?? ''}
            onChange={(e) => onUpdate({ lng: e.target.value === '' ? (undefined as any) : parseFloat(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>类型</label>
          <select
            value={spot.type ?? 'spot'}
            onChange={(e) => onUpdate({ type: e.target.value as 'spot' | 'transport' })}
          >
            <option value="spot">景点 / 停留点</option>
            <option value="transport">交通枢纽 (仅占位)</option>
          </select>
        </div>
        <div className="field">
          <label>时间段</label>
          <input
            type="text"
            value={spot.timeSlot ?? ''}
            onChange={(e) => onUpdate({ timeSlot: e.target.value })}
            placeholder="上午 / 下午 / 晚上"
          />
        </div>
        <div className="field">
          <label>停留时长 (分钟)</label>
          <input
            type="number"
            value={spot.stayMinutes ?? ''}
            onChange={(e) => onUpdate({ stayMinutes: e.target.value === '' ? (undefined as any) : parseInt(e.target.value) })}
          />
        </div>
        <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            id={`mustVisit-${spot.id}`}
            checked={spot.mustVisit}
            onChange={(e) => onUpdate({ mustVisit: e.target.checked })}
          />
          <label htmlFor={`mustVisit-${spot.id}`} style={{ marginBottom: 0 }}>必去景点</label>
        </div>
      </div>
    </div>
  );
}
