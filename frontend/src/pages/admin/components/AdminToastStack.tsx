export interface AdminToast {
  id: string;
  tone: 'success' | 'info' | 'warning' | 'error';
  title: string;
  detail?: string;
  /** P4-2: 可选 undo action — 删除/重排等破坏性操作显示"撤销"按钮 */
  action?: {
    label: string;
    onAction: () => void;
  };
}

interface AdminToastStackProps {
  items: AdminToast[];
  onDismiss: (id: string) => void;
}

export function AdminToastStack({ items, onDismiss }: AdminToastStackProps) {
  if (!items.length) return null;

  return (
    <div className="admin-toast-stack" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`admin-toast is-${item.tone}${item.action ? ' has-action' : ''}`}>
          <div className="admin-toast-copy">
            <strong>{item.title}</strong>
            {item.detail ? <p>{item.detail}</p> : null}
          </div>
          {item.action ? (
            <button
              type="button"
              className="admin-toast-action"
              onClick={() => {
                item.action!.onAction();
                onDismiss(item.id);
              }}
            >
              {item.action.label}
            </button>
          ) : null}
          <button type="button" className="admin-toast-dismiss" onClick={() => onDismiss(item.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
