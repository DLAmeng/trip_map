import type {
  CreateTripBody,
  CreateTripResult,
  TripFullPayload,
  TripListItem,
  TripSummaryResponse,
  UpdateTripResult,
} from '../types/trip';

/**
 * 前端 trip API 客户端(TypeScript 版),跟根目录 trip-api.js 一一对应。
 * 所有 trip CRUD 都经由这里,保持前后端契约收口在同一层。
 * Places 搜索、照片上传、runtime-config 等 Phase 2+ 再按需补到 api/ 里。
 */

export const DEFAULT_TRIP_ID = 'current';

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export class TripApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'TripApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
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
  return body as T;
}

function extractErrorMessage(body: unknown): string | undefined {
  if (!body) return undefined;
  if (typeof body === 'string') return body;
  if (typeof body === 'object' && 'error' in body) {
    const candidate = (body as { error?: unknown }).error;
    if (typeof candidate === 'string') return candidate;
  }
  return undefined;
}

export async function listTrips(): Promise<TripListItem[]> {
  const data = await request<{ items?: TripListItem[] }>('/api/trips');
  return Array.isArray(data.items) ? data.items : [];
}

export function getTripSummary(id: string): Promise<TripSummaryResponse> {
  return request<TripSummaryResponse>(`/api/trips/${encodeURIComponent(id)}`);
}

export function getTripFull(id: string): Promise<TripFullPayload> {
  // no-store:避免 SW 对 /full 的 stale 响应干扰编辑保存
  return request<TripFullPayload>(`/api/trips/${encodeURIComponent(id)}/full`, {
    cache: 'no-store',
  });
}

export function createTrip(body: CreateTripBody): Promise<CreateTripResult> {
  return request<CreateTripResult>('/api/trips', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

export function updateTripFull(id: string, payload: TripFullPayload): Promise<UpdateTripResult> {
  return request<UpdateTripResult>(`/api/trips/${encodeURIComponent(id)}/full`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

/**
 * P32: 持久化前端 hydrate 出来的 route path / 距离 / 时长 / 运行时来源。
 * 后端只接受 path.length >= 2 的非空路径,直线 fallback 不会被存。幂等。
 */
export interface PersistSegmentPathUpdate {
  segmentId: string;
  path: Array<[number, number]>;
  distanceMeters?: number | null;
  durationSec?: number | null;
  runtimeSource?: string | null;
}

export function persistSegmentPaths(
  id: string,
  updates: PersistSegmentPathUpdate[],
): Promise<{ ok: boolean; updated: number }> {
  return request<{ ok: boolean; updated: number }>(
    `/api/trips/${encodeURIComponent(id)}/persist-paths`,
    {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ updates }),
    },
  );
}

export function deleteTrip(id: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/trips/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function duplicateTrip(id: string): Promise<CreateTripResult> {
  return request<CreateTripResult>(`/api/trips/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
  });
}

export function importLocalToCurrent(): Promise<UpdateTripResult> {
  return request<UpdateTripResult>('/api/trips/current/import-local', { method: 'POST' });
}

export function exportCurrentToLocal(): Promise<{ ok: boolean; path: string }> {
  return request<{ ok: boolean; path: string }>('/api/trips/current/export-local', {
    method: 'POST',
  });
}
