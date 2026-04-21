import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { getVisibleSpots, getVisibleSpotIds } from '../../selectors/filterState';
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
export function TripMapCanvas({ config, spots, segments, spotById, cityNames, filter, onFilterChange, selectedSpotId, onSelectSpot, onMapClick, stats, onToggleList, isListVisible, activeTool, setActiveTool, isOnline = true, isMobile = false, }) {
    const containerRef = useRef(null);
    const controllerRef = useRef(null);
    const [useFallback, setUseFallback] = useState(false);
    const [mapError, setMapError] = useState(null);
    const [geometryCache, setGeometryCache] = useState({});
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
        if (!container)
            return;
        const isGoogle = mapProvider === 'googleMaps' && !useFallback;
        const factory = isGoogle ? createGoogleController : createLeafletController;
        let controller = null;
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
        }
        catch (err) {
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
        const missing = segments.filter((s) => !s.path && !geometryCache[s.id] && (s.transportType === 'walk' || s.transportType === 'bus' || s.transportType === 'drive'));
        if (missing.length === 0)
            return;
        missing.forEach(async (seg) => {
            const from = spotById.get(seg.fromSpotId);
            const to = spotById.get(seg.toSpotId);
            if (!from || !to)
                return;
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
    // 监听过滤条件变化：当手动切换天数（且未选中具体景点）时，自动缩放以适配全天
    const lastFilterDay = useRef(filter.day);
    useEffect(() => {
        if (filter.day !== lastFilterDay.current) {
            lastFilterDay.current = filter.day;
            const controller = controllerRef.current;
            if (controller && !selectedSpotId && currentDaySpots.length > 0) {
                controller.fitToSpots(currentDaySpots);
            }
        }
    }, [filter.day, selectedSpotId, currentDaySpots]);
    const handleReset = () => {
        controllerRef.current?.resetView();
    };
    const handleFitToDay = () => {
        const controller = controllerRef.current;
        if (!controller)
            return;
        if (currentDaySpots.length === 0)
            return;
        controller.fitToSpots(currentDaySpots);
    };
    const handleToggleTool = (tool) => {
        setActiveTool(activeTool === tool ? null : tool);
    };
    const dayNumbers = useMemo(() => {
        const days = new Set();
        spots.forEach(s => days.add(s.day));
        return Array.from(days).sort((a, b) => a - b);
    }, [spots]);
    return (_jsxs("section", { className: "map-stage", "aria-label": "\u5730\u56FE", children: [_jsxs("div", { className: "map-notice-stack", "aria-live": "polite", children: [!isOnline ? (_jsx(MapNotice, { tone: "warning", message: "\u5F53\u524D\u79BB\u7EBF \u2014\u2014 \u5DF2\u663E\u793A\u7F13\u5B58\u6570\u636E,\u90E8\u5206\u529F\u80FD(\u641C\u7D22 / \u65B0\u8DEF\u5F84 / \u4FDD\u5B58)\u4E0D\u53EF\u7528\u3002" })) : null, mapError ? (_jsx(MapNotice, { tone: "error", message: `Google Maps 加载失败:${mapError}` +
                            (fallbackToLeaflet ? '（当前已自动降级回 Leaflet 引擎）' : '') })) : null] }), _jsx("div", { ref: containerRef, className: `map-canvas${mapProvider === 'googleMaps' ? ' is-google' : ''}`, role: "application", "aria-label": "\u4EA4\u4E92\u5730\u56FE" }), _jsx("div", { className: "desktop-only", children: _jsx(MapToolbar, { activeTool: activeTool, onToggleTool: handleToggleTool }) }), activeTool === 'filter' && (_jsx("div", { className: "desktop-only", children: _jsx(FiltersCard, { dayNumbers: dayNumbers, cityNames: cityNames, filter: filter, onChange: onFilterChange }) })), activeTool === 'summary' && window.innerWidth > 1024 && (_jsx(SummaryBar, { stats: stats, isFiltered: filter.day !== null ||
                    filter.city !== null ||
                    filter.mustOnly ||
                    filter.nextOnly })), (activeTool === 'search' || isMobile) && (_jsx(MapSearch, { spots: spots, segments: segments, apiKey: config.googleMaps?.apiKey, onSelectSpot: onSelectSpot, onFocus: () => {
                    if (isMobile) {
                        // 当移动端聚焦时，关闭底部的列表和筛选器弹窗
                        if (isListVisible)
                            onToggleList();
                        setActiveTool('search');
                    }
                }, onSelectRoute: (id) => {
                    const seg = segments.find((s) => s.id === id);
                    if (seg) {
                        const from = spotById.get(seg.fromSpotId);
                        const to = spotById.get(seg.toSpotId);
                        if (from && to) {
                            controllerRef.current?.fitToSpots([from, to]);
                        }
                        else if (from || to) {
                            const s = (from || to);
                            controllerRef.current?.setView({ lat: s.lat, lng: s.lng }, 15);
                        }
                    }
                }, onSelectLocation: (lat, lng) => {
                    controllerRef.current?.setView({ lat, lng }, 15);
                }, onClose: () => setActiveTool(null) })), _jsx(MapLegend, { dayColors: config.dayColors, isRouteBroken: filter.day !== null, isGoogleMap: mapProvider === 'googleMaps' && !useFallback, hasWalkSegment: segments.some((s) => s.transportType?.toLowerCase?.() === 'walk') }), isMobile ? null : (_jsxs("div", { className: "map-controls", children: [_jsxs("button", { type: "button", className: "ctrl-btn", onClick: handleReset, title: "\u56DE\u5230\u884C\u7A0B\u521D\u59CB\u89C6\u89D2", children: [_jsx("span", { className: "ctrl-icon", "aria-hidden": "true", children: "\u21BA" }), _jsx("span", { className: "ctrl-label", children: "\u91CD\u7F6E\u89C6\u89D2" })] }), _jsxs("button", { type: "button", className: "ctrl-btn", onClick: handleFitToDay, disabled: currentDaySpots.length === 0, title: filter.day === null ? '适配全部可见景点' : `适配第 ${filter.day} 天`, children: [_jsx("span", { className: "ctrl-icon", "aria-hidden": "true", children: "\u25CE" }), _jsx("span", { className: "ctrl-label", children: filter.day === null ? '适配可见' : '适配当天' })] }), _jsxs("button", { type: "button", className: `ctrl-btn desktop-only ${isListVisible ? 'active' : ''}`, onClick: onToggleList, title: "\u5207\u6362\u65E5\u7A0B\u5217\u8868", children: [_jsx("span", { className: "ctrl-icon", "aria-hidden": "true", children: "\u2261" }), _jsx("span", { className: "ctrl-label", children: isListVisible ? '收起列表' : '显示列表' })] })] })), isMobile ? (_jsx(MobileMapFloatingActions, { onResetView: handleReset, onFitVisible: handleFitToDay, fitDisabled: currentDaySpots.length === 0, onLocate: (coords) => {
                    if (!coords) {
                        console.warn('[TripMapCanvas] geolocation unavailable');
                        return;
                    }
                    controllerRef.current?.setView(coords, 15);
                } })) : null] }));
}
