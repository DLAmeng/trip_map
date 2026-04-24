import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { buildRouteHeadline, buildRouteMetaLine, formatRouteSource, formatTransportType, getRouteActualMeta, getTransitLegMeta, getTransitSummaryBadges, formatTransitLegTitle, } from '../../../utils/route-detail';
export function RouteDetailContent({ segment }) {
    const headline = buildRouteHeadline(segment);
    const metaLine = buildRouteMetaLine(segment);
    const sourceLabel = formatRouteSource(segment.runtimeSource);
    const actualMeta = getRouteActualMeta(segment);
    const transitSummaryBadges = getTransitSummaryBadges(segment.runtimeTransitSummary);
    const moveTypes = segment.runtimeTransitSummary?.moveTypes?.length
        ? segment.runtimeTransitSummary.moveTypes
            .map((moveType) => formatTransportType(moveType))
            .filter(Boolean)
            .join(' / ')
        : null;
    const transitLegs = Array.isArray(segment.runtimeTransitLegs)
        ? segment.runtimeTransitLegs.filter(Boolean)
        : [];
    const warnings = Array.isArray(segment.realWarnings)
        ? segment.realWarnings.filter(Boolean)
        : [];
    return (_jsxs("div", { className: "route-detail-content", children: [metaLine.length ? (_jsx("p", { className: "route-detail-eyebrow", children: metaLine.join(' · ') })) : null, _jsx("h3", { className: "route-detail-title", children: headline }), segment.note ? (_jsx("p", { className: "route-detail-note", children: segment.note })) : null, sourceLabel || transitSummaryBadges.length > 0 || moveTypes ? (_jsxs("div", { className: "route-detail-chip-row", children: [sourceLabel ? (_jsx("span", { className: "route-detail-chip route-detail-chip-source", children: sourceLabel })) : null, transitSummaryBadges.map((badge) => (_jsx("span", { className: "route-detail-chip", children: badge }, badge))), moveTypes ? (_jsx("span", { className: "route-detail-chip route-detail-chip-muted", children: moveTypes })) : null] })) : null, actualMeta.length ? (_jsxs("div", { className: "route-detail-section", children: [_jsx("h4", { children: "\u8D34\u8DEF\u53C2\u8003" }), _jsx("p", { children: actualMeta.join(' · ') })] })) : null, transitLegs.length ? (_jsxs("div", { className: "route-detail-section", children: [_jsx("h4", { children: "\u7EBF\u8DEF\u8BF4\u660E" }), _jsx("ol", { className: "route-leg-list", children: transitLegs.map((leg, index) => (_jsxs("li", { className: "route-leg-item", children: [_jsx("strong", { children: formatTransitLegTitle(leg) }), _jsx("span", { children: getTransitLegMeta(leg).join(' · ') })] }, `${leg.lineName || leg.mode || 'leg'}-${index}`))) })] })) : null, warnings.length ? (_jsxs("div", { className: "route-detail-section route-detail-section-warning", children: [_jsx("h4", { children: "\u63D0\u9192" }), _jsx("ul", { className: "route-warning-list", children: warnings.map((warning, index) => (_jsx("li", { children: warning }, `${warning}-${index}`))) })] })) : null] }));
}
