import { useState } from 'react';

interface BulkActionsToolbarProps {
  selectedCount: number;
  dayOptions: number[];
  onMoveToDay: (day: number) => void;
  onCopyToDay: (day: number) => void;
  onSetMustVisit: (mustVisit: boolean) => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

/**
 * 浮层批量操作工具栏 — 替代原 Bulk Actions 工具栏。
 * 仅在 selectedCount > 0 时渲染:
 *   - 移动端:固定底部浮(bottom + safe-area),主轴可滚
 *   - 桌面端:固定 SaveBar 下方 sticky
 *
 * 内容:N 个已选 + 移动到 Day▾ + 复制到 Day▾ + ★ 必去 + 🗑 删除 + ✕ 取消
 *
 * "进入选择模式" = PlannerBoard 内 spot 长按 1s,触发 onToggleSpotSelection,
 * selectedSpotIds 变化驱动本组件渲染。
 */
export function BulkActionsToolbar({
  selectedCount,
  dayOptions,
  onMoveToDay,
  onCopyToDay,
  onSetMustVisit,
  onDelete,
  onClearSelection,
}: BulkActionsToolbarProps) {
  const [targetDay, setTargetDay] = useState<number>(dayOptions[0] || 1);

  if (selectedCount === 0) return null;

  return (
    <div className="bulk-actions-toolbar" role="toolbar" aria-label="批量操作">
      <div className="bulk-actions-count">
        <strong>{selectedCount}</strong>
        <span>已选中</span>
      </div>

      <div className="bulk-actions-main">
        {/* 移动 / 复制到 day */}
        <select
          className="bulk-actions-day-select"
          value={targetDay}
          onChange={(e) => setTargetDay(Number(e.target.value))}
          aria-label="目标天数"
        >
          {dayOptions.map((d) => (
            <option key={d} value={d}>
              Day {d}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onMoveToDay(targetDay)}
        >
          移动
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onCopyToDay(targetDay)}
        >
          复制
        </button>

        {/* 必去 toggle */}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onSetMustVisit(true)}
          title="标为必去"
        >
          ★ 必去
        </button>

        {/* 删除 */}
        <button
          type="button"
          className="btn btn-ghost btn-danger"
          onClick={onDelete}
        >
          🗑 删除
        </button>
      </div>

      <button
        type="button"
        className="bulk-actions-cancel"
        onClick={onClearSelection}
        aria-label="取消选择"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
