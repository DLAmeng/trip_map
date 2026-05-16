export function createGoogleRouteLayer({ onRouteClick, dayColors = [] } = {}) {
    let map = null;
    let routeRefs = [];
    let currentFilter = { day: null, city: null };
    // 缓冲逻辑
    let pendingSegments = null;
    let pendingSpotById = null;
    // P30: 之前按 transportType 着色(步行蓝 / 地铁橙 / 新干线红),
    // 用户反馈「同一天路线颜色应该一致 + 跟景点颜色对应」,改为完全按 day 着色。
    // 14 个内置 fallback 颜色覆盖最长行程,不够时用 hash hue 兜底。
    const DAY_COLOR_FALLBACK = [
        '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
        '#3498db', '#9b59b6', '#8e44ad', '#c0392b', '#d35400',
        '#27ae60', '#2980b9', '#16a085', '#7f8c8d',
    ];
    function getDayColor(day) {
        const idx = Math.max(0, (day || 1) - 1);
        return dayColors[idx] || DAY_COLOR_FALLBACK[idx % DAY_COLOR_FALLBACK.length];
    }
    function destroy() {
        routeRefs.forEach((ref) => {
            ref.bodyLine.setMap(null);
            ref.casingLine.setMap(null);
        });
        routeRefs = [];
    }
    function applyVisibility() {
        routeRefs.forEach((ref) => {
            const dayMatches = !currentFilter.visibleDays ||
                currentFilter.visibleDays.size === 0 ||
                currentFilter.visibleDays.has(ref.day);
            const cityMatches = currentFilter.city === null ||
                !currentFilter.visibleCities ||
                currentFilter.visibleCities.size === 0 ||
                [...ref.cities].some((city) => currentFilter.visibleCities?.has(city));
            const isVisible = dayMatches && cityMatches;
            // 两层都做 show/hide,避免过滤时只剩描边或只剩本体
            ref.bodyLine.setMap(isVisible ? map : null);
            ref.casingLine.setMap(isVisible ? map : null);
        });
    }
    const layer = {
        init(m) {
            map = m;
            if (pendingSegments && pendingSpotById) {
                layer.render(pendingSegments, pendingSpotById);
            }
            applyVisibility();
        },
        render(segments, spotById) {
            pendingSegments = segments;
            pendingSpotById = spotById;
            destroy();
            if (!map)
                return;
            routeRefs = segments.map((seg) => {
                const fromSpot = spotById.get(seg.fromSpotId);
                const toSpot = spotById.get(seg.toSpotId);
                let path = [];
                if (seg.path && seg.path.length > 0) {
                    path = seg.path.map(([lat, lng]) => ({ lat, lng }));
                }
                else if (fromSpot && toSpot) {
                    path = [
                        { lat: fromSpot.lat, lng: fromSpot.lng },
                        { lat: toSpot.lat, lng: toSpot.lng },
                    ];
                }
                // P30: 路线颜色 = 该 day 的颜色(与 marker / SpotList 同步),不再按 transportType
                const bodyColor = getDayColor(seg.day);
                // 先建 casing(底层描边),zIndex 更低,clickable:false 不拦截事件
                const casingLine = new google.maps.Polyline({
                    path,
                    geodesic: true,
                    strokeColor: '#1a1a1a',
                    strokeOpacity: 0.45,
                    strokeWeight: 8,
                    clickable: false,
                    zIndex: 1,
                    map: map,
                });
                const bodyLine = new google.maps.Polyline({
                    path,
                    geodesic: true,
                    strokeColor: bodyColor,
                    strokeOpacity: 0.85,
                    strokeWeight: 4,
                    clickable: true,
                    zIndex: 2,
                    map: map,
                });
                bodyLine.addListener('click', (event) => {
                    const domEvent = event.domEvent;
                    domEvent?.stopPropagation?.();
                    domEvent?.preventDefault?.();
                    onRouteClick?.(seg.id, {
                        clientX: domEvent?.clientX ?? 0,
                        clientY: domEvent?.clientY ?? 0,
                        lat: event.latLng?.lat(),
                        lng: event.latLng?.lng(),
                    });
                });
                // Google Maps Tooltip (Simple Title)
                // const tooltip = buildRouteTooltipHtml(seg);
                // Note: Google Polylines don't have built-in easy tooltips like Leaflet,
                // we could use InfoWindow on click, but keeping it simple for now.
                const cities = new Set();
                if (fromSpot?.city)
                    cities.add(fromSpot.city);
                if (toSpot?.city)
                    cities.add(toSpot.city);
                return {
                    bodyLine,
                    casingLine,
                    segmentId: seg.id,
                    day: seg.day,
                    cities,
                };
            });
            applyVisibility();
        },
        setActiveFilter(filter) {
            currentFilter = filter;
            applyVisibility();
        },
        destroy() {
            destroy();
        },
    };
    return layer;
}
