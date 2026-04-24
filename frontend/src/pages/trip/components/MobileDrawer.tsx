import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpotItem } from '../../../types/trip';
import type { FilterState } from '../../../selectors/filterState';
import { SpotList } from '../SpotList';

type DrawerState = 'collapsed' | 'half' | 'full';

interface DrawerMetrics {
  height: number;
  collapsed: number;
  half: number;
  full: number;
}

interface MobileDrawerProps {
  isOpen: boolean;
  spotsByDay: Map<number, SpotItem[]>;
  dayNumbers: number[];
  dayColors: string[];
  filter: FilterState;
  selectedSpotId: string | null;
  onSelect: (id: string) => void;
  onDayClick?: (day: number | null) => void;
  onClose?: () => void;
}

function getDrawerMetrics(): DrawerMetrics {
  const height = Math.min(window.innerHeight - 12, Math.max(420, window.innerHeight * 0.88));
  const collapsedPeek = window.innerHeight < 760 ? 60 : 68;
  const halfVisible = Math.min(height - 20, Math.max(320, height * 0.52));
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

function resolveNearestState(translateY: number, metrics: DrawerMetrics): DrawerState {
  const candidates: Array<{ state: DrawerState; offset: number }> = [
    { state: 'full', offset: metrics.full },
    { state: 'half', offset: metrics.half },
    { state: 'collapsed', offset: metrics.collapsed },
  ];

  candidates.sort((a, b) => Math.abs(a.offset - translateY) - Math.abs(b.offset - translateY));
  return candidates[0]?.state ?? 'half';
}

export function MobileDrawer({
  isOpen,
  spotsByDay,
  dayNumbers,
  dayColors,
  filter,
  selectedSpotId,
  onSelect,
  onDayClick,
  onClose,
}: MobileDrawerProps) {
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [drawerState, setDrawerState] = useState<DrawerState>('half');
  const [translateY, setTranslateY] = useState(() => getDrawerMetrics().half);
  const dragStateRef = useRef<{ pointerId: number; startY: number; startTranslateY: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => getDrawerMetrics(), [viewportHeight]);

  useEffect(() => {
    if (!isOpen) return;
    setDrawerState(selectedSpotId ? 'full' : 'half');
  }, [isOpen, selectedSpotId]);

  useEffect(() => {
    if (!isOpen) return;
    setTranslateY(metrics[drawerState]);
  }, [drawerState, isOpen, metrics]);

  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTranslateY: translateY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const nextTranslateY = clamp(
      dragState.startTranslateY + (event.clientY - dragState.startY),
      metrics.full,
      metrics.collapsed,
    );
    setTranslateY(nextTranslateY);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDrawerState(resolveNearestState(translateY, metrics));
  };

  const handleHeaderClick = () => {
    setDrawerState((prev) => {
      if (prev === 'collapsed') return 'half';
      if (prev === 'half') return 'full';
      return 'collapsed';
    });
  };

  const drawerDayLabel = filter.day !== null ? `第 ${filter.day} 天` : '全部天数';
  const drawerNextStop = (() => {
    if (filter.day === null) return '';
    const daySpots = spotsByDay.get(filter.day) ?? [];
    const lastSpot = daySpots[daySpots.length - 1];
    return lastSpot?.transportNote ?? '';
  })();

  if (!isOpen) return null;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={rootRef}
        className="mobile-drawer"
        aria-label="行程抽屉"
        style={{ height: `${metrics.height}px`, transform: `translateY(${translateY}px)` }}
      >
        <div
          className="drawer-handle-wrap"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          <div className="drawer-handle" />
        </div>

        <div className="modal-header drawer-header" onClick={handleHeaderClick}>
          <h3>行程列表</h3>
        </div>
        <div className="drawer-context-row" onClick={handleHeaderClick}>
          <p className="drawer-day-label">{drawerDayLabel}</p>
          {drawerNextStop ? <p className="drawer-next-stop">{drawerNextStop}</p> : null}
        </div>

        <div className="modal-body drawer-content">
          <SpotList
            spotsByDay={spotsByDay}
            dayNumbers={dayNumbers}
            dayColors={dayColors}
            filter={filter}
            selectedSpotId={selectedSpotId}
            onSelect={onSelect}
            onDayClick={onDayClick}
          />
        </div>
      </div>
    </>
  );
}
