import L from 'leaflet';
import 'leaflet.markercluster';
import type { SpotItem } from '../../types/trip';
import type { MarkerLayer } from '../types';
import { buildSpotPopupHtml } from '../shared/popup-builder';

interface MarkerEntry {
  spot: SpotItem;
  marker: L.Marker;
  visible: boolean;
  isNext: boolean;
}

interface CreateMarkerLayerParams {
  map: L.Map;
  dayColors: string[];
  onSpotClick?: (id: string) => void;
}

/**
 * Leaflet 实现的 MarkerLayer。对齐原生 app.js createLeafletMarker L1860-1913 的
 * 行为(divIcon + popup + 点击 stopPropagation),把 marker 生命周期从全局 markerCache
 * 抽成这个独立对象,对外只暴露命令式方法。
 */
export function createLeafletMarkerLayer({
  map,
  dayColors,
  onSpotClick,
}: CreateMarkerLayerParams): MarkerLayer & { destroy(): void } {
  const clusterGroup = (L as any).markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 16,
  });
  map.addLayer(clusterGroup);

  const entries = new Map<string, MarkerEntry>();
  const fallbackColor = '#888';

  function getColor(day: number): string {
    return dayColors[day - 1] ?? fallbackColor;
  }

  function makeIcon(spot: SpotItem, isActive: boolean, isNext = false): L.DivIcon {
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

  function removeAll(): void {
    clusterGroup.clearLayers();
    entries.clear();
  }

  function render(spots: SpotItem[]): void {
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
      clusterGroup.addLayer(marker);
      entries.set(spot.id, { spot, marker, visible: true, isNext: false });
    }
  }

  function setVisibleSpots(visibleIds: Set<string>): void {
    entries.forEach((entry, id) => {
      const shouldShow = visibleIds.has(id);
      if (shouldShow === entry.visible) return;
      if (shouldShow) {
        clusterGroup.addLayer(entry.marker);
      } else {
        clusterGroup.removeLayer(entry.marker);
      }
      entry.visible = shouldShow;
    });
  }

  let selectedId: string | null = null;

  function setSelected(id: string | null, options?: { pan?: boolean }): void {
    // 重置上一个选中
    if (selectedId && selectedId !== id) {
      const prev = entries.get(selectedId);
      if (prev) {
        prev.marker.setIcon(makeIcon(prev.spot, false, prev.isNext));
        prev.marker.closePopup();
      }
    }
    selectedId = id;
    if (!id) return;
    const entry = entries.get(id);
    if (!entry) return;
    entry.marker.setIcon(makeIcon(entry.spot, true, entry.isNext));
    if (options?.pan !== false && entry.visible) {
      // 自动平移并确保缩放级别至少为 15
      map.setView([entry.spot.lat, entry.spot.lng], Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 0.4,
      });
    }
    if (entry.visible) {
      entry.marker.openPopup();
    }
  }

  function setNextHighlight(ids: Set<string>): void {
    entries.forEach((entry, id) => {
      const shouldBeNext = ids.has(id);
      if (shouldBeNext === entry.isNext) return;
      entry.isNext = shouldBeNext;
      // 用当前 selected 状态重建 icon
      const isActive = selectedId === id;
      entry.marker.setIcon(makeIcon(entry.spot, isActive, shouldBeNext));
    });
  }

  function openPopup(id: string): void {
    const entry = entries.get(id);
    if (!entry || !entry.visible) return;
    entry.marker.openPopup();
  }

  function destroy(): void {
    removeAll();
    map.removeLayer(clusterGroup);
  }

  return { render, setVisibleSpots, setSelected, openPopup, setNextHighlight, destroy };
}
