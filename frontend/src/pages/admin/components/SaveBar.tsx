interface SaveBarProps {
  onSave: () => void;
  onReset: () => void;
  onImport: () => void;
  onExport: () => void;
  isSaving: boolean;
  isSyncing: boolean;
  isDirty: boolean;
}

export function SaveBar({
  onSave,
  onReset,
  onImport,
  onExport,
  isSaving,
  isSyncing,
  isDirty,
}: SaveBarProps) {
  return (
    <div className="save-bar">
      <div className="save-bar-info">
        {isDirty ? (
          <span className="save-status-dirty">● 您有未保存的更改</span>
        ) : (
          <span className="save-status-clean">所有更改已保存</span>
        )}
      </div>
      <div className="save-bar-actions">
        <button
          className="btn btn-ghost"
          onClick={onImport}
          disabled={isSaving || isSyncing}
          title="从本地 itinerary.json 导入"
        >
          导入本地
        </button>
        <button
          className="btn btn-ghost"
          onClick={onExport}
          disabled={isSaving || isSyncing}
          title="导出到本地 itinerary.json"
        >
          导出本地
        </button>
        <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 8px' }} />
        <button
          className="btn btn-ghost"
          onClick={onReset}
          disabled={!isDirty || isSaving || isSyncing}
        >
          重置
        </button>
        <button
          className="btn btn-primary"
          onClick={onSave}
          disabled={!isDirty || isSaving || isSyncing}
        >
          {isSaving ? '正在保存...' : '保存更改'}
        </button>
      </div>
    </div>
  );
}
