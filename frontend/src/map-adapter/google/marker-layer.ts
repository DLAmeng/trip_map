import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { SpotItem } from '../../types/trip';
import type { MarkerLayer } from '../types';
import { buildSpotPopupHtml } from '../shared/popup-builder';

interface GoogleMarkerRef {
  marker: google.maps.marker.AdvancedMarkerElement;
  infoWindow: google.maps.InfoWindow;
  spotId: string;
}

export function createGoogleMarkerLayer(config: {
  dayColors: string[];
  onSpotClick?: (id: string) => void;
}) {
  let map: google.maps.Map | null = null;
  let markerRefs: GoogleMarkerRef[] = [];
  let markerCluster: MarkerClusterer | null = null;
  let activeInfoWindow: google.maps.InfoWindow | null = null;

  // 缓冲逻辑
  let pendingSpots: SpotItem[] | null = null;
  let pendingVisibleIds: Set<string> | null = null;
  let selectedId: string | null = null;

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

  const layer: MarkerLayer & { init: (m: google.maps.Map) => void; destroy: () => void } = {
    init(m: google.maps.Map) {
      map = m;
      markerCluster = new MarkerClusterer({ map });
      // 初始化完成后，立刻恢复之前缓冲的数据
      if (pendingSpots) layer.render(pendingSpots);
      if (pendingVisibleIds) layer.setVisibleSpots(pendingVisibleIds);
      if (selectedId) layer.setSelected(selectedId, { pan: false });
    },

    render(spots: SpotItem[]) {
      pendingSpots = spots;
      if (!map) return;
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

    setVisibleSpots(visibleIds: Set<string>) {
      pendingVisibleIds = visibleIds;
      if (!map || !markerCluster) return;

      const visibleMarkers: google.maps.marker.AdvancedMarkerElement[] = [];

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

    setSelected(id: string | null, options?: { pan?: boolean }) {
      selectedId = id;
      if (!map) return;

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
          map.panTo(ref.marker.position as google.maps.LatLngLiteral);
          // 如果当前缩放层级太小（太远），自动放大到 15 级
          if (map.getZoom()! < 15) {
            map.setZoom(15);
          }
        }
        // 自动打开气泡弹窗，显示景点信息
        layer.openPopup(id);
      }
    },

    openPopup(id: string) {
      const ref = markerRefs.find((r) => r.spotId === id);
      if (ref && map) {
        if (activeInfoWindow) activeInfoWindow.close();
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
