export const DEFAULT_THRESHOLDS = {
    tightDayMinutes: 510,
    overloadDayMinutes: 630,
    cityTransitWarnMinutes: 45,
    intercityTransitWarnMinutes: 150,
    intercityTransitDangerMinutes: 210,
    longWalkWarnMinutes: 35,
};
function toFiniteNumber(value) {
    const nextValue = Number(value);
    return Number.isFinite(nextValue) ? nextValue : null;
}
export function sortNumbersAscending(list) {
    return [...list].sort((a, b) => a - b);
}
export function deriveDayNumbers(spots) {
    return sortNumbersAscending(Array.from(new Set(spots
        .map((s) => toFiniteNumber(s.day))
        .filter((v) => v !== null && v > 0))));
}
export function parseDurationToMinutes(value) {
    const raw = String(value || '').trim();
    if (!raw)
        return null;
    let totalMinutes = 0;
    let matched = false;
    const hourMatches = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*(?:小时|小時|hr|hrs|hour|hours|h)/gi)];
    hourMatches.forEach((match) => {
        totalMinutes += Number(match[1]) * 60;
        matched = true;
    });
    const minuteMatches = [
        ...raw.matchAll(/(\d+(?:\.\d+)?)\s*(?:分钟|分鐘|分|mins|min|minute|minutes|m)(?![a-z])/gi),
    ];
    minuteMatches.forEach((match) => {
        totalMinutes += Number(match[1]);
        matched = true;
    });
    if (matched)
        return Math.round(totalMinutes);
    const directMinutes = Number(raw.replace(/[^\d.]/g, ''));
    if (Number.isFinite(directMinutes) && directMinutes > 0) {
        return Math.round(directMinutes);
    }
    return null;
}
function getRouteMinutes(segment) {
    // 暂时不支持 realDurationSec, 只看 duration 文本
    const parsedMinutes = parseDurationToMinutes(segment.duration);
    if (Number.isFinite(parsedMinutes) && parsedMinutes > 0) {
        return { minutes: parsedMinutes, source: 'planned' };
    }
    return { minutes: null, source: 'missing' };
}
function getStatusMeta(status) {
    const map = {
        ok: { label: '正常', severity: 0 },
        tight: { label: '紧凑', severity: 1 },
        overload: { label: '过载', severity: 2 },
        incomplete: { label: '数据不足', severity: 3 },
    };
    return map[status] || map.ok;
}
export function analyzeTripFeasibility(trip, options = {}) {
    const thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    const spots = trip.spots.filter((s) => s.type !== 'transport');
    const dayNumbers = deriveDayNumbers(trip.spots);
    const spotsByDay = new Map();
    const routesByDay = new Map();
    dayNumbers.forEach((d) => {
        spotsByDay.set(d, spots.filter((s) => s.day === d).sort((a, b) => a.order - b.order));
        routesByDay.set(d, trip.routeSegments.filter((r) => r.day === d));
    });
    const dayReports = dayNumbers.map((day) => {
        const daySpots = spotsByDay.get(day) || [];
        const dayRoutes = routesByDay.get(day) || [];
        const issues = [];
        const totalStayMinutes = daySpots.reduce((sum, s) => sum + (s.stayMinutes || 0), 0);
        let totalTransitMinutes = 0;
        let missingDurationCount = 0;
        let longestSegmentMinutes = 0;
        dayRoutes.forEach((seg) => {
            const routeDuration = getRouteMinutes(seg);
            if (routeDuration.minutes === null) {
                missingDurationCount++;
                issues.push({
                    id: `${seg.id}-missing`,
                    day,
                    severity: 'warning',
                    title: '路线时长缺失',
                    detail: `${seg.transportType} 路线缺少时长，评估可能不准。`,
                    routeId: seg.id,
                    spotId: null,
                });
                return;
            }
            totalTransitMinutes += routeDuration.minutes;
            longestSegmentMinutes = Math.max(longestSegmentMinutes, routeDuration.minutes);
            if (seg.scope === 'intercity' && routeDuration.minutes >= thresholds.intercityTransitDangerMinutes) {
                issues.push({
                    id: `${seg.id}-long-intercity`,
                    day,
                    severity: 'danger',
                    title: '跨城移动过长',
                    detail: `预计 ${routeDuration.minutes} 分钟，建议确认节奏。`,
                    routeId: seg.id,
                    spotId: null,
                });
            }
        });
        const activeMinutes = totalStayMinutes + totalTransitMinutes;
        let status = 'ok';
        if (activeMinutes >= thresholds.overloadDayMinutes) {
            status = 'overload';
        }
        else if (activeMinutes >= thresholds.tightDayMinutes) {
            status = 'tight';
        }
        return {
            day,
            status,
            statusLabel: getStatusMeta(status).label,
            issueCount: issues.length,
            totalStayMinutes,
            totalTransitMinutes,
            activeMinutes,
            longestSegmentMinutes,
            missingDurationCount,
            routeCount: dayRoutes.length,
            spotCount: daySpots.length,
            issues,
        };
    });
    const allIssues = dayReports.flatMap((r) => r.issues);
    const statusCounts = { ok: 0, tight: 0, overload: 0, incomplete: 0 };
    dayReports.forEach((r) => statusCounts[r.status]++);
    return {
        summary: {
            status: 'ok', // 简化
            statusLabel: '分析完毕',
            issueCount: allIssues.length,
            atRiskDays: dayReports.filter((r) => r.status !== 'ok').length,
            tightDays: statusCounts.tight,
            overloadDays: statusCounts.overload,
            incompleteDays: statusCounts.incomplete,
            totalStayMinutes: dayReports.reduce((s, r) => s + r.totalStayMinutes, 0),
            totalTransitMinutes: dayReports.reduce((s, r) => s + r.totalTransitMinutes, 0),
        },
        dayReports,
        dayReportByDay: Object.fromEntries(dayReports.map((r) => [String(r.day), r])),
        issues: allIssues,
    };
}
