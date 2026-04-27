import { useEffect, useState } from 'react';
import type { RouteSegment } from '../../../types/trip';
import { RouteDetailContent } from './RouteDetailContent';

interface MobileRouteDetailSheetProps {
  isOpen: boolean;
  segment: RouteSegment | null;
  onClose: () => void;
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
}: MobileRouteDetailSheetProps) {
  const [mode, setMode] = useState<SheetMode>('full');

  // 每次打开都重置回 full,避免上次留下的 half 状态出现"sheet 一开就是收起"
  useEffect(() => {
    if (isOpen) setMode('full');
  }, [isOpen]);

  if (!isOpen || !segment) return null;

  const toggleMode = () => setMode((prev) => (prev === 'full' ? 'half' : 'full'));

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
          <button
            type="button"
            className="btn-primary route-detail-close-btn"
            onClick={onClose}
          >
            完成
          </button>
        </div>
      </div>
    </>
  );
}
