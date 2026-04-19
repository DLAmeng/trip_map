import type { TripMeta } from '../../../types/trip';

interface TripMetaFormProps {
  meta: TripMeta;
  onChange: (meta: Partial<TripMeta>) => void;
}

export function TripMetaForm({ meta, onChange }: TripMetaFormProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>基础信息</h2>
      </div>
      <div className="field-grid">
        <div className="field field-wide">
          <label htmlFor="trip-title">行程标题</label>
          <input
            id="trip-title"
            type="text"
            value={meta.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="例如：日本最终行程表"
          />
        </div>
        <div className="field field-wide">
          <label htmlFor="trip-desc">描述</label>
          <textarea
            id="trip-desc"
            value={meta.description ?? ''}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="简要描述行程内容..."
          />
        </div>
      </div>
    </section>
  );
}
