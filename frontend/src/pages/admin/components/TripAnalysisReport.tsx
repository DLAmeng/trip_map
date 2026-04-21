import { useMemo } from 'react';
import type { TripFullPayload } from '../../../types/trip';
import { analyzeTripFeasibility } from '../../../utils/trip-analysis';

interface TripAnalysisReportProps {
  trip: TripFullPayload;
}

export function TripAnalysisReport({ trip }: TripAnalysisReportProps) {
  const result = useMemo(() => analyzeTripFeasibility(trip), [trip]);

  if (result.issues.length === 0) {
    return (
      <div className="analysis-empty">
        ✅ 暂无行程冲突，安排合理。
      </div>
    );
  }

  return (
    <div className="analysis-report">
      <div className="analysis-header">
        <strong>行程诊断报告</strong>
        <span className="issue-count">{result.issues.length} 个潜在问题</span>
      </div>
      <ul className="issue-list">
        {result.issues.map((issue) => (
          <li key={issue.id} className={`issue-item is-${issue.severity}`}>
            <div className="issue-title">
              <span className="issue-day">D{issue.day}</span>
              {issue.title}
            </div>
            <div className="issue-detail">{issue.detail}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
