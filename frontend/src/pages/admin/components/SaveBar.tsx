interface SaveBarProps {
  onSave: () => void;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenSettings: () => void;
  /** 触发 ConflictsModal 打开,issueCount > 0 时按钮显示红点 */
  onOpenConflicts: () => void;
  issueCount: number;
  isSaving: boolean;
  isSyncing: boolean;
  isReloading: boolean;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  restoredFromLocalDraft: boolean;
  inlineMessage?: string | null;
}

/**
 * 简化后的 SaveBar(P-final 移动优先重设计):
 *   - 撤销 / 重做(常用) — 一组
 *   - 设置 ⚙(打开 AdminSettingsSheet,放重载/导入/导出/Meta/批量导入)
 *   - 冲突 🔔 + N(issueCount>0 时显示红点,触发 ConflictsModal)
 *   - 重置 / 保存更改 — 主按钮组
 *
 * 删除的按钮(已移到 AdminSettingsSheet):重载最新 / 导入本地 / 导出本地
 */
export function SaveBar({
  onSave,
  onReset,
  onUndo,
  onRedo,
  onOpenSettings,
  onOpenConflicts,
  issueCount,
  isSaving,
  isSyncing,
  isReloading,
  isDirty,
  canUndo,
  canRedo,
  restoredFromLocalDraft,
  inlineMessage,
}: SaveBarProps) {
  const isBusy = isSaving || isSyncing || isReloading;

  return (
    <div className="save-bar">
      <div className="save-bar-info">
        <span className={isDirty ? 'save-status-dirty' : 'save-status-clean'}>
          {isDirty ? '● 您有未保存的更改' : '所有更改已保存'}
        </span>
        {restoredFromLocalDraft ? (
          <span className="save-status-draft">已恢复本地草稿</span>
        ) : null}
        {inlineMessage ? <span className="save-status-inline">{inlineMessage}</span> : null}
      </div>
      <div className="save-bar-actions">
        {/* 组 1:撤销 / 重做 */}
        <div className="save-bar-group">
          <button
            className="btn btn-ghost"
            onClick={onUndo}
            disabled={!canUndo || isBusy}
            title="撤销上一步"
            aria-label="撤销"
          >
            撤销
          </button>
          <button
            className="btn btn-ghost"
            onClick={onRedo}
            disabled={!canRedo || isBusy}
            title="恢复刚才撤销的更改"
            aria-label="重做"
          >
            重做
          </button>
        </div>

        {/* 组 2:冲突 + 设置 */}
        <div className="save-bar-group">
          <button
            type="button"
            className={`btn btn-ghost save-bar-conflict-btn${issueCount > 0 ? ' has-issues' : ''}`}
            onClick={onOpenConflicts}
            title={issueCount > 0 ? `${issueCount} 处冲突,点击查看` : '检查行程冲突'}
            aria-label={issueCount > 0 ? `${issueCount} 处冲突` : '冲突检查'}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
              <path
                d="M8 1.5l6.5 11.5h-13L8 1.5z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path d="M8 6v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="8" cy="11.5" r="0.7" fill="currentColor" />
            </svg>
            {issueCount > 0 ? <span className="save-bar-issue-badge">{issueCount}</span> : null}
          </button>
          <button
            type="button"
            className="btn btn-ghost save-bar-settings-btn"
            onClick={onOpenSettings}
            title="设置 / 批量导入 / 本地 JSON"
            aria-label="设置"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M8 1v2M8 13v2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M1 8h2M13 8h2M3.5 12.5l1.5-1.5M11 5l1.5-1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* 组 3:重置 / 保存(primary) */}
        <div className="save-bar-group save-bar-group-primary">
          <button
            className="btn btn-ghost btn-danger"
            onClick={onReset}
            disabled={!isDirty || isBusy}
            title="丢弃未保存的所有更改"
          >
            重置
          </button>
          <button
            className="btn btn-primary btn-save"
            onClick={onSave}
            disabled={!isDirty || isBusy}
          >
            {isSaving ? '正在保存...' : '保存更改'}
          </button>
        </div>
      </div>
    </div>
  );
}
