import { loadGoogleMapsLibrary, importLibrary } from './loader';
import type { MapController, MapControllerFactory, LatLng } from '../types';
import type { SpotItem } from '../../types/trip';
import { createGoogleMarkerLayer } from './marker-layer';
import { createGoogleRouteLayer } from './route-layer';
import { debugTripMapEvent } from '../debug';

export const createGoogleController: MapControllerFactory = (container, config) => {
  const initialCenter = config.center;
  const initialZoom = config.zoom;
  let googleMap: google.maps.Map | null = null;
  let markers: any = null;
  let routes: any = null;

  // 因为工厂函数必须同步返回接口，我们先返回一个“代理”控制器，
  // 它的方法会等待地图加载完成后再执行。
  const initPromise = loadGoogleMapsLibrary({
    apiKey: config.apiKey || '',
  })
    .then(async (mapsLibrary) => {
      const { Map } = mapsLibrary as google.maps.MapsLibrary;

      // 确保也加载了 marker 库 (Legacy Marker 同样需要库就绪)
      await importLibrary('marker');

      const mapOptions: google.maps.MapOptions = {
        center: initialCenter,
        zoom: initialZoom,
        // 彻底移除所有 Google Maps 原生控件 (缩放、地图类型、街景、镜头等)
        disableDefaultUI: true,
        // 高级标记要求必须有 mapId
        mapId: config.mapId || 'DEMO_MAP_ID',
      };

      googleMap = new Map(container, mapOptions);

      if (config.onMapClick) {
        googleMap.addListener('click', () => {
          debugTripMapEvent('google map click');
          config.onMapClick?.();
        });
      }

      markers.init(googleMap);
      routes.init(googleMap);

      return googleMap;
    })
    .catch((err: any) => {
      console.error('[GoogleMapsAdapter] Initialization failed:', err);
      config.onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    });

  markers = createGoogleMarkerLayer({
    dayColors: config.dayColors,
    onSpotClick: config.onSpotClick,
    onSpotPopupClose: config.onSpotPopupClose,
  });

  routes = createGoogleRouteLayer({
    onRouteClick: config.onRouteClick,
  });

  const controller: MapController = {
    markers,
    routes,
    async setView(center: LatLng, zoom?: number) {
      const map = await initPromise;
      map.setCenter(center);
      if (zoom !== undefined) map.setZoom(zoom);
    },
    async fitBounds(points: LatLng[], padding = 48) {
      const map = await initPromise;
      if (!points.length) return;
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, padding);
    },
    async fitToSpots(spots: SpotItem[], padding = 48) {
      if (!spots.length) return;
      await this.fitBounds(
        spots.map((s) => ({ lat: s.lat, lng: s.lng })),
        padding
      );
    },
    async resetView() {
      const map = await initPromise;
      map.setCenter(initialCenter);
      map.setZoom(initialZoom);
    },
    destroy() {
      // 安全清理：只有当全局 google 对象存在时才执行清理逻辑
      if (typeof google !== 'undefined' && google.maps && google.maps.event) {
        google.maps.event.clearInstanceListeners(container);
      }
      markers.destroy();
      routes.destroy();
    },
  };

  return controller;
};
