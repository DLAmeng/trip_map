export function createGoogleRouteLayer() {
    let map = null;
    let routeRefs = [];
    let currentFilter = { day: null };
    let animationFrameId = null;
    let iconOffset = 0;
    // 缓冲逻辑
    let pendingSegments = null;
    let pendingSpotById = null;
    const TRANSPORT_COLORS = {
        walk: '#38bdf8',
        metro: '#f97316',
        subway: '#f97316',
        bus: '#10b981',
        shinkansen: '#dc2626',
        train: '#7c3aed',
        drive: '#475569',
    };
    function destroy() {
        routeRefs.forEach((ref) => {
            ref.polyline.setMap(null);
        });
        routeRefs = [];
    }
    function applyVisibility() {
        routeRefs.forEach((ref) => {
            const isVisible = currentFilter.day === null || ref.day === currentFilter.day;
            ref.polyline.setMap(isVisible ? map : null);
        });
    }
    function startAnimation() {
        if (animationFrameId)
            return;
        const animate = () => {
            iconOffset = (iconOffset + 1) % 100;
            routeRefs.forEach((ref) => {
                const icons = ref.polyline.get('icons');
                if (icons && icons.length > 0) {
                    icons[0].offset = iconOffset + '%';
                    ref.polyline.set('icons', icons);
                }
            });
            animationFrameId = requestAnimationFrame(animate);
        };
        animationFrameId = requestAnimationFrame(animate);
    }
    function stopAnimation() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
    const layer = {
        init(m) {
            map = m;
            if (pendingSegments && pendingSpotById) {
                layer.render(pendingSegments, pendingSpotById);
            }
            applyVisibility();
            startAnimation();
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
                const transportType = seg.transportType?.toLowerCase() || '';
                const isAnimated = transportType === 'walk' || transportType === 'bus';
                const polyline = new google.maps.Polyline({
                    path,
                    geodesic: true,
                    strokeColor: TRANSPORT_COLORS[seg.transportType] || '#888',
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                    map: map,
                    icons: isAnimated
                        ? [
                            {
                                icon: {
                                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                                    scale: 2,
                                    strokeColor: TRANSPORT_COLORS[seg.transportType],
                                    fillOpacity: 1,
                                    fillColor: TRANSPORT_COLORS[seg.transportType],
                                },
                                offset: '0',
                                repeat: '50px',
                            },
                        ]
                        : undefined,
                });
                // Google Maps Tooltip (Simple Title)
                // const tooltip = buildRouteTooltipHtml(seg);
                // Note: Google Polylines don't have built-in easy tooltips like Leaflet,
                // we could use InfoWindow on click, but keeping it simple for now.
                return {
                    polyline,
                    segmentId: seg.id,
                    day: seg.day,
                };
            });
            applyVisibility();
        },
        setActiveFilter(filter) {
            currentFilter = filter;
            applyVisibility();
        },
        destroy() {
            stopAnimation();
            destroy();
        },
    };
    return layer;
}
