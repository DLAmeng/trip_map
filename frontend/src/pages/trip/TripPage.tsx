import 'leaflet/dist/leaflet.css';
import './trip.css';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTripFull, DEFAULT_TRIP_ID } from '../../api/trip-api';
import { normalizeTripData, computeStats } from '../../selectors/tripSelectors';
import { type FilterState } from '../../selectors/filterState';
import { TripHeader } from './TripHeader';
import { TripMapCanvas } from './TripMapCanvas';
import { SpotList } from './SpotList';
import { MobileFilterSheet } from './components/MobileFilterSheet';
import { MobileDrawer } from './components/MobileDrawer';
import { SummaryBar } from './components/SummaryBar';
import { LoadingScreen } from './components/LoadingScreen';
import { MobileTripHeaderCard } from './components/MobileTripHeaderCard';
import { MobileTripBottomSwitcher, type MobileTripMode } from './components/MobileTripBottomSwitcher';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useIsMobile } from '../../hooks/useIsMobile';

// TripStats 类型现在统一从 selectors/tripSelectors 导出,此处保留空位以便阅读代码时知道它在哪里。

/**
 * Phase 3 Trip 页壳组件。
 *
 * 职责:
 *   - 从 URL ?id= 读 tripId(默认 'current',跟原生 app.js 对齐)
 *   - useQuery 拉 /full,管 loading / error / 空态 / 重试
 *   - useMemo 把 payload normalize 成各种索引(Phase 4 Admin 也复用 selectors)
 *   - 持有 filter + selectedSpotId 两个 UI state,所有子组件都是受控的
 *
 * 边界:本文件不 import leaflet,地图生命周期在 TripMapCanvas 里,
 * 地图 API 调用在 useTripMap + adapter 里。
 */
export function TripPage() {
  const [params, setParams] = useSearchParams();
  const tripId = params.get('id') || DEFAULT_TRIP_ID;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => getTripFull(tripId),
    staleTime: 30_000,
  });

  const normalized = useMemo(() => {
    if (!data) return null;
    return normalizeTripData(data);
  }, [data]);

  const stats = useMemo(() => {
    if (!normalized) return { days: 0, cities: 0, spots: 0 };
    return computeStats(normalized);
  }, [normalized]);

  // 从 URL 参数派生 UI 状态
  const filter: FilterState = useMemo(() => {
    const dayParam = params.get('day');
    return {
      day: dayParam ? Number(dayParam) : null,
      city: params.get('city') || null,
      mustOnly: params.get('mustVisit') === 'true',
      nextOnly: params.get('nextOnly') === 'true',
    };
  }, [params]);

  const selectedSpotId = params.get('spot') || null;

  const [isListVisible, setIsListVisible] = useState(() => window.innerWidth > 1024);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  const isMobile = useIsMobile();

  // 当前激活的底部 switcher 模式(仅手机端用)。
  // 'summary' / 'list' / 'filter' / null;null = 纯地图视图
  const activeMobileMode: MobileTripMode | null =
    activeTool === 'summary' ? 'summary' : isListVisible ? 'list' : isFilterSheetOpen ? 'filter' : null;

  const hasActiveFilter =
    filter.day !== null ||
    filter.city !== null ||
    filter.mustOnly ||
    filter.nextOnly;

  const hasSpotsForDayAndCity = useCallback((day: number, city: string) => {
    if (!normalized) return false;
    return normalized.spots.some((spot) => spot.day === day && spot.city === city);
  }, [normalized]);

  const normalizeFilter = useCallback((nextFilter: FilterState): FilterState => {
    let day = nextFilter.day;
    let city = nextFilter.city;

    if (day !== null && city !== null && !hasSpotsForDayAndCity(day, city)) {
      const dayChanged = day !== filter.day;
      const cityChanged = city !== filter.city;
      if (dayChanged && !cityChanged) {
        city = null;
      } else if (cityChanged && !dayChanged) {
        day = null;
      } else {
        city = null;
      }
    }

    return {
      ...nextFilter,
      day,
      city,
    };
  }, [filter.day, filter.city, hasSpotsForDayAndCity]);

  const closeAllPopups = useCallback(() => {
    // 桌面默认展开列表,手机点空白处会收起所有 sheet(list / filter / summary)
    setIsListVisible(!isMobile);
    setIsFilterSheetOpen(false);
    setActiveTool(null);
  }, [isMobile]);

  // 状态更新函数改为修改 URL 参数
  const setFilter = useCallback((updater: FilterState | ((prev: FilterState) => FilterState)) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      const current: FilterState = {
        day: prev.get('day') ? Number(prev.get('day')) : null,
        city: prev.get('city') || null,
        mustOnly: prev.get('mustVisit') === 'true',
        nextOnly: prev.get('nextOnly') === 'true',
      };
      const nextFilter = normalizeFilter(
        typeof updater === 'function' ? updater(current) : updater,
      );

      if (nextFilter.day !== null) next.set('day', String(nextFilter.day));
      else next.delete('day');

      if (nextFilter.city) next.set('city', nextFilter.city);
      else next.delete('city');

      if (nextFilter.mustOnly) next.set('mustVisit', 'true');
      else next.delete('mustVisit');

      if (nextFilter.nextOnly) next.set('nextOnly', 'true');
      else next.delete('nextOnly');

      // 切换过滤条件时通常需要清除具体选中，以触发 Fit Day
      next.delete('spot');

      return next;
    }, { replace: true });
  }, [normalizeFilter, setParams]);

  const handleSelectSpot = useCallback((id: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (prev.get('spot') === id) return prev;

      next.set('spot', id);
      return next;
    }, { replace: true });
  }, [setParams]);

  const handleMapClick = useCallback(() => {
    setParams((prev) => {
      if (!prev.has('spot')) return prev;
      const next = new URLSearchParams(prev);
      next.delete('spot');
      return next;
    }, { replace: true });
  }, [setParams]);

  // loading 态:用全屏 loading card 对齐旧版
  if (isLoading) {
    return (
      <div className="trip-shell">
        <LoadingScreen
          eyebrow="正在整理路线"
          title="正在加载行程..."
          message={`正在读取行程 ${tripId}`}
        />
      </div>
    );
  }

  // error 态
  if (isError || !data || !normalized) {
    const message = isError
      ? (error as Error)?.message || '未知错误'
      : '这个行程没有返回有效数据。';
    return (
      <div className="trip-shell">
        <div className="trip-status" role="alert">
          <h2>无法加载行程</h2>
          <p>{message}</p>
          <div className="trip-status-actions">
            <button type="button" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? '重试中…' : '重试'}
            </button>
            <a href={`/trip?id=${encodeURIComponent(tripId)}`} target="_blank" rel="noreferrer">
              新标签页打开当前 Trip 页面
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`trip-shell${isMobile ? ' trip-shell-mobile' : ''}`}>
      {/* 手机端:顶部行程上下文卡片(搜索栏 MapSearch 已经在 TripMapCanvas 内常驻渲染) */}
      {isMobile ? (
        <MobileTripHeaderCard
          meta={data.meta}
          tripId={tripId}
          cityNames={normalized.cityNames}
        />
      ) : (
        <TripHeader
          meta={data.meta}
          tripId={tripId}
          stats={stats}
          dayNumbers={normalized.dayNumbers}
          cityNames={normalized.cityNames}
          filter={filter}
          onDaySelect={(day) => setFilter((prev) => ({ ...prev, day }))}
        />
      )}

      <div className={`main-content ${!isListVisible ? 'list-hidden' : ''}`}>
        <TripMapCanvas
          config={data.config}
          spots={normalized.spots}
          segments={normalized.routeSegments}
          spotById={normalized.allEntriesById}
          cityNames={normalized.cityNames}
          filter={filter}
          onFilterChange={setFilter}
          selectedSpotId={selectedSpotId}
          onSelectSpot={handleSelectSpot}
          onMapClick={handleMapClick}
          stats={stats}
          onToggleList={() => setIsListVisible(!isListVisible)}
          isListVisible={isListVisible}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          isOnline={isOnline}
          isMobile={isMobile}
        />
        {isListVisible && (
          <>
            {isMobile ? (
              <MobileDrawer
                isOpen={isListVisible}
                spotsByDay={normalized.spotsByDay}
                dayNumbers={normalized.dayNumbers}
                dayColors={data.config.dayColors}
                filter={filter}
                selectedSpotId={selectedSpotId}
                onSelect={handleSelectSpot}
                onDayClick={(day) =>
                  setFilter((prev) => ({ ...prev, day }))
                }
                onClose={() => setIsListVisible(false)}
              />
            ) : (
              <div className="spot-list-wrapper">
                <SpotList
                  spotsByDay={normalized.spotsByDay}
                  dayNumbers={normalized.dayNumbers}
                  dayColors={data.config.dayColors}
                  filter={filter}
                  selectedSpotId={selectedSpotId}
                  onSelect={handleSelectSpot}
                  onDayClick={(day) =>
                    setFilter((prev) => ({ ...prev, day }))
                  }
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* 移动端底部胶囊切换栏 —— 概况 / 列表 / 筛选 */}
      {isMobile ? (
        <MobileTripBottomSwitcher
          activeMode={activeMobileMode}
          hasActiveFilter={hasActiveFilter}
          onSelectSummary={() => {
            setActiveTool(activeTool === 'summary' ? null : 'summary');
            setIsListVisible(false);
            setIsFilterSheetOpen(false);
          }}
          onSelectList={() => {
            setIsListVisible(!isListVisible);
            setActiveTool(null);
            setIsFilterSheetOpen(false);
          }}
          onSelectFilter={() => {
            setIsFilterSheetOpen(true);
            setActiveTool(null);
            setIsListVisible(false);
          }}
        />
      ) : null}

      {/* 移动端行程概况弹窗 */}
      {activeTool === 'summary' && isMobile && (
        <>
          <div className="sheet-backdrop" onClick={closeAllPopups} />
          <div className="mobile-summary-modal">
            <div className="modal-header">
              <h3>行程概况</h3>
            </div>
            <div className="modal-body">
              <SummaryBar
                stats={stats}
                isFiltered={
                  filter.day !== null ||
                  filter.city !== null ||
                  filter.mustOnly ||
                  filter.nextOnly
                }
              />
            </div>
          </div>
        </>
      )}

      <MobileFilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        dayNumbers={normalized.dayNumbers}
        dayColors={data.config.dayColors}
        cityNames={normalized.cityNames}
        filter={filter}
        onChange={setFilter}
      />
    </div>
  );
}
