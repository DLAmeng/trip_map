import { useEffect, useMemo, useState } from 'react';
import type { SpotItem, TripMeta } from '../../../types/trip';
import { parsePathInput } from '../../../utils/trip-normalize';
import { RouteDetailContent } from '../../trip/components/RouteDetailContent';
import { BatchImportPanel } from './BatchImportPanel';
import { PhotoUploader } from './PhotoUploader';
import { PlaceSearchAutocomplete } from './PlaceSearchAutocomplete';
import { TripMetaForm } from './TripMetaForm';
import type { LegDraft, PlannerSegment } from '../hooks/useTripPlannerEditor';

interface PlannerInspectorProps {
  meta: TripMeta;
  spots: SpotItem[];
  selectedSpot: SpotItem | null;
  selectedSegment: PlannerSegment | null;
  spotById: Map<string, SpotItem>;
  onUpdateMeta: (payload: Partial<TripMeta>) => void;
  onUpdateSpot: (spotId: string, payload: Partial<SpotItem>) => void;
  onDeleteSpot: (spotId: string) => void;
  onUpdateLeg: (key: string, payload: Partial<LegDraft>) => void;
  onResetLeg: (key: string) => void;
  onDeleteDetachedSegment: (segmentId: string) => void;
  onFocusSpot: (spotId: string) => void;
  onAddImportedSpots: (spots: SpotItem[]) => void;
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

const TRANSPORT_OPTIONS = [
  'walk',
  'bus',
  'drive',
  'train',
  'metro',
  'subway',
  'jrrapid',
  'shinkansen',
  'nankai',
];

export function PlannerInspector({
  meta,
  spots,
  selectedSpot,
  selectedSegment,
  spotById,
  onUpdateMeta,
  onUpdateSpot,
  onDeleteSpot,
  onUpdateLeg,
  onResetLeg,
  onDeleteDetachedSegment,
  onFocusSpot,
  onAddImportedSpots,
}: PlannerInspectorProps) {
  const [pathOverrideText, setPathOverrideText] = useState('');
  const [pathError, setPathError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedSegment) {
      setPathOverrideText('');
      setPathError(null);
      return;
    }
    setPathOverrideText(JSON.stringify(selectedSegment.path || [], null, 2));
    setPathError(null);
  }, [selectedSegment]);

  const segmentEndpoints = useMemo(() => {
    if (!selectedSegment) return null;
    return {
      from: spotById.get(selectedSegment.fromSpotId) || null,
      to: spotById.get(selectedSegment.toSpotId) || null,
    };
  }, [selectedSegment, spotById]);

  const applyPathOverride = () => {
    if (!selectedSegment) return;
    try {
      const pathOverride = parsePathInput(pathOverrideText);
      onUpdateLeg(selectedSegment.key, { pathOverride });
      setPathError(null);
    } catch (error) {
      setPathError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <aside className="planner-inspector">
      <section className="panel planner-inspector-panel">
        <div className="panel-head">
          <div>
            <p className="panel-kicker">Inspector</p>
            <h2>{selectedSpot ? '景点详情' : selectedSegment ? '路线设置' : '当前未选中对象'}</h2>
          </div>
        </div>

        {selectedSpot ? (
          <div className="planner-inspector-body">
            <div className="planner-inspector-summary">
              <div>
                <strong>{selectedSpot.name || '未命名景点'}</strong>
                <p>
                  Day {selectedSpot.day} · 顺序 {selectedSpot.order} · {selectedSpot.city || '待补城市'}
                </p>
              </div>
              <div className="planner-inspector-actions">
                {selectedSpot.googleMapsUri ? (
                  <a className="btn btn-ghost" href={selectedSpot.googleMapsUri} target="_blank" rel="noreferrer">
                    Google Maps
                  </a>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-danger"
                  onClick={() => onDeleteSpot(selectedSpot.id)}
                >
                  删除景点
                </button>
              </div>
            </div>

            <div className="field-grid">
              <div className="field field-wide">
                <label>智能补全</label>
                <PlaceSearchAutocomplete
                  onSelect={(place) => {
                    onUpdateSpot(selectedSpot.id, {
                      name: place.name,
                      lat: place.lat,
                      lng: place.lng,
                    });
                  }}
                  placeholder="搜索地点并带入名称与坐标..."
                />
              </div>
              <div className="field field-wide">
                <label>名称</label>
                <input
                  type="text"
                  value={selectedSpot.name ?? ''}
                  onChange={(event) => onUpdateSpot(selectedSpot.id, { name: event.target.value })}
                />
              </div>
              <div className="field">
                <label>城市</label>
                <input
                  type="text"
                  value={selectedSpot.city ?? ''}
                  onChange={(event) => onUpdateSpot(selectedSpot.id, { city: event.target.value })}
                />
              </div>
              <div className="field">
                <label>区域</label>
                <input
                  type="text"
                  value={selectedSpot.area ?? ''}
                  onChange={(event) => onUpdateSpot(selectedSpot.id, { area: event.target.value })}
                />
              </div>
              <div className="field">
                <label>时段</label>
                <input
                  type="text"
                  value={selectedSpot.timeSlot ?? ''}
                  onChange={(event) => onUpdateSpot(selectedSpot.id, { timeSlot: event.target.value })}
                />
              </div>
              <div className="field">
                <label>停留时长 (分钟)</label>
                <input
                  type="number"
                  value={selectedSpot.stayMinutes ?? ''}
                  onChange={(event) =>
                    onUpdateSpot(selectedSpot.id, {
                      stayMinutes:
                        event.target.value === '' ? undefined : Number.parseInt(event.target.value, 10),
                    })
                  }
                />
              </div>
              <div className="field">
                <label>纬度</label>
                <input
                  type="number"
                  step="any"
                  value={selectedSpot.lat ?? ''}
                  onChange={(event) =>
                    onUpdateSpot(selectedSpot.id, {
                      lat: event.target.value === '' ? undefined : Number.parseFloat(event.target.value),
                    })
                  }
                />
              </div>
              <div className="field">
                <label>经度</label>
                <input
                  type="number"
                  step="any"
                  value={selectedSpot.lng ?? ''}
                  onChange={(event) =>
                    onUpdateSpot(selectedSpot.id, {
                      lng: event.target.value === '' ? undefined : Number.parseFloat(event.target.value),
                    })
                  }
                />
              </div>
              <label className="field checkbox-field">
                <input
                  type="checkbox"
                  checked={!!selectedSpot.mustVisit}
                  onChange={(event) => onUpdateSpot(selectedSpot.id, { mustVisit: event.target.checked })}
                />
                <span>标记为必去</span>
              </label>
              <div className="field">
                <label>类型</label>
                <select
                  value={selectedSpot.type ?? 'spot'}
                  onChange={(event) =>
                    onUpdateSpot(selectedSpot.id, {
                      type: event.target.value as SpotItem['type'],
                    })
                  }
                >
                  <option value="spot">景点 / 停留点</option>
                  <option value="transport">交通节点</option>
                </select>
              </div>
              <div className="field field-wide">
                <label>描述</label>
                <textarea
                  rows={4}
                  value={selectedSpot.description ?? ''}
                  onChange={(event) => onUpdateSpot(selectedSpot.id, { description: event.target.value })}
                />
              </div>
              <div className="field field-wide">
                <label>为什么去</label>
                <textarea
                  rows={3}
                  value={selectedSpot.whyGo ?? ''}
                  onChange={(event) => onUpdateSpot(selectedSpot.id, { whyGo: event.target.value })}
                />
              </div>
            </div>

            <details className="planner-advanced-details">
              <summary>低频字段与外链</summary>
              <div className="field-grid">
                <div className="field field-wide">
                  <label>标签 (逗号分隔)</label>
                  <input
                    type="text"
                    value={selectedSpot.tags?.join(', ') ?? ''}
                    onChange={(event) =>
                      onUpdateSpot(selectedSpot.id, { tags: csvToTags(event.target.value) })
                    }
                  />
                </div>
                <div className="field field-wide">
                  <label>交通备注</label>
                  <textarea
                    rows={3}
                    value={selectedSpot.transportNote ?? ''}
                    onChange={(event) =>
                      onUpdateSpot(selectedSpot.id, { transportNote: event.target.value })
                    }
                  />
                </div>
                <div className="field field-wide">
                  <label>Google Maps 链接</label>
                  <input
                    type="url"
                    value={selectedSpot.googleMapsUri ?? ''}
                    onChange={(event) =>
                      onUpdateSpot(selectedSpot.id, { googleMapsUri: event.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Google Place ID</label>
                  <input
                    type="text"
                    value={selectedSpot.googlePlaceId ?? ''}
                    onChange={(event) =>
                      onUpdateSpot(selectedSpot.id, { googlePlaceId: event.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>评分</label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedSpot.rating ?? ''}
                    onChange={(event) =>
                      onUpdateSpot(selectedSpot.id, {
                        rating: event.target.value === '' ? null : Number.parseFloat(event.target.value),
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>网站</label>
                  <input
                    type="url"
                    value={selectedSpot.website ?? ''}
                    onChange={(event) => onUpdateSpot(selectedSpot.id, { website: event.target.value })}
                  />
                </div>
                <div className="field">
                  <label>电话</label>
                  <input
                    type="text"
                    value={selectedSpot.phone ?? ''}
                    onChange={(event) => onUpdateSpot(selectedSpot.id, { phone: event.target.value })}
                  />
                </div>
                <div className="field field-wide">
                  <label>营业时间 (每行一条)</label>
                  <textarea
                    rows={4}
                    value={selectedSpot.openingHours?.join('\n') ?? ''}
                    onChange={(event) =>
                      onUpdateSpot(selectedSpot.id, {
                        openingHours: linesToList(event.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label>照片</label>
                <PhotoUploader
                  photos={selectedSpot.photos || []}
                  onChange={(photos) => onUpdateSpot(selectedSpot.id, { photos })}
                />
              </div>
            </details>
          </div>
        ) : null}

        {!selectedSpot && selectedSegment ? (
          <div className="planner-inspector-body">
            <div className="planner-inspector-summary">
              <div>
                <strong>{selectedSegment.label || '未命名路线段'}</strong>
                <p>
                  Day {selectedSegment.day}
                  {selectedSegment.detached ? ' · 兼容保留段' : ' · 自动生成段'}
                </p>
              </div>
              <div className="planner-inspector-actions">
                {selectedSegment.detached ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-danger"
                    onClick={() => onDeleteDetachedSegment(selectedSegment.id)}
                  >
                    删除兼容段
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onResetLeg(selectedSegment.key)}
                  >
                    恢复自动路线
                  </button>
                )}
              </div>
            </div>

            <div className="planner-leg-endpoints">
              <button
                type="button"
                className="planner-endpoint-chip"
                onClick={() => segmentEndpoints?.from && onFocusSpot(segmentEndpoints.from.id)}
              >
                起点: {segmentEndpoints?.from?.name || selectedSegment.fromSpotId}
              </button>
              <button
                type="button"
                className="planner-endpoint-chip"
                onClick={() => segmentEndpoints?.to && onFocusSpot(segmentEndpoints.to.id)}
              >
                终点: {segmentEndpoints?.to?.name || selectedSegment.toSpotId}
              </button>
            </div>

            <div className="field-grid">
              <div className="field">
                <label>交通方式</label>
                <select
                  value={selectedSegment.transportType || 'walk'}
                  onChange={(event) =>
                    onUpdateLeg(selectedSegment.key, { transportType: event.target.value })
                  }
                >
                  {TRANSPORT_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>范围</label>
                <select
                  value={selectedSegment.scope}
                  onChange={(event) =>
                    onUpdateLeg(selectedSegment.key, {
                      scope: event.target.value as PlannerSegment['scope'],
                    })
                  }
                >
                  <option value="city">市内</option>
                  <option value="intercity">跨城</option>
                </select>
              </div>
              <div className="field field-wide">
                <label>路线标题</label>
                <input
                  type="text"
                  value={selectedSegment.label ?? ''}
                  onChange={(event) => onUpdateLeg(selectedSegment.key, { label: event.target.value })}
                />
              </div>
              <div className="field">
                <label>预计时长</label>
                <input
                  type="text"
                  value={selectedSegment.duration ?? ''}
                  onChange={(event) =>
                    onUpdateLeg(selectedSegment.key, { duration: event.target.value })
                  }
                  placeholder="例如 35 分钟 / 2h 10m"
                />
              </div>
              <div className="field field-wide">
                <label>备注</label>
                <textarea
                  rows={4}
                  value={selectedSegment.note ?? ''}
                  onChange={(event) => onUpdateLeg(selectedSegment.key, { note: event.target.value })}
                />
              </div>
            </div>

            <div className="planner-route-runtime">
              <RouteDetailContent segment={selectedSegment} />
            </div>

            <details className="planner-advanced-details">
              <summary>高级路径覆盖</summary>
              <div className="field field-wide">
                <label>path override JSON</label>
                <textarea
                  rows={8}
                  value={pathOverrideText}
                  onChange={(event) => setPathOverrideText(event.target.value)}
                  spellCheck={false}
                />
                {pathError ? <p className="planner-field-error">{pathError}</p> : null}
              </div>
              <div className="planner-inline-actions">
                <button type="button" className="btn btn-ghost" onClick={applyPathOverride}>
                  应用路径覆盖
                </button>
                {!selectedSegment.detached ? (
                  <button type="button" className="btn btn-ghost" onClick={() => onResetLeg(selectedSegment.key)}>
                    清除覆盖并恢复自动生成
                  </button>
                ) : null}
              </div>
            </details>
          </div>
        ) : null}

        {!selectedSpot && !selectedSegment ? (
          <div className="planner-empty-inspector">
            <strong>从左侧或地图上选一个景点 / 路线</strong>
            <p>景点顺序决定自动路线，右侧只负责调整当前对象的细节。</p>
          </div>
        ) : null}
      </section>

      <details className="panel planner-side-panel" open={!selectedSpot && !selectedSegment}>
        <summary className="planner-side-summary">行程基础信息</summary>
        <TripMetaForm meta={meta} onChange={onUpdateMeta} />
      </details>

      <details className="panel planner-side-panel">
        <summary className="planner-side-summary">批量导入 GPX / KML / Google Maps</summary>
        <BatchImportPanel spots={spots} onAddSpots={onAddImportedSpots} />
      </details>
    </aside>
  );
}
