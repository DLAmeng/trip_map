import { useEffect, useState } from 'react';
import { importLibrary } from '../../../map-adapter/google/loader';

interface ExternalPoiCardProps {
  /** Google Places placeId,组件内部用它 fetch 详情 */
  placeId: string;
  /** 关闭卡片回调(用户点 × 或外层 setActivePoi(null)) */
  onClose: () => void;
}

interface PoiDetails {
  name: string;
  address: string;
  rating: number | null;
  userRatingCount: number | null;
  photoUrl: string | null;
  websiteUri: string | null;
  googleMapsUri: string | null;
}

/**
 * 自渲染的 Google POI 详情卡 — 替代 Google Maps 自带 InfoWindow,
 * 由我们控制位置和样式,避让 mobile bottom switcher / fab 等浮层按钮。
 *
 * 触发流程:
 *   user 点 Google POI icon
 *     → google adapter event.stop() 阻止默认 InfoWindow
 *     → adapter 调 onPoiClick(placeId)
 *     → TripMapCanvas setActivePoi({placeId, ...})
 *     → 渲染本组件
 *
 * 布局:
 *   - 桌面: fixed 右上 (top 100px right 24px),260px 宽,避开顶部 site-header
 *   - 移动: fixed bottom (避让 bottom switcher + safe area + 16px gap),
 *           full width minus 24px,圆角 20px
 *   位置由 CSS 控制,组件内不做 layout 计算。
 */
export function ExternalPoiCard({ placeId, onClose }: ExternalPoiCardProps) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<PoiDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetails(null);
    setError(null);

    (async () => {
      try {
        const { Place } = (await importLibrary('places')) as any;
        const place = new Place({ id: placeId });
        await place.fetchFields({
          fields: [
            'displayName',
            'formattedAddress',
            'rating',
            'userRatingCount',
            'photos',
            'websiteURI',
            'googleMapsURI',
          ],
        });
        if (cancelled) return;

        const photoUrl = place.photos?.[0]?.getURI({ maxWidth: 480, maxHeight: 320 }) ?? null;
        setDetails({
          name: place.displayName ?? '未命名地点',
          address: place.formattedAddress ?? '',
          rating: typeof place.rating === 'number' ? place.rating : null,
          userRatingCount:
            typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
          photoUrl,
          websiteUri: place.websiteURI ?? null,
          googleMapsUri: place.googleMapsURI ?? null,
        });
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.warn('[ExternalPoiCard] fetch place failed:', err);
        setError((err as Error).message || '无法加载地点详情');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [placeId]);

  return (
    <div className="external-poi-card" role="dialog" aria-label="地点详情">
      <button
        type="button"
        className="external-poi-close"
        onClick={onClose}
        aria-label="关闭详情"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {loading ? (
        <div className="external-poi-body external-poi-loading">
          <div className="external-poi-skeleton-line" style={{ width: '60%' }} />
          <div className="external-poi-skeleton-line" style={{ width: '90%' }} />
          <div className="external-poi-skeleton-line" style={{ width: '40%' }} />
        </div>
      ) : error ? (
        <div className="external-poi-body external-poi-error">
          <p className="external-poi-error-msg">{error}</p>
        </div>
      ) : details ? (
        <>
          {details.photoUrl ? (
            <div
              className="external-poi-photo"
              style={{ backgroundImage: `url("${details.photoUrl}")` }}
              aria-hidden="true"
            />
          ) : null}
          <div className="external-poi-body">
            <div className="external-poi-name">{details.name}</div>
            {details.rating != null ? (
              <div className="external-poi-rating">
                <span className="external-poi-star" aria-hidden="true">★</span>
                <span className="external-poi-rating-value">{details.rating.toFixed(1)}</span>
                {details.userRatingCount != null ? (
                  <span className="external-poi-rating-count">({details.userRatingCount})</span>
                ) : null}
              </div>
            ) : null}
            {details.address ? (
              <div className="external-poi-address">{details.address}</div>
            ) : null}
            {(details.googleMapsUri || details.websiteUri) ? (
              <div className="external-poi-actions">
                {details.googleMapsUri ? (
                  <a
                    className="external-poi-action"
                    href={details.googleMapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    在 Google 地图打开
                  </a>
                ) : null}
                {details.websiteUri ? (
                  <a
                    className="external-poi-action external-poi-action-secondary"
                    href={details.websiteUri}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    官方网站
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
