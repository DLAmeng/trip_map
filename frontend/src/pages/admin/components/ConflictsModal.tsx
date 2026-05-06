import { useEffect } from 'react';
import type { TripFullPayload } from '../../../types/trip';
import type { TripIssue } from '../../../utils/trip-analysis';
import { TripAnalysisReport } from './TripAnalysisReport';

interface ConflictsModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripFullPayload;
  onSelectIssue?: (issue: TripIssue) => void;
}

/**
 * 冲突详情 modal — 替代原 TripAnalysisReport 的常驻位置。
 * 由 SaveBar 上的红点按钮触发,平时不渲染不占视觉。
 */
export function ConflictsModal({
  isOpen,
  onClose,
  trip,
  onSelectIssue,
}: ConflictsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="admin-sheet-backdrop" onClick={onClose} />
      <div
        className="conflicts-modal"
        role="dialog"
        aria-label="行程冲突"
      >
        <header className="admin-sheet-header">
          <h2>行程冲突检查</h2>
          <button
            type="button"
            className="admin-sheet-close"
            onClick={onClose}
            aria-label="关闭"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="admin-sheet-body">
          <TripAnalysisReport
            trip={trip}
            onSelectIssue={(issue) => {
              onSelectIssue?.(issue);
              onClose(); // 定位后自动关闭 modal,焦点跳转到对应 spot
            }}
          />
        </div>
      </div>
    </>
  );
}
