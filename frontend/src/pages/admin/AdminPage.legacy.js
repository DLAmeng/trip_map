import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTripFull, updateTripFull, importLocalToCurrent, exportCurrentToLocal, } from '../../api/trip-api';
import { normalizeTripForSave } from '../../utils/trip-normalize';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { useTripEditor } from './hooks/useTripEditor';
import { AdminHeader } from './components/AdminHeader';
import { TripMetaForm } from './components/TripMetaForm';
import { SpotListEditor } from './components/SpotListEditor';
import { SegmentListEditor } from './components/SegmentListEditor';
import { BatchImportPanel } from './components/BatchImportPanel';
import { TripAnalysisReport } from './components/TripAnalysisReport';
import { SaveBar } from './components/SaveBar';
import './admin.css';
export function AdminPage() {
    const [params] = useSearchParams();
    const tripId = params.get('id') || 'current';
    const queryClient = useQueryClient();
    const { data: initialData, isLoading, error, refetch } = useQuery({
        queryKey: ['trip', 'full', tripId],
        queryFn: () => getTripFull(tripId),
    });
    const mutation = useMutation({
        mutationFn: (draft) => {
            // 保存前统一 normalize:对齐旧版 admin.js normalizeTripForSave,
            // 避免 UI 里残留的空格 / 字符串型数字 / 脏 tags 写进数据库
            const { payload, issues } = normalizeTripForSave(draft);
            if (issues.length > 0) {
                const lines = issues.map((i) => `  - [${i.kind} ${i.id ?? `#${i.index}`}] ${i.field}: ${i.message}`);
                throw new Error(`有 ${issues.length} 处字段格式异常:\n${lines.join('\n')}`);
            }
            return updateTripFull(tripId, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trip', 'full', tripId] });
            alert('保存成功！');
        },
        onError: (err) => {
            alert(`保存失败: ${err.message}`);
        },
    });
    const importMutation = useMutation({
        mutationFn: importLocalToCurrent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trip', 'full', tripId] });
            alert('已从本地 JSON 导入成功');
        },
        onError: (err) => alert('导入失败: ' + err.message),
    });
    const exportMutation = useMutation({
        mutationFn: exportCurrentToLocal,
        onSuccess: () => alert('已成功导出到本地 itinerary.json'),
        onError: (err) => alert('导出失败: ' + err.message),
    });
    if (isLoading) {
        return (_jsx("div", { className: "admin-shell", children: _jsx("div", { className: "status-card panel", children: _jsx("strong", { id: "status-text", children: "\u6B63\u5728\u52A0\u8F7D\u884C\u7A0B\u6570\u636E..." }) }) }));
    }
    if (error || !initialData) {
        return (_jsx("div", { className: "admin-shell", children: _jsxs("div", { className: "status-card panel is-error", children: [_jsx("strong", { id: "status-text", children: "\u52A0\u8F7D\u5931\u8D25" }), _jsx("p", { children: error?.message || '未知错误' }), _jsx("button", { className: "btn btn-primary", onClick: () => refetch(), children: "\u91CD\u8BD5" })] }) }));
    }
    return (_jsx("div", { className: "admin-page-bg", children: _jsx(AdminEditor, { tripId: tripId, initialData: initialData, isSaving: mutation.isPending, onSave: (payload) => mutation.mutate(payload), onImport: () => importMutation.mutate(), onExport: () => exportMutation.mutate(), isSyncing: importMutation.isPending || exportMutation.isPending }) }));
}
function AdminEditor({ tripId, initialData, isSaving, onSave, onImport, onExport, isSyncing, }) {
    const { draft, updateMeta, updateSpot, addSpot, addSpots, insertAfterSpot, deleteSpot, updateSegment, addSegment, deleteSegment, reorderSpots, reorderSegments, sortSpotsByDayOrder, sortSegmentsByDay, reset, } = useTripEditor(initialData);
    const isDirty = useMemo(() => {
        return JSON.stringify(draft) !== JSON.stringify(initialData);
    }, [draft, initialData]);
    // dirty 时拦截关闭 / 刷新 / 关标签页
    useBeforeUnload(isDirty);
    const stats = useMemo(() => {
        const days = new Set(draft.spots.map((s) => s.day)).size;
        return {
            days,
            spots: draft.spots.length,
            segments: draft.routeSegments.length,
        };
    }, [draft]);
    return (_jsxs("div", { className: "admin-shell", children: [_jsx(AdminHeader, { title: draft.meta.title || '', tripId: tripId, stats: stats }), _jsxs("main", { className: "editor-layout", children: [_jsx(TripAnalysisReport, { trip: draft }), _jsx(TripMetaForm, { meta: draft.meta, onChange: updateMeta }), _jsx(SpotListEditor, { spots: draft.spots, onUpdateSpot: updateSpot, onDeleteSpot: deleteSpot, onAddSpot: addSpot, onReorderSpots: reorderSpots, onInsertAfterSpot: insertAfterSpot, onSortByDayOrder: sortSpotsByDayOrder }), _jsx(SegmentListEditor, { segments: draft.routeSegments, spots: draft.spots, onUpdateSegment: updateSegment, onDeleteSegment: deleteSegment, onAddSegment: addSegment, onReorderSegments: reorderSegments, onSortByDay: sortSegmentsByDay }), _jsx(BatchImportPanel, { spots: draft.spots, onAddSpots: addSpots })] }), _jsx(SaveBar, { onSave: () => onSave(draft), onReset: () => reset(initialData), onImport: onImport, onExport: onExport, isSaving: isSaving, isSyncing: isSyncing, isDirty: isDirty })] }));
}
