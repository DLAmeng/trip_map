import L from 'leaflet';
import 'leaflet.markercluster';
import { buildSpotPopupElement } from '../shared/popup-builder';
const CLUSTER_EXPAND_ZOOM = 9;
const SPIDERFY_CLUSTER_LIMIT = 6;
const TINY_CLUSTER_DEGREES = 0.0003;
/**
 * Leaflet 实现的 MarkerLayer。对齐原生 app.js createLeafletMarker L1860-1913 的
 * 行为(divIcon + popup + 点击 stopPropagation),把 marker 生命周期从全局 markerCache
 * 抽成这个独立对象,对外只暴露命令式方法。
 */
export function createLeafletMarkerLayer({ map, dayColors, onSpotClick, onSpotPopupClose, }) {
    const clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: false,
        zoomToBoundsOnClick: false,
        disableClusteringAtZoom: CLUSTER_EXPAND_ZOOM,
    });
    map.addLayer(clusterGroup);
    function shouldSpiderfyCluster(event) {
        const markers = event.layer?.getAllChildMarkers?.() ?? [];
        if (markers.length < 2 || markers.length > SPIDERFY_CLUSTER_LIMIT)
            return false;
        const bounds = event.layer?.getBounds?.();
        if (!bounds?.isValid?.())
            return true;
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        const latSpan = Math.abs(northEast.lat - southWest.lat);
        const lngSpan = Math.abs(northEast.lng - southWest.lng);
        return latSpan <= TINY_CLUSTER_DEGREES && lngSpan <= TINY_CLUSTER_DEGREES;
    }
    clusterGroup.on('clusterclick', (event) => {
        event.originalEvent?.stopPropagation?.();
        event.originalEvent?.preventDefault?.();
        if (shouldSpiderfyCluster(event) && event.layer?.spiderfy) {
            event.layer.spiderfy();
            return;
        }
        const bounds = event.layer?.getBounds?.();
        if (bounds?.isValid?.()) {
            map.fitBounds(bounds, {
                animate: true,
                padding: L.point(48, 48),
                maxZoom: CLUSTER_EXPAND_ZOOM,
            });
            return;
        }
        const latLng = event.layer?.getLatLng?.();
        if (latLng) {
            map.setView(latLng, Math.max(map.getZoom() + 2, CLUSTER_EXPAND_ZOOM), { animate: true });
        }
    });
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
        // 显式关 popup —— 因为 bindPopup 的默认 remove→closePopup 被摘掉,markers 被
        // clearLayers 时不会自动关 popup,不手动关会留下孤儿 popup 在 map 上。
        entries.forEach((entry) => {
            entry.marker.closePopup();
        });
        clusterGroup.clearLayers();
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
                onNextSpotClick: onSpotClick,
            }), {
                maxWidth: 240,
                closeButton: true,
                offset: L.point(0, -6),
                autoClose: false,
                closeOnClick: false,
            });
            // 摘掉 Leaflet bindPopup 里默认注册的 { remove: this.closePopup }。
            // markercluster 在 zoomend 时会 _featureGroup.removeLayer(marker) 再 addLayer 做
            // cluster merge/split 动画(见 node_modules/leaflet.markercluster/src/
            // MarkerClusterGroup.js L184/L404/L1140+),每次 remove 都会把刚打开的 popup 关掉,
            // 表现为"点景点 popup 显示一下就消失"。
            //
            // popup 生命周期改由我们显式控制(setSelected 切换时 closePopup、openPopup 重开、
            // 用户点 × 的 DOM click、removeAll 兜底),不受 markercluster 内部 remove 影响。
            marker.off('remove', marker.closePopup, marker);
            marker.on('click', (event) => {
                // 不让 marker 点击冒泡到 map 的 click(会触发 onMapClick → 清 selection)
                if (event.originalEvent) {
                    L.DomEvent.stopPropagation(event.originalEvent);
                    L.DomEvent.preventDefault(event.originalEvent);
                }
                onSpotClick?.(spot.id);
            });
            // Leaflet 的 popupclose 事件触发源太多 —— setIcon / map setView 放大时
            // markercluster re-cluster 导致的 marker.remove → bindPopup 注册的 remove→closePopup、
            // 程序化切换 marker 的 closePopup、用户点 × —— 在 Leaflet 内部无法可靠区分,
            // 所以 popupclose 本身不做外通知(以前在这里清 spot URL 会把"程序被动关"
            // 当成"用户主动取消",造成点 marker popup 一闪而过的 race)。
            //
            // 想要"用户点 × → 清 selection"这个 UX,改在 popupopen 时给
            // .leaflet-popup-close-button 单独绑 DOM click:只有真人鼠标点击才会触发
            // DOM click,程序化 _close() 不会走 close button。这是能明确区分意图的唯一路径。
            marker.on('popupopen', (event) => {
                const popup = event.popup;
                const closeButton = popup
                    .getElement()
                    ?.querySelector('.leaflet-popup-close-button');
                if (!closeButton)
                    return;
                // { once: true }:每次 popup 重新 open 时 Leaflet 会重建 close button DOM,
                // 本次绑的 listener 在一次点击后自动解绑,不会泄漏到下次 popup 生命周期。
                closeButton.addEventListener('click', () => {
                    // Leaflet 自己的 _onCloseButtonClick 已经做了 _close + preventDefault,
                    // 这里只补"用户意图"这一层信号,不再手动 closePopup。
                    onSpotPopupClose?.(spot.id);
                }, { once: true });
            });
            clusterGroup.addLayer(marker);
            entries.set(spot.id, { spot, marker, visible: true, isNext: false });
        }
    }
    function setVisibleSpots(visibleIds) {
        entries.forEach((entry, id) => {
            const shouldShow = visibleIds.has(id);
            if (shouldShow === entry.visible)
                return;
            if (shouldShow) {
                clusterGroup.addLayer(entry.marker);
            }
            else {
                // 隐藏 marker 前先关 popup,防止默认 remove→closePopup 被摘掉后 popup 孤儿在 map 上。
                entry.marker.closePopup();
                clusterGroup.removeLayer(entry.marker);
            }
            entry.visible = shouldShow;
        });
    }
    let selectedId = null;
    function setSelected(id, options) {
        // 先更新内部 selectedId,再做 closePopup。顺序颠倒会导致旧 marker 的 popupclose
        // 事件在 handler 里 selectedId 仍等于自己,误以为是用户取消选中,
        // 触发 onSpotPopupClose → 上层清 spot URL → popup 刚开就被关(闪一下消失)。
        const prevId = selectedId;
        selectedId = id;
        if (prevId && prevId !== id) {
            const prev = entries.get(prevId);
            if (prev) {
                prev.marker.setIcon(makeIcon(prev.spot, false, prev.isNext));
                prev.marker.closePopup();
            }
        }
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
        clusterGroup.zoomToShowLayer(entry.marker, () => {
            entry.marker.openPopup();
        });
    }
    function destroy() {
        removeAll();
        clusterGroup.off();
        map.removeLayer(clusterGroup);
    }
    return { render, setVisibleSpots, setSelected, openPopup, setNextHighlight, destroy };
}
