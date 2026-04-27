import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listTrips } from '../../api/trip-api';
import { filterAndSort } from '../../utils/format';
import { Toast } from '../../components/Toast';
import { useDeleteTripMutation, useDuplicateTripMutation, } from '../../hooks/useTripMutations';
import { CreateTripDialog } from './CreateTripDialog';
import { TripCard } from './TripCard';
import './dashboard.css';
/**
 * Phase 2 的 Dashboard 主页:
 *   - useQuery 拉列表,loading / error / 空 / 无结果四态
 *   - query / sortBy 是 UI state,filterAndSort 用 useMemo 派生
 *   - 新建 / 复制 / 删除走 useMutation,删除后 invalidate ['trips'] 触发列表刷新
 *   - toast 用本地 state + <Toast> 组件承担
 */
export function DashboardPage() {
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['trips'],
        queryFn: listTrips,
    });
    const [query, setQuery] = useState('');
    const [sortBy, setSortBy] = useState('updated');
    const [toast, setToast] = useState(null);
    const [duplicatingId, setDuplicatingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const dialogRef = useRef(null);
    const duplicateMutation = useDuplicateTripMutation();
    const deleteMutation = useDeleteTripMutation();
    const trips = data ?? [];
    const total = trips.length;
    const filtered = useMemo(() => filterAndSort(trips, query, sortBy), [trips, query, sortBy]);
    const subtitle = !total
        ? '还没有行程。创建第一个,或基于默认日本行程复制一份。'
        : `共 ${total} 个行程,继续规划吧。`;
    const resultCountText = !total
        ? ''
        : filtered.length === total
            ? `${total} 个`
            : `${filtered.length} / ${total}`;
    const openCreate = () => {
        dialogRef.current?.open();
    };
    const showToast = (message, tone = 'default') => {
        setToast({ message, tone });
    };
    const handleDuplicate = (trip) => {
        setDuplicatingId(trip.id);
        duplicateMutation.mutate(trip.id, {
            onSuccess: (result) => {
                showToast(`已复制为「${result.trip.name}」`);
            },
            onError: (err) => {
                showToast(err.message, 'error');
            },
            onSettled: () => {
                setDuplicatingId(null);
            },
        });
    };
    const handleDelete = (trip) => {
        const confirmed = window.confirm(`确定删除「${trip.name || trip.id}」这个行程吗?此操作不可恢复。`);
        if (!confirmed)
            return;
        setDeletingId(trip.id);
        deleteMutation.mutate(trip.id, {
            onSuccess: () => {
                showToast('已删除');
            },
            onError: (err) => {
                showToast(err.message, 'error');
            },
            onSettled: () => {
                setDeletingId(null);
            },
        });
    };
    const handleDuplicateCurrent = () => {
        const currentTrip = trips.find((t) => t.id === 'current');
        if (currentTrip) {
            handleDuplicate(currentTrip);
        }
        else {
            // 兜底:列表还没加载或默认行程被改名,直接按 id 调
            setDuplicatingId('current');
            duplicateMutation.mutate('current', {
                onSuccess: (result) => {
                    showToast(`已复制为「${result.trip.name}」`);
                },
                onError: (err) => {
                    showToast(err.message, 'error');
                },
                onSettled: () => setDuplicatingId(null),
            });
        }
    };
    return (_jsxs("div", { className: "dash-shell", children: [_jsxs("header", { className: "dash-header", children: [_jsxs("div", { className: "dash-header-copy", children: [_jsx("span", { className: "eyebrow", children: "Trip Map" }), _jsx("h1", { children: "\u6211\u7684\u65C5\u884C\u8BA1\u5212" }), _jsx("p", { className: "dash-subtitle", children: isError ? '加载失败' : subtitle })] }), _jsxs("div", { className: "dash-header-actions", children: [_jsxs("button", { type: "button", className: "secondary-btn", title: "\u57FA\u4E8E\u9ED8\u8BA4\u65E5\u672C\u884C\u7A0B\u5FEB\u901F\u590D\u5236\u4E00\u4EFD\u53EF\u7F16\u8F91\u7684\u526F\u672C", disabled: duplicatingId === 'current', onClick: handleDuplicateCurrent, children: [_jsx("span", { "aria-hidden": "true", children: "\u2398" }), " \u590D\u5236\u9ED8\u8BA4\u884C\u7A0B"] }), _jsx("button", { type: "button", className: "primary-btn", onClick: openCreate, children: "\uFF0B \u65B0\u5EFA\u884C\u7A0B" })] })] }), _jsxs("section", { className: "dash-toolbar", "aria-label": "\u7B5B\u9009\u884C\u7A0B", children: [_jsxs("label", { className: "dash-search", children: [_jsx("span", { className: "sr-only", children: "\u641C\u7D22\u884C\u7A0B" }), _jsx("input", { type: "search", placeholder: "\u6309\u540D\u79F0\u3001\u76EE\u7684\u5730\u3001\u63CF\u8FF0\u641C\u7D22...", autoComplete: "off", value: query, onChange: (event) => setQuery(event.target.value) })] }), _jsxs("label", { className: "dash-sort", children: [_jsx("span", { className: "dash-sort-label", children: "\u6392\u5E8F" }), _jsxs("select", { value: sortBy, onChange: (event) => setSortBy(event.target.value), children: [_jsx("option", { value: "updated", children: "\u6700\u8FD1\u66F4\u65B0" }), _jsx("option", { value: "name", children: "\u540D\u79F0 A\u2192Z" }), _jsx("option", { value: "spots", children: "\u666F\u70B9\u6570\u91CF" }), _jsx("option", { value: "created", children: "\u521B\u5EFA\u65F6\u95F4" })] })] }), _jsx("div", { className: "dash-result-count", "aria-live": "polite", children: resultCountText })] }), _jsx("main", { className: "dash-main", children: isLoading ? (
                // 用 trip-card 同尺寸的 skeleton 占位,让加载过场更平滑、跳变更小
                _jsx("div", { className: "trip-grid", "aria-busy": "true", "aria-live": "polite", children: [0, 1, 2].map((i) => (_jsxs("article", { className: "trip-card trip-card-skeleton", "aria-hidden": "true", children: [_jsx("div", { className: "skeleton-line skeleton-title" }), _jsx("div", { className: "skeleton-line skeleton-subtitle" }), _jsx("div", { className: "skeleton-line skeleton-text" }), _jsx("div", { className: "skeleton-line skeleton-text-short" }), _jsxs("div", { className: "skeleton-chips", children: [_jsx("span", { className: "skeleton-chip" }), _jsx("span", { className: "skeleton-chip" }), _jsx("span", { className: "skeleton-chip" })] }), _jsxs("div", { className: "skeleton-actions", children: [_jsx("span", { className: "skeleton-button" }), _jsx("span", { className: "skeleton-button" })] })] }, i))) })) : isError ? (_jsxs("div", { className: "empty-state compact", children: [_jsxs("p", { children: ["\u65E0\u6CD5\u52A0\u8F7D\u884C\u7A0B\u5217\u8868:", error.message] }), _jsx("button", { type: "button", className: "secondary-btn", onClick: () => refetch(), disabled: isFetching, children: isFetching ? '重试中...' : '重试' })] })) : total === 0 ? (_jsxs("div", { className: "empty-state", children: [_jsx("div", { className: "empty-state-icon", "aria-hidden": "true", children: "\uD83E\uDDED" }), _jsx("h2", { children: "\u5F00\u542F\u4F60\u7684\u7B2C\u4E00\u6BB5\u65C5\u7A0B" }), _jsx("p", { children: "\u6536\u96C6\u666F\u70B9\u3001\u52FE\u753B\u8DEF\u7EBF\u3001\u79BB\u7EBF\u5E26\u8D70\u5730\u56FE\u3002\u4E00\u5207\u4ECE\u8FD9\u91CC\u5F00\u59CB\u3002" }), _jsxs("div", { className: "empty-state-actions", children: [_jsx("button", { type: "button", className: "primary-btn", onClick: openCreate, children: "\uFF0B \u521B\u5EFA\u65B0\u884C\u7A0B" }), _jsxs("button", { type: "button", className: "secondary-btn", onClick: handleDuplicateCurrent, disabled: duplicatingId === 'current', title: "\u57FA\u4E8E\u5185\u7F6E\u65E5\u672C\u793A\u4F8B\u884C\u7A0B\u5FEB\u901F\u590D\u5236\u4E00\u4EFD\u53EF\u7F16\u8F91\u526F\u672C", children: [_jsx("span", { "aria-hidden": "true", children: "\u2398" }), " \u590D\u5236\u65E5\u672C\u6A21\u677F"] })] })] })) : filtered.length === 0 ? (_jsx("div", { className: "empty-state compact", children: _jsx("p", { children: "\u6CA1\u6709\u5339\u914D\u7684\u884C\u7A0B,\u6362\u4E2A\u5173\u952E\u5B57\u8BD5\u8BD5\u3002" }) })) : (_jsx("div", { className: "trip-grid", "aria-live": "polite", children: filtered.map((trip) => (_jsx(TripCard, { trip: trip, onDuplicate: handleDuplicate, onDelete: handleDelete, duplicating: duplicatingId === trip.id, deleting: deletingId === trip.id }, trip.id))) })) }), _jsx(CreateTripDialog, { ref: dialogRef }), _jsx(Toast, { message: toast?.message ?? null, tone: toast?.tone, onDismiss: () => setToast(null) })] }));
}
