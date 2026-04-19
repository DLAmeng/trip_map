import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef } from 'react';
import { getVisibleSpots } from '../../selectors/filterState';
import { createLeafletController } from '../../map-adapter/leaflet';
import { createGoogleController } from '../../map-adapter/google';
import { useTripMap } from '../../hooks/useTripMap';
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
export function TripMapCanvas({ config, spots, segments, spotById, filter, selectedSpotId, onSelectSpot, onMapClick, }) {
    const containerRef = useRef(null);
    const controllerRef = useRef(null);
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
        const factory = mapProvider === 'googleMaps' ? createGoogleController : createLeafletController;
        let controller = null;
        try {
            controller = factory(container, {
                center: { lat: centerLat, lng: centerLng },
                zoom: defaultZoom,
                dayColors: config.dayColors,
                onSpotClick: (id) => callbacksRef.current.onSelectSpot(id),
                onMapClick: () => callbacksRef.current.onMapClick(),
            });
            controllerRef.current = controller;
        }
        catch (err) {
            // Google stub 会抛;后面 Phase 5 再实现。这里兜底 fallback 到 Leaflet,
            // 保证第一版 mapProvider=googleMaps 的数据也能在 React 端跑起来。
            console.warn('[TripMapCanvas] primary map provider failed, fallback to Leaflet:', err);
            controller = createLeafletController(container, {
                center: { lat: centerLat, lng: centerLng },
                zoom: defaultZoom,
                dayColors: config.dayColors,
                onSpotClick: (id) => callbacksRef.current.onSelectSpot(id),
                onMapClick: () => callbacksRef.current.onMapClick(),
            });
            controllerRef.current = controller;
        }
        return () => {
            controller?.destroy();
            controllerRef.current = null;
        };
        // config.dayColors 用 dayColorsKey 做稳定性,避免引用变化就重 init
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [centerLat, centerLng, defaultZoom, mapProvider, dayColorsKey]);
    // 同步 spots / segments / filter / selection 到 controller
    useTripMap(controllerRef, {
        spots,
        segments,
        spotById,
        filter,
        selectedSpotId,
    });
    // 当天 spots(给"适配当天"用)
    const currentDaySpots = useMemo(() => {
        if (filter.day === null)
            return getVisibleSpots(spots, filter);
        return spots.filter((spot) => spot.day === filter.day);
    }, [spots, filter]);
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
    return (_jsxs("section", { className: "map-stage", "aria-label": "\u5730\u56FE", children: [_jsx("div", { ref: containerRef, className: `map-canvas${mapProvider === 'googleMaps' ? ' is-google' : ''}`, role: "application", "aria-label": "\u4EA4\u4E92\u5730\u56FE" }), _jsxs("div", { className: "map-controls", children: [_jsxs("button", { type: "button", className: "ctrl-btn", onClick: handleReset, title: "\u56DE\u5230\u884C\u7A0B\u521D\u59CB\u89C6\u89D2", children: [_jsx("span", { className: "ctrl-icon", "aria-hidden": "true", children: "\u21BA" }), _jsx("span", { children: "\u91CD\u7F6E\u89C6\u89D2" })] }), _jsxs("button", { type: "button", className: "ctrl-btn", onClick: handleFitToDay, disabled: currentDaySpots.length === 0, title: filter.day === null ? '适配全部可见景点' : `适配第 ${filter.day} 天`, children: [_jsx("span", { className: "ctrl-icon", "aria-hidden": "true", children: "\u25CE" }), _jsx("span", { children: filter.day === null ? '适配可见' : '适配当天' })] })] })] }));
}
