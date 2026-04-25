import L from 'leaflet';
import type { SpotItem } from '../../types/trip';
import type { LatLng, MapController, MapControllerFactory } from '../types';
import { createLeafletMarkerLayer } from './marker-layer';
import { createLeafletRouteLayer } from './route-layer';

/**
 * Leaflet 实现的 MapController 工厂。
 *
 * 对应原生 app.js initLeafletMap() L648-668:
 *   - L.map(container).setView(center, zoom)
 *   - L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
 *   - map.on('click') → onMapClick(清空选中)
 *   - 不做 zoomend 切换 marker 模式(marker cluster 第一版不做)
 *
 * 注意:React StrictMode 会让 useEffect 跑两次,destroy 必须彻底清掉
 * map 实例,否则第二次 init 会抛 "Map container is already initialized"。
 */
export const createLeafletController: MapControllerFactory = (container, config) => {
  const initialCenter: LatLng = config.center;
  const initialZoom = config.zoom;

  const map = L.map(container, { zoomControl: false }).setView(
    [initialCenter.lat, initialCenter.lng],
    initialZoom,
  );

  const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  });
  tileLayer.addTo(map);

  if (config.onMapClick) {
    map.on('click', () => {
      config.onMapClick?.();
    });
  }

  const markers = createLeafletMarkerLayer({
    map,
    dayColors: config.dayColors,
    onSpotClick: config.onSpotClick,
    onSpotPopupClose: config.onSpotPopupClose,
  });
  const routes = createLeafletRouteLayer({
    map,
    onRouteClick: config.onRouteClick,
  });

  function fitBounds(points: LatLng[], padding = 48): void {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p.lat, p.lng)));
    map.fitBounds(bounds, { padding: L.point(padding, padding), animate: true });
  }

  function fitToSpots(spots: SpotItem[], padding = 48): void {
    if (!spots.length) return;
    fitBounds(
      spots.map((s) => ({ lat: s.lat, lng: s.lng })),
      padding,
    );
  }

  function setView(center: LatLng, zoom?: number): void {
    map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true });
  }

  function resetView(): void {
    map.setView([initialCenter.lat, initialCenter.lng], initialZoom, { animate: true });
  }

  function destroy(): void {
    markers.destroy();
    routes.destroy();
    map.off();
    map.remove();
  }

  const controller: MapController = {
    markers,
    routes,
    setView,
    fitBounds,
    fitToSpots,
    resetView,
    destroy,
  };
  return controller;
};
