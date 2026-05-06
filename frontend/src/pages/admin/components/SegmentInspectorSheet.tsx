import { useEffect, useMemo, useState } from 'react';
import type { SpotItem } from '../../../types/trip';
import type { LegDraft, PlannerSegment } from '../hooks/useTripPlannerEditor';
import { parsePathInput } from '../../../utils/trip-normalize';
import { RouteDetailContent } from '../../trip/components/RouteDetailContent';

interface SegmentInspectorSheetProps {
  segment: PlannerSegment | null;
  spotById: Map<string, SpotItem>;
  onClose: () => void;
  onUpdateLeg: (key: string, payload: Partial<LegDraft>) => void;
  onResetLeg: (key: string) => void;
  onDeleteDetachedSegment: (segmentId: string) => void;
  onFocusSpot: (spotId: string) => void;
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

/**
 * Segment 详情编辑 sheet — 替代原 PlannerInspector 的 segment 模式。
 * 移动端 bottom sheet,桌面端右侧浮卡。
 */
export function SegmentInspectorSheet({
  segment,
  spotById,
  onClose,
  onUpdateLeg,
  onResetLeg,
  onDeleteDetachedSegment,
  onFocusSpot,
}: SegmentInspectorSheetProps) {
  const [pathOverrideText, setPathOverrideText] = useState('');
  const [pathError, setPathError] = useState<string | null>(null);

  useEffect(() => {
    if (!segment) {
      setPathOverrideText('');
      setPathError(null);
      return;
    }
    setPathOverrideText(JSON.stringify(segment.path || [], null, 2));
    setPathError(null);
  }, [segment]);

  // Esc 关闭
  useEffect(() => {
    if (!segment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [segment, onClose]);

  const endpoints = useMemo(() => {
    if (!segment) return null;
    return {
      from: spotById.get(segment.fromSpotId) || null,
      to: spotById.get(segment.toSpotId) || null,
    };
  }, [segment, spotById]);

  if (!segment) return null;

  const applyPathOverride = () => {
    try {
      const parsed = parsePathInput(pathOverrideText);
      onUpdateLeg(segment.key, { pathOverride: parsed });
      setPathError(null);
    } catch (err) {
      setPathError((err as Error).message);
    }
  };

  return (
    <>
      <div className="admin-sheet-backdrop admin-sheet-backdrop-light" onClick={onClose} />
      <aside
        className="spot-inspector-sheet segment-inspector-sheet"
        role="dialog"
        aria-label="路线设置"
      >
        <div className="admin-sheet-handle" aria-hidden="true" />

        <header className="admin-sheet-header">
          <div className="spot-inspector-summary">
            <strong>{segment.label || '未命名路线段'}</strong>
            <p>
              Day {segment.day}
              {segment.detached ? ' · 兼容保留段' : ' · 自动生成段'}
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
          <div className="spot-inspector-actions">
            {segment.detached ? (
              <button
                type="button"
                className="btn btn-ghost btn-danger"
                onClick={() => {
                  if (window.confirm('删除该兼容段?')) {
                    onDeleteDetachedSegment(segment.id);
                    onClose();
                  }
                }}
              >
                删除兼容段
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onResetLeg(segment.key)}
              >
                恢复自动路线
              </button>
            )}
          </div>

          {/* 起终点芯片 */}
          <div className="planner-leg-endpoints">
            <button
              type="button"
              className="planner-endpoint-chip"
              onClick={() => endpoints?.from && onFocusSpot(endpoints.from.id)}
            >
              起点: {endpoints?.from?.name || segment.fromSpotId}
            </button>
            <button
              type="button"
              className="planner-endpoint-chip"
              onClick={() => endpoints?.to && onFocusSpot(endpoints.to.id)}
            >
              终点: {endpoints?.to?.name || segment.toSpotId}
            </button>
          </div>

          {/* 常用字段 */}
          <div className="field-grid">
            <div className="field">
              <label>交通方式</label>
              <select
                value={segment.transportType || 'walk'}
                onChange={(e) => onUpdateLeg(segment.key, { transportType: e.target.value })}
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
                value={segment.scope}
                onChange={(e) =>
                  onUpdateLeg(segment.key, { scope: e.target.value as PlannerSegment['scope'] })
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
                value={segment.label ?? ''}
                onChange={(e) => onUpdateLeg(segment.key, { label: e.target.value })}
              />
            </div>
            <div className="field">
              <label>预计时长</label>
              <input
                type="text"
                value={segment.duration ?? ''}
                onChange={(e) => onUpdateLeg(segment.key, { duration: e.target.value })}
                placeholder="例如 35 分钟 / 2h 10m"
              />
            </div>
            <div className="field field-wide">
              <label>备注</label>
              <textarea
                rows={3}
                value={segment.note ?? ''}
                onChange={(e) => onUpdateLeg(segment.key, { note: e.target.value })}
              />
            </div>
          </div>

          <div className="planner-route-runtime">
            <RouteDetailContent segment={segment} />
          </div>

          {/* 高级路径覆盖 */}
          <details className="planner-advanced-details">
            <summary>高级 · 路径 JSON 覆盖</summary>
            <div className="field field-wide">
              <label>path override JSON</label>
              <textarea
                rows={6}
                value={pathOverrideText}
                onChange={(e) => setPathOverrideText(e.target.value)}
                spellCheck={false}
              />
              {pathError ? <p className="planner-field-error">{pathError}</p> : null}
            </div>
            <div className="planner-inline-actions">
              <button type="button" className="btn btn-ghost" onClick={applyPathOverride}>
                应用路径覆盖
              </button>
              {!segment.detached ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onResetLeg(segment.key)}
                >
                  清除覆盖并恢复自动生成
                </button>
              ) : null}
            </div>
          </details>
        </div>
      </aside>
    </>
  );
}
