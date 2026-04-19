import type { RouteSegment, SpotItem } from '../types/trip';

/**
 * map-adapter 公共接口。纯 TS,不依赖 React,也不依赖具体地图库。
 * 具体实现放在 leaflet/ 和(未来)google/ 下。
 *
 * 约定:
 * - React 只通过 MapController 的方法和事件和地图交互
 * - adapter 拿 container DOM、独立管理地图实例生命周期
 * - selectors 的 FilterState / SpotItem 在两边都能复用
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapControllerConfig {
  center: LatLng;
  zoom: number;
  /** 一维数组,index = day - 1;超出长度时 adapter 内部 fallback */
  dayColors: string[];
  /** 空白处点击 → React 清空 selection */
  onMapClick?: () => void;
  /** marker click → React 更新 selectedSpotId */
  onSpotClick?: (id: string) => void;
}

export interface MapController {
  markers: MarkerLayer;
  routes: RouteLayer;
  setView(center: LatLng, zoom?: number): void;
  fitBounds(points: LatLng[], padding?: number): void;
  fitToSpots(spots: SpotItem[], padding?: number): void;
  resetView(): void;
  destroy(): void;
}

export interface MarkerLayer {
  /** 首次 / spots 变化时整体重建 marker */
  render(spots: SpotItem[]): void;
  /** 过滤时的显隐同步 */
  setVisibleSpots(visibleIds: Set<string>): void;
  /** 选中状态 + 可选的 panTo */
  setSelected(id: string | null, options?: { pan?: boolean }): void;
  /** 手动打开指定 spot 的 popup(列表项点击用) */
  openPopup(id: string): void;
}

export interface RouteFilter {
  day: number | null;
}

export interface RouteLayer {
  render(segments: RouteSegment[], spotById: Map<string, SpotItem>): void;
  setActiveFilter(filter: RouteFilter): void;
}

export type MapControllerFactory = (
  container: HTMLElement,
  config: MapControllerConfig,
) => MapController;
