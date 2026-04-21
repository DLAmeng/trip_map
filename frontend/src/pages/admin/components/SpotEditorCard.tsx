import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlaceSearchAutocomplete } from './PlaceSearchAutocomplete';
import { PhotoUploader } from './PhotoUploader';
import type { SpotItem } from '../../../types/trip';

interface SpotEditorCardProps {
  spot: SpotItem;
  onUpdate: (payload: Partial<SpotItem>) => void;
  onDelete: () => void;
  onInsertAfter?: () => void;
  allSpots?: SpotItem[];
}

export function SpotEditorCard({
  spot,
  onUpdate,
  onDelete,
  onInsertAfter,
  allSpots,
}: SpotEditorCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: spot.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const tagsValue = Array.isArray(spot.tags) ? spot.tags.join(', ') : '';
  const openingHoursValue = Array.isArray(spot.openingHours)
    ? spot.openingHours.join('\n')
    : '';

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
            <span className="badge">第 {spot.day} 天</span>
            {spot.city ? <span className="badge">{spot.city}</span> : null}
            {spot.area ? <span className="badge">{spot.area}</span> : null}
            {spot.mustVisit ? <span className="badge">必去</span> : null}
          </div>
          <div className="card-title">{spot.name || '未命名景点'}</div>
          <div
            className="card-subtitle"
            style={{ fontSize: '0.78rem', color: 'var(--admin-muted)', marginTop: 4 }}
          >
            ID: {spot.id || '—'} · 顺序 {spot.order ?? '—'} · 下一站 {spot.nextStopId || '无'}
          </div>
        </div>
        <div className="card-tools" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {spot.googleMapsUri ? (
            <a
              className="btn btn-ghost"
              href={spot.googleMapsUri}
              target="_blank"
              rel="noreferrer"
              title="在 Google Maps 中打开"
            >
              地图
            </a>
          ) : null}
          <PlaceSearchAutocomplete
            onSelect={(place) => {
              onUpdate({
                name: place.name,
                lat: place.lat,
                lng: place.lng,
              });
            }}
            placeholder="智能补全信息..."
          />
          {onInsertAfter ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onInsertAfter}
              title="在此景点之后插入新点,自动续接 nextStopId 链"
            >
              在此后插入
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-danger" onClick={onDelete}>
            删除
          </button>
        </div>
      </div>

      <div className="field-grid">
        <div className="field">
          <label>ID</label>
          <input
            type="text"
            value={spot.id ?? ''}
            onChange={(e) => onUpdate({ id: e.target.value })}
          />
        </div>
        <div className="field">
          <label>第几天</label>
          <input
            type="number"
            value={spot.day ?? ''}
            onChange={(e) =>
              onUpdate({ day: e.target.value === '' ? (undefined as any) : parseInt(e.target.value) })
            }
          />
        </div>
        <div className="field">
          <label>排序</label>
          <input
            type="number"
            value={spot.order ?? ''}
            onChange={(e) =>
              onUpdate({ order: e.target.value === '' ? (undefined as any) : parseInt(e.target.value) })
            }
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

        <div className="field field-wide">
          <label>名称</label>
          <input
            type="text"
            value={spot.name ?? ''}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </div>
        <div className="field field-wide">
          <label>英文名</label>
          <input
            type="text"
            value={spot.nameEn ?? ''}
            onChange={(e) => onUpdate({ nameEn: e.target.value })}
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
            onChange={(e) =>
              onUpdate({ lat: e.target.value === '' ? (undefined as any) : parseFloat(e.target.value) })
            }
          />
        </div>
        <div className="field">
          <label>经度 (Lng)</label>
          <input
            type="number"
            step="any"
            value={spot.lng ?? ''}
            onChange={(e) =>
              onUpdate({ lng: e.target.value === '' ? (undefined as any) : parseFloat(e.target.value) })
            }
          />
        </div>

        <div className="field">
          <label>时段</label>
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
            onChange={(e) =>
              onUpdate({
                stayMinutes:
                  e.target.value === '' ? (undefined as any) : parseInt(e.target.value),
              })
            }
          />
        </div>

        <div className="field">
          <label>下一站 ID (nextStopId)</label>
          {allSpots && allSpots.length > 0 ? (
            <select
              value={spot.nextStopId ?? ''}
              onChange={(e) =>
                onUpdate({ nextStopId: e.target.value === '' ? null : e.target.value })
              }
            >
              <option value="">— 无 —</option>
              {allSpots
                .filter((s) => s.id !== spot.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    D{s.day} · {s.name || s.id}
                  </option>
                ))}
            </select>
          ) : (
            <input
              type="text"
              value={spot.nextStopId ?? ''}
              onChange={(e) =>
                onUpdate({ nextStopId: e.target.value === '' ? null : e.target.value })
              }
            />
          )}
        </div>
        <div className="field checkbox-field">
          <input
            type="checkbox"
            id={`nearNextTransport-${spot.id}`}
            checked={!!spot.nearNextTransport}
            onChange={(e) => onUpdate({ nearNextTransport: e.target.checked })}
          />
          <label htmlFor={`nearNextTransport-${spot.id}`}>临近下一段交通</label>
        </div>

        <div className="field field-wide">
          <label>标签 (逗号分隔)</label>
          <input
            type="text"
            value={tagsValue}
            onChange={(e) =>
              onUpdate({
                tags: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="樱花, 夜景, 美食"
          />
        </div>

        <div className="field checkbox-field">
          <input
            type="checkbox"
            id={`mustVisit-${spot.id}`}
            checked={!!spot.mustVisit}
            onChange={(e) => onUpdate({ mustVisit: e.target.checked })}
          />
          <label htmlFor={`mustVisit-${spot.id}`}>必去景点</label>
        </div>
      </div>

      <details className="card-advanced" style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--admin-muted)', fontSize: '0.85rem' }}>
          展开说明 / 交通提示 / 联系方式
        </summary>
        <div className="field-grid" style={{ marginTop: 12 }}>
          <div className="field field-wide">
            <label>景点说明 (description)</label>
            <textarea
              rows={3}
              value={spot.description ?? ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
            />
          </div>
          <div className="field field-wide">
            <label>为什么去 (whyGo)</label>
            <textarea
              rows={3}
              value={spot.whyGo ?? ''}
              onChange={(e) => onUpdate({ whyGo: e.target.value })}
            />
          </div>
          <div className="field field-wide">
            <label>交通提示 (transportNote)</label>
            <textarea
              rows={2}
              value={spot.transportNote ?? ''}
              onChange={(e) => onUpdate({ transportNote: e.target.value })}
            />
          </div>

          <div className="field">
            <label>评分 (rating)</label>
            <input
              type="number"
              step="0.1"
              value={spot.rating ?? ''}
              onChange={(e) =>
                onUpdate({
                  rating: e.target.value === '' ? null : parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div className="field">
            <label>电话</label>
            <input
              type="text"
              value={spot.phone ?? ''}
              onChange={(e) => onUpdate({ phone: e.target.value })}
            />
          </div>
          <div className="field field-wide">
            <label>网站 (website)</label>
            <input
              type="url"
              value={spot.website ?? ''}
              onChange={(e) => onUpdate({ website: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="field field-wide">
            <label>Google Maps 链接</label>
            <input
              type="url"
              value={spot.googleMapsUri ?? ''}
              onChange={(e) => onUpdate({ googleMapsUri: e.target.value })}
              placeholder="https://maps.google.com/..."
            />
          </div>
          <div className="field field-wide">
            <label>Google Place ID</label>
            <input
              type="text"
              value={spot.googlePlaceId ?? ''}
              onChange={(e) => onUpdate({ googlePlaceId: e.target.value })}
            />
          </div>
          <div className="field field-wide">
            <label>营业时间 (每行一条)</label>
            <textarea
              rows={4}
              value={openingHoursValue}
              onChange={(e) =>
                onUpdate({
                  openingHours: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder={'周一: 09:00 - 21:00\n周二: 09:00 - 21:00'}
            />
          </div>
        </div>
      </details>

      <PhotoUploader
        photos={spot.photos || []}
        onChange={(photos) => onUpdate({ photos })}
      />
    </div>
  );
}
