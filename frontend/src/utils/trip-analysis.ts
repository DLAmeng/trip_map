import type { RouteSegment, SpotItem, TripFullPayload } from '../types/trip';

export const DEFAULT_THRESHOLDS = {
  tightDayMinutes: 510,
  overloadDayMinutes: 630,
  cityTransitWarnMinutes: 45,
  intercityTransitWarnMinutes: 150,
  intercityTransitDangerMinutes: 210,
  longWalkWarnMinutes: 35,
};

export type AnalysisSeverity = 'warning' | 'danger' | 'success';

export interface TripIssue {
  id: string;
  day: number;
  severity: AnalysisSeverity;
  title: string;
  detail: string;
  routeId: string | null;
  spotId: string | null;
}

export interface DayReport {
  day: number;
  status: 'ok' | 'tight' | 'overload' | 'incomplete';
  statusLabel: string;
  issueCount: number;
  totalStayMinutes: number;
  totalTransitMinutes: number;
  activeMinutes: number;
  longestSegmentMinutes: number;
  missingDurationCount: number;
  routeCount: number;
  spotCount: number;
  issues: TripIssue[];
}

export interface AnalysisResult {
  summary: {
    status: string;
    statusLabel: string;
    issueCount: number;
    atRiskDays: number;
    tightDays: number;
    overloadDays: number;
    incompleteDays: number;
    totalStayMinutes: number;
    totalTransitMinutes: number;
  };
  dayReports: DayReport[];
  dayReportByDay: Record<string, DayReport>;
  issues: TripIssue[];
}

function toFiniteNumber(value: any): number | null {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}

export function sortNumbersAscending(list: number[]): number[] {
  return [...list].sort((a, b) => a - b);
}

export function deriveDayNumbers(spots: SpotItem[]): number[] {
  return sortNumbersAscending(
    Array.from(
      new Set(
        spots
          .map((s) => toFiniteNumber(s.day))
          .filter((v): v is number => v !== null && v > 0)
      )
    )
  );
}

export function parseDurationToMinutes(value: string | undefined): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

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

  if (matched) return Math.round(totalMinutes);

  const directMinutes = Number(raw.replace(/[^\d.]/g, ''));
  if (Number.isFinite(directMinutes) && directMinutes > 0) {
    return Math.round(directMinutes);
  }

  return null;
}

function getRouteMinutes(segment: RouteSegment) {
  // 暂时不支持 realDurationSec, 只看 duration 文本
  const parsedMinutes = parseDurationToMinutes(segment.duration);
  if (Number.isFinite(parsedMinutes) && parsedMinutes! > 0) {
    return { minutes: parsedMinutes, source: 'planned' };
  }
  return { minutes: null, source: 'missing' };
}

function getStatusMeta(status: string) {
  const map: Record<string, { label: string; severity: number }> = {
    ok: { label: '正常', severity: 0 },
    tight: { label: '紧凑', severity: 1 },
    overload: { label: '过载', severity: 2 },
    incomplete: { label: '数据不足', severity: 3 },
  };
  return map[status] || map.ok;
}

export function analyzeTripFeasibility(
  trip: TripFullPayload,
  options: { thresholds?: Partial<typeof DEFAULT_THRESHOLDS> } = {}
): AnalysisResult {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
  const spots = trip.spots.filter((s) => s.type !== 'transport');
  const dayNumbers = deriveDayNumbers(trip.spots);

  const spotsByDay = new Map<number, SpotItem[]>();
  const routesByDay = new Map<number, RouteSegment[]>();

  dayNumbers.forEach((d) => {
    spotsByDay.set(d, spots.filter((s) => s.day === d).sort((a, b) => a.order - b.order));
    routesByDay.set(d, trip.routeSegments.filter((r) => r.day === d));
  });

  const dayReports: DayReport[] = dayNumbers.map((day) => {
    const daySpots = spotsByDay.get(day) || [];
    const dayRoutes = routesByDay.get(day) || [];
    const issues: TripIssue[] = [];

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
    let status: DayReport['status'] = 'ok';
    if (activeMinutes >= thresholds.overloadDayMinutes) {
      status = 'overload';
    } else if (activeMinutes >= thresholds.tightDayMinutes) {
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
