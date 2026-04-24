import type { RouteSegment } from '../../../types/trip';
import { RouteDetailContent } from './RouteDetailContent';

interface MobileRouteDetailSheetProps {
  isOpen: boolean;
  segment: RouteSegment | null;
  onClose: () => void;
}

export function MobileRouteDetailSheet({
  isOpen,
  segment,
  onClose,
}: MobileRouteDetailSheetProps) {
  if (!isOpen || !segment) return null;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="mobile-route-detail-sheet">
        <div className="modal-header">
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
