import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { RouteSegment, SpotItem } from '../../../types/trip';

interface SegmentEditorCardProps {
  segment: RouteSegment;
  spots: SpotItem[];
  onUpdate: (payload: Partial<RouteSegment>) => void;
  onDelete: () => void;
}

const TRANSPORT_OPTIONS = [
  'walk',
  'metro',
  'subway',
  'train',
  'shinkansen',
  'bus',
  'drive',
  'taxi',
  'ferry',
];

function resolveSpotName(spots: SpotItem[], id: string): string {
  const hit = spots.find((s) => s.id === id);
  return hit ? hit.name || hit.id : '';
}

export function SegmentEditorCard({
  segment,
  spots,
  onUpdate,
  onDelete,
}: SegmentEditorCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: segment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  // path 在 UI 里用字符串编辑,blur 时 parse;错误本地化提示
  const [pathDraft, setPathDraft] = useState(() =>
    JSON.stringify(segment.path ?? [], null, 2),
  );
  const [pathError, setPathError] = useState<string | null>(null);

  const commitPath = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onUpdate({ path: [] });
      setPathError(null);
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        throw new Error('path 必须是 [[lat,lng], ...] 数组');
      }
      const cleaned: Array<[number, number]> = [];
      for (const pair of parsed) {
        if (!Array.isArray(pair) || pair.length < 2) continue;
        const lat = Number(pair[0]);
        const lng = Number(pair[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        cleaned.push([lat, lng]);
      }
      onUpdate({ path: cleaned });
      setPathError(null);
    } catch (err) {
      setPathError(err instanceof Error ? err.message : String(err));
    }
  };

  const fromName = resolveSpotName(spots, segment.fromSpotId);
  const toName = resolveSpotName(spots, segment.toSpotId);

  return (
    <div className="editor-card" ref={setNodeRef} style={style}>
      <div className="card-head">
        <div
          className="drag-handle"
          {...attributes}
          {...listeners}
          title="按住拖拽排序"
        >
          ⠿
        </div>
        <div className="card-title-wrap" style={{ flex: 1, minWidth: 180 }}>
          <div className="card-badges" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <span className="badge">第 {segment.day} 天</span>
            <span className="badge">{segment.scope || 'city'}</span>
            <span className="badge">{segment.transportType || '未设交通'}</span>
          </div>
          <div className="card-title">{segment.label || '未命名路线'}</div>
          <div
            className="card-subtitle"
            style={{ fontSize: '0.78rem', color: 'var(--admin-muted)', marginTop: 4 }}
          >
            {fromName || segment.fromSpotId || '—'} → {toName || segment.toSpotId || '—'} · ID:{' '}
            {segment.id || '—'}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-danger"
          onClick={onDelete}
        >
          删除
        </button>
      </div>

      <div className="field-grid">
        <div className="field">
          <label>ID</label>
          <input
            type="text"
            value={segment.id ?? ''}
            onChange={(e) => onUpdate({ id: e.target.value })}
          />
        </div>
        <div className="field">
          <label>第几天</label>
          <input
            type="number"
            value={segment.day ?? ''}
            onChange={(e) =>
              onUpdate({
                day: e.target.value === '' ? (undefined as any) : parseInt(e.target.value),
              })
            }
          />
        </div>
        <div className="field">
          <label>范围 (scope)</label>
          <select
            value={segment.scope ?? 'city'}
            onChange={(e) => onUpdate({ scope: e.target.value as 'city' | 'intercity' })}
          >
            <option value="city">城市内 (city)</option>
            <option value="intercity">跨城市 (intercity)</option>
          </select>
        </div>
        <div className="field">
          <label>交通方式 (transportType)</label>
          <input
            type="text"
            list={`transport-options-${segment.id}`}
            value={segment.transportType ?? ''}
            onChange={(e) => onUpdate({ transportType: e.target.value })}
            placeholder="walk / metro / bus..."
          />
          <datalist id={`transport-options-${segment.id}`}>
            {TRANSPORT_OPTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div className="field">
          <label>起点景点</label>
          <select
            value={segment.fromSpotId ?? ''}
            onChange={(e) => onUpdate({ fromSpotId: e.target.value })}
          >
            <option value="">请选择起点</option>
            {spots.map((s) => (
              <option key={s.id} value={s.id}>
                D{s.day} · {s.name || s.id}
              </option>
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
            {spots.map((s) => (
              <option key={s.id} value={s.id}>
                D{s.day} · {s.name || s.id}
              </option>
            ))}
          </select>
        </div>

        <div className="field field-wide">
          <label>显示标题 (label)</label>
          <input
            type="text"
            value={segment.label ?? ''}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="如: 东京 → 京都 (新干线 Hikari)"
          />
        </div>
        <div className="field">
          <label>时长 (duration)</label>
          <input
            type="text"
            value={segment.duration ?? ''}
            onChange={(e) => onUpdate({ duration: e.target.value })}
            placeholder="如: 2h 15min"
          />
        </div>
      </div>

      <details className="card-advanced" style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--admin-muted)', fontSize: '0.85rem' }}>
          展开说明与路径 JSON
        </summary>
        <div className="field-grid" style={{ marginTop: 12 }}>
          <div className="field field-wide">
            <label>说明 (note)</label>
            <textarea
              rows={3}
              value={segment.note ?? ''}
              onChange={(e) => onUpdate({ note: e.target.value })}
              placeholder="具体的换乘信息、班次等..."
            />
          </div>
          <div className="field field-wide">
            <label>
              路径 JSON (path){' '}
              <small style={{ color: 'var(--admin-muted)', fontWeight: 400 }}>
                [[lat, lng], ...] 数组,留空则由起止点直连
              </small>
            </label>
            <textarea
              rows={5}
              value={pathDraft}
              onChange={(e) => {
                setPathDraft(e.target.value);
                // 打字过程中不 commit,避免中间状态报错闪烁
              }}
              onBlur={(e) => commitPath(e.target.value)}
              spellCheck={false}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            />
            {pathError ? (
              <small style={{ color: '#b91c1c', fontWeight: 600 }}>
                ⚠ {pathError}
              </small>
            ) : (
              <small style={{ color: 'var(--admin-muted)' }}>
                当前 {segment.path?.length ?? 0} 个点
              </small>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
