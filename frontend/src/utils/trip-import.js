/**
 * 批量导入景点的解析工具。
 * - GPX:解析 <wpt> 节点
 * - KML / KMZ(文本):解析 <Placemark> 下 Point 坐标
 * - Google Maps 链接:从 URL 参数里提取 @lat,lng / ll= / q= 模式的坐标
 *
 * 所有函数都返回 `ParsedImportPoint[]`,不抛异常,无法解析的直接跳过。
 */
function safeDomParse(text) {
    try {
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        // DOMParser 出错会返回一个带 <parsererror> 的 doc
        if (doc.querySelector('parsererror'))
            return null;
        return doc;
    }
    catch {
        return null;
    }
}
export function parseGpx(text) {
    const doc = safeDomParse(text);
    if (!doc)
        return [];
    const result = [];
    for (const wpt of Array.from(doc.querySelectorAll('wpt'))) {
        const lat = parseFloat(wpt.getAttribute('lat') ?? '');
        const lng = parseFloat(wpt.getAttribute('lon') ?? '');
        if (!Number.isFinite(lat) || !Number.isFinite(lng))
            continue;
        result.push({
            name: wpt.querySelector('name')?.textContent?.trim() || '未命名',
            description: wpt.querySelector('desc')?.textContent?.trim() || '',
            lat,
            lng,
            source: 'gpx',
        });
    }
    return result;
}
export function parseKml(text) {
    const doc = safeDomParse(text);
    if (!doc)
        return [];
    const result = [];
    for (const pm of Array.from(doc.querySelectorAll('Placemark'))) {
        const coordsText = pm.querySelector('Point > coordinates')?.textContent?.trim() || '';
        if (!coordsText)
            continue;
        const [lngStr, latStr] = coordsText.split(',');
        const lat = parseFloat(latStr ?? '');
        const lng = parseFloat(lngStr ?? '');
        if (!Number.isFinite(lat) || !Number.isFinite(lng))
            continue;
        result.push({
            name: pm.querySelector('name')?.textContent?.trim() || '未命名',
            description: pm.querySelector('description')?.textContent?.trim() || '',
            lat,
            lng,
            source: 'kml',
        });
    }
    return result;
}
export function parseGoogleMapsUrl(url) {
    const trimmed = url.trim();
    if (!trimmed)
        return null;
    const patterns = [
        /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
        /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
        /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    ];
    for (const pattern of patterns) {
        const m = trimmed.match(pattern);
        if (m) {
            const lat = parseFloat(m[1]);
            const lng = parseFloat(m[2]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng))
                continue;
            const name = extractPlaceNameFromGoogleUrl(trimmed) || '地点';
            return { name, description: '', lat, lng, source: 'google-url' };
        }
    }
    const nameOnly = extractPlaceNameFromGoogleUrl(trimmed);
    if (nameOnly) {
        return { name: nameOnly, description: '需手动填写坐标', lat: 0, lng: 0, source: 'google-url' };
    }
    return null;
}
function extractPlaceNameFromGoogleUrl(url) {
    const match = url.match(/\/place\/([^/@?]+)/);
    if (!match)
        return '';
    try {
        return decodeURIComponent(match[1].replace(/\+/g, ' '));
    }
    catch {
        return '';
    }
}
export async function parseImportFile(file) {
    const text = await file.text();
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.gpx'))
        return parseGpx(text);
    if (lower.endsWith('.kml') || lower.endsWith('.kmz'))
        return parseKml(text);
    return [];
}
export function parseImportUrls(urlsText) {
    return urlsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map(parseGoogleMapsUrl)
        .filter((p) => p !== null);
}
