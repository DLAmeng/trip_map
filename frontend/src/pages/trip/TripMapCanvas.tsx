import { useEffect, useMemo, useRef, useState } from 'react';
import type { RouteSegment, SpotItem, TripConfig } from '../../types/trip';
import type { FilterState } from '../../selectors/filterState';
import {
  getVisibleRouteContext,
  getVisibleSpots,
  getVisibleSpotIds,
} from '../../selectors/filterState';
import type { MapController, RouteClickAnchor } from '../../map-adapter/types';
import { createLeafletController } from '../../map-adapter/leaflet';
import { createGoogleController } from '../../map-adapter/google';
import { useTripMap } from '../../hooks/useTripMap';
import {
  hydrateRealRouteGeometries,
  shouldAwaitInitialRailHydration,
} from '../../api/routing-api';
import { MapLegend } from './components/MapLegend';
import { SummaryBar } from './components/SummaryBar';
import { FiltersCard } from './components/FiltersCard';
import { MapToolbar } from './components/MapToolbar';
import { MapSearch } from './components/MapSearch';
import { MapNotice } from './components/MapNotice';
import { MobileMapFloatingActions } from './components/MobileMapFloatingActions';
import { RouteDetailContent } from './components/RouteDetailContent';
import { MobileRouteDetailSheet } from './components/MobileRouteDetailSheet';
import { ExternalPoiCard } from './components/ExternalPoiCard';
import type { TripStats } from '../../selectors/tripSelectors';

type CachedRouteGeometry = {
  path: Array<[number, number]>;
  distanceMeters: number | null;
  durationSec: number | null;
  warnings: string[] | null;
  source?: RouteSegment['runtimeSource'] | null;
  transitSummary?: RouteSegment['runtimeTransitSummary'] | null;
  transitLegs?: RouteSegment['runtimeTransitLegs'] | null;
};

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
  /** ExternalPoiCard "+ 加入行程" 用户选好 day+insertIndex 后的回调 */
  onAddPoiToTrip?: (data: {
    placeId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    day: number;
    insertIndex?: number;
  }) => void;
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
  onAddPoiToTrip,
}: TripMapCanvasProps) {
  const stageRef = useRef<HTMLElement>(null);
  const toolOverlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MapController | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [geometryCache, setGeometryCache] = useState<Record<string, CachedRouteGeometry>>({});
  const [isInitialRailHydrationPending, setIsInitialRailHydrationPending] = useState(() =>
    segments.some((segment) => shouldAwaitInitialRailHydration(segment, config)),
  );
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [routeAnchor, setRouteAnchor] = useState<RouteClickAnchor | null>(null);
  // Google POI(餐厅/景点 icon)被点击时记录,React 拿 placeId 自行 fetch 详情并渲染卡片
  const [activePoi, setActivePoi] = useState<{ placeId: string; lat: number; lng: number } | null>(
    null,
  );

  const fallbackToLeaflet = config.googleMaps?.fallbackToLeaflet !== false;

  const handleSelectSpotFromCanvas = (id: string) => {
    setSelectedRouteId(null);
    setRouteAnchor(null);
    onSelectSpot(id);
  };

  const handleMapClickFromCanvas = () => {
    setSelectedRouteId(null);
    setRouteAnchor(null);
    setActivePoi(null); // 点空白处也关 POI 卡
    onMapClick();
  };

  const handlePoiClick = (placeId: string, position: { lat: number; lng: number }) => {
    setSelectedRouteId(null);
    setRouteAnchor(null);
    setActivePoi({ placeId, lat: position.lat, lng: position.lng });
  };

  const handleRouteClick = (id: string, anchor: RouteClickAnchor) => {
    setSelectedRouteId(id);
    setRouteAnchor(anchor);
  };

  const handleSpotPopupClose = (id: string) => {
    if (selectedSpotId !== id) return;
    handleMapClickFromCanvas();
  };

  // 事件回调用 ref 包一层,避免 onSpotClick / onMapClick 改了就让 controller 重 init
  const callbacksRef = useRef({
    onSelectSpot: handleSelectSpotFromCanvas,
    onMapClick: handleMapClickFromCanvas,
    onSpotPopupClose: handleSpotPopupClose,
    onRouteClick: handleRouteClick,
    onPoiClick: handlePoiClick,
  });
  useEffect(() => {
    callbacksRef.current = {
      onSelectSpot: handleSelectSpotFromCanvas,
      onMapClick: handleMapClickFromCanvas,
      onSpotPopupClose: handleSpotPopupClose,
      onRouteClick: handleRouteClick,
      onPoiClick: handlePoiClick,
    };
  }, [onMapClick, onSelectSpot, selectedSpotId]);

  // 一次性 init(依赖 config 的稳定字段)。
  // 注意:config 对象引用每次 useQuery 重取可能都变,所以把它的原始字段拆出来做依赖。
  const centerLat = config.centerLat;
  const centerLng = config.centerLng;
  const defaultZoom = config.defaultZoom;
  const mapProvider = config.mapProvider;
  const dayColorsKey = config.dayColors.join('|');
  const routingEngine = mapProvider === 'googleMaps' && !useFallback ? 'google' : 'leaflet';
  const initialRailHydrationIds = useMemo(
    () =>
      new Set(
        segments
          .filter((segment) => shouldAwaitInitialRailHydration(segment, config))
          .map((segment) => segment.id),
      ),
    [config, segments],
  );
  const initialRailHydrationKey = useMemo(
    () => Array.from(initialRailHydrationIds).sort().join('|'),
    [initialRailHydrationIds],
  );

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
        onSpotPopupClose: (id) => callbacksRef.current.onSpotPopupClose(id),
        onMapClick: () => callbacksRef.current.onMapClick(),
        onRouteClick: (id, anchor) => callbacksRef.current.onRouteClick(id, anchor),
        onPoiClick: (placeId, pos) => callbacksRef.current.onPoiClick(placeId, pos),
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
      controller.routes.render(renderSegments, spotById);
      controller.markers.setVisibleSpots(getVisibleSpotIds(spots, filter));
      controller.routes.setActiveFilter({
        day: filter.day,
        city: filter.city,
        visibleDays: routeContext.visibleDays,
        visibleCities: routeContext.visibleCities,
      });
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
    return segments.map((seg) => {
      const geometry = geometryCache[seg.id];
      return {
        ...seg,
        path: geometry?.path || seg.path,
        realDistanceMeters: geometry?.distanceMeters ?? seg.realDistanceMeters ?? null,
        realDurationSec: geometry?.durationSec ?? seg.realDurationSec ?? null,
        realWarnings: geometry?.warnings ?? seg.realWarnings ?? null,
        runtimeSource: geometry?.source ?? seg.runtimeSource ?? null,
        runtimeTransitSummary: geometry?.transitSummary ?? seg.runtimeTransitSummary ?? null,
        runtimeTransitLegs: geometry?.transitLegs ?? seg.runtimeTransitLegs ?? null,
      };
    });
  }, [segments, geometryCache]);
  const renderSegments = useMemo(() => {
    if (!isInitialRailHydrationPending) {
      return hydratedSegments;
    }
    return hydratedSegments.filter((segment) => !initialRailHydrationIds.has(segment.id));
  }, [hydratedSegments, initialRailHydrationIds, isInitialRailHydrationPending]);

  const routeGeometryKey = useMemo(
    () =>
      segments
        .map(
          (segment) =>
            `${segment.id}:${segment.transportType}:${segment.path?.length ?? 0}`,
        )
        .join('|'),
    [segments],
  );

  useEffect(() => {
    setGeometryCache({});
  }, [routeGeometryKey, routingEngine]);

  useEffect(() => {
    setIsInitialRailHydrationPending(initialRailHydrationIds.size > 0);
  }, [initialRailHydrationKey, initialRailHydrationIds.size]);

  // 同步 spots / segments / filter / selection 到 controller
  useTripMap(controllerRef, {
    spots,
    segments: renderSegments,
    spotById,
    filter,
    selectedSpotId,
  });

  // 异步补齐真实路网轨迹，对齐旧版 hydrateRealRouteGeometries 的主流程。
  useEffect(() => {
    const abortController = new AbortController();
    const pendingRailIds = new Set(initialRailHydrationIds);

    hydrateRealRouteGeometries({
      segments,
      spotById,
      config,
      routingEngine,
      signal: abortController.signal,
      onResolved: (segmentId, geometry) => {
        setGeometryCache((prev) => ({
          ...prev,
          [segmentId]: geometry,
        }));
        pendingRailIds.delete(segmentId);
        if (pendingRailIds.size === 0) {
          setIsInitialRailHydrationPending(false);
        }
      },
    }).finally(() => {
      if (!abortController.signal.aborted) {
        setIsInitialRailHydrationPending(false);
      }
    });

    return () => {
      abortController.abort();
    };
  }, [config, initialRailHydrationIds, routingEngine, segments, spotById]);

  // 当天 spots(给"适配当天"用)
  const currentDaySpots = useMemo(() => {
    return getVisibleSpots(spots, filter);
  }, [spots, filter]);
  const routeContext = useMemo(() => getVisibleRouteContext(spots, filter), [spots, filter]);
  const selectedRoute = useMemo(
    () => hydratedSegments.find((segment) => segment.id === selectedRouteId) ?? null,
    [hydratedSegments, selectedRouteId],
  );
  const desktopRoutePopoverStyle = useMemo(() => {
    if (isMobile || !selectedRoute) return null;
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) return { top: '20px', right: '20px' };
    if (!routeAnchor) return { top: '20px', right: '20px' };
    const maxWidth = 360;
    const verticalOffset = 12;
    const horizontalOffset = 12;
    const padding = 16;
    const left = routeAnchor.clientX - stageRect.left + horizontalOffset;
    const top = routeAnchor.clientY - stageRect.top + verticalOffset;
    return {
      left: `${Math.max(padding, Math.min(left, stageRect.width - maxWidth - padding))}px`,
      top: `${Math.max(padding, Math.min(top, stageRect.height - 260))}px`,
    };
  }, [isMobile, routeAnchor, selectedRoute]);

  useEffect(() => {
    if (!selectedSpotId) return;
    setSelectedRouteId(null);
    setRouteAnchor(null);
  }, [selectedSpotId]);

  useEffect(() => {
    if (!selectedRouteId) return;
    const routeStillVisible = renderSegments.some((segment) => segment.id === selectedRouteId);
    if (!routeStillVisible) {
      setSelectedRouteId(null);
      setRouteAnchor(null);
    }
  }, [renderSegments, selectedRouteId]);

  // 监听过滤条件变化：当手动切换天数或城市（且未选中具体景点）时，自动缩放以适配可见景点
  const lastFilter = useRef({ day: filter.day, city: filter.city });
  useEffect(() => {
    const dayChanged = filter.day !== lastFilter.current.day;
    const cityChanged = filter.city !== lastFilter.current.city;

    if (dayChanged || cityChanged) {
      lastFilter.current = { day: filter.day, city: filter.city };
      const controller = controllerRef.current;
      if (!controller || selectedSpotId) return;
      if (currentDaySpots.length > 0) {
        controller.fitToSpots(currentDaySpots);
      } else if (filter.day === null && filter.city === null) {
        controller.resetView();
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

  useEffect(() => {
    if (!activeTool || isMobile) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (toolOverlayRef.current?.contains(target)) return;
      setActiveTool(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveTool(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTool, isMobile, setActiveTool]);

  const dayNumbers = useMemo(() => {
    const days = new Set<number>();
    spots.forEach(s => days.add(s.day));
    return Array.from(days).sort((a, b) => a - b);
  }, [spots]);

  /** 给 ExternalPoiCard 选 position 用的简化 day → spot summary */
  const spotsSummaryByDay = useMemo(() => {
    const map = new Map<number, Array<{ id: string; name: string }>>();
    for (const day of dayNumbers) {
      const list = spots
        .filter((s) => s.day === day)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((s) => ({ id: s.id, name: s.name }));
      map.set(day, list);
    }
    return map;
  }, [spots, dayNumbers]);

  return (
    <section ref={stageRef} className="map-stage" aria-label="地图">
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
        {isInitialRailHydrationPending ? (
          <div className="map-loading-overlay" role="status" aria-live="polite">
            <div className="map-loading-card">
              <span className="map-loading-eyebrow">正在匹配铁路路线</span>
              <strong className="map-loading-title">先把首屏线路对齐</strong>
              <p className="map-loading-message">
                日本铁路段会先等补线完成，再展示地图，避免先看到示意线再跳变。
              </p>
            </div>
          </div>
        ) : null}

        <div ref={toolOverlayRef}>
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
              segments={hydratedSegments}
              apiKey={config.googleMaps?.apiKey}
              onSelectSpot={handleSelectSpotFromCanvas}
              onFocus={() => {
                if (isMobile) {
                  // 当移动端聚焦时，关闭底部的列表和筛选器弹窗
                  if (isListVisible) onToggleList();
                  setActiveTool('search');
                }
              }}
              onSelectRoute={(id) => {
                const seg = hydratedSegments.find((s) => s.id === id);
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
              onSelectLocation={(lat, lng, _name, placeId) => {
                controllerRef.current?.setView({ lat, lng }, 15);
                // 复用 ExternalPoiCard 显示详情(仅 Google Places 结果有 placeId,
                // Nominatim 没 placeId 就只 setView 飞过去 — 用户至少看到位置在地图哪)
                if (placeId) {
                  setActivePoi({ placeId, lat, lng });
                }
              }}
              onClose={() => setActiveTool(null)}
            />
          )}
        </div>

        <MapLegend
          dayColors={config.dayColors}
          isRouteBroken={
            filter.day !== null ||
            filter.city !== null ||
            filter.mustOnly ||
            filter.nextOnly
          }
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

        {/* Google POI 详情卡 — 用户点 Google 自带 POI icon 时显示
            位置由 CSS 控制(桌面右上 / 移动居底),避让 mobile-trip-bottom-switcher */}
        {activePoi ? (
          <ExternalPoiCard
            placeId={activePoi.placeId}
            onClose={() => setActivePoi(null)}
            dayNumbers={dayNumbers}
            spotsByDay={spotsSummaryByDay}
            defaultDay={filter.day ?? undefined}
            onAddToTrip={
              onAddPoiToTrip
                ? (data) => {
                    // 把 activePoi 已知的 lat/lng 补到 callback,跨层省再 fetch 一次
                    onAddPoiToTrip({
                      ...data,
                      lat: activePoi.lat,
                      lng: activePoi.lng,
                    });
                    setActivePoi(null);
                  }
                : undefined
            }
          />
        ) : null}

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
        {!isMobile && selectedRoute ? (
          <div
            className="route-detail-popover"
            style={desktopRoutePopoverStyle ?? undefined}
            role="dialog"
            aria-label="路线说明"
          >
            <button
              type="button"
              className="route-detail-dismiss"
              onClick={() => {
                setSelectedRouteId(null);
                setRouteAnchor(null);
              }}
              aria-label="关闭路线说明"
            >
              ×
            </button>
            <RouteDetailContent segment={selectedRoute} />
          </div>
        ) : null}
        <MobileRouteDetailSheet
          isOpen={Boolean(isMobile && selectedRoute)}
          segment={selectedRoute}
          onClose={() => {
            setSelectedRouteId(null);
            setRouteAnchor(null);
          }}
        />
    </section>
  );
}
