import { useEffect } from 'react';
import type { SpotItem, TripMeta } from '../../../types/trip';
import { TripMetaForm } from './TripMetaForm';
import { BatchImportPanel } from './BatchImportPanel';

interface AdminSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  meta: TripMeta;
  spots: SpotItem[];
  isDefaultTrip: boolean;
  onUpdateMeta: (payload: Partial<TripMeta>) => void;
  onAddImportedSpots: (spots: SpotItem[]) => void;
  onReload: () => void;
  onImport: () => void;
  onExport: () => void;
  isReloading: boolean;
  isSaving: boolean;
  isSyncing: boolean;
}

/**
 * 容纳从主流程移走的低频功能:
 *   - 行程 Meta 编辑(标题/描述/目的地/起止/标签/dayColors)
 *   - 批量导入(CSV / JSON / Google Maps URL)
 *   - 本地 itinerary.json 重载/导入/导出 (仅 isDefaultTrip)
 *
 * 移动端:bottom sheet 风格,从底部滑入,max-height 88vh
 * 桌面端:右侧 360px 抽屉(同 backdrop)
 */
export function AdminSettingsSheet({
  isOpen,
  onClose,
  meta,
  spots,
  isDefaultTrip,
  onUpdateMeta,
  onAddImportedSpots,
  onReload,
  onImport,
  onExport,
  isReloading,
  isSaving,
  isSyncing,
}: AdminSettingsSheetProps) {
  // Esc 关闭
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isBusy = isReloading || isSaving || isSyncing;

  return (
    <>
      <div className="admin-sheet-backdrop" onClick={onClose} />
      <aside
        className="admin-settings-sheet"
        role="dialog"
        aria-label="行程设置"
      >
        <div className="admin-sheet-handle" aria-hidden="true" />
        <header className="admin-sheet-header">
          <h2>行程设置</h2>
          <button
            type="button"
            className="admin-sheet-close"
            onClick={onClose}
            aria-label="关闭设置"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="admin-sheet-body">
          {/* 1. 行程基础信息 */}
          <section className="admin-sheet-section">
            <h3 className="admin-sheet-section-title">基础信息</h3>
            <TripMetaForm meta={meta} onChange={onUpdateMeta} />
          </section>

          {/* 2. 批量导入 */}
          <section className="admin-sheet-section">
            <h3 className="admin-sheet-section-title">批量导入</h3>
            <p className="admin-sheet-section-desc">
              从 CSV / JSON / Google Maps URL 一次添加多个景点。
            </p>
            <BatchImportPanel spots={spots} onAddSpots={onAddImportedSpots} />
          </section>

          {/* 3. 本地 itinerary.json 工具 — 仅默认行程显示(开发期/迁移使用) */}
          {isDefaultTrip ? (
            <section className="admin-sheet-section">
              <h3 className="admin-sheet-section-title">本地数据 · 高级</h3>
              <p className="admin-sheet-section-desc">
                与项目根目录的 itinerary.json 互通,仅默认行程可用。
              </p>
              <div className="admin-sheet-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onReload}
                  disabled={isBusy}
                  title="从数据库重新载入,丢弃未保存改动"
                >
                  {isReloading ? '重载中…' : '重载最新'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onImport}
                  disabled={isBusy}
                  title="把本地 itinerary.json 内容导入"
                >
                  导入本地 JSON
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onExport}
                  disabled={isBusy}
                  title="把当前行程导出到本地 itinerary.json"
                >
                  导出本地 JSON
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </>
  );
}
