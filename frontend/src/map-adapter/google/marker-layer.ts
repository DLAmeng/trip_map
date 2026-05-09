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
  /** 该景点在所属 day 内的 1-based 顺序,marker 内显示的 glyph */
  dayIndex: number;
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

  function buildPinElement(spot: SpotItem, isActive: boolean, isNext: boolean, dayIndex: number) {
    const scale = isActive
      ? (spot.mustVisit ? 1.45 : 1.3)
      : isNext
        ? (spot.mustVisit ? 1.28 : 1.12)
        : (spot.mustVisit ? 1.15 : 1);

    return new google.maps.marker.PinElement({
      glyphText: String(dayIndex || spot.order),
      glyphColor: '#fff',
      background: config.dayColors[spot.day - 1] || '#ea4335',
      borderColor: isActive ? '#183847' : isNext ? '#236f7a' : '#fff',
      scale,
    });
  }

  function updateMarkerAppearance(ref: GoogleMarkerRef) {
    const isActive = selectedId === ref.spotId;
    const isNext = nextHighlightedIds.has(ref.spotId) && !isActive;
    const pin = buildPinElement(ref.spot, isActive, isNext, ref.dayIndex);
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

      // P7 回退:之前按 spot.id 去重会**丢掉合理的多日访问 spot**,
      // 只保留 jitter 处理同坐标视觉重叠 — 让所有 spot 都建 marker。
      // 重复的 spot.id 仅打 debug 日志,不删除。
      {
        const seenIds = new Set<string>();
        let duplicateCount = 0;
        for (const spot of spots) {
          if (seenIds.has(spot.id)) duplicateCount += 1;
          else seenIds.add(spot.id);
        }
        if (duplicateCount > 0) {
          debugTripMapEvent('google marker render duplicate ids (kept all)', {
            total: spots.length,
            duplicates: duplicateCount,
          });
        }
      }

      // 按 day 分桶,基于 spot.order 计算每个 spot 在当天的 1-based 序号
      const dayCounters = new Map<number, number>();
      const dayIndexById = new Map<string, number>();
      const sortedForIndex = [...spots].sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return (a.order ?? 0) - (b.order ?? 0);
      });
      for (const spot of sortedForIndex) {
        const next = (dayCounters.get(spot.day) ?? 0) + 1;
        dayCounters.set(spot.day, next);
        dayIndexById.set(spot.id, next);
      }

      // P7: 同坐标 marker jitter — 业务里"第 N 天访问 X" + "第 M 天再访问 X"
      // 是合理数据,但 lat/lng 完全相同会让 cluster 把它们永远合并显示 "N",
      // 用户点击只能看到一个 popup。给同位置第 2+ 个 marker 加微小角度偏移,
      // ~11 米/个,zoom 16+ 时视觉上能分开,cluster fitBounds 能正常展开。
      const positionGroupCount = new Map<string, number>();
      const POSITION_PRECISION = 6;
      const JITTER_DEG = 0.0001; // ~11 米

      markerRefs = spots.map((spot) => {
        // 同坐标第 N+1 个 spot:沿黄金角圆周偏移,分布均匀
        const posKey = `${spot.lat.toFixed(POSITION_PRECISION)},${spot.lng.toFixed(POSITION_PRECISION)}`;
        const groupIdx = positionGroupCount.get(posKey) ?? 0;
        positionGroupCount.set(posKey, groupIdx + 1);
        let renderLat = spot.lat;
        let renderLng = spot.lng;
        if (groupIdx > 0) {
          const angle = (groupIdx * 137.5 * Math.PI) / 180;
          const r = JITTER_DEG * groupIdx;
          const cosLat = Math.cos((spot.lat * Math.PI) / 180) || 1;
          renderLat += r * Math.cos(angle);
          renderLng += (r * Math.sin(angle)) / cosLat;
        }
        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: renderLat, lng: renderLng },
          title: spot.name,
        });
        const popupContent = buildSpotPopupElement(spot, {
          dayColors: config.dayColors,
          onNextSpotClick: config.onSpotClick,
        });

        // P5: 动态 maxWidth — 移动端突破 260 限制至 viewport - 32
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
        const dynamicMaxWidth = Math.max(280, Math.min(viewportWidth - 32, 360));
        const infoWindow = new google.maps.InfoWindow({
          content: popupContent,
          maxWidth: dynamicMaxWidth,
          // P6 回退:让 Google 自己 autoPan 处理边界(默认 false)
          // 我们在 openPopup 里手动 panTo 让 marker 居中,然后 popup 自然跟随 marker
        });

        marker.addListener('gmp-click', () => {
          debugTripMapEvent('google marker click', { spotId: spot.id });
          config.onSpotClick?.(spot.id);
        });

        const dayIndex = dayIndexById.get(spot.id) ?? 0;
        const ref = { marker, infoWindow, spotId: spot.id, spot, popupContent, dayIndex };
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
        // P6 修正:打开 popup 前让 marker 移到屏幕中央**偏下**位置,
        // 这样 popup(在 marker 上方)的视觉中心会更接近屏幕几何中央。
        // panTo 让 marker 居中 → panBy(0, -120) 视图上移 120px ⇒ marker 屏幕位置下移 120px
        // 之后用户拖动地图,popup 因锚定到 marker 会跟着地图一起移动 —
        // 这是 Google InfoWindow 标准行为,符合用户对地图 popup 的直觉。
        const markerPos = ref.marker.position as google.maps.LatLngLiteral | null;
        if (markerPos) {
          map.panTo(markerPos);
          // P11-1: 动态计算 panY — viewport 18% 上限 120px。
          // iPhone Pro (812h) → -120;iPhone SE (568h) → -102;窄屏 → 更小,
          // 避免 popup 顶端撞合并的 trip-card+search 区域。
          const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
          const panY = -Math.min(120, Math.floor(viewportH * 0.18));
          map.panBy(0, panY);
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
