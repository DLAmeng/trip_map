export interface AdminToast {
  id: string;
  tone: 'success' | 'info' | 'warning' | 'error';
  title: string;
  detail?: string;
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
        <div key={item.id} className={`admin-toast is-${item.tone}`}>
          <div className="admin-toast-copy">
            <strong>{item.title}</strong>
            {item.detail ? <p>{item.detail}</p> : null}
          </div>
          <button type="button" className="admin-toast-dismiss" onClick={() => onDismiss(item.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
