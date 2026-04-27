function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
function formatTimeSlot(raw) {
    if (!raw)
        return '时段未排';
    return raw;
}
function buildDestinationNavigationUrl(target) {
    if (!Number.isFinite(target.lat) || !Number.isFinite(target.lng)) {
        return null;
    }
    const params = new URLSearchParams({
        api: '1',
        destination: `${target.lat},${target.lng}`,
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
}
function getPopupMarkup(spot, options) {
    const { dayColors, fallbackColor = '#888' } = options;
    const color = dayColors[spot.day - 1] ?? fallbackColor;
    const subLabel = spot.nameEn
        ? `<div class="popup-name-en">${escapeHtml(spot.nameEn)}</div>`
        : '';
    const mustBadge = spot.mustVisit ? '<span class="popup-must">必去</span>' : '';
    const stayLine = typeof spot.stayMinutes === 'number' && spot.stayMinutes > 0
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
    const navUrl = buildDestinationNavigationUrl(spot);
    const navLine = navUrl
        ? `<div class="popup-nav-row">
        <a class="popup-nav-btn popup-current-btn" href="${escapeHtml(navUrl)}" target="_blank" rel="noopener noreferrer">导航</a>
        ${spot.nextStopId
            ? `<button class="popup-nav-btn popup-next-btn" type="button" data-next-spot-id="${escapeHtml(spot.nextStopId)}" aria-label="切换到下一站 ${escapeHtml(spot.nextStopName || '')}">下一站</button>`
            : '<button class="popup-nav-btn popup-next-btn is-disabled" type="button" disabled>无下一站</button>'}
      </div>`
        : '';
    const photo = Array.isArray(spot.photos) && spot.photos.length > 0
        ? `<div class="popup-photo"><img src="${escapeHtml(spot.photos[0])}" alt="" /></div>`
        : '';
    return `
    <div class="popup-shell" style="--day-color:${color}">
      <div class="popup-day-band" aria-hidden="true"></div>
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
export function buildSpotPopupElement(spot, options) {
    const shell = document.createElement('div');
    shell.innerHTML = getPopupMarkup(spot, options);
    const element = shell.firstElementChild ?? shell;
    const nextButton = element.querySelector('.popup-next-btn[data-next-spot-id]');
    if (nextButton && options.onNextSpotClick) {
        nextButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const nextSpotId = nextButton.dataset.nextSpotId;
            if (nextSpotId) {
                options.onNextSpotClick?.(nextSpotId);
            }
        });
    }
    return element;
}
export function buildSpotPopupHtml(spot, options) {
    return getPopupMarkup(spot, options);
}
/**
 * 简单 tooltip,用于鼠标悬停在 polyline 上。
 */
export function buildRouteTooltipHtml(segment) {
    const parts = [];
    if (segment.label)
        parts.push(escapeHtml(segment.label));
    if (segment.duration)
        parts.push(escapeHtml(segment.duration));
    if (!parts.length)
        parts.push(escapeHtml(segment.transportType));
    return parts.join(' · ');
}
