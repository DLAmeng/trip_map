import { useEffect, useMemo, useRef, useState } from 'react';
import type { RouteSegment, SpotItem, TripConfig } from '../../types/trip';
import type { FilterState } from '../../selectors/filterState';
import { getVisibleSpots, getVisibleSpotIds } from '../../selectors/filterState';
import type { MapController } from '../../map-adapter/types';
import { createLeafletController } from '../../map-adapter/leaflet';
import { createGoogleController } from '../../map-adapter/google';
import { useTripMap } from '../../hooks/useTripMap';
import { fetchOSRMRoute } from '../../api/routing-api';
import { MapLegend } from './components/MapLegend';
import { SummaryBar } from './components/SummaryBar';
import { FiltersCard } from './components/FiltersCard';
import { MapToolbar } from './components/MapToolbar';
import { MapSearch } from './components/MapSearch';
import { MapNotice } from './components/MapNotice';
import { MobileMapFloatingActions } from './components/MobileMapFloatingActions';
import type { TripStats } from '../../selectors/tripSelectors';

interface TripMapCanvasProps {
  config: TripConfig;
  spots: SpotItem[];
  segments: RouteSegment[];
  spotById: Map<string, SpotItem>;
  cityNames: string[];
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  selectedSpotId: string | null;
  onSelectSpot: (id: string) => void;
  onMapClick: () => void;
  stats: TripStats;
  onToggleList: () => void;
  isListVisible: boolean;
  activeTool: string | null;
  setActiveTool: (tool: string | null) => void;
  isOnline?: boolean;
  /** 手机模式 —— 隐藏左下 `.map-controls`,换成右侧浮动按钮组 */
  isMobile?: boolean;
}

/**
 * 地图画布组件:
 *   - 拿一个 DOM container 给 adapter
 *   - useEffect 一次性 create controller,cleanup 时 destroy
 *   - 事件上,从 adapter 向 React 抛 onSpotClick / onMapClick;
 *     从 React 向 adapter 同步 spots/segments/filter/selectedSpotId 由 useTripMap 管
 *   - 浮动按钮:重置视角 + 适配当天
 *
 * StrictMode gotcha:cleanup 必须调 controller.destroy() + 置 null,
 * 否则第二次 effect 再 create 会被 Leaflet 抛 "Map container is already initialized"。
 */
export function TripMapCanvas({
  config,
  spots,
  segments,
  spotById,
  cityNames,
  filter,
  onFilterChange,
  selectedSpotId,
  onSelectSpot,
  onMapClick,
  stats,
  onToggleList,
  isListVisible,
  activeTool,
  setActiveTool,
  isOnline = true,
  isMobile = false,
}: TripMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MapController | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [geometryCache, setGeometryCache] = useState<Record<string, Array<[number, number]>>>({});

  const fallbackToLeaflet = config.googleMaps?.fallbackToLeaflet !== false;

  // 事件回调用 ref 包一层,避免 onSpotClick / onMapClick 改了就让 controller 重 init
  const callbacksRef = useRef({ onSelectSpot, onMapClick });
  useEffect(() => {
    callbacksRef.current = { onSelectSpot, onMapClick };
  }, [onSelectSpot, onMapClick]);

  // 一次性 init(依赖 config 的稳定字段)。
  // 注意:config 对象引用每次 useQuery 重取可能都变,所以把它的原始字段拆出来做依赖。
  const centerLat = config.centerLat;
  const centerLng = config.centerLng;
  const defaultZoom = config.defaultZoom;
  const mapProvider = config.mapProvider;
  const dayColorsKey = config.dayColors.join('|');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isGoogle = mapProvider === 'googleMaps' && !useFallback;
    const factory = isGoogle ? createGoogleController : createLeafletController;

    let controller: MapController | null = null;
    try {
      controller = factory(container, {
        center: { lat: centerLat, lng: centerLng },
        zoom: defaultZoom,
        apiKey: config.googleMaps?.apiKey,
        mapId: config.googleMaps?.mapId,
        dayColors: config.dayColors,
        onSpotClick: (id) => callbacksRef.current.onSelectSpot(id),
        onMapClick: () => callbacksRef.current.onMapClick(),
        onError: (err) => {
          console.error('[GoogleMapsAdapter] Initialization failed:', err);
          if (isGoogle) {
            setMapError(err.message);
            if (fallbackToLeaflet) {
              console.warn('[TripMapCanvas] Falling back to Leaflet');
              setUseFallback(true);
            }
          }
        },
      });
      controllerRef.current = controller;

      // 引擎重建后立即同步初始数据
      controller.markers.render(spots);
      controller.routes.render(segments, spotById);
      controller.markers.setVisibleSpots(getVisibleSpotIds(spots, filter));
      controller.routes.setActiveFilter({ day: filter.day });
      if (selectedSpotId) {
        controller.markers.setSelected(selectedSpotId, { pan: false });
      }
    } catch (err) {
      console.error('[TripMapCanvas] factory error:', err);
      if (isGoogle) {
        setMapError(err instanceof Error ? err.message : String(err));
        if (fallbackToLeaflet) {
          console.warn('[TripMapCanvas] Falling back to Leaflet');
          setUseFallback(true);
        }
      }
    }

    return () => {
      controller?.destroy();
      controllerRef.current = null;
    };
    // config.dayColors 用 dayColorsKey 做稳定性,避免引用变化就重 init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerLat, centerLng, defaultZoom, mapProvider, dayColorsKey, useFallback]);

  // 注入缓存后的轨迹数据到 segments
  const hydratedSegments = useMemo(() => {
    return segments.map(seg => ({
      ...seg,
      path: geometryCache[seg.id] || seg.path,
    }));
  }, [segments, geometryCache]);

  // 同步 spots / segments / filter / selection 到 controller
  useTripMap(controllerRef, {
    spots,
    segments: hydratedSegments,
    spotById,
    filter,
    selectedSpotId,
  });

  // 异步加载缺失的真实路网轨迹 (P0)
  useEffect(() => {
    const missing = segments.filter(
      (s) => !s.path && !geometryCache[s.id] && (s.transportType === 'walk' || s.transportType === 'bus' || s.transportType === 'drive')
    );
    if (missing.length === 0) return;

    missing.forEach(async (seg) => {
      const from = spotById.get(seg.fromSpotId);
      const to = spotById.get(seg.toSpotId);
      if (!from || !to) return;

      const profile = seg.transportType === 'walk' ? 'foot' : 'car';
      const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
      const path = await fetchOSRMRoute(profile, coords);
      if (path) {
        setGeometryCache(prev => ({ ...prev, [seg.id]: path }));
      }
    });
  }, [segments, spotById, geometryCache]);

  // 当天 spots(给"适配当天"用)
  const currentDaySpots = useMemo(() => {
    return getVisibleSpots(spots, filter);
  }, [spots, filter]);

  // 监听过滤条件变化：当手动切换天数或城市（且未选中具体景点）时，自动缩放以适配可见景点
  const lastFilter = useRef({ day: filter.day, city: filter.city });
  useEffect(() => {
    const dayChanged = filter.day !== lastFilter.current.day;
    const cityChanged = filter.city !== lastFilter.current.city;

    if (dayChanged || cityChanged) {
      lastFilter.current = { day: filter.day, city: filter.city };
      const controller = controllerRef.current;
      if (controller && !selectedSpotId && currentDaySpots.length > 0) {
        controller.fitToSpots(currentDaySpots);
      }
    }
  }, [filter.day, filter.city, selectedSpotId, currentDaySpots]);

  const handleReset = () => {
    controllerRef.current?.resetView();
  };

  const handleFitToDay = () => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (currentDaySpots.length === 0) return;
    controller.fitToSpots(currentDaySpots);
  };

  const handleToggleTool = (tool: string) => {
    setActiveTool(activeTool === tool ? null : tool);
  };

  const dayNumbers = useMemo(() => {
    const days = new Set<number>();
    spots.forEach(s => days.add(s.day));
    return Array.from(days).sort((a, b) => a - b);
  }, [spots]);

  return (
    <section className="map-stage" aria-label="地图">
      <div className="map-notice-stack" aria-live="polite">
        {!isOnline ? (
          <MapNotice
            tone="warning"
            message="当前离线 —— 已显示缓存数据,部分功能(搜索 / 新路径 / 保存)不可用。"
          />
        ) : null}
        {mapError ? (
          <MapNotice
            tone="error"
            message={
              `Google Maps 加载失败:${mapError}` +
              (fallbackToLeaflet ? '（当前已自动降级回 Leaflet 引擎）' : '')
            }
          />
        ) : null}
      </div>
        <div
          ref={containerRef}
          className={`map-canvas${mapProvider === 'googleMaps' ? ' is-google' : ''}`}
          role="application"
          aria-label="交互地图"
        />

        {/* 左侧工具栏:仅桌面显示;手机靠底部浮动按钮的搜索/概况/筛选入口 */}
        <div className="desktop-only">
          <MapToolbar activeTool={activeTool} onToggleTool={handleToggleTool} />
        </div>

        {/* 过滤面板:仅桌面 */}
        {activeTool === 'filter' && (
          <div className="desktop-only">
            <FiltersCard
              dayNumbers={dayNumbers}
              cityNames={cityNames}
              filter={filter}
              onChange={onFilterChange}
            />
          </div>
        )}
        {activeTool === 'summary' && window.innerWidth > 1024 && (
          <SummaryBar
            stats={stats}
            isFiltered={
              filter.day !== null ||
              filter.city !== null ||
              filter.mustOnly ||
              filter.nextOnly
            }
          />
        )}
        {(activeTool === 'search' || isMobile) && (
          <MapSearch
            spots={spots}
            segments={segments}
            apiKey={config.googleMaps?.apiKey}
            onSelectSpot={onSelectSpot}
            onFocus={() => {
              if (isMobile) {
                // 当移动端聚焦时，关闭底部的列表和筛选器弹窗
                if (isListVisible) onToggleList();
                setActiveTool('search');
              }
            }}
            onSelectRoute={(id) => {
              const seg = segments.find((s) => s.id === id);
              if (seg) {
                const from = spotById.get(seg.fromSpotId);
                const to = spotById.get(seg.toSpotId);
                if (from && to) {
                  controllerRef.current?.fitToSpots([from, to]);
                } else if (from || to) {
                  const s = (from || to)!;
                  controllerRef.current?.setView({ lat: s.lat, lng: s.lng }, 15);
                }
              }
            }}
            onSelectLocation={(lat, lng) => {
              controllerRef.current?.setView({ lat, lng }, 15);
            }}
            onClose={() => setActiveTool(null)}
          />
        )}

        <MapLegend
          dayColors={config.dayColors}
          isRouteBroken={filter.day !== null}
          isGoogleMap={mapProvider === 'googleMaps' && !useFallback}
          hasWalkSegment={segments.some(
            (s) => s.transportType?.toLowerCase?.() === 'walk',
          )}
        />

        {/* 桌面 / 平板:左下方的文字式控件组 */}
        {isMobile ? null : (
          <div className="map-controls">
            <button
              type="button"
              className="ctrl-btn"
              onClick={handleReset}
              title="回到行程初始视角"
            >
              <span className="ctrl-icon" aria-hidden="true">↺</span>
              <span className="ctrl-label">重置视角</span>
            </button>
            <button
              type="button"
              className="ctrl-btn"
              onClick={handleFitToDay}
              disabled={currentDaySpots.length === 0}
              title={filter.day === null ? '适配全部可见景点' : `适配第 ${filter.day} 天`}
            >
              <span className="ctrl-icon" aria-hidden="true">◎</span>
              <span className="ctrl-label">{filter.day === null ? '适配可见' : '适配当天'}</span>
            </button>
            <button
              type="button"
              className={`ctrl-btn desktop-only ${isListVisible ? 'active' : ''}`}
              onClick={onToggleList}
              title="切换日程列表"
            >
              <span className="ctrl-icon" aria-hidden="true">≡</span>
              <span className="ctrl-label">{isListVisible ? '收起列表' : '显示列表'}</span>
            </button>
          </div>
        )}

        {/* 手机:右侧圆形浮动按钮组(重置 / 适配 / 定位) */}
        {isMobile ? (
          <MobileMapFloatingActions
            onResetView={handleReset}
            onFitVisible={handleFitToDay}
            fitDisabled={currentDaySpots.length === 0}
            onLocate={(coords) => {
              if (!coords) {
                console.warn('[TripMapCanvas] geolocation unavailable');
                return;
              }
              controllerRef.current?.setView(coords, 15);
            }}
          />
        ) : null}
    </section>
  );
}
