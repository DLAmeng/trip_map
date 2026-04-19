import 'leaflet/dist/leaflet.css';
import './trip.css';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTripFull, DEFAULT_TRIP_ID } from '../../api/trip-api';
import { normalizeTripData, computeStats } from '../../selectors/tripSelectors';
import { DEFAULT_FILTER, type FilterState } from '../../selectors/filterState';
import { TripHeader } from './TripHeader';
import { TripFilters } from './TripFilters';
import { TripMapCanvas } from './TripMapCanvas';
import { SpotList } from './SpotList';

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
  const [params] = useSearchParams();
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

  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);

  const handleSelectSpot = useCallback((id: string) => {
    setSelectedSpotId((prev) => (prev === id ? prev : id));
  }, []);

  const handleMapClick = useCallback(() => {
    setSelectedSpotId(null);
  }, []);

  // loading 态
  if (isLoading) {
    return (
      <div className="trip-shell">
        <div className="trip-status" role="status" aria-live="polite">
          <h2>加载中…</h2>
          <p>
            正在读取行程 <code>{tripId}</code>
          </p>
        </div>
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
              打开 Express 原生页(回滚入口)
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="trip-shell">
      <TripHeader meta={data.meta} stats={stats} tripId={tripId} />

      <div className="main-content">
        <TripMapCanvas
          config={data.config}
          spots={normalized.spots}
          segments={normalized.routeSegments}
          spotById={normalized.spotById}
          filter={filter}
          selectedSpotId={selectedSpotId}
          onSelectSpot={handleSelectSpot}
          onMapClick={handleMapClick}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
            gap: '12px',
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <TripFilters
            dayNumbers={normalized.dayNumbers}
            filter={filter}
            onChange={setFilter}
          />
          <SpotList
            spotsByDay={normalized.spotsByDay}
            dayNumbers={normalized.dayNumbers}
            dayColors={data.config.dayColors}
            filter={filter}
            selectedSpotId={selectedSpotId}
            onSelect={handleSelectSpot}
          />
        </div>
      </div>
    </div>
  );
}
