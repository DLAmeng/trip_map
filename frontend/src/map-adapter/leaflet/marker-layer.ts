import L from 'leaflet';
import 'leaflet.markercluster';
import type { SpotItem } from '../../types/trip';
import type { MarkerLayer } from '../types';
import { buildSpotPopupElement } from '../shared/popup-builder';

interface MarkerEntry {
  spot: SpotItem;
  marker: L.Marker;
  visible: boolean;
  isNext: boolean;
  /** 该景点在所属 day 内的 1-based 顺序,用于 marker 内嵌的小序号文字 */
  dayIndex: number;
}

interface CreateMarkerLayerParams {
  map: L.Map;
  dayColors: string[];
  onSpotClick?: (id: string) => void;
  onSpotPopupClose?: (id: string) => void;
}

interface LeafletClusterClickEvent extends L.LeafletEvent {
  originalEvent?: Event;
  layer: L.Layer & {
    getAllChildMarkers?: () => L.Marker[];
    getBounds?: () => L.LatLngBounds;
    getLatLng?: () => L.LatLng;
    spiderfy?: () => void;
  };
}

const CLUSTER_EXPAND_ZOOM = 9;
const SPIDERFY_CLUSTER_LIMIT = 6;
const TINY_CLUSTER_DEGREES = 0.0003;

/**
 * Leaflet 实现的 MarkerLayer。对齐原生 app.js createLeafletMarker L1860-1913 的
 * 行为(divIcon + popup + 点击 stopPropagation),把 marker 生命周期从全局 markerCache
 * 抽成这个独立对象,对外只暴露命令式方法。
 */
export function createLeafletMarkerLayer({
  map,
  dayColors,
  onSpotClick,
  onSpotPopupClose,
}: CreateMarkerLayerParams): MarkerLayer & { destroy(): void } {
  const clusterGroup = (L as any).markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: false,
    zoomToBoundsOnClick: false,
    disableClusteringAtZoom: CLUSTER_EXPAND_ZOOM,
  });
  map.addLayer(clusterGroup);

  function shouldSpiderfyCluster(event: LeafletClusterClickEvent): boolean {
    const markers = event.layer?.getAllChildMarkers?.() ?? [];
    if (markers.length < 2 || markers.length > SPIDERFY_CLUSTER_LIMIT) return false;
    const bounds = event.layer?.getBounds?.();
    if (!bounds?.isValid?.()) return true;
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    const latSpan = Math.abs(northEast.lat - southWest.lat);
    const lngSpan = Math.abs(northEast.lng - southWest.lng);
    return latSpan <= TINY_CLUSTER_DEGREES && lngSpan <= TINY_CLUSTER_DEGREES;
  }

  clusterGroup.on('clusterclick', (event: LeafletClusterClickEvent) => {
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

  const entries = new Map<string, MarkerEntry>();
  const fallbackColor = '#888';

  function getColor(day: number): string {
    return dayColors[day - 1] ?? fallbackColor;
  }

  function makeIcon(
    spot: SpotItem,
    isActive: boolean,
    isNext = false,
    dayIndex = 0,
  ): L.DivIcon {
    const base = spot.mustVisit ? 24 : 20;
    const size = isActive ? base + 6 : base;
    const color = getColor(spot.day);
    const mustClass = spot.mustVisit ? ' is-must' : '';
    const activeClass = isActive ? ' is-active' : '';
    const nextClass = isNext ? ' is-next' : '';
    // dayIndex 为 0(老调用点没传)时不渲染序号,保持向后兼容
    const indexHtml = dayIndex > 0
      ? `<span class="spot-marker-index">${dayIndex}</span>`
      : '';
    return L.divIcon({
      html: `<div class="spot-marker${mustClass}${activeClass}${nextClass}" style="--marker-color:${color};--marker-size:${size}px">${indexHtml}</div>`,
      className: 'marker-shell',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  function removeAll(): void {
    // 显式关 popup —— 因为 bindPopup 的默认 remove→closePopup 被摘掉,markers 被
    // clearLayers 时不会自动关 popup,不手动关会留下孤儿 popup 在 map 上。
    entries.forEach((entry) => {
      entry.marker.closePopup();
    });
    clusterGroup.clearLayers();
    entries.clear();
  }

  function render(spots: SpotItem[]): void {
    removeAll();
    // 按 day 分桶,基于 spot.order 排序后取 1-based 序号 → marker 内嵌数字
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

    for (const spot of spots) {
      const dayIndex = dayIndexById.get(spot.id) ?? 0;
      const marker = L.marker([spot.lat, spot.lng], {
        icon: makeIcon(spot, false, false, dayIndex),
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
        // P4-h: popup 打开时 leaflet 自动 pan,要避开移动端的浮层 toolbar
        // 顶部:mobile-trip-context-card(~60px) + mobile-map-search-bar(~58px) + 10px buffer
        // 底部:mobile-trip-bottom-switcher(~58px) + safe area + 10px buffer
        // 桌面下这些 toolbar 不存在,但留点 padding 不影响 — popup 离边缘有距离更舒适
        autoPan: true,
        autoPanPaddingTopLeft: L.point(20, 130),
        autoPanPaddingBottomRight: L.point(20, 110),
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
          ?.querySelector<HTMLAnchorElement>('.leaflet-popup-close-button');
        if (!closeButton) return;
        // { once: true }:每次 popup 重新 open 时 Leaflet 会重建 close button DOM,
        // 本次绑的 listener 在一次点击后自动解绑,不会泄漏到下次 popup 生命周期。
        closeButton.addEventListener(
          'click',
          () => {
            // Leaflet 自己的 _onCloseButtonClick 已经做了 _close + preventDefault,
            // 这里只补"用户意图"这一层信号,不再手动 closePopup。
            onSpotPopupClose?.(spot.id);
          },
          { once: true },
        );
      });
      clusterGroup.addLayer(marker);
      entries.set(spot.id, { spot, marker, visible: true, isNext: false, dayIndex });
    }
  }

  function setVisibleSpots(visibleIds: Set<string>): void {
    entries.forEach((entry, id) => {
      const shouldShow = visibleIds.has(id);
      if (shouldShow === entry.visible) return;
      if (shouldShow) {
        clusterGroup.addLayer(entry.marker);
      } else {
        // 隐藏 marker 前先关 popup,防止默认 remove→closePopup 被摘掉后 popup 孤儿在 map 上。
        entry.marker.closePopup();
        clusterGroup.removeLayer(entry.marker);
      }
      entry.visible = shouldShow;
    });
  }

  let selectedId: string | null = null;

  function setSelected(id: string | null, options?: { pan?: boolean }): void {
    // 先更新内部 selectedId,再做 closePopup。顺序颠倒会导致旧 marker 的 popupclose
    // 事件在 handler 里 selectedId 仍等于自己,误以为是用户取消选中,
    // 触发 onSpotPopupClose → 上层清 spot URL → popup 刚开就被关(闪一下消失)。
    const prevId = selectedId;
    selectedId = id;
    if (prevId && prevId !== id) {
      const prev = entries.get(prevId);
      if (prev) {
        prev.marker.setIcon(makeIcon(prev.spot, false, prev.isNext, prev.dayIndex));
        prev.marker.closePopup();
      }
    }
    if (!id) return;
    const entry = entries.get(id);
    if (!entry) return;
    entry.marker.setIcon(makeIcon(entry.spot, true, entry.isNext, entry.dayIndex));
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

  function setNextHighlight(ids: Set<string>): void {
    entries.forEach((entry, id) => {
      const shouldBeNext = ids.has(id);
      if (shouldBeNext === entry.isNext) return;
      entry.isNext = shouldBeNext;
      // 用当前 selected 状态重建 icon
      const isActive = selectedId === id;
      entry.marker.setIcon(makeIcon(entry.spot, isActive, shouldBeNext, entry.dayIndex));
    });
  }

  function openPopup(id: string): void {
    const entry = entries.get(id);
    if (!entry || !entry.visible) return;
    clusterGroup.zoomToShowLayer(entry.marker, () => {
      entry.marker.openPopup();
    });
  }

  function destroy(): void {
    removeAll();
    clusterGroup.off();
    map.removeLayer(clusterGroup);
  }

  return { render, setVisibleSpots, setSelected, openPopup, setNextHighlight, destroy };
}
