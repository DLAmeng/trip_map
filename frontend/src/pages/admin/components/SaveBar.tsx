interface SaveBarProps {
  onSave: () => void;
  onReset: () => void;
  isSaving: boolean;
  isDirty: boolean;
}

export function SaveBar({ onSave, onReset, isSaving, isDirty }: SaveBarProps) {
  return (
    <div className="save-bar">
      <div className="save-bar-info">
        {isDirty ? (
          <span style={{ color: 'var(--admin-accent)' }}>● 您有未保存的更改</span>
        ) : (
          <span style={{ opacity: 0.6 }}>所有更改已保存</span>
        )}
      </div>
      <div className="save-bar-actions">
        <button
          className="btn btn-ghost"
          onClick={onReset}
          disabled={!isDirty || isSaving}
        >
          重置
        </button>
        <button
          className="btn btn-primary"
          onClick={onSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? '正在保存...' : '保存更改'}
        </button>
      </div>
    </div>
  );
}
