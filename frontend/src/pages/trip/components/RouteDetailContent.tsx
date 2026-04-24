import type { RouteSegment } from '../../../types/trip';
import {
  buildRouteHeadline,
  buildRouteMetaLine,
  formatRouteSource,
  formatTransportType,
  getRouteActualMeta,
  getTransitLegMeta,
  getTransitSummaryBadges,
  formatTransitLegTitle,
} from '../../../utils/route-detail';

interface RouteDetailContentProps {
  segment: RouteSegment;
}

export function RouteDetailContent({ segment }: RouteDetailContentProps) {
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

  return (
    <div className="route-detail-content">
      {metaLine.length ? (
        <p className="route-detail-eyebrow">{metaLine.join(' · ')}</p>
      ) : null}
      <h3 className="route-detail-title">{headline}</h3>

      {segment.note ? (
        <p className="route-detail-note">{segment.note}</p>
      ) : null}

      {sourceLabel || transitSummaryBadges.length > 0 || moveTypes ? (
        <div className="route-detail-chip-row">
          {sourceLabel ? (
            <span className="route-detail-chip route-detail-chip-source">{sourceLabel}</span>
          ) : null}
          {transitSummaryBadges.map((badge) => (
            <span key={badge} className="route-detail-chip">
              {badge}
            </span>
          ))}
          {moveTypes ? (
            <span className="route-detail-chip route-detail-chip-muted">{moveTypes}</span>
          ) : null}
        </div>
      ) : null}

      {actualMeta.length ? (
        <div className="route-detail-section">
          <h4>贴路参考</h4>
          <p>{actualMeta.join(' · ')}</p>
        </div>
      ) : null}

      {transitLegs.length ? (
        <div className="route-detail-section">
          <h4>线路说明</h4>
          <ol className="route-leg-list">
            {transitLegs.map((leg, index) => (
              <li key={`${leg.lineName || leg.mode || 'leg'}-${index}`} className="route-leg-item">
                <strong>{formatTransitLegTitle(leg)}</strong>
                <span>{getTransitLegMeta(leg).join(' · ')}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="route-detail-section route-detail-section-warning">
          <h4>提醒</h4>
          <ul className="route-warning-list">
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
