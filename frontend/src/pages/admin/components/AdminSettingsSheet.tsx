import { useEffect, useRef } from 'react';
import type { SpotItem, TripFullPayload, TripMeta } from '../../../types/trip';
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
  /** P19: 从用户电脑上传 JSON 文件,覆盖当前 trip(任意 trip 都能用,不限默认) */
  onImportFromFile: (parsed: TripFullPayload) => void;
  /** P20: 批量自动定位缺 lat/lng 的 spot,走 /api/places/search 反查 Google Places */
  onAutoLocateSpots: () => Promise<void> | void;
  /** P20: 当前缺位置 spot 数,用于按钮显示数量 + disabled 状态 */
  missingLocationCount: number;
  isAutoLocating: boolean;
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
  onImportFromFile,
  onAutoLocateSpots,
  missingLocationCount,
  isAutoLocating,
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

  // P19: file input ref + 上传处理
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * P19-2: 校验每个 spot 是否能被地图识别。
   * 地图渲染 marker 的条件:Number.isFinite(lat) && Number.isFinite(lng) && day 是有效数字。
   * 任一缺失,该 spot 不会出现在地图上(仅在列表显示)。
   */
  const analyzeImportPayload = (parsed: TripFullPayload) => {
    const spots = Array.isArray(parsed.spots) ? parsed.spots : [];
    const valid: SpotItem[] = [];
    const invalid: { spot: SpotItem; reasons: string[] }[] = [];
    for (const spot of spots) {
      const reasons: string[] = [];
      if (!Number.isFinite(spot?.lat)) reasons.push('缺 lat');
      if (!Number.isFinite(spot?.lng)) reasons.push('缺 lng');
      if (!Number.isFinite(spot?.day)) reasons.push('缺 day');
      if (reasons.length === 0) valid.push(spot);
      else invalid.push({ spot, reasons });
    }
    return { valid, invalid, total: spots.length };
  };

  const handleFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 处理完清空 value,让用户能连续上传同名文件
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as TripFullPayload;
      // 最小验证:必须有 spots 数组和 config 对象
      if (!parsed || typeof parsed !== 'object') {
        window.alert('文件不是合法 JSON,请检查内容。');
        return;
      }
      if (!Array.isArray(parsed.spots) || !parsed.config) {
        window.alert('JSON 缺少必要字段(spots / config),不是合法 itinerary。');
        return;
      }

      // P19-2: 预扫描所有 spot,统计地图可识别 / 不可识别
      const { valid, invalid, total } = analyzeImportPayload(parsed);

      // 全 0 景点 → 友好阻止
      if (total === 0) {
        window.alert('文件里 spots 数组是空的,导入后地图上看不到任何景点。请检查文件。');
        return;
      }

      // 全部 spot 字段都缺 → 阻止(数据格式不对)
      if (valid.length === 0) {
        const samples = invalid.slice(0, 3).map(
          (it) => `  · ${it.spot?.name || '<未命名>'}:${it.reasons.join(' / ')}`,
        ).join('\n');
        window.alert(
          `文件里 ${total} 个景点全部缺关键字段(lat / lng / day),地图无法识别。\n\n` +
          `前 3 个示例:\n${samples}\n\n` +
          `请检查 JSON 格式是否正确。每个 spot 需要 lat / lng / day 三个数字字段。`,
        );
        return;
      }

      // 部分 invalid 加警告;全 valid 给绿光
      const warnLine = invalid.length > 0
        ? `\n⚠ ${invalid.length} 个景点缺字段(列表可见,但地图不显示 marker)`
        : '\n✓ 所有景点位置完整,地图可全部识别';
      const ok = window.confirm(
        `确定用上传的文件覆盖当前行程吗?\n\n` +
        `上传:${total} 个景点 / ${parsed.routeSegments?.length || 0} 条路线\n` +
        `✓ ${valid.length} 个景点有完整位置(lat / lng / day)${warnLine}\n\n` +
        `此操作会丢弃当前未保存的修改,但你可以"撤销"或重新加载恢复。`,
      );
      if (!ok) return;
      onImportFromFile(parsed);
    } catch (err) {
      window.alert(`文件解析失败:${(err as Error).message}`);
    }
  };

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
          {/* 1. 行程基础信息 — 高频 */}
          <section className="admin-sheet-section">
            <h3 className="admin-sheet-section-title">基础信息</h3>
            <div className="admin-sheet-embed">
              <TripMetaForm meta={meta} onChange={onUpdateMeta} />
            </div>
          </section>

          {/* P21: 2. 从文件导入行程 — JSON 主入口,提到第 2 位 + 加"推荐"徽章 */}
          <section className="admin-sheet-section">
            <h3 className="admin-sheet-section-title">
              从文件导入行程
              <span className="admin-sheet-section-pill">推荐</span>
            </h3>
            <p className="admin-sheet-section-desc">
              选择电脑上的 <code>itinerary.json</code> 文件,<strong>整体覆盖</strong>当前行程
              (包括 spots / 路线 / meta)。<br/>
              <strong>地图识别要求</strong>:每个 spot 需要 <code>lat / lng / day</code>
              {' '}三个数字字段才能在地图上显示 marker;缺字段的 spot 仍在列表显示,但地图不会画它。
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleFilePicked}
            />
            <div className="admin-sheet-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                title="从电脑上传一个 itinerary.json 文件"
              >
                选择 JSON 文件…
              </button>
            </div>
          </section>

          {/* P20: 3. 批量自动定位缺位置景点 */}
          <section className="admin-sheet-section">
            <h3 className="admin-sheet-section-title">
              修复缺位置景点
              {missingLocationCount > 0 ? (
                <span style={{
                  marginLeft: 8,
                  fontSize: '0.72rem',
                  background: 'rgba(234, 88, 12, 0.12)',
                  color: '#c2410c',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}>{missingLocationCount} 个待修</span>
              ) : null}
            </h3>
            <p className="admin-sheet-section-desc">
              如果导入的 JSON 里景点名字写对了但缺 <code>lat/lng</code>,
              这里可以<strong>自动用 Google Places 反查</strong>(根据 name + 城市)填回。<br/>
              <strong>注意</strong>:同名地点多个时,可能定位到错的(比如"中央公园"
              在多个城市都有)。修复后请去 SpotInspector 复核,失败的可手动搜索。
            </p>
            <div className="admin-sheet-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onAutoLocateSpots()}
                disabled={isBusy || isAutoLocating || missingLocationCount === 0}
                title={
                  missingLocationCount === 0
                    ? '所有景点已有经纬度'
                    : `用 Google Places 自动定位 ${missingLocationCount} 个缺位置景点`
                }
              >
                {isAutoLocating
                  ? '反查中…'
                  : missingLocationCount === 0
                    ? '所有景点已有位置'
                    : `自动定位 ${missingLocationCount} 个景点`}
              </button>
            </div>
          </section>

          {/* P21: 4. 批量导入 (GPX/KML/URL) — 文案纠正:不再误标"JSON",且小字指引整 trip JSON 走上方 */}
          <section className="admin-sheet-section">
            <h3 className="admin-sheet-section-title">
              批量导入
              <span className="admin-sheet-section-tag">GPX / KML / URL</span>
            </h3>
            <p className="admin-sheet-section-desc">
              从 GPX / KML 文件 或 Google Maps 链接一次<strong>追加</strong>多个景点。
              <small>整个行程的 JSON 导入请用上方"从文件导入行程"。</small>
            </p>
            <div className="admin-sheet-embed">
              <BatchImportPanel spots={spots} onAddSpots={onAddImportedSpots} />
            </div>
          </section>

          {/* 5. 本地 itinerary.json 工具 — 仅默认行程显示(开发期/迁移使用) */}
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
