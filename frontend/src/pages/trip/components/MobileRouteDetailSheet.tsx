import { useEffect, useState } from 'react';
import type { RouteSegment } from '../../../types/trip';
import { RouteDetailContent } from './RouteDetailContent';

interface Coord {
  lat: number;
  lng: number;
}

interface MobileRouteDetailSheetProps {
  isOpen: boolean;
  segment: RouteSegment | null;
  onClose: () => void;
  /** P17: 起终点经纬度;有值时显示"用 Google Maps 导航"主按钮 */
  fromCoord?: Coord | null;
  toCoord?: Coord | null;
}

/**
 * P17: 根据 segment.transportType 映射到 Google Maps directions API 的 travelmode 参数。
 * 中文 / 英文 / 数据库可能的多种值都做映射。
 */
function mapTransportToTravelMode(raw: string | undefined): 'driving' | 'walking' | 'transit' {
  const t = String(raw || '').toLowerCase();
  if (/walk|步行|徒步/.test(t)) return 'walking';
  if (/driv|car|taxi|driving|自驾|驾车|出租/.test(t)) return 'driving';
  // 默认 transit(地铁 / 巴士 / 新干线 / 火车 / JR / 电车 等)
  return 'transit';
}

function buildGoogleMapsUrl(from: Coord, to: Coord, mode: string): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: mode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

type SheetMode = 'half' | 'full';

/**
 * 路线详情 bottom sheet,支持 half / full 两档:
 *   - full(默认): 78vh,完全显示路线详情
 *   - half: 仅顶部 ~140px,只露 handle + 标题,让用户看到地图
 *
 * 切档:
 *   - 点击 handle 区域 → 切换 half ↔ full
 *   - 点 backdrop / "完成" → onClose
 *
 * 没有用 pointer drag(MobileDrawer 那一套) —— 路线详情内容少,
 * 两档点击切换够用,避免拷贝大量 drag pointer 状态机。
 */
export function MobileRouteDetailSheet({
  isOpen,
  segment,
  onClose,
  fromCoord,
  toCoord,
}: MobileRouteDetailSheetProps) {
  const [mode, setMode] = useState<SheetMode>('full');

  // 每次打开都重置回 full,避免上次留下的 half 状态出现"sheet 一开就是收起"
  useEffect(() => {
    if (isOpen) setMode('full');
  }, [isOpen]);

  if (!isOpen || !segment) return null;

  const toggleMode = () => setMode((prev) => (prev === 'full' ? 'half' : 'full'));

  // P17: 只在拿到 from + to 完整经纬度时才显示导航按钮
  const canNavigate =
    !!fromCoord && !!toCoord
    && Number.isFinite(fromCoord.lat) && Number.isFinite(fromCoord.lng)
    && Number.isFinite(toCoord.lat) && Number.isFinite(toCoord.lng);
  const travelMode = mapTransportToTravelMode(segment.transportType);
  const navUrl = canNavigate
    ? buildGoogleMapsUrl(fromCoord!, toCoord!, travelMode)
    : null;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`mobile-route-detail-sheet is-${mode}`}>
        <button
          type="button"
          className="sheet-handle-wrap"
          onClick={toggleMode}
          aria-label={mode === 'full' ? '收起到半屏' : '展开全屏'}
        >
          <div className="sheet-handle" aria-hidden="true" />
        </button>
        <div className="modal-header" onClick={toggleMode}>
          <h3>路线说明</h3>
        </div>
        <div className="modal-body">
          <RouteDetailContent segment={segment} />
          <div className="route-detail-actions">
            {navUrl ? (
              <a
                className="btn-primary route-detail-nav-btn"
                href={navUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="用 Google Maps 导航此路线"
              >
                用 Google Maps 导航 →
              </a>
            ) : null}
            <button
              type="button"
              className="btn-ghost route-detail-close-btn"
              onClick={onClose}
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
