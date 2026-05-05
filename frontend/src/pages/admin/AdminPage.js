import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exportCurrentToLocal, getTripFull, importLocalToCurrent, updateTripFull, } from '../../api/trip-api';
import { normalizeTripForSave } from '../../utils/trip-normalize';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { AdminHeader } from './components/AdminHeader';
import { AdminToastStack } from './components/AdminToastStack';
import { AdminTripMap } from './components/AdminTripMap';
import { PlannerBoard } from './components/PlannerBoard';
import { PlannerInspector } from './components/PlannerInspector';
import { PlaceSearchAutocomplete } from './components/PlaceSearchAutocomplete';
import { SaveBar } from './components/SaveBar';
import { TripAnalysisReport } from './components/TripAnalysisReport';
import { useTripPlannerEditor } from './hooks/useTripPlannerEditor';
import './admin.css';
function createClientSpotId() {
    return `spot-client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
function sortDays(list) {
    return Array.from(new Set(list.filter((item) => Number.isFinite(item) && item > 0))).sort((a, b) => a - b);
}
function buildSpotFromPlace(place) {
    return {
        id: place.id,
        day: place.day,
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        city: '',
    };
}
export function AdminPage() {
    const [params] = useSearchParams();
    const tripId = params.get('id') || 'current';
    const isDefaultTrip = tripId === 'current';
    const queryClient = useQueryClient();
    const { data: initialData, isLoading, error, refetch } = useQuery({
        queryKey: ['trip', 'full', tripId],
        queryFn: () => getTripFull(tripId),
    });
    const mutation = useMutation({
        mutationFn: (draft) => {
            const { payload, issues } = normalizeTripForSave(draft);
            if (issues.length > 0) {
                const lines = issues.map((issue) => `- [${issue.kind} ${issue.id ?? `#${issue.index}`}] ${issue.field}: ${issue.message}`);
                throw new Error(`有 ${issues.length} 处字段格式异常:\n${lines.join('\n')}`);
            }
            return updateTripFull(tripId, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trip', 'full', tripId] });
        },
    });
    const importMutation = useMutation({
        mutationFn: importLocalToCurrent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trip', 'full', tripId] });
        },
    });
    const exportMutation = useMutation({
        mutationFn: exportCurrentToLocal,
    });
    if (isLoading) {
        return (_jsx("div", { className: "admin-shell", children: _jsx("div", { className: "status-card panel", children: _jsx("strong", { id: "status-text", children: "\u6B63\u5728\u52A0\u8F7D\u884C\u7A0B\u6570\u636E..." }) }) }));
    }
    if (error || !initialData) {
        return (_jsx("div", { className: "admin-shell", children: _jsxs("div", { className: "status-card panel is-error", children: [_jsx("strong", { id: "status-text", children: "\u52A0\u8F7D\u5931\u8D25" }), _jsx("p", { children: error?.message || '未知错误' }), _jsx("button", { className: "btn btn-primary", onClick: () => refetch(), children: "\u91CD\u8BD5" })] }) }));
    }
    return (_jsx("div", { className: "admin-page-bg", children: _jsx(AdminEditor, { tripId: tripId, isDefaultTrip: isDefaultTrip, initialData: initialData, isSaving: mutation.isPending, onSave: (payload) => mutation.mutateAsync(payload), onImport: () => importMutation.mutateAsync(), onExport: () => exportMutation.mutateAsync(), onReload: async () => {
                const result = await refetch();
                if (result.error)
                    throw result.error;
                if (!result.data)
                    throw new Error('未拿到最新行程数据');
                return result.data;
            }, isSyncing: importMutation.isPending || exportMutation.isPending }) }));
}
function AdminEditor({ tripId, isDefaultTrip, initialData, isSaving, onSave, onImport, onExport, onReload, isSyncing, }) {
    const [editorParams, setEditorParams] = useSearchParams();
    const [isReloading, setIsReloading] = useState(false);
    const [savedPayload, setSavedPayload] = useState(initialData);
    const [activeDay, setActiveDay] = useState(() => initialData.spots[0]?.day || 1);
    const [selectedSpotId, setSelectedSpotId] = useState(null);
    const [selectedSegmentId, setSelectedSegmentId] = useState(null);
    const [selectedSpotIds, setSelectedSpotIds] = useState([]);
    const [isMapAddMode, setIsMapAddMode] = useState(false);
    const [bulkTargetDay, setBulkTargetDay] = useState(() => initialData.spots[0]?.day || 1);
    const [bulkTag, setBulkTag] = useState('');
    const [inlineMessage, setInlineMessage] = useState(null);
    const [toasts, setToasts] = useState([]);
    const { snapshot, payload, isDirty, canUndo, canRedo, restoredFromLocalDraft, updateMeta, addSpot, addSpots, updateSpot, deleteSpot, moveSpot, duplicateDay, clearDay, autoSortDay, updateLeg, resetLeg, deleteDetachedSegment, moveSelectedToDay, copySelectedToDay, setSelectedMustVisit, appendTagToSelected, deleteSelected, undo, redo, resetFromPayload, acknowledgeSavedPayload, } = useTripPlannerEditor(initialData, tripId);
    useBeforeUnload(isDirty);
    const addToast = useCallback((tone, title, detail) => {
        const nextToast = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tone,
            title,
            detail,
        };
        setToasts((current) => [...current, nextToast]);
    }, []);
    useEffect(() => {
        if (!toasts.length)
            return undefined;
        const timeout = window.setTimeout(() => {
            setToasts((current) => current.slice(1));
        }, 4200);
        return () => window.clearTimeout(timeout);
    }, [toasts]);
    useEffect(() => {
        if (inlineMessage) {
            const timeout = window.setTimeout(() => setInlineMessage(null), 3200);
            return () => window.clearTimeout(timeout);
        }
        return undefined;
    }, [inlineMessage]);
    useEffect(() => {
        if (isDirty)
            return;
        const incoming = JSON.stringify(initialData);
        const current = JSON.stringify(savedPayload);
        if (incoming !== current) {
            setSavedPayload(initialData);
            acknowledgeSavedPayload(initialData);
        }
    }, [acknowledgeSavedPayload, initialData, isDirty, savedPayload]);
    const stats = useMemo(() => {
        const dayCount = snapshot.days.length || 1;
        return {
            days: dayCount,
            spots: payload.spots.length,
            segments: payload.routeSegments.length,
        };
    }, [payload.routeSegments.length, payload.spots.length, snapshot.days.length]);
    const dayOptions = useMemo(() => sortDays([...snapshot.dayNumbers, activeDay, bulkTargetDay]), [activeDay, bulkTargetDay, snapshot.dayNumbers]);
    const selectedSpot = selectedSpotId ? snapshot.spotById.get(selectedSpotId) || null : null;
    const selectedSegment = selectedSegmentId
        ? snapshot.segmentById.get(selectedSegmentId) || null
        : null;
    useEffect(() => {
        if (selectedSpotId && !snapshot.spotById.has(selectedSpotId)) {
            setSelectedSpotId(null);
        }
        if (selectedSegmentId && !snapshot.segmentById.has(selectedSegmentId)) {
            setSelectedSegmentId(null);
        }
        setSelectedSpotIds((current) => current.filter((id) => snapshot.spotById.has(id)));
    }, [selectedSegmentId, selectedSpotId, snapshot.segmentById, snapshot.spotById]);
    useEffect(() => {
        if (!dayOptions.includes(activeDay)) {
            setActiveDay(dayOptions[0] || 1);
        }
        if (!dayOptions.includes(bulkTargetDay)) {
            setBulkTargetDay(dayOptions[0] || 1);
        }
    }, [activeDay, bulkTargetDay, dayOptions]);
    const selectSpot = useCallback((spotId) => {
        setSelectedSpotId(spotId);
        setSelectedSegmentId(null);
        const spot = snapshot.spotById.get(spotId);
        if (spot?.day) {
            setActiveDay(spot.day);
        }
    }, [snapshot.spotById]);
    const selectSegment = useCallback((segmentId) => {
        setSelectedSegmentId(segmentId);
        setSelectedSpotId(null);
        const segment = snapshot.segmentById.get(segmentId);
        if (segment?.day) {
            setActiveDay(segment.day);
        }
    }, [snapshot.segmentById]);
    const toggleSpotSelection = (spotId, checked) => {
        setSelectedSpotIds((current) => {
            if (checked) {
                return Array.from(new Set([...current, spotId]));
            }
            return current.filter((id) => id !== spotId);
        });
    };
    const handleAddSpot = (day, index, partial) => {
        const id = partial?.id || createClientSpotId();
        addSpot(day, { ...partial, id }, index);
        selectSpot(id);
        setInlineMessage(`已在 Day ${day} 新增景点`);
    };
    const handleMapAddSpot = (lat, lng) => {
        handleAddSpot(activeDay, undefined, {
            name: `Day ${activeDay} 新景点`,
            lat,
            lng,
            day: activeDay,
        });
        addToast('info', '已从地图新增景点', '你可以继续拖动 marker 微调位置。');
    };
    const handleQuickAddPlace = (place) => {
        const id = createClientSpotId();
        handleAddSpot(activeDay, undefined, buildSpotFromPlace({ ...place, id, day: activeDay }));
    };
    /**
     * 处理 trip 页 ExternalPoiCard "+ 加入行程" 跳转过来的预填:
     * URL 含 prefillSpot=encoded({placeId,name,address,lat,lng,day,insertIndex}) 时,
     * 调 handleAddSpot 加到指定位置,然后**自动保存**(让用户切回 trip 页能立刻看到),
     * 最后清 URL 参数防刷新重复加。
     * 用 ref 防 React.StrictMode 双 mount 时执行两次。
     */
    const prefillHandledRef = useRef(false);
    const [autoSavePending, setAutoSavePending] = useState(false);
    // 加 spot 后等 payload 反映新数据(isDirty=true) → 触发自动保存,
    // 完成后让用户切回 trip 页能立即看到。失败时留在 admin 让用户手动保存。
    useEffect(() => {
        if (!autoSavePending)
            return;
        if (isSaving)
            return;
        if (!isDirty)
            return; // 等 payload 真正含新 spot
        setAutoSavePending(false);
        (async () => {
            try {
                const result = await onSave(payload);
                setSavedPayload(result.payload);
                acknowledgeSavedPayload(result.payload);
                addToast('success', '已加入并保存', '回到行程页查看新景点');
            }
            catch (err) {
                addToast('error', '保存失败', `景点已加到 Day ${activeDay},但保存失败:${err.message}`);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoSavePending, isDirty, isSaving]);
    useEffect(() => {
        if (prefillHandledRef.current)
            return;
        const raw = editorParams.get('prefillSpot');
        if (!raw)
            return;
        try {
            const parsed = JSON.parse(decodeURIComponent(raw));
            if (parsed.name && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
                prefillHandledRef.current = true;
                const targetDay = typeof parsed.day === 'number' ? parsed.day : activeDay;
                const id = createClientSpotId();
                handleAddSpot(targetDay, parsed.insertIndex, buildSpotFromPlace({
                    id,
                    day: targetDay,
                    name: parsed.name,
                    lat: parsed.lat,
                    lng: parsed.lng,
                }));
                // 切到目标 day,让用户能看到刚加的 spot
                setActiveDay(targetDay);
                const positionLabel = typeof parsed.insertIndex === 'number' ? `第 ${parsed.insertIndex + 1} 位` : '末尾';
                addToast('info', '已加入,正在保存…', `${parsed.name} → Day ${targetDay} ${positionLabel}`);
                // 触发自动保存(让 trip 页切回后立即能看到)
                setAutoSavePending(true);
                // 清掉 URL 参数,刷新不重复加
                const next = new URLSearchParams(editorParams);
                next.delete('prefillSpot');
                setEditorParams(next, { replace: true });
            }
        }
        catch (err) {
            console.warn('[AdminPage] prefillSpot parse failed:', err);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorParams]);
    const handleDeleteSpot = (spotId) => {
        const spot = snapshot.spotById.get(spotId);
        const confirmed = window.confirm(`删除景点“${spot?.name || spotId}”后不可恢复，继续吗？`);
        if (!confirmed)
            return;
        deleteSpot(spotId);
        setSelectedSpotIds((current) => current.filter((id) => id !== spotId));
        if (selectedSpotId === spotId) {
            setSelectedSpotId(null);
        }
        addToast('warning', '已删除景点');
    };
    const handleSave = async () => {
        try {
            const result = await onSave(payload);
            setSavedPayload(result.payload);
            acknowledgeSavedPayload(result.payload);
            setInlineMessage('已保存到后端');
            addToast('success', '保存成功', 'Trip 前台会自动读取最新行程。');
        }
        catch (error) {
            addToast('error', '保存失败', error.message);
        }
    };
    const handleReset = () => {
        if (!isDirty)
            return;
        const confirmed = window.confirm('重置会丢弃当前未保存修改，继续吗？');
        if (!confirmed)
            return;
        resetFromPayload(savedPayload);
        setSelectedSpotIds([]);
        setSelectedSpotId(null);
        setSelectedSegmentId(null);
        setInlineMessage('已恢复到最近一次保存状态');
    };
    const handleReload = async () => {
        if (isDirty) {
            const confirmed = window.confirm('重载后会丢弃当前未保存修改，继续吗？');
            if (!confirmed)
                return;
        }
        setIsReloading(true);
        try {
            const latest = await onReload();
            setSavedPayload(latest);
            acknowledgeSavedPayload(latest);
            setSelectedSpotIds([]);
            setSelectedSpotId(null);
            setSelectedSegmentId(null);
            setInlineMessage('已重新载入数据库中的最新版本');
            addToast('success', '重载成功');
        }
        catch (error) {
            addToast('error', '重载失败', error.message);
        }
        finally {
            setIsReloading(false);
        }
    };
    const handleImport = async () => {
        try {
            const result = await onImport();
            setSavedPayload(result.payload);
            acknowledgeSavedPayload(result.payload);
            setInlineMessage('已从本地 itinerary.json 导入');
            addToast('success', '导入成功');
        }
        catch (error) {
            addToast('error', '导入失败', error.message);
        }
    };
    const handleExport = async () => {
        try {
            const result = await onExport();
            addToast('success', '导出成功', result.path);
        }
        catch (error) {
            addToast('error', '导出失败', error.message);
        }
    };
    const handleIssueSelect = (issue) => {
        setActiveDay(issue.day);
        if (issue.spotId && snapshot.spotById.has(issue.spotId)) {
            selectSpot(issue.spotId);
            return;
        }
        if (issue.routeId && snapshot.segmentById.has(issue.routeId)) {
            selectSegment(issue.routeId);
            return;
        }
        const fallbackSpot = snapshot.days.find((day) => day.day === issue.day)?.spots[0];
        if (fallbackSpot) {
            selectSpot(fallbackSpot.id);
        }
    };
    const handleMoveSelected = () => {
        if (!selectedSpotIds.length)
            return;
        moveSelectedToDay(selectedSpotIds, bulkTargetDay);
        setActiveDay(bulkTargetDay);
        setInlineMessage(`已把 ${selectedSpotIds.length} 个景点移动到 Day ${bulkTargetDay}`);
    };
    const handleCopySelected = () => {
        if (!selectedSpotIds.length)
            return;
        copySelectedToDay(selectedSpotIds, bulkTargetDay);
        setInlineMessage(`已复制 ${selectedSpotIds.length} 个景点到 Day ${bulkTargetDay}`);
    };
    const handleDeleteSelected = () => {
        if (!selectedSpotIds.length)
            return;
        const confirmed = window.confirm(`删除选中的 ${selectedSpotIds.length} 个景点吗？`);
        if (!confirmed)
            return;
        deleteSelected(selectedSpotIds);
        setSelectedSpotIds([]);
        setSelectedSpotId(null);
        addToast('warning', '已删除选中景点');
    };
    const handleAppendTag = () => {
        const tag = bulkTag.trim();
        if (!tag || !selectedSpotIds.length)
            return;
        appendTagToSelected(selectedSpotIds, tag);
        setBulkTag('');
        setInlineMessage(`已为 ${selectedSpotIds.length} 个景点追加标签 ${tag}`);
    };
    const handleClearDay = (day) => {
        const confirmed = window.confirm(`清空 Day ${day} 的全部景点吗？`);
        if (!confirmed)
            return;
        clearDay(day);
        if (activeDay === day) {
            setSelectedSpotId(null);
            setSelectedSegmentId(null);
        }
        setSelectedSpotIds((current) => current.filter((id) => snapshot.spotById.get(id)?.day !== day));
        addToast('warning', `Day ${day} 已清空`);
    };
    return (_jsxs("div", { className: "admin-shell", children: [_jsx(AdminToastStack, { items: toasts, onDismiss: (id) => setToasts((current) => current.filter((item) => item.id !== id)) }), _jsx(AdminHeader, { title: payload.meta.title || '', tripId: tripId, meta: payload.meta, isDefaultTrip: isDefaultTrip, stats: stats }), _jsx(SaveBar, { onSave: handleSave, onReset: handleReset, onReload: handleReload, onImport: handleImport, onExport: handleExport, onUndo: undo, onRedo: redo, isSaving: isSaving, isSyncing: isSyncing, isReloading: isReloading, isDirty: isDirty, isDefaultTrip: isDefaultTrip, canUndo: canUndo, canRedo: canRedo, restoredFromLocalDraft: restoredFromLocalDraft, inlineMessage: inlineMessage }), _jsx(TripAnalysisReport, { trip: payload, onSelectIssue: handleIssueSelect }), _jsxs("section", { className: "panel planner-toolbar-panel", children: [_jsxs("div", { className: "planner-toolbar-section", children: [_jsxs("div", { children: [_jsx("p", { className: "panel-kicker", children: "Quick Add" }), _jsxs("h2", { children: ["\u641C\u7D22\u540E\u76F4\u63A5\u52A0\u5165 Day ", activeDay] })] }), _jsx(PlaceSearchAutocomplete, { onSelect: handleQuickAddPlace, placeholder: "\u641C\u7D22\u5730\u70B9\u5E76\u8FFD\u52A0\u5230\u5F53\u524D\u5929..." })] }), _jsxs("div", { className: "planner-toolbar-section planner-bulk-toolbar", children: [_jsxs("div", { children: [_jsx("p", { className: "panel-kicker", children: "Bulk Actions" }), _jsx("h2", { children: "\u6279\u91CF\u5904\u7406\u5DF2\u52FE\u9009\u666F\u70B9" })] }), _jsxs("div", { className: "planner-bulk-actions", children: [_jsxs("span", { className: "planner-bulk-count", children: [selectedSpotIds.length, " \u4E2A\u5DF2\u9009\u4E2D"] }), _jsxs("label", { className: "field planner-inline-field", children: [_jsx("span", { children: "\u76EE\u6807 Day" }), _jsx("select", { value: bulkTargetDay, onChange: (event) => setBulkTargetDay(Number(event.target.value)), children: dayOptions.map((day) => (_jsxs("option", { value: day, children: ["Day ", day] }, day))) })] }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: handleMoveSelected, disabled: !selectedSpotIds.length, children: "\u79FB\u52A8\u5230\u76EE\u6807\u5929" }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: handleCopySelected, disabled: !selectedSpotIds.length, children: "\u590D\u5236\u5230\u76EE\u6807\u5929" }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => setSelectedMustVisit(selectedSpotIds, true), disabled: !selectedSpotIds.length, children: "\u8BBE\u4E3A\u5FC5\u53BB" }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => setSelectedMustVisit(selectedSpotIds, false), disabled: !selectedSpotIds.length, children: "\u53D6\u6D88\u5FC5\u53BB" }), _jsx("input", { className: "planner-inline-input", type: "text", value: bulkTag, onChange: (event) => setBulkTag(event.target.value), placeholder: "\u6279\u91CF\u8FFD\u52A0\u6807\u7B7E" }), _jsx("button", { type: "button", className: "btn btn-ghost", onClick: handleAppendTag, disabled: !selectedSpotIds.length || !bulkTag.trim(), children: "\u8FFD\u52A0\u6807\u7B7E" }), _jsx("button", { type: "button", className: "btn btn-ghost btn-danger", onClick: handleDeleteSelected, disabled: !selectedSpotIds.length, children: "\u5220\u9664\u9009\u4E2D" })] })] })] }), _jsxs("main", { className: "planner-layout", children: [_jsxs("div", { className: "planner-main-column", children: [_jsx(PlannerBoard, { days: snapshot.days, dayColors: payload.config.dayColors, activeDay: activeDay, selectedSpotId: selectedSpotId, selectedSegmentId: selectedSegmentId, selectedSpotIds: selectedSpotIds, onSetActiveDay: setActiveDay, onSelectSpot: selectSpot, onToggleSpotSelection: toggleSpotSelection, onSelectSegment: selectSegment, onAddSpot: handleAddSpot, onMoveSpot: moveSpot, onDuplicateDay: (day) => {
                                    duplicateDay(day);
                                    addToast('info', `已复制 Day ${day}`);
                                }, onClearDay: handleClearDay, onAutoSortDay: (day) => {
                                    autoSortDay(day);
                                    setInlineMessage(`Day ${day} 已按地图距离重新排序`);
                                } }), _jsx(PlannerInspector, { meta: payload.meta, spots: payload.spots, selectedSpot: selectedSpot, selectedSegment: selectedSegment, spotById: snapshot.spotById, onUpdateMeta: updateMeta, onUpdateSpot: updateSpot, onDeleteSpot: handleDeleteSpot, onUpdateLeg: updateLeg, onResetLeg: resetLeg, onDeleteDetachedSegment: deleteDetachedSegment, onFocusSpot: selectSpot, onAddImportedSpots: (spots) => {
                                    addSpots(spots);
                                    if (spots[0]?.day) {
                                        setActiveDay(spots[0].day);
                                    }
                                    addToast('success', '批量导入完成', `已加入 ${spots.length} 个景点`);
                                } })] }), _jsx("div", { className: "planner-map-column", children: _jsx(AdminTripMap, { config: payload.config, days: snapshot.days, selectedSpotId: selectedSpotId, selectedSegmentId: selectedSegmentId, activeDay: activeDay, isAddMode: isMapAddMode, onToggleAddMode: () => setIsMapAddMode((value) => !value), onSelectSpot: selectSpot, onSelectSegment: selectSegment, onAddSpotAtPoint: handleMapAddSpot, onUpdateSpotPosition: (spotId, lat, lng) => updateSpot(spotId, { lat, lng }) }) })] })] }));
}
