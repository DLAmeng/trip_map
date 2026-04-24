import L from 'leaflet';
import 'leaflet.markercluster';
import { buildSpotPopupElement } from '../shared/popup-builder';
/**
 * Leaflet 实现的 MarkerLayer。对齐原生 app.js createLeafletMarker L1860-1913 的
 * 行为(divIcon + popup + 点击 stopPropagation),把 marker 生命周期从全局 markerCache
 * 抽成这个独立对象,对外只暴露命令式方法。
 */
export function createLeafletMarkerLayer({ map, dayColors, onSpotClick, }) {
    const clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 16,
    });
    const normalMarkerGroup = L.layerGroup();
    map.addLayer(clusterGroup);
    function syncMarkerMode() {
        const useClusters = map.getZoom() < 9;
        if (useClusters) {
            if (map.hasLayer(normalMarkerGroup)) {
                map.removeLayer(normalMarkerGroup);
            }
            if (!map.hasLayer(clusterGroup)) {
                map.addLayer(clusterGroup);
            }
            return;
        }
        if (map.hasLayer(clusterGroup)) {
            map.removeLayer(clusterGroup);
        }
        if (!map.hasLayer(normalMarkerGroup)) {
            map.addLayer(normalMarkerGroup);
        }
    }
    map.on('zoomend', syncMarkerMode);
    syncMarkerMode();
    const entries = new Map();
    const fallbackColor = '#888';
    function getColor(day) {
        return dayColors[day - 1] ?? fallbackColor;
    }
    function makeIcon(spot, isActive, isNext = false) {
        const base = spot.mustVisit ? 24 : 20;
        const size = isActive ? base + 6 : base;
        const color = getColor(spot.day);
        const mustClass = spot.mustVisit ? ' is-must' : '';
        const activeClass = isActive ? ' is-active' : '';
        const nextClass = isNext ? ' is-next' : '';
        return L.divIcon({
            html: `<div class="spot-marker${mustClass}${activeClass}${nextClass}" style="--marker-color:${color};--marker-size:${size}px"></div>`,
            className: 'marker-shell',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }
    function removeAll() {
        clusterGroup.clearLayers();
        normalMarkerGroup.clearLayers();
        entries.clear();
    }
    function render(spots) {
        removeAll();
        for (const spot of spots) {
            const marker = L.marker([spot.lat, spot.lng], {
                icon: makeIcon(spot, false),
                riseOnHover: true,
                keyboard: true,
            });
            marker.bindPopup(buildSpotPopupElement(spot, {
                dayColors,
                fallbackColor,
            }), {
                maxWidth: 240,
                closeButton: false,
                offset: L.point(0, -6),
            });
            marker.on('click', (event) => {
                // 不让 marker 点击冒泡到 map 的 click(会触发 onMapClick → 清 selection)
                L.DomEvent.stopPropagation(event);
                onSpotClick?.(spot.id);
            });
            clusterGroup.addLayer(marker);
            normalMarkerGroup.addLayer(marker);
            entries.set(spot.id, { spot, marker, visible: true, isNext: false });
        }
        syncMarkerMode();
    }
    function setVisibleSpots(visibleIds) {
        entries.forEach((entry, id) => {
            const shouldShow = visibleIds.has(id);
            if (shouldShow === entry.visible)
                return;
            if (shouldShow) {
                clusterGroup.addLayer(entry.marker);
                normalMarkerGroup.addLayer(entry.marker);
            }
            else {
                clusterGroup.removeLayer(entry.marker);
                normalMarkerGroup.removeLayer(entry.marker);
            }
            entry.visible = shouldShow;
        });
    }
    let selectedId = null;
    function setSelected(id, options) {
        // 重置上一个选中
        if (selectedId && selectedId !== id) {
            const prev = entries.get(selectedId);
            if (prev) {
                prev.marker.setIcon(makeIcon(prev.spot, false, prev.isNext));
                prev.marker.closePopup();
            }
        }
        selectedId = id;
        if (!id)
            return;
        const entry = entries.get(id);
        if (!entry)
            return;
        entry.marker.setIcon(makeIcon(entry.spot, true, entry.isNext));
        if (options?.pan !== false && entry.visible) {
            // 自动平移并确保缩放级别至少为 15
            map.setView([entry.spot.lat, entry.spot.lng], Math.max(map.getZoom(), 15), {
                animate: true,
                duration: 0.4,
            });
        }
        if (entry.visible) {
            openPopup(id);
        }
    }
    function setNextHighlight(ids) {
        entries.forEach((entry, id) => {
            const shouldBeNext = ids.has(id);
            if (shouldBeNext === entry.isNext)
                return;
            entry.isNext = shouldBeNext;
            // 用当前 selected 状态重建 icon
            const isActive = selectedId === id;
            entry.marker.setIcon(makeIcon(entry.spot, isActive, shouldBeNext));
        });
    }
    function openPopup(id) {
        const entry = entries.get(id);
        if (!entry || !entry.visible)
            return;
        if (map.hasLayer(clusterGroup)) {
            clusterGroup.zoomToShowLayer(entry.marker, () => {
                entry.marker.openPopup();
            });
            return;
        }
        entry.marker.openPopup();
    }
    function destroy() {
        removeAll();
        map.off('zoomend', syncMarkerMode);
        map.removeLayer(clusterGroup);
        map.removeLayer(normalMarkerGroup);
    }
    return { render, setVisibleSpots, setSelected, openPopup, setNextHighlight, destroy };
}
