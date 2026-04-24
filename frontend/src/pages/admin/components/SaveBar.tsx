interface SaveBarProps {
  onSave: () => void;
  onReset: () => void;
  onReload: () => void;
  onImport: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  isSaving: boolean;
  isSyncing: boolean;
  isReloading: boolean;
  isDirty: boolean;
  isDefaultTrip: boolean;
  canUndo: boolean;
  canRedo: boolean;
  restoredFromLocalDraft: boolean;
  inlineMessage?: string | null;
}

export function SaveBar({
  onSave,
  onReset,
  onReload,
  onImport,
  onExport,
  onUndo,
  onRedo,
  isSaving,
  isSyncing,
  isReloading,
  isDirty,
  isDefaultTrip,
  canUndo,
  canRedo,
  restoredFromLocalDraft,
  inlineMessage,
}: SaveBarProps) {
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
        <div className="save-bar-group">
          <button
            className="btn btn-ghost"
            onClick={onUndo}
            disabled={!canUndo || isSaving || isSyncing || isReloading}
            title="撤销上一步"
          >
            撤销
          </button>
          <button
            className="btn btn-ghost"
            onClick={onRedo}
            disabled={!canRedo || isSaving || isSyncing || isReloading}
            title="恢复刚才撤销的更改"
          >
            重做
          </button>
        </div>
        <div className="save-bar-group">
          <button
            className="btn btn-ghost"
            onClick={onReload}
            disabled={isSaving || isSyncing || isReloading}
            title="重新从数据库载入最新行程"
          >
            {isReloading ? '重载中...' : '重载最新'}
          </button>
          {isDefaultTrip ? (
            <>
              <button
                className="btn btn-ghost"
                onClick={onImport}
                disabled={isSaving || isSyncing || isReloading}
                title="从本地 itinerary.json 导入"
              >
                导入本地
              </button>
              <button
                className="btn btn-ghost"
                onClick={onExport}
                disabled={isSaving || isSyncing || isReloading}
                title="导出到本地 itinerary.json"
              >
                导出本地
              </button>
            </>
          ) : null}
        </div>
        <div className="save-bar-group save-bar-group-primary">
          <button
            className="btn btn-ghost"
            onClick={onReset}
            disabled={!isDirty || isSaving || isSyncing || isReloading}
          >
            重置
          </button>
          <button
            className="btn btn-primary"
            onClick={onSave}
            disabled={!isDirty || isSaving || isSyncing || isReloading}
          >
            {isSaving ? '正在保存...' : '保存更改'}
          </button>
        </div>
      </div>
    </div>
  );
}
