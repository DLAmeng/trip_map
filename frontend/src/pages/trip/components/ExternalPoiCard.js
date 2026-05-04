import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { importLibrary } from '../../../map-adapter/google/loader';
/**
 * 自渲染的 Google POI 详情卡 — 替代 Google Maps 自带 InfoWindow,
 * 由我们控制位置和样式,避让 mobile bottom switcher / fab 等浮层按钮。
 *
 * 两阶段交互:
 *   1. mode='detail'(默认):显示照片 / 名称 / 评分 / 地址 + Google 地图/官网/+加入行程
 *   2. 点 "+ 加入行程" → mode='select':替换内容为
 *      - Day chips 横向滚动(D1 D2 ...)
 *      - 该 day 的现有 spots 列表(加到开头 / 在 X 之前 / 加到末尾)
 *      - [取消] [确认]
 *      用户选好后调 onAddToTrip(data + day + insertIndex)
 */
export function ExternalPoiCard({ placeId, onClose, onAddToTrip, dayNumbers = [], spotsByDay, defaultDay, }) {
    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState(null);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('detail');
    const [selectedDay, setSelectedDay] = useState(defaultDay ?? dayNumbers[0] ?? 1);
    /** 插入位置:undefined 表示末尾,数字表示插到该 index 之前(0-based) */
    const [selectedInsertIndex, setSelectedInsertIndex] = useState(undefined);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setDetails(null);
        setError(null);
        setMode('detail');
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
    // 切换 day 时重置 insertIndex(避免索引越界)
    useEffect(() => {
        setSelectedInsertIndex(undefined);
    }, [selectedDay]);
    const currentDaySpots = spotsByDay?.get(selectedDay) ?? [];
    const handleEnterSelect = () => {
        setMode('select');
    };
    const handleConfirmAdd = () => {
        if (!details || !onAddToTrip)
            return;
        onAddToTrip({
            placeId,
            name: details.name,
            address: details.address,
            day: selectedDay,
            insertIndex: selectedInsertIndex,
        });
    };
    return (_jsxs("div", { className: "external-poi-card", role: "dialog", "aria-label": "\u5730\u70B9\u8BE6\u60C5", children: [_jsx("button", { type: "button", className: "external-poi-close", onClick: onClose, "aria-label": "\u5173\u95ED\u8BE6\u60C5", children: _jsx("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }) }) }), loading ? (_jsxs("div", { className: "external-poi-body external-poi-loading", children: [_jsx("div", { className: "external-poi-skeleton-line", style: { width: '60%' } }), _jsx("div", { className: "external-poi-skeleton-line", style: { width: '90%' } }), _jsx("div", { className: "external-poi-skeleton-line", style: { width: '40%' } })] })) : error ? (_jsx("div", { className: "external-poi-body external-poi-error", children: _jsx("p", { className: "external-poi-error-msg", children: error }) })) : details ? (_jsxs(_Fragment, { children: [details.photoUrl && mode === 'detail' ? (_jsx("div", { className: "external-poi-photo", style: { backgroundImage: `url("${details.photoUrl}")` }, "aria-hidden": "true" })) : null, _jsx("div", { className: "external-poi-body", children: mode === 'detail' ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "external-poi-name", children: details.name }), details.rating != null ? (_jsxs("div", { className: "external-poi-rating", children: [_jsx("span", { className: "external-poi-star", "aria-hidden": "true", children: "\u2605" }), _jsx("span", { className: "external-poi-rating-value", children: details.rating.toFixed(1) }), details.userRatingCount != null ? (_jsxs("span", { className: "external-poi-rating-count", children: ["(", details.userRatingCount, ")"] })) : null] })) : null, details.address ? (_jsx("div", { className: "external-poi-address", children: details.address })) : null, onAddToTrip ? (_jsx("div", { className: "external-poi-actions", children: _jsx("button", { type: "button", className: "external-poi-action external-poi-action-primary", onClick: handleEnterSelect, children: "\uFF0B \u52A0\u5165\u884C\u7A0B" }) })) : null, (details.googleMapsUri || details.websiteUri) ? (_jsxs("div", { className: "external-poi-actions", children: [details.googleMapsUri ? (_jsx("a", { className: "external-poi-action external-poi-action-secondary", href: details.googleMapsUri, target: "_blank", rel: "noopener noreferrer", children: "Google \u5730\u56FE" })) : null, details.websiteUri ? (_jsx("a", { className: "external-poi-action external-poi-action-secondary", href: details.websiteUri, target: "_blank", rel: "noopener noreferrer", children: "\u5B98\u65B9\u7F51\u7AD9" })) : null] })) : null] })) : (
                        // mode === 'select':选 day + position
                        _jsxs(_Fragment, { children: [_jsx("div", { className: "external-poi-select-title", children: "\u52A0\u5165\u5230\u884C\u7A0B" }), _jsxs("div", { className: "external-poi-select-eyebrow", children: ["\u6B63\u5728\u6DFB\u52A0 ", _jsx("strong", { children: details.name })] }), _jsxs("div", { className: "external-poi-select-section", children: [_jsx("div", { className: "external-poi-select-label", children: "\u9009\u62E9\u5929\u6570" }), _jsx("div", { className: "external-poi-day-chips", children: dayNumbers.length > 0 ? (dayNumbers.map((day) => (_jsxs("button", { type: "button", className: `external-poi-day-chip${day === selectedDay ? ' is-active' : ''}`, onClick: () => setSelectedDay(day), children: ["D", day] }, day)))) : (_jsx("span", { className: "external-poi-day-empty", children: "\u6682\u65E0\u5929\u6570" })) })] }), _jsxs("div", { className: "external-poi-select-section", children: [_jsx("div", { className: "external-poi-select-label", children: "\u9009\u62E9\u4F4D\u7F6E" }), _jsxs("div", { className: "external-poi-position-list", children: [_jsxs("label", { className: "external-poi-position-row", children: [_jsx("input", { type: "radio", name: "poi-position", checked: selectedInsertIndex === 0, onChange: () => setSelectedInsertIndex(0) }), _jsx("span", { children: "\u52A0\u5230\u5F00\u5934" })] }), currentDaySpots.map((spot, idx) => (_jsxs("label", { className: "external-poi-position-row", children: [_jsx("input", { type: "radio", name: "poi-position", checked: selectedInsertIndex === idx + 1, onChange: () => setSelectedInsertIndex(idx + 1) }), _jsxs("span", { children: ["\u5728 ", _jsx("strong", { children: spot.name }), " \u4E4B\u540E"] })] }, spot.id))), _jsxs("label", { className: "external-poi-position-row", children: [_jsx("input", { type: "radio", name: "poi-position", checked: selectedInsertIndex === undefined, onChange: () => setSelectedInsertIndex(undefined) }), _jsx("span", { children: "\u52A0\u5230\u672B\u5C3E(\u9ED8\u8BA4)" })] })] })] }), _jsxs("div", { className: "external-poi-actions external-poi-select-actions", children: [_jsx("button", { type: "button", className: "external-poi-action external-poi-action-secondary", onClick: () => setMode('detail'), children: "\u53D6\u6D88" }), _jsx("button", { type: "button", className: "external-poi-action external-poi-action-primary", onClick: handleConfirmAdd, disabled: dayNumbers.length === 0, children: "\u786E\u8BA4\u52A0\u5165" })] })] })) })] })) : null] }));
}
