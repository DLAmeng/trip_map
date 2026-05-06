import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type SheetMode = 'collapsed' | 'half' | 'full';

interface AdminMapSheetProps {
  /** 仅移动端启用 sheet 行为;桌面端透传地图(由 AdminPage 决定挂哪) */
  isMobile: boolean;
  children: ReactNode;
}

interface DrawerMetrics {
  height: number;
  collapsed: number;
  half: number;
  full: number;
}

function getMetrics(): DrawerMetrics {
  const height = Math.min(
    window.innerHeight - 12,
    Math.max(420, window.innerHeight * 0.85),
  );
  const collapsedPeek = 88;
  const halfVisible = Math.min(height - 20, Math.max(280, height * 0.5));
  return {
    height,
    collapsed: Math.max(0, height - collapsedPeek),
    half: Math.max(0, height - halfVisible),
    full: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nearestMode(translateY: number, metrics: DrawerMetrics): SheetMode {
  const candidates: Array<{ mode: SheetMode; offset: number }> = [
    { mode: 'full', offset: metrics.full },
    { mode: 'half', offset: metrics.half },
    { mode: 'collapsed', offset: metrics.collapsed },
  ];
  candidates.sort((a, b) => Math.abs(a.offset - translateY) - Math.abs(b.offset - translateY));
  return candidates[0]?.mode ?? 'collapsed';
}

/**
 * 移动端把 AdminTripMap 包成底部 collapsed/half/full 三档抽屉。
 * 默认 collapsed peek 88px,露出 handle + "上滑查看地图"提示。
 *
 * 桌面端(isMobile=false)直接透传 children,由 AdminPage 控制挂载到右列 sticky。
 */
export function AdminMapSheet({ isMobile, children }: AdminMapSheetProps) {
  // 桌面端直接透传,不进入 sheet 逻辑
  if (!isMobile) {
    return <>{children}</>;
  }

  return <AdminMapSheetMobile>{children}</AdminMapSheetMobile>;
}

function AdminMapSheetMobile({ children }: { children: ReactNode }) {
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const metrics = useMemo(() => getMetrics(), [viewportHeight]);
  const [mode, setMode] = useState<SheetMode>('collapsed');
  const [translateY, setTranslateY] = useState(() => metrics.collapsed);
  const dragRef = useRef<{ pointerId: number; startY: number; startTranslateY: number } | null>(null);

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setTranslateY(metrics[mode]);
  }, [mode, metrics]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startTranslateY: translateY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const next = clamp(
      drag.startTranslateY + (e.clientY - drag.startY),
      metrics.full,
      metrics.collapsed,
    );
    setTranslateY(next);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setMode(nearestMode(translateY, metrics));
  };

  const handleHandleClick = () => {
    setMode((prev) => {
      if (prev === 'collapsed') return 'half';
      if (prev === 'half') return 'full';
      return 'collapsed';
    });
  };

  return (
    <div
      className={`admin-map-sheet admin-map-sheet-${mode}`}
      style={{
        height: `${metrics.height}px`,
        transform: `translateY(${translateY}px)`,
      }}
      role="region"
      aria-label="行程地图"
    >
      <div
        className="admin-map-sheet-handle-wrap"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={handleHandleClick}
      >
        <div className="admin-map-sheet-handle" aria-hidden="true" />
        {mode === 'collapsed' ? (
          <span className="admin-map-sheet-peek-label">上滑查看地图</span>
        ) : null}
      </div>
      <div className="admin-map-sheet-content">{children}</div>
    </div>
  );
}
