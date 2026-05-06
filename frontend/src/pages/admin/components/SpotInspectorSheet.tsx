import { useEffect } from 'react';
import type { SpotItem } from '../../../types/trip';
import { PhotoUploader } from './PhotoUploader';
import { PlaceSearchAutocomplete } from './PlaceSearchAutocomplete';

interface SpotInspectorSheetProps {
  spot: SpotItem | null;
  onClose: () => void;
  onUpdateSpot: (spotId: string, payload: Partial<SpotItem>) => void;
  onDeleteSpot: (spotId: string) => void;
}

function csvToTags(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Spot 详情编辑 sheet — 替代原 PlannerInspector 的 spot 模式。
 *
 * 移动端:bottom sheet,从底部滑入,max-height 88vh
 * 桌面端:右侧浮卡,fixed top: 100px right: 24px width: 360px
 *
 * 内容分两层:
 *   - 常显:名称 / 城市 / 区域 / 时段 / 停留时长 / 必去 / 类型 / 描述 / 为什么去 + 智能补全
 *   - 高级折叠:坐标 / 标签 / 交通备注 / Google Maps / Place ID / 评分 / 网站 / 电话 / 营业时间 / 照片
 *
 * 平时不渲染(spot=null),减小 admin 主页视觉权重。
 */
export function SpotInspectorSheet({
  spot,
  onClose,
  onUpdateSpot,
  onDeleteSpot,
}: SpotInspectorSheetProps) {
  // Esc 关闭
  useEffect(() => {
    if (!spot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spot, onClose]);

  if (!spot) return null;

  return (
    <>
      <div className="admin-sheet-backdrop admin-sheet-backdrop-light" onClick={onClose} />
      <aside
        className="spot-inspector-sheet"
        role="dialog"
        aria-label="景点详情"
      >
        <div className="admin-sheet-handle" aria-hidden="true" />

        <header className="admin-sheet-header">
          <div className="spot-inspector-summary">
            <strong>{spot.name || '未命名景点'}</strong>
            <p>
              Day {spot.day} · 顺序 {spot.order} · {spot.city || '待补城市'}
            </p>
          </div>
          <button
            type="button"
            className="admin-sheet-close"
            onClick={onClose}
            aria-label="关闭"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="admin-sheet-body">
          {/* 顶部操作 */}
          <div className="spot-inspector-actions">
            {spot.googleMapsUri ? (
              <a className="btn btn-ghost" href={spot.googleMapsUri} target="_blank" rel="noreferrer">
                Google Maps
              </a>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-danger"
              onClick={() => {
                if (window.confirm(`删除景点"${spot.name || '未命名'}"?`)) {
                  onDeleteSpot(spot.id);
                  onClose();
                }
              }}
            >
              删除景点
            </button>
          </div>

          {/* 常显字段 */}
          <div className="field-grid">
            <div className="field field-wide">
              <label>智能补全</label>
              <PlaceSearchAutocomplete
                onSelect={(place) =>
                  onUpdateSpot(spot.id, {
                    name: place.name,
                    lat: place.lat,
                    lng: place.lng,
                  })
                }
                placeholder="搜索地点并带入名称与坐标..."
              />
            </div>
            <div className="field field-wide">
              <label>名称</label>
              <input
                type="text"
                value={spot.name ?? ''}
                onChange={(e) => onUpdateSpot(spot.id, { name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>城市</label>
              <input
                type="text"
                value={spot.city ?? ''}
                onChange={(e) => onUpdateSpot(spot.id, { city: e.target.value })}
              />
            </div>
            <div className="field">
              <label>区域</label>
              <input
                type="text"
                value={spot.area ?? ''}
                onChange={(e) => onUpdateSpot(spot.id, { area: e.target.value })}
              />
            </div>
            <div className="field">
              <label>时段</label>
              <input
                type="text"
                value={spot.timeSlot ?? ''}
                onChange={(e) => onUpdateSpot(spot.id, { timeSlot: e.target.value })}
              />
            </div>
            <div className="field">
              <label>停留 (分钟)</label>
              <input
                type="number"
                value={spot.stayMinutes ?? ''}
                onChange={(e) =>
                  onUpdateSpot(spot.id, {
                    stayMinutes: e.target.value === '' ? undefined : Number.parseInt(e.target.value, 10),
                  })
                }
              />
            </div>
            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={!!spot.mustVisit}
                onChange={(e) => onUpdateSpot(spot.id, { mustVisit: e.target.checked })}
              />
              <span>标记为必去</span>
            </label>
            <div className="field">
              <label>类型</label>
              <select
                value={spot.type ?? 'spot'}
                onChange={(e) =>
                  onUpdateSpot(spot.id, { type: e.target.value as SpotItem['type'] })
                }
              >
                <option value="spot">景点 / 停留点</option>
                <option value="transport">交通节点</option>
              </select>
            </div>
            <div className="field field-wide">
              <label>描述</label>
              <textarea
                rows={3}
                value={spot.description ?? ''}
                onChange={(e) => onUpdateSpot(spot.id, { description: e.target.value })}
              />
            </div>
            <div className="field field-wide">
              <label>为什么去</label>
              <textarea
                rows={2}
                value={spot.whyGo ?? ''}
                onChange={(e) => onUpdateSpot(spot.id, { whyGo: e.target.value })}
              />
            </div>
          </div>

          {/* 高级折叠 — 默认收起,点击展开 */}
          <details className="planner-advanced-details">
            <summary>高级 · 坐标 / 标签 / 联系信息 / 照片</summary>
            <div className="field-grid">
              <div className="field">
                <label>纬度</label>
                <input
                  type="number"
                  step="any"
                  value={spot.lat ?? ''}
                  onChange={(e) =>
                    onUpdateSpot(spot.id, {
                      lat: e.target.value === '' ? undefined : Number.parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div className="field">
                <label>经度</label>
                <input
                  type="number"
                  step="any"
                  value={spot.lng ?? ''}
                  onChange={(e) =>
                    onUpdateSpot(spot.id, {
                      lng: e.target.value === '' ? undefined : Number.parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div className="field field-wide">
                <label>标签 (逗号分隔)</label>
                <input
                  type="text"
                  value={spot.tags?.join(', ') ?? ''}
                  onChange={(e) => onUpdateSpot(spot.id, { tags: csvToTags(e.target.value) })}
                />
              </div>
              <div className="field field-wide">
                <label>交通备注</label>
                <textarea
                  rows={2}
                  value={spot.transportNote ?? ''}
                  onChange={(e) => onUpdateSpot(spot.id, { transportNote: e.target.value })}
                />
              </div>
              <div className="field field-wide">
                <label>Google Maps 链接</label>
                <input
                  type="url"
                  value={spot.googleMapsUri ?? ''}
                  onChange={(e) => onUpdateSpot(spot.id, { googleMapsUri: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Place ID</label>
                <input
                  type="text"
                  value={spot.googlePlaceId ?? ''}
                  onChange={(e) => onUpdateSpot(spot.id, { googlePlaceId: e.target.value })}
                />
              </div>
              <div className="field">
                <label>评分</label>
                <input
                  type="number"
                  step="0.1"
                  value={spot.rating ?? ''}
                  onChange={(e) =>
                    onUpdateSpot(spot.id, {
                      rating: e.target.value === '' ? null : Number.parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div className="field">
                <label>网站</label>
                <input
                  type="url"
                  value={spot.website ?? ''}
                  onChange={(e) => onUpdateSpot(spot.id, { website: e.target.value })}
                />
              </div>
              <div className="field">
                <label>电话</label>
                <input
                  type="text"
                  value={spot.phone ?? ''}
                  onChange={(e) => onUpdateSpot(spot.id, { phone: e.target.value })}
                />
              </div>
              <div className="field field-wide">
                <label>营业时间 (每行一条)</label>
                <textarea
                  rows={3}
                  value={spot.openingHours?.join('\n') ?? ''}
                  onChange={(e) =>
                    onUpdateSpot(spot.id, { openingHours: linesToList(e.target.value) })
                  }
                />
              </div>
              <div className="field field-wide">
                <label>照片</label>
                <PhotoUploader
                  photos={spot.photos || []}
                  onChange={(photos) => onUpdateSpot(spot.id, { photos })}
                />
              </div>
            </div>
          </details>
        </div>
      </aside>
    </>
  );
}
