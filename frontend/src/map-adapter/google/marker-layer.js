import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { buildSpotPopupElement } from '../shared/popup-builder';
export function createGoogleMarkerLayer(config) {
    let map = null;
    let markerRefs = [];
    let markerCluster = null;
    let activeInfoWindow = null;
    // 缓冲逻辑
    let pendingSpots = null;
    let pendingVisibleIds = null;
    let selectedId = null;
    let nextHighlightedIds = new Set();
    function buildPinElement(spot, isActive, isNext) {
        const scale = isActive
            ? (spot.mustVisit ? 1.45 : 1.3)
            : isNext
                ? (spot.mustVisit ? 1.28 : 1.12)
                : (spot.mustVisit ? 1.15 : 1);
        return new google.maps.marker.PinElement({
            glyphText: String(spot.order),
            glyphColor: '#fff',
            background: config.dayColors[spot.day - 1] || '#ea4335',
            borderColor: isActive ? '#183847' : isNext ? '#236f7a' : '#fff',
            scale,
        });
    }
    function updateMarkerAppearance(ref) {
        const isActive = selectedId === ref.spotId;
        const isNext = nextHighlightedIds.has(ref.spotId) && !isActive;
        const pin = buildPinElement(ref.spot, isActive, isNext);
        ref.marker.content = pin.element;
        ref.marker.zIndex = isActive ? 1200 + ref.spot.day : isNext ? 900 + ref.spot.day : 100 + ref.spot.day;
    }
    function updateAllMarkerAppearances() {
        markerRefs.forEach(updateMarkerAppearance);
    }
    function destroy() {
        if (markerCluster) {
            markerCluster.clearMarkers();
            markerCluster = null;
        }
        markerRefs.forEach((ref) => {
            ref.marker.map = null;
            if (typeof google !== 'undefined' && google.maps && google.maps.event) {
                google.maps.event.clearInstanceListeners(ref.marker);
            }
        });
        markerRefs = [];
    }
    const layer = {
        init(m) {
            map = m;
            markerCluster = new MarkerClusterer({ map });
            // 初始化完成后，立刻恢复之前缓冲的数据
            if (pendingSpots)
                layer.render(pendingSpots);
            if (pendingVisibleIds)
                layer.setVisibleSpots(pendingVisibleIds);
            if (selectedId)
                layer.setSelected(selectedId, { pan: false });
        },
        render(spots) {
            pendingSpots = spots;
            if (!map)
                return;
            destroy();
            markerCluster = new MarkerClusterer({ map });
            markerRefs = spots.map((spot) => {
                const marker = new google.maps.marker.AdvancedMarkerElement({
                    position: { lat: spot.lat, lng: spot.lng },
                    title: spot.name,
                });
                const popupContent = buildSpotPopupElement(spot, {
                    dayColors: config.dayColors,
                });
                const infoWindow = new google.maps.InfoWindow({
                    content: popupContent,
                    maxWidth: 260,
                });
                marker.addListener('gmp-click', () => {
                    config.onSpotClick?.(spot.id);
                });
                const ref = { marker, infoWindow, spotId: spot.id, spot, popupContent };
                updateMarkerAppearance(ref);
                return ref;
            });
            const markers = markerRefs.map((r) => r.marker);
            markerCluster.addMarkers(markers);
        },
        setVisibleSpots(visibleIds) {
            pendingVisibleIds = visibleIds;
            if (!map || !markerCluster)
                return;
            const visibleMarkers = [];
            markerRefs.forEach((ref) => {
                const isVisible = visibleIds.has(ref.spotId);
                if (isVisible) {
                    visibleMarkers.push(ref.marker);
                }
                if (!isVisible && activeInfoWindow === ref.infoWindow) {
                    activeInfoWindow.close();
                    activeInfoWindow = null;
                }
            });
            // 更新聚类器中的标记
            markerCluster.clearMarkers();
            markerCluster.addMarkers(visibleMarkers);
        },
        setSelected(id, options) {
            selectedId = id;
            if (!map)
                return;
            updateAllMarkerAppearances();
            if (id === null) {
                if (activeInfoWindow) {
                    activeInfoWindow.close();
                    activeInfoWindow = null;
                }
                return;
            }
            const ref = markerRefs.find((r) => r.spotId === id);
            if (ref) {
                if (options?.pan) {
                    map.panTo(ref.marker.position);
                    // 如果当前缩放层级太小（太远），自动放大到 15 级
                    if (map.getZoom() < 15) {
                        map.setZoom(15);
                    }
                    google.maps.event.addListenerOnce(map, 'idle', () => {
                        if (selectedId === id) {
                            layer.openPopup(id);
                        }
                    });
                    return;
                }
                // 自动打开气泡弹窗，显示景点信息
                layer.openPopup(id);
            }
        },
        openPopup(id) {
            const ref = markerRefs.find((r) => r.spotId === id);
            if (ref && map) {
                if (activeInfoWindow)
                    activeInfoWindow.close();
                if (ref.marker.position) {
                    ref.infoWindow.setPosition(ref.marker.position);
                }
                ref.infoWindow.open({
                    map,
                    shouldFocus: false,
                });
                activeInfoWindow = ref.infoWindow;
            }
        },
        setNextHighlight(ids) {
            nextHighlightedIds = ids;
            updateAllMarkerAppearances();
        },
        destroy,
    };
    return layer;
}
