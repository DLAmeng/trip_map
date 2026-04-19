'use strict';

/**
 * 前端通用 trip API 客户端。
 * 由 dashboard.js / admin.js 使用。app.js 因为有本地 fallback 逻辑仍然保留自己的 fetch 实现。
 * 挂到 window.TripApi,不使用 ES module 以避免引入构建流程。
 */
(function () {
  const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const DEFAULT_TRIP_ID = 'current';

  async function request(url, options = {}) {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const message = (body && body.error) || (typeof body === 'string' ? body : null) || `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  const TripApi = {
    DEFAULT_TRIP_ID,

    async listTrips() {
      const data = await request('/api/trips');
      return Array.isArray(data.items) ? data.items : [];
    },

    getTripSummary(id) {
      return request(`/api/trips/${encodeURIComponent(id)}`);
    },

    getTripFull(id) {
      // no-store：避免 SW 对 /full 的 stale 响应干扰编辑保存
      return request(`/api/trips/${encodeURIComponent(id)}/full`, { cache: 'no-store' });
    },

    createTrip(body) {
      return request('/api/trips', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(body || {}),
      });
    },

    updateTripFull(id, payload) {
      return request(`/api/trips/${encodeURIComponent(id)}/full`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      });
    },

    deleteTrip(id) {
      return request(`/api/trips/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    duplicateTrip(id) {
      return request(`/api/trips/${encodeURIComponent(id)}/duplicate`, { method: 'POST' });
    },

    importLocalToCurrent() {
      return request('/api/trips/current/import-local', { method: 'POST' });
    },

    exportCurrentToLocal() {
      return request('/api/trips/current/export-local', { method: 'POST' });
    },
  };

  window.TripApi = TripApi;
})();
