import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { buildSpotPopupHtml } from '../shared/popup-builder';
export function createGoogleMarkerLayer(config) {
    let map = null;
    let markerRefs = [];
    let markerCluster = null;
    let activeInfoWindow = null;
    // 缓冲逻辑
    let pendingSpots = null;
    let pendingVisibleIds = null;
    let selectedId = null;
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
                const pin = new google.maps.marker.PinElement({
                    glyphText: String(spot.order),
                    glyphColor: '#fff',
                    background: config.dayColors[spot.day - 1] || '#ea4335',
                    borderColor: '#fff',
                });
                const marker = new google.maps.marker.AdvancedMarkerElement({
                    position: { lat: spot.lat, lng: spot.lng },
                    title: spot.name,
                    content: pin,
                });
                const infoWindow = new google.maps.InfoWindow({
                    content: buildSpotPopupHtml(spot, { dayColors: config.dayColors }),
                    maxWidth: 260,
                });
                marker.addListener('gmp-click', () => {
                    config.onSpotClick?.(spot.id);
                });
                return { marker, infoWindow, spotId: spot.id };
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
                ref.infoWindow.open({
                    anchor: ref.marker,
                    map,
                    shouldFocus: false,
                });
                activeInfoWindow = ref.infoWindow;
            }
        },
        destroy,
    };
    return layer;
}
