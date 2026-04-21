/**
 * 把服务端返回的时间戳(可能是 ISO 字符串,也可能是 "2026-04-19 14:06:33" 这种)
 * 解析成 epoch ms,失败返回 0。与 dashboard.js 行为一致。
 */
export function parseTimestamp(value) {
    if (!value)
        return 0;
    const raw = String(value);
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
    const time = new Date(normalized).getTime();
    return Number.isNaN(time) ? 0 : time;
}
/**
 * "刚刚更新" / "N 分钟前" / "N 小时前" / "N 天前" / "更新于 M/D"。
 * 不依赖 Intl.RelativeTimeFormat,对旧浏览器友好。
 */
export function formatUpdatedAt(trip) {
    const time = parseTimestamp(trip.updatedAt);
    if (!time)
        return '';
    const date = new Date(time);
    const now = Date.now();
    const diff = now - time;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute)
        return '刚刚更新';
    if (diff < hour)
        return `${Math.floor(diff / minute)} 分钟前`;
    if (diff < day)
        return `${Math.floor(diff / hour)} 小时前`;
    if (diff < 7 * day)
        return `${Math.floor(diff / day)} 天前`;
    return `更新于 ${date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}`;
}
/**
 * 行程天数 chip:优先用 meta.startDate / endDate,
 * 退到 summary.startDay / endDay 的景点跨天跨度,最后兜底"未安排日程"。
 */
export function formatDurationChip(trip) {
    const meta = trip.meta || {};
    const summary = trip.summary;
    if (meta.startDate && meta.endDate) {
        const start = new Date(meta.startDate).getTime();
        const end = new Date(meta.endDate).getTime();
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
            const days = Math.max(1, Math.round((end - start) / (24 * 3600 * 1000)) + 1);
            return `${days} 天`;
        }
    }
    if (summary?.startDay && summary?.endDay) {
        const span = summary.endDay - summary.startDay + 1;
        return span === 1 ? `第 ${summary.startDay} 天` : `${span} 天行程`;
    }
    return '未安排日程';
}
export function formatDestination(trip) {
    const dest = (trip.meta || {}).destination;
    return dest ? dest.trim() : '';
}
/**
 * 客户端过滤 + 排序,与 dashboard.js 的 filterAndSort 一致。
 * current 行程在按时间排序时固定置顶,按名称/景点排序时保留自然序。
 */
export function filterAndSort(trips, query, sortBy) {
    const normalizedQuery = query.trim().toLowerCase();
    let list = trips;
    if (normalizedQuery) {
        list = list.filter((trip) => {
            const haystack = [trip.name, trip.meta?.destination, trip.meta?.description, trip.slug]
                .filter(Boolean)
                .map((v) => String(v).toLowerCase())
                .join(' \u0001 ');
            return haystack.includes(normalizedQuery);
        });
    }
    const sorted = [...list];
    switch (sortBy) {
        case 'name':
            sorted.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN'));
            break;
        case 'spots':
            sorted.sort((a, b) => (b.summary?.spotCount || 0) - (a.summary?.spotCount || 0));
            break;
        case 'created':
            sorted.sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));
            break;
        case 'updated':
        default:
            sorted.sort((a, b) => parseTimestamp(b.updatedAt) - parseTimestamp(a.updatedAt));
            break;
    }
    if (sortBy === 'updated' || sortBy === 'created') {
        const currentIdx = sorted.findIndex((t) => t.id === 'current');
        if (currentIdx > 0) {
            const [current] = sorted.splice(currentIdx, 1);
            sorted.unshift(current);
        }
    }
    return sorted;
}
