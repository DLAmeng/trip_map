import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { analyzeTripFeasibility } from '../../../utils/trip-analysis';
export function TripAnalysisReport({ trip }) {
    const result = useMemo(() => analyzeTripFeasibility(trip), [trip]);
    if (result.issues.length === 0) {
        return (_jsx("div", { className: "analysis-empty", children: "\u2705 \u6682\u65E0\u884C\u7A0B\u51B2\u7A81\uFF0C\u5B89\u6392\u5408\u7406\u3002" }));
    }
    return (_jsxs("div", { className: "analysis-report", children: [_jsxs("div", { className: "analysis-header", children: [_jsx("strong", { children: "\u884C\u7A0B\u8BCA\u65AD\u62A5\u544A" }), _jsxs("span", { className: "issue-count", children: [result.issues.length, " \u4E2A\u6F5C\u5728\u95EE\u9898"] })] }), _jsx("ul", { className: "issue-list", children: result.issues.map((issue) => (_jsxs("li", { className: `issue-item is-${issue.severity}`, children: [_jsxs("div", { className: "issue-title", children: [_jsxs("span", { className: "issue-day", children: ["D", issue.day] }), issue.title] }), _jsx("div", { className: "issue-detail", children: issue.detail })] }, issue.id))) })] }));
}
