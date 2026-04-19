'use strict';

function createEmptyTripPayload({
  title = '未命名行程',
  description = '',
  destination = '',
  startDate = '',
  endDate = '',
} = {}) {
  return {
    meta: {
      title,
      description,
      destination,
      startDate,
      endDate,
    },
    config: {
      mapProvider: 'googleMaps',
      centerLat: 35.6762,
      centerLng: 139.6503,
      defaultZoom: 10,
      googleMaps: {
        apiKey: '',
        mapId: 'DEMO_MAP_ID',
        language: 'zh-CN',
        region: 'JP',
        fallbackToLeaflet: true,
      },
      routing: {
        provider: 'Google Maps Routes Library',
        baseUrl: 'https://router.project-osrm.org/route/v1',
      },
      dayColors: [
        '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
        '#3498db', '#9b59b6', '#8e44ad', '#c0392b', '#d35400',
        '#27ae60', '#2980b9', '#16a085', '#7f8c8d',
      ],
    },
    spots: [],
    routeSegments: [],
  };
}

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'trip';
}

module.exports = { createEmptyTripPayload, slugify };
