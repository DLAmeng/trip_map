import type { RouteSegment, SpotItem } from '../types/trip';

/**
 * 对齐旧版 `legacy/old-frontend/admin.js` 的 makeBlankSpot。
 * 返回一个字段齐全的新景点,保证后续 normalize 不会补全出意外字段。
 */
export function makeBlankSpot(params?: {
  id?: string;
  day?: number;
  order?: number;
  nextStopId?: string | null;
  name?: string;
  lat?: number;
  lng?: number;
  city?: string;
}): SpotItem {
  const id =
    params?.id ??
    `spot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    day: params?.day ?? 1,
    order: params?.order ?? 1,
    city: params?.city ?? '',
    area: '',
    name: params?.name ?? '新景点',
    nameEn: '',
    timeSlot: '',
    lat: params?.lat ?? 0,
    lng: params?.lng ?? 0,
    mustVisit: false,
    type: 'spot',
    description: '',
    whyGo: '',
    stayMinutes: 60,
    nextStopId: params?.nextStopId ?? null,
    nearNextTransport: false,
    tags: [],
    transportNote: '',
    photos: [],
    googleMapsUri: '',
    googlePlaceId: '',
    rating: null,
    website: '',
    phone: '',
    openingHours: [],
  };
}

export function makeBlankSegment(params?: {
  id?: string;
  day?: number;
  fromSpotId?: string;
  toSpotId?: string;
  scope?: 'city' | 'intercity';
  transportType?: string;
}): RouteSegment {
  const id =
    params?.id ??
    `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    day: params?.day ?? 1,
    scope: params?.scope ?? 'city',
    fromSpotId: params?.fromSpotId ?? '',
    toSpotId: params?.toSpotId ?? '',
    transportType: params?.transportType ?? 'walk',
    label: '',
    duration: '',
    note: '',
    path: [],
  };
}
