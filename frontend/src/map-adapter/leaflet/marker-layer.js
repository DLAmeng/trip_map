import L from 'leaflet';
import { buildSpotPopupHtml } from '../shared/popup-builder';
/**
 * Leaflet 实现的 MarkerLayer。对齐原生 app.js createLeafletMarker L1860-1913 的
 * 行为(divIcon + popup + 点击 stopPropagation),把 marker 生命周期从全局 markerCache
 * 抽成这个独立对象,对外只暴露命令式方法。
 */
export function createLeafletMarkerLayer({ map, dayColors, onSpotClick, }) {
    const entries = new Map();
    const fallbackColor = '#888';
    function getColor(day) {
        return dayColors[day - 1] ?? fallbackColor;
    }
    function makeIcon(spot, isActive) {
        const base = spot.mustVisit ? 24 : 20;
        const size = isActive ? base + 6 : base;
        const color = getColor(spot.day);
        const mustClass = spot.mustVisit ? ' is-must' : '';
        const activeClass = isActive ? ' is-active' : '';
        return L.divIcon({
            html: `<div class="spot-marker${mustClass}${activeClass}" style="--marker-color:${color};--marker-size:${size}px"></div>`,
            className: 'marker-shell',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
    }
    function removeAll() {
        entries.forEach((entry) => {
            entry.marker.remove();
        });
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
            marker.bindPopup(buildSpotPopupHtml(spot, { dayColors, fallbackColor }), {
                maxWidth: 240,
                closeButton: false,
                offset: L.point(0, -6),
            });
            marker.on('click', (event) => {
                // 不让 marker 点击冒泡到 map 的 click(会触发 onMapClick → 清 selection)
                L.DomEvent.stopPropagation(event);
                onSpotClick?.(spot.id);
            });
            marker.addTo(map);
            entries.set(spot.id, { spot, marker, visible: true });
        }
    }
    function setVisibleSpots(visibleIds) {
        entries.forEach((entry, id) => {
            const shouldShow = visibleIds.has(id);
            if (shouldShow === entry.visible)
                return;
            if (shouldShow) {
                entry.marker.addTo(map);
            }
            else {
                entry.marker.remove();
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
                prev.marker.setIcon(makeIcon(prev.spot, false));
                prev.marker.closePopup();
            }
        }
        selectedId = id;
        if (!id)
            return;
        const entry = entries.get(id);
        if (!entry)
            return;
        entry.marker.setIcon(makeIcon(entry.spot, true));
        if (options?.pan !== false && entry.visible) {
            map.panTo([entry.spot.lat, entry.spot.lng], { animate: true, duration: 0.4 });
        }
        if (entry.visible) {
            entry.marker.openPopup();
        }
    }
    function openPopup(id) {
        const entry = entries.get(id);
        if (!entry || !entry.visible)
            return;
        entry.marker.openPopup();
    }
    function destroy() {
        removeAll();
    }
    return { render, setVisibleSpots, setSelected, openPopup, destroy };
}
