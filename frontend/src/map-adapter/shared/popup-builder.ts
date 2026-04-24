import type { SpotItem } from '../../types/trip';

export interface PopupBuilderOptions {
  dayColors: string[];
  fallbackColor?: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatTimeSlot(raw?: string): string {
  if (!raw) return '时段未排';
  return raw;
}

function buildNavigationUrl(spot: SpotItem): string | null {
  if (
    !spot.prevStopName ||
    !Number.isFinite(spot.prevStopLat) ||
    !Number.isFinite(spot.prevStopLng)
  ) {
    return null;
  }

  const params = new URLSearchParams({
    api: '1',
    origin: `${spot.prevStopLat},${spot.prevStopLng}`,
    destination: `${spot.lat},${spot.lng}`,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function getPopupMarkup(spot: SpotItem, options: PopupBuilderOptions): string {
  const { dayColors, fallbackColor = '#888' } = options;
  const color = dayColors[spot.day - 1] ?? fallbackColor;
  const subLabel = spot.nameEn
    ? `<div class="popup-name-en">${escapeHtml(spot.nameEn)}</div>`
    : '';
  const mustBadge = spot.mustVisit ? '<span class="popup-must">必去</span>' : '';
  const stayLine =
    typeof spot.stayMinutes === 'number' && spot.stayMinutes > 0
      ? `<span>${spot.stayMinutes} 分钟</span>`
      : '';
  const desc = spot.description
    ? `<div class="popup-desc">${escapeHtml(spot.description)}</div>`
    : '';
  const whyGo = spot.whyGo
    ? `<div class="popup-why">推荐理由:${escapeHtml(spot.whyGo)}</div>`
    : '';
  const transport = spot.transportNote
    ? `<div class="popup-transport">${escapeHtml(spot.transportNote)}</div>`
    : '';
  const navUrl = buildNavigationUrl(spot);
  const navLabel = spot.prevStopName
    ? `从 ${escapeHtml(spot.prevStopName)} 到这里`
    : '';
  const navLine = navLabel || navUrl
    ? `<div class="popup-nav-row"><span>${navLabel}</span>${navUrl ? `<a class="popup-nav-btn" href="${escapeHtml(navUrl)}" target="_blank" rel="noopener noreferrer">导航</a>` : ''}</div>`
    : '';

  const photo =
    Array.isArray(spot.photos) && spot.photos.length > 0
      ? `<div class="popup-photo"><img src="${escapeHtml(spot.photos[0])}" alt="" /></div>`
      : '';

  return `
    <div class="popup-shell">
      ${photo}
      <div class="popup-day" style="color:${color}">第 ${spot.day} 天 · ${escapeHtml(formatTimeSlot(spot.timeSlot))}</div>
      <div class="popup-name">${escapeHtml(spot.name)}${mustBadge}</div>
      ${subLabel}
      <div class="popup-meta">
        <span>${escapeHtml(spot.area || spot.city || '')}</span>
        ${stayLine}
      </div>
      ${desc}
      ${whyGo}
      ${transport}
      ${navLine}
    </div>
  `.trim();
}

export function buildSpotPopupElement(spot: SpotItem, options: PopupBuilderOptions): HTMLDivElement {
  const shell = document.createElement('div');
  shell.innerHTML = getPopupMarkup(spot, options);
  return (shell.firstElementChild as HTMLDivElement | null) ?? shell;
}

export function buildSpotPopupHtml(spot: SpotItem, options: PopupBuilderOptions): string {
  return getPopupMarkup(spot, options);
}

/**
 * 简单 tooltip,用于鼠标悬停在 polyline 上。
 */
export function buildRouteTooltipHtml(segment: {
  label?: string;
  duration?: string;
  transportType: string;
}): string {
  const parts: string[] = [];
  if (segment.label) parts.push(escapeHtml(segment.label));
  if (segment.duration) parts.push(escapeHtml(segment.duration));
  if (!parts.length) parts.push(escapeHtml(segment.transportType));
  return parts.join(' · ');
}
