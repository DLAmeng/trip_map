import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { importLibrary } from '../../../map-adapter/google/loader';
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
export function ExternalPoiCard({ placeId, onClose }) {
    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setDetails(null);
        setError(null);
        (async () => {
            try {
                const { Place } = (await importLibrary('places'));
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
                if (cancelled)
                    return;
                const photoUrl = place.photos?.[0]?.getURI({ maxWidth: 480, maxHeight: 320 }) ?? null;
                setDetails({
                    name: place.displayName ?? '未命名地点',
                    address: place.formattedAddress ?? '',
                    rating: typeof place.rating === 'number' ? place.rating : null,
                    userRatingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
                    photoUrl,
                    websiteUri: place.websiteURI ?? null,
                    googleMapsUri: place.googleMapsURI ?? null,
                });
                setLoading(false);
            }
            catch (err) {
                if (cancelled)
                    return;
                console.warn('[ExternalPoiCard] fetch place failed:', err);
                setError(err.message || '无法加载地点详情');
                setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [placeId]);
    return (_jsxs("div", { className: "external-poi-card", role: "dialog", "aria-label": "\u5730\u70B9\u8BE6\u60C5", children: [_jsx("button", { type: "button", className: "external-poi-close", onClick: onClose, "aria-label": "\u5173\u95ED\u8BE6\u60C5", children: _jsx("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }) }) }), loading ? (_jsxs("div", { className: "external-poi-body external-poi-loading", children: [_jsx("div", { className: "external-poi-skeleton-line", style: { width: '60%' } }), _jsx("div", { className: "external-poi-skeleton-line", style: { width: '90%' } }), _jsx("div", { className: "external-poi-skeleton-line", style: { width: '40%' } })] })) : error ? (_jsx("div", { className: "external-poi-body external-poi-error", children: _jsx("p", { className: "external-poi-error-msg", children: error }) })) : details ? (_jsxs(_Fragment, { children: [details.photoUrl ? (_jsx("div", { className: "external-poi-photo", style: { backgroundImage: `url("${details.photoUrl}")` }, "aria-hidden": "true" })) : null, _jsxs("div", { className: "external-poi-body", children: [_jsx("div", { className: "external-poi-name", children: details.name }), details.rating != null ? (_jsxs("div", { className: "external-poi-rating", children: [_jsx("span", { className: "external-poi-star", "aria-hidden": "true", children: "\u2605" }), _jsx("span", { className: "external-poi-rating-value", children: details.rating.toFixed(1) }), details.userRatingCount != null ? (_jsxs("span", { className: "external-poi-rating-count", children: ["(", details.userRatingCount, ")"] })) : null] })) : null, details.address ? (_jsx("div", { className: "external-poi-address", children: details.address })) : null, (details.googleMapsUri || details.websiteUri) ? (_jsxs("div", { className: "external-poi-actions", children: [details.googleMapsUri ? (_jsx("a", { className: "external-poi-action", href: details.googleMapsUri, target: "_blank", rel: "noopener noreferrer", children: "\u5728 Google \u5730\u56FE\u6253\u5F00" })) : null, details.websiteUri ? (_jsx("a", { className: "external-poi-action external-poi-action-secondary", href: details.websiteUri, target: "_blank", rel: "noopener noreferrer", children: "\u5B98\u65B9\u7F51\u7AD9" })) : null] })) : null] })] })) : null] }));
}
