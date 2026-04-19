import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTripFull, updateTripFull } from '../../api/trip-api';
import { useTripEditor } from './hooks/useTripEditor';
import { AdminHeader } from './components/AdminHeader';
import { TripMetaForm } from './components/TripMetaForm';
import { SpotListEditor } from './components/SpotListEditor';
import { SegmentListEditor } from './components/SegmentListEditor';
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
        mutationFn: (payload) => updateTripFull(tripId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trip', 'full', tripId] });
            alert('保存成功！');
        },
        onError: (err) => {
            alert(`保存失败: ${err.message}`);
        },
    });
    if (isLoading) {
        return (_jsx("div", { className: "admin-shell", children: _jsx("div", { className: "status-card panel", children: _jsx("strong", { id: "status-text", children: "\u6B63\u5728\u52A0\u8F7D\u884C\u7A0B\u6570\u636E..." }) }) }));
    }
    if (error || !initialData) {
        return (_jsx("div", { className: "admin-shell", children: _jsxs("div", { className: "status-card panel", style: { borderColor: '#ff4d4f' }, children: [_jsx("strong", { id: "status-text", style: { color: '#ff4d4f' }, children: "\u52A0\u8F7D\u5931\u8D25" }), _jsx("p", { children: error?.message || '未知错误' }), _jsx("button", { className: "btn btn-primary", onClick: () => refetch(), children: "\u91CD\u8BD5" })] }) }));
    }
    return (_jsx("div", { className: "admin-page-bg", children: _jsx(AdminEditor, { tripId: tripId, initialData: initialData, isSaving: mutation.isPending, onSave: (payload) => mutation.mutate(payload) }) }));
}
function AdminEditor({ tripId, initialData, isSaving, onSave }) {
    const { draft, updateMeta, updateSpot, addSpot, deleteSpot, updateSegment, addSegment, deleteSegment, reset } = useTripEditor(initialData);
    const isDirty = useMemo(() => {
        return JSON.stringify(draft) !== JSON.stringify(initialData);
    }, [draft, initialData]);
    const stats = useMemo(() => {
        const days = new Set(draft.spots.map(s => s.day)).size;
        return {
            days,
            spots: draft.spots.length,
            segments: draft.routeSegments.length,
        };
    }, [draft]);
    return (_jsxs("div", { className: "admin-shell", children: [_jsx(AdminHeader, { title: draft.meta.title || '', tripId: tripId, stats: stats }), _jsxs("main", { className: "editor-layout", children: [_jsx(TripMetaForm, { meta: draft.meta, onChange: updateMeta }), _jsx(SpotListEditor, { spots: draft.spots, onUpdateSpot: updateSpot, onDeleteSpot: deleteSpot, onAddSpot: addSpot }), _jsx(SegmentListEditor, { segments: draft.routeSegments, spots: draft.spots, onUpdateSegment: updateSegment, onDeleteSegment: deleteSegment, onAddSegment: addSegment })] }), _jsx(SaveBar, { onSave: () => onSave(draft), onReset: () => reset(initialData), isSaving: isSaving, isDirty: isDirty })] }));
}
