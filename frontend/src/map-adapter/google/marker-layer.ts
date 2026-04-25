import { MarkerClusterer } from '@googlemaps/markerclusterer';
import type { SpotItem } from '../../types/trip';
import type { MarkerLayer } from '../types';
import { buildSpotPopupElement } from '../shared/popup-builder';
import { debugTripMapEvent } from '../debug';

interface GoogleMarkerRef {
  marker: google.maps.marker.AdvancedMarkerElement;
  infoWindow: google.maps.InfoWindow;
  spotId: string;
  spot: SpotItem;
  popupContent: HTMLElement;
}

export function createGoogleMarkerLayer(config: {
  dayColors: string[];
  onSpotClick?: (id: string) => void;
  onSpotPopupClose?: (id: string) => void;
}) {
  let map: google.maps.Map | null = null;
  let markerRefs: GoogleMarkerRef[] = [];
  let markerCluster: MarkerClusterer | null = null;
  let activeInfoWindow: google.maps.InfoWindow | null = null;

  // 缓冲逻辑
  let pendingSpots: SpotItem[] | null = null;
  let pendingVisibleIds: Set<string> | null = null;
  let selectedId: string | null = null;
  let nextHighlightedIds = new Set<string>();

  function buildPinElement(spot: SpotItem, isActive: boolean, isNext: boolean) {
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

  function updateMarkerAppearance(ref: GoogleMarkerRef) {
    const isActive = selectedId === ref.spotId;
    const isNext = nextHighlightedIds.has(ref.spotId) && !isActive;
    const pin = buildPinElement(ref.spot, isActive, isNext);
    ref.marker.content = pin.element;
    ref.marker.zIndex = isActive ? 1200 + ref.spot.day : isNext ? 900 + ref.spot.day : 100 + ref.spot.day;
  }

  function updateAllMarkerAppearances() {
    markerRefs.forEach(updateMarkerAppearance);
  }

  function handleInfoWindowClosed(ref: GoogleMarkerRef) {
    debugTripMapEvent('google infoWindow close', {
      spotId: ref.spotId,
      selectedId,
      isActiveInfoWindow: activeInfoWindow === ref.infoWindow,
    });
    if (activeInfoWindow === ref.infoWindow) {
      activeInfoWindow = null;
    }
  }

  function handleInfoWindowCloseClick(ref: GoogleMarkerRef) {
    debugTripMapEvent('google infoWindow closeclick', { spotId: ref.spotId, selectedId });
    if (activeInfoWindow === ref.infoWindow) {
      activeInfoWindow = null;
    }
    if (selectedId === ref.spotId) {
      selectedId = null;
      updateAllMarkerAppearances();
      debugTripMapEvent('selected cleared by google infoWindow closeclick', { spotId: ref.spotId });
      config.onSpotPopupClose?.(ref.spotId);
    }
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

  function createClusterer() {
    return new MarkerClusterer({
      map,
      onClusterClick: (event, cluster, clusterMap) => {
        const domEvent = event.domEvent as Event | undefined;
        domEvent?.stopPropagation?.();
        domEvent?.preventDefault?.();
        const bounds = cluster.bounds;
        if (bounds && !bounds.isEmpty()) {
          clusterMap.fitBounds(bounds, 64);
          return;
        }
        const zoom = clusterMap.getZoom() ?? 8;
        clusterMap.setCenter(cluster.position);
        clusterMap.setZoom(Math.min(zoom + 2, 15));
      },
    });
  }

  const layer: MarkerLayer & { init: (m: google.maps.Map) => void; destroy: () => void } = {
    init(m: google.maps.Map) {
      map = m;
      markerCluster = createClusterer();
      // 初始化完成后，立刻恢复之前缓冲的数据
      if (pendingSpots) layer.render(pendingSpots);
      if (pendingVisibleIds) layer.setVisibleSpots(pendingVisibleIds);
      if (selectedId) layer.setSelected(selectedId, { pan: false });
    },

    render(spots: SpotItem[]) {
      pendingSpots = spots;
      if (!map) return;
      destroy();
      markerCluster = createClusterer();

      markerRefs = spots.map((spot) => {
        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: spot.lat, lng: spot.lng },
          title: spot.name,
        });
        const popupContent = buildSpotPopupElement(spot, {
          dayColors: config.dayColors,
          onNextSpotClick: config.onSpotClick,
        });

        const infoWindow = new google.maps.InfoWindow({
          content: popupContent,
          maxWidth: 260,
        });

        marker.addListener('gmp-click', () => {
          debugTripMapEvent('google marker click', { spotId: spot.id });
          config.onSpotClick?.(spot.id);
        });

        const ref = { marker, infoWindow, spotId: spot.id, spot, popupContent };
        infoWindow.addListener('closeclick', () => {
          handleInfoWindowCloseClick(ref);
        });
        infoWindow.addListener('close', () => {
          handleInfoWindowClosed(ref);
        });
        updateMarkerAppearance(ref);
        return ref;
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
          debugTripMapEvent('google infoWindow close by hidden marker', { spotId: ref.spotId });
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
      updateAllMarkerAppearances();

      if (id === null) {
        if (activeInfoWindow) {
          debugTripMapEvent('google infoWindow close by selected null');
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

    openPopup(id: string) {
      const ref = markerRefs.find((r) => r.spotId === id);
      if (ref && map) {
        if (activeInfoWindow && activeInfoWindow !== ref.infoWindow) {
          debugTripMapEvent('google infoWindow close before opening another', { nextSpotId: id });
          activeInfoWindow.close();
        }
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

    setNextHighlight(ids: Set<string>) {
      nextHighlightedIds = ids;
      updateAllMarkerAppearances();
    },

    destroy,
  };

  return layer;
}
