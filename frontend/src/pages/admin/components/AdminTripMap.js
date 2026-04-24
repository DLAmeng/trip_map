import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { buildRouteHeadline, buildRouteMetaLine } from '../../../utils/route-detail';
function buildMarkerIcon(label, color, selected, transport) {
    return L.divIcon({
        className: '',
        html: `
      <div class="admin-map-marker${selected ? ' is-selected' : ''}${transport ? ' is-transport' : ''}" style="--marker-color: ${color}">
        <span>${label}</span>
      </div>
    `,
        iconSize: transport ? [24, 24] : [30, 30],
        iconAnchor: transport ? [12, 12] : [15, 15],
    });
}
function resolveSegmentPath(segment, spotById) {
    if (Array.isArray(segment.path) && segment.path.length >= 2) {
        return segment.path;
    }
    const from = spotById.get(segment.fromSpotId);
    const to = spotById.get(segment.toSpotId);
    if (!from || !to)
        return [];
    return [
        [from.lat, from.lng],
        [to.lat, to.lng],
    ];
}
export function AdminTripMap({ config, days, selectedSpotId, selectedSegmentId, activeDay, isAddMode, onToggleAddMode, onSelectSpot, onSelectSegment, onAddSpotAtPoint, onUpdateSpotPosition, }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markerLayerRef = useRef(null);
    const routeLayerRef = useRef(null);
    const markerRef = useRef(new Map());
    const addModeRef = useRef(isAddMode);
    const onAddSpotRef = useRef(onAddSpotAtPoint);
    const allSpots = useMemo(() => days.flatMap((day) => day.spots), [days]);
    const allSegments = useMemo(() => days.flatMap((day) => day.segments), [days]);
    const spotById = useMemo(() => new Map(allSpots.map((spot) => [spot.id, spot])), [allSpots]);
    useEffect(() => {
        addModeRef.current = isAddMode;
    }, [isAddMode]);
    useEffect(() => {
        onAddSpotRef.current = onAddSpotAtPoint;
    }, [onAddSpotAtPoint]);
    useEffect(() => {
        if (!containerRef.current || mapRef.current)
            return;
        const map = L.map(containerRef.current, { zoomControl: false }).setView([config.centerLat, config.centerLng], config.defaultZoom);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18,
        }).addTo(map);
        const markerLayer = L.layerGroup().addTo(map);
        const routeLayer = L.layerGroup().addTo(map);
        map.on('click', (event) => {
            if (!addModeRef.current)
                return;
            onAddSpotRef.current(event.latlng.lat, event.latlng.lng);
        });
        mapRef.current = map;
        markerLayerRef.current = markerLayer;
        routeLayerRef.current = routeLayer;
        return () => {
            map.off();
            map.remove();
            mapRef.current = null;
            markerLayerRef.current = null;
            routeLayerRef.current = null;
            markerRef.current.clear();
        };
    }, [config.centerLat, config.centerLng, config.defaultZoom]);
    useEffect(() => {
        const map = mapRef.current;
        const markerLayer = markerLayerRef.current;
        const routeLayer = routeLayerRef.current;
        if (!map || !markerLayer || !routeLayer)
            return;
        markerLayer.clearLayers();
        routeLayer.clearLayers();
        markerRef.current.clear();
        allSegments.forEach((segment) => {
            const path = resolveSegmentPath(segment, spotById);
            if (path.length < 2)
                return;
            const dayIndex = Math.max(0, days.findIndex((day) => day.day === segment.day));
            const color = config.dayColors[dayIndex % config.dayColors.length] || '#b85c38';
            const isSelected = segment.id === selectedSegmentId;
            const isActiveDay = segment.day === activeDay;
            const line = L.polyline(path, {
                color,
                weight: isSelected ? 7 : 4,
                opacity: isActiveDay ? 0.92 : 0.38,
                dashArray: segment.detached ? '10 8' : undefined,
            });
            const meta = buildRouteMetaLine(segment);
            line.bindTooltip([buildRouteHeadline(segment), meta.join(' · ')].filter(Boolean).join(' · '), { sticky: true });
            line.on('click', (event) => {
                L.DomEvent.stopPropagation(event);
                onSelectSegment(segment.id);
            });
            line.addTo(routeLayer);
        });
        allSpots.forEach((spot) => {
            const dayIndex = Math.max(0, days.findIndex((day) => day.day === spot.day));
            const color = config.dayColors[dayIndex % config.dayColors.length] || '#b85c38';
            const marker = L.marker([spot.lat, spot.lng], {
                draggable: true,
                icon: buildMarkerIcon(String(spot.order), color, selectedSpotId === spot.id, spot.type === 'transport'),
                keyboard: false,
            });
            marker.bindTooltip(spot.name || '未命名景点', { direction: 'top', offset: [0, -14] });
            marker.on('click', (event) => {
                L.DomEvent.stopPropagation(event);
                onSelectSpot(spot.id);
            });
            marker.on('dragend', () => {
                const latLng = marker.getLatLng();
                onUpdateSpotPosition(spot.id, latLng.lat, latLng.lng);
            });
            marker.addTo(markerLayer);
            markerRef.current.set(spot.id, marker);
        });
    }, [
        activeDay,
        allSegments,
        allSpots,
        config.dayColors,
        days,
        onSelectSegment,
        onSelectSpot,
        onUpdateSpotPosition,
        selectedSegmentId,
        selectedSpotId,
        spotById,
    ]);
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !selectedSpotId)
            return;
        const marker = markerRef.current.get(selectedSpotId);
        if (!marker)
            return;
        const latLng = marker.getLatLng();
        map.panTo(latLng, { animate: true });
        marker.openTooltip();
    }, [selectedSpotId]);
    const fitAll = () => {
        const map = mapRef.current;
        if (!map || allSpots.length === 0)
            return;
        const bounds = L.latLngBounds(allSpots.map((spot) => [spot.lat, spot.lng]));
        map.fitBounds(bounds, { padding: [48, 48], animate: true });
    };
    const fitActiveDay = () => {
        const map = mapRef.current;
        if (!map)
            return;
        const daySpots = days.find((day) => day.day === activeDay)?.spots || [];
        if (!daySpots.length)
            return;
        const bounds = L.latLngBounds(daySpots.map((spot) => [spot.lat, spot.lng]));
        map.fitBounds(bounds, { padding: [48, 48], animate: true });
    };
    return (_jsxs("section", { className: "panel admin-trip-map-panel", children: [_jsxs("div", { className: "panel-head", children: [_jsxs("div", { children: [_jsx("p", { className: "panel-kicker", children: "Map Studio" }), _jsx("h2", { children: "\u5730\u56FE\u8054\u52A8\u7F16\u8F91" })] }), _jsxs("div", { className: "admin-trip-map-actions", children: [_jsx("button", { type: "button", className: `btn ${isAddMode ? 'btn-primary' : 'btn-ghost'}`, onClick: onToggleAddMode, children: isAddMode ? '点地图即可新增' : '地图新增模式' }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: fitActiveDay, children: "\u9002\u914D\u5F53\u5929" }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: fitAll, children: "\u5168\u90E8\u9002\u914D" })] })] }), _jsxs("div", { className: "admin-trip-map-frame", children: [_jsx("div", { ref: containerRef, className: "admin-trip-map-canvas" }), isAddMode ? (_jsxs("div", { className: "admin-map-add-hint", children: ["\u70B9\u5730\u56FE\u7A7A\u767D\u5904\u5373\u53EF\u628A\u666F\u70B9\u8FFD\u52A0\u5230 Day ", activeDay] })) : null] })] }));
}
