/**
 * 前端 trip API 客户端(TypeScript 版),跟根目录 trip-api.js 一一对应。
 * 所有 trip CRUD 走这里,迁移期的 React 页面和原生页面保持同一个后端契约。
 * Places 搜索、照片上传、runtime-config 等 Phase 2+ 再按需补到 api/ 里。
 */
export const DEFAULT_TRIP_ID = 'current';
const JSON_HEADERS = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
};
export class TripApiError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.name = 'TripApiError';
        this.status = status;
        this.body = body;
    }
}
async function request(url, options = {}) {
    const response = await fetch(url, {
        headers: { Accept: 'application/json', ...(options.headers || {}) },
        ...options,
    });
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
        ? await response.json()
        : await response.text();
    if (!response.ok) {
        const message = extractErrorMessage(body) || `HTTP ${response.status}`;
        throw new TripApiError(message, response.status, body);
    }
    return body;
}
function extractErrorMessage(body) {
    if (!body)
        return undefined;
    if (typeof body === 'string')
        return body;
    if (typeof body === 'object' && 'error' in body) {
        const candidate = body.error;
        if (typeof candidate === 'string')
            return candidate;
    }
    return undefined;
}
export async function listTrips() {
    const data = await request('/api/trips');
    return Array.isArray(data.items) ? data.items : [];
}
export function getTripSummary(id) {
    return request(`/api/trips/${encodeURIComponent(id)}`);
}
export function getTripFull(id) {
    // no-store:避免 SW 对 /full 的 stale 响应干扰编辑保存
    return request(`/api/trips/${encodeURIComponent(id)}/full`, {
        cache: 'no-store',
    });
}
export function createTrip(body) {
    return request('/api/trips', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
    });
}
export function updateTripFull(id, payload) {
    return request(`/api/trips/${encodeURIComponent(id)}/full`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
    });
}
export function deleteTrip(id) {
    return request(`/api/trips/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
}
export function duplicateTrip(id) {
    return request(`/api/trips/${encodeURIComponent(id)}/duplicate`, {
        method: 'POST',
    });
}
export function importLocalToCurrent() {
    return request('/api/trips/current/import-local', { method: 'POST' });
}
export function exportCurrentToLocal() {
    return request('/api/trips/current/export-local', {
        method: 'POST',
    });
}
