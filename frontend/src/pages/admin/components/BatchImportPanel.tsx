import { useMemo, useRef, useState } from 'react';
import type { SpotItem } from '../../../types/trip';
import { makeBlankSpot } from '../../../utils/trip-factory';
import {
  parseImportFile,
  parseImportUrls,
  type ParsedImportPoint,
} from '../../../utils/trip-import';

interface BatchImportPanelProps {
  /** 当前 trip 的 spots,用来推算"下一个 order" */
  spots: SpotItem[];
  onAddSpots: (newSpots: SpotItem[]) => void;
}

/**
 * 对齐旧版 `legacy/old-frontend/admin.html` 的 `panel-import`:
 * - 支持上传多个 GPX / KML 文件
 * - 支持粘贴 Google Maps 链接(每行一条)
 * - 解析后弹出预览,让用户选"导入到第几天"
 * - 确认导入时调 onAddSpots,用 makeBlankSpot 填全字段
 */
export function BatchImportPanel({ spots, onAddSpots }: BatchImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [pending, setPending] = useState<ParsedImportPoint[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [targetDay, setTargetDay] = useState<number>(1);

  const dayOptions = useMemo(() => {
    const days = Array.from(new Set(spots.map((s) => Number(s.day) || 0).filter(Boolean)))
      .sort((a, b) => a - b);
    // 保证有 1..max+1 的选项,方便"追加到新的一天"
    if (days.length === 0) return [1];
    const max = days[days.length - 1];
    const extended = new Set(days);
    extended.add(max + 1);
    return Array.from(extended).sort((a, b) => a - b);
  }, [spots]);

  // 如果当前 targetDay 不在可选范围里,拉回到第一个
  const effectiveDay = dayOptions.includes(targetDay) ? targetDay : dayOptions[0];

  const handleParse = async () => {
    setIsParsing(true);
    setParseError(null);
    try {
      const collected: ParsedImportPoint[] = [];
      const files = Array.from(fileInputRef.current?.files ?? []);
      for (const file of files) {
        const parsed = await parseImportFile(file);
        collected.push(...parsed);
      }
      collected.push(...parseImportUrls(urlInput));
      setPending(collected);
      if (collected.length === 0) {
        setParseError('没有解析到任何地点。请检查文件或链接格式。');
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
      setPending(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = () => {
    if (!pending || pending.length === 0) return;
    const day = effectiveDay;
    const sameDay = spots.filter((s) => Number(s.day) === day);
    let nextOrder = sameDay.length
      ? Math.max(...sameDay.map((s) => Number(s.order) || 0)) + 1
      : 1;

    const newSpots: SpotItem[] = pending.map((p) => {
      const spot = makeBlankSpot({
        day,
        order: nextOrder++,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
      });
      if (p.description) {
        spot.description = p.description;
      }
      return spot;
    });

    onAddSpots(newSpots);

    // reset UI
    setPending(null);
    setUrlInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCancel = () => {
    setPending(null);
    setParseError(null);
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">批量导入</p>
          <h2>GPX / KML 文件 或 Google Maps 链接</h2>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleParse}
            disabled={isParsing}
          >
            {isParsing ? '解析中...' : '解析文件 / 链接'}
          </button>
          {pending && pending.length > 0 ? (
            <button type="button" className="btn btn-primary" onClick={handleConfirm}>
              确认导入 {pending.length} 个景点
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="import-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        <div className="field field-wide">
          <label>上传 GPX / KML 文件 (可多选)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx,.kml,.kmz"
            multiple
          />
          <small style={{ color: 'var(--admin-muted)' }}>
            GPX 读取 &lt;wpt&gt;,KML 读取 &lt;Placemark&gt; 里的 Point 坐标。
          </small>
        </div>
        <div className="field field-wide">
          <label>Google Maps 链接 (每行一条)</label>
          <textarea
            rows={4}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={
              'https://maps.google.com/maps?q=35.68,139.76\nhttps://www.google.com/maps/place/Shibuya+Crossing/@35.659,139.700'
            }
            spellCheck={false}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
          />
        </div>
      </div>

      <div
        className="import-day-row"
        style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <label className="field" style={{ maxWidth: 200 }}>
          <span>导入到第几天</span>
          <select
            value={effectiveDay}
            onChange={(e) => setTargetDay(Number(e.target.value))}
          >
            {dayOptions.map((d) => (
              <option key={d} value={d}>
                第 {d} 天
              </option>
            ))}
          </select>
        </label>
      </div>

      {parseError ? (
        <div
          className="import-error"
          style={{
            marginTop: 14,
            padding: 12,
            background: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fca5a5',
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          ⚠ {parseError}
        </div>
      ) : null}

      {pending && pending.length > 0 ? (
        <div
          className="import-preview"
          style={{
            marginTop: 16,
            background: '#fff',
            border: '1px solid var(--admin-line)',
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <strong>
              预览:解析到 {pending.length} 个地点,将导入到第 {effectiveDay} 天
            </strong>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
              style={{ padding: '4px 12px', minHeight: 'auto' }}
            >
              取消
            </button>
          </div>
          <ul
            className="import-list"
            style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}
          >
            {pending.map((p, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'baseline',
                  padding: '8px 10px',
                  background: 'var(--admin-bg)',
                  borderRadius: 10,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--admin-accent)',
                    minWidth: 60,
                  }}
                >
                  {p.source}
                </span>
                <strong style={{ flex: 1 }}>{p.name}</strong>
                {p.lat || p.lng ? (
                  <span style={{ color: 'var(--admin-muted)', fontFamily: 'monospace' }}>
                    {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                  </span>
                ) : (
                  <span style={{ color: '#b91c1c' }}>未解析到坐标</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
