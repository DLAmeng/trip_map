import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exportCurrentToLocal, getTripFull, importLocalToCurrent, updateTripFull, } from '../../api/trip-api';
import { normalizeTripForSave } from '../../utils/trip-normalize';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { analyzeTripFeasibility } from '../../utils/trip-analysis';
import { hydrateRealRouteGeometries } from '../../api/routing-api';
import { AdminHeader } from './components/AdminHeader';
import { AdminToastStack } from './components/AdminToastStack';
import { AdminSettingsSheet } from './components/AdminSettingsSheet';
import { BulkActionsToolbar } from './components/BulkActionsToolbar';
import { ConflictsModal } from './components/ConflictsModal';
import { PlannerBoard } from './components/PlannerBoard';
import { SaveBar } from './components/SaveBar';
import { SegmentInspectorSheet } from './components/SegmentInspectorSheet';
import { SpotInspectorSheet } from './components/SpotInspectorSheet';
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
            // P22-2: 同时 invalidate trip 页 + dashboard 用的 key,确保跨页面立即看到最新数据
            // (trip 页 staleTime=30s,不显式 invalidate 用户切过去 30s 内拿的还是 cache)
            queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
            queryClient.invalidateQueries({ queryKey: ['trips'] });
        },
    });
    const importMutation = useMutation({
        mutationFn: importLocalToCurrent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trip', 'full', tripId] });
            // P22-2: 同上 — 本地 itinerary.json 导入后,trip / dashboard 也要刷
            queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
            queryClient.invalidateQueries({ queryKey: ['trips'] });
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
    const [bulkTargetDay, setBulkTargetDay] = useState(() => initialData.spots[0]?.day || 1);
    const [inlineMessage, setInlineMessage] = useState(null);
    const [toasts, setToasts] = useState([]);
    // P-final: 设置 sheet + 冲突 modal 开关
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [conflictsOpen, setConflictsOpen] = useState(false);
    const { snapshot, payload, isDirty, canUndo, canRedo, restoredFromLocalDraft, updateMeta, addSpot, addSpots, updateSpot, deleteSpot, moveSpot, duplicateDay, clearDay, autoSortDay, updateLeg, resetLeg, deleteDetachedSegment, moveSelectedToDay, copySelectedToDay, setSelectedMustVisit, deleteSelected, undo, redo, resetFromPayload, acknowledgeSavedPayload, } = useTripPlannerEditor(initialData, tripId);
    useBeforeUnload(isDirty);
    const addToast = useCallback((tone, title, detail, action) => {
        const nextToast = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tone,
            title,
            detail,
            action,
        };
        setToasts((current) => [...current, nextToast]);
    }, []);
    useEffect(() => {
        if (!toasts.length)
            return undefined;
        // P4-2: 带 undo action 的 toast 持续 6s(用户来得及撤销),普通 toast 仍 4.2s
        const head = toasts[0];
        const lifetime = head.action ? 6000 : 4200;
        const timeout = window.setTimeout(() => {
            setToasts((current) => current.slice(1));
        }, lifetime);
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
    // 冲突数 — SaveBar 红点显示用
    const issueCount = useMemo(() => analyzeTripFeasibility(payload).issues.length, [payload]);
    /**
     * P18-2: 改 transportType 后自动 hydrate 重算 distance / duration / path 信息
     *
     * 流程:
     * 1. useTripPlannerEditor.updateLeg(P18-1)在 transportType 变更时清空 realDistance/realDuration
     * 2. 本 effect 监听 payload.routeSegments,找出 realDistance == null 的 segment
     * 3. 通过 attemptKey = `${id}:${transportType}` 跟踪已尝试过的(用 ref 不触发 re-render)
     * 4. debounce 400ms 后调用 hydrateRealRouteGeometries(支持 Google Directions API + RapidAPI)
     * 5. onResolved 回调用 updateLeg 写回 draft,UI 立即看到新值
     *
     * 死循环防护:
     * - attemptKey 包含 transportType,改回相同 transport 时 key 相同不重试
     * - 改不同 transport → key 变 → 重新尝试 ✓
     * - hydrate 失败(API 失败 / transport 不在 Google travel modes 映射)→ ref 已记录,不再重试
     */
    const hydrationAttemptsRef = useRef(new Set());
    useEffect(() => {
        // 没有 Google API key 时不尝试 hydrate
        if (!payload.config.googleMaps?.apiKey)
            return;
        const candidates = payload.routeSegments.filter((seg) => {
            // 已有真实距离 → 不需要重算
            if (seg.realDistanceMeters != null)
                return false;
            // attemptKey 含 transportType,改 transport 时 key 变,可重新尝试
            const attemptKey = `${seg.id}:${seg.transportType}`;
            return !hydrationAttemptsRef.current.has(attemptKey);
        });
        if (candidates.length === 0)
            return;
        // 立即标记已尝试,避免 hydrate 异步期间重复触发
        candidates.forEach((seg) => {
            hydrationAttemptsRef.current.add(`${seg.id}:${seg.transportType}`);
        });
        const ac = new AbortController();
        // debounce 400ms — 用户连续改 transportType 时避免每次都发请求
        const timer = window.setTimeout(() => {
            hydrateRealRouteGeometries({
                segments: candidates,
                spotById: snapshot.spotById,
                config: payload.config,
                routingEngine: 'google',
                signal: ac.signal,
                onResolved: (segmentId, geometry) => {
                    const seg = payload.routeSegments.find((s) => s.id === segmentId);
                    if (!seg)
                        return;
                    const key = `${seg.fromSpotId}__${seg.toSpotId}`;
                    updateLeg(key, {
                        realDistanceMeters: geometry.distanceMeters,
                        realDurationSec: geometry.durationSec,
                        realWarnings: geometry.warnings ?? null,
                        runtimeSource: geometry.source ?? null,
                        runtimeTransitSummary: geometry.transitSummary ?? null,
                        runtimeTransitLegs: geometry.transitLegs ?? null,
                    });
                },
            }).catch((err) => {
                // hydrate 内部错误不该崩页面,记日志
                if (err?.name !== 'AbortError') {
                    // eslint-disable-next-line no-console
                    console.warn('[admin hydrate] failed:', err);
                }
            });
        }, 400);
        return () => {
            window.clearTimeout(timer);
            ac.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payload.routeSegments, payload.config.googleMaps?.apiKey]);
    /**
     * P0-1: 根据 trip.meta.startDate/endDate 算出"期望天数",传给 PlannerBoard 让 DayTabs
     * 至少展开 N 个 day。用户在创建 trip 表单填了 06-01 → 06-05(5 天),即使 hook spots
     * 还没有任何景点(snapshot.dayNumbers 是空),DayTabs 也会显示 D1-D5 5 个 chip,
     * 用户能直接切到任一 day 开始加 spot。
     */
    const expectedDayCount = useMemo(() => {
        const start = payload.meta.startDate;
        const end = payload.meta.endDate;
        if (!start || !end)
            return undefined;
        const startMs = Date.parse(start);
        const endMs = Date.parse(end);
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs)
            return undefined;
        // 含起止两端,例如 06-01 → 06-05 = 5 天
        return Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;
    }, [payload.meta.startDate, payload.meta.endDate]);
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
        // P4-6: 移动端 haptic 反馈(iOS 16.4+ / Android Chrome 支持)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(15);
        }
        // P4-1: 等 React commit 后,滚到新 spot 卡 + 加 1.5s highlight 动画
        // (移动端视口小,新加的 spot 在 day 末尾,如果不滚用户根本看不到)
        if (typeof window !== 'undefined') {
            window.setTimeout(() => {
                const card = document.querySelector(`[data-spot-id="${id}"]`);
                if (!card)
                    return;
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('is-just-added');
                window.setTimeout(() => card.classList.remove('is-just-added'), 1800);
            }, 60);
        }
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
        // P4-2: 删除立刻执行,toast 6s 内可撤销 — 比 window.confirm 在移动端友好得多
        // (PWA 不弹原生 confirm,且减少摩擦)
        const spot = snapshot.spotById.get(spotId);
        if (!spot)
            return;
        const backup = { ...spot };
        deleteSpot(spotId);
        setSelectedSpotIds((current) => current.filter((id) => id !== spotId));
        if (selectedSpotId === spotId) {
            setSelectedSpotId(null);
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate)
            navigator.vibrate(20);
        addToast('warning', `已删除"${backup.name || '未命名景点'}"`, undefined, {
            label: '撤销',
            onAction: () => addSpots([backup]),
        });
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
        // P4-3: confirm 移到 SaveBar 内"二次轻点"逻辑(移动端 PWA 友好,
        // 不再弹原生 window.confirm),这里直接执行
        if (!isDirty)
            return;
        resetFromPayload(savedPayload);
        setSelectedSpotIds([]);
        setSelectedSpotId(null);
        setSelectedSegmentId(null);
        setInlineMessage('已恢复到最近一次保存状态');
        addToast('info', '已重置为上次保存状态');
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
    /**
     * P19: 从用户电脑上传 JSON 文件覆盖当前 trip(纯前端,不调后端)。
     * 用户保存后才同步到后端,在此之前停留在 isDirty 状态,可以撤销 / 重置回到原状。
     * 不限默认 trip,任何 trip 都能用。
     */
    /**
     * P20: 批量自动定位缺 lat/lng 的 spot
     * 用 spot.name + city 作 query 调 /api/places/search(后端走 Google Places API),
     * 取第一条结果的 lat/lng 写回 spot。串行避免 burst quota。
     *
     * 适用场景:用户上传的 JSON 只有 name 没有经纬度,或地点名拼错位置缺失。
     * 失败:跳过该 spot(列表仍可见,用户可去 SpotInspectorSheet 手动搜索修)。
     */
    const [isAutoLocating, setIsAutoLocating] = useState(false);
    const handleAutoLocateSpots = useCallback(async () => {
        const candidates = payload.spots.filter((s) => !Number.isFinite(s.lat) || !Number.isFinite(s.lng));
        if (candidates.length === 0) {
            addToast('info', '没有需要自动定位的景点', '所有景点已有经纬度');
            return;
        }
        if (!payload.config?.googleMaps?.apiKey) {
            addToast('error', '后端未配 Google Maps API key', '无法用 Places API 反查');
            return;
        }
        setIsAutoLocating(true);
        let resolved = 0;
        let failed = 0;
        for (const spot of candidates) {
            const query = [spot.name, spot.city].filter(Boolean).join(' ').trim();
            if (!query) {
                failed += 1;
                continue;
            }
            try {
                const r = await fetch('/api/places/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query }),
                });
                const data = await r.json();
                const first = data?.ok && Array.isArray(data.places) ? data.places[0] : null;
                if (first && Number.isFinite(first.lat) && Number.isFinite(first.lng)) {
                    updateSpot(spot.id, { lat: first.lat, lng: first.lng });
                    resolved += 1;
                }
                else {
                    failed += 1;
                }
            }
            catch {
                failed += 1;
            }
        }
        setIsAutoLocating(false);
        addToast(resolved > 0 ? 'success' : 'warning', `自动定位完成`, `已定位 ${resolved} 个 / 失败 ${failed} 个${failed > 0 ? ',失败的可在 SpotInspector 手动搜索' : ''}`);
    }, [payload.spots, payload.config?.googleMaps?.apiKey, updateSpot, addToast]);
    const handleImportFromFile = async (parsed) => {
        try {
            // P22-1: 直接调 mutation POST 到后端,而不是 resetFromPayload(parsed)。
            // resetFromPayload 会把 baseline 也设成 parsed → isDirty=false → SaveBar
            // 「保存」按钮不亮,用户无法保存,数据永远停留在前端 React state,
            // 切到 trip 页 / dashboard 看到的还是后端旧数据。
            // 改成 onSave(parsed) 后,数据直接 PUT /api/trips/:id 写入数据库,
            // mutation.onSuccess 会 invalidate trip / dashboard 的 query key(见 P22-2)。
            const result = await onSave(parsed);
            setSavedPayload(result.payload);
            acknowledgeSavedPayload(result.payload); // baseline 对齐到已保存版本
            setSelectedSpotIds([]);
            setSelectedSpotId(null);
            setSelectedSegmentId(null);
            // P19-2: 统计能被地图识别的 spot 数(lat/lng/day 全有效)
            // 注意:用 parsed 而不是 result.payload,因为后端 normalize 可能改字段;
            // 这里只是给用户看导入文件本身的质量
            const spots = Array.isArray(parsed.spots) ? parsed.spots : [];
            const mappable = spots.filter((s) => Number.isFinite(s?.lat) &&
                Number.isFinite(s?.lng) &&
                Number.isFinite(s?.day)).length;
            const missing = spots.length - mappable;
            setInlineMessage(`已导入并保存 ${spots.length} 景点 / ${parsed.routeSegments?.length ?? 0} 路线`
                + (missing > 0 ? `,其中 ${missing} 个缺位置无法在地图显示` : ''));
            addToast(missing === 0 ? 'success' : 'warning', '导入并保存成功', missing === 0
                ? `${mappable} 个景点已写入数据库 → trip 页 / dashboard 立即可见`
                : `${mappable} 个景点已写入数据库,${missing} 个缺字段(列表可见,无 marker)`);
            setSettingsOpen(false);
            // P21-3: sheet 关闭后给一帧 commit,scroll PlannerBoard 到顶部让用户立刻看到新数据
            requestAnimationFrame(() => {
                const board = document.querySelector('.planner-layout');
                board?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
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
    // P-final: handleMoveSelected/handleCopySelected/handleAppendTag 已被 BulkActionsToolbar 取代
    // P4-2: handleDeleteSelected / handleClearDay 改 undoable toast(去掉 confirm 摩擦)
    const handleDeleteSelected = () => {
        if (!selectedSpotIds.length)
            return;
        // 备份被删 spot,toast 撤销时恢复
        const backups = selectedSpotIds
            .map((id) => snapshot.spotById.get(id))
            .filter((s) => !!s)
            .map((s) => ({ ...s }));
        if (!backups.length)
            return;
        deleteSelected(selectedSpotIds);
        setSelectedSpotIds([]);
        setSelectedSpotId(null);
        if (typeof navigator !== 'undefined' && navigator.vibrate)
            navigator.vibrate(20);
        addToast('warning', `已删除 ${backups.length} 个景点`, undefined, {
            label: '撤销',
            onAction: () => addSpots(backups),
        });
    };
    const handleClearDay = (day) => {
        const dayBackup = snapshot.days.find((d) => d.day === day);
        if (!dayBackup || dayBackup.spots.length === 0)
            return;
        const backups = dayBackup.spots.map((s) => ({ ...s }));
        clearDay(day);
        if (activeDay === day) {
            setSelectedSpotId(null);
            setSelectedSegmentId(null);
        }
        setSelectedSpotIds((current) => current.filter((id) => snapshot.spotById.get(id)?.day !== day));
        if (typeof navigator !== 'undefined' && navigator.vibrate)
            navigator.vibrate(20);
        addToast('warning', `Day ${day} 已清空(${backups.length} 个景点)`, undefined, {
            label: '撤销',
            onAction: () => addSpots(backups),
        });
    };
    return (_jsxs("div", { className: "admin-shell", children: [_jsx(AdminToastStack, { items: toasts, onDismiss: (id) => setToasts((current) => current.filter((item) => item.id !== id)) }), _jsx(AdminHeader, { title: payload.meta.title || '', tripId: tripId, meta: payload.meta, isDefaultTrip: isDefaultTrip, stats: stats }), _jsx(SaveBar, { onSave: handleSave, onReset: handleReset, onUndo: undo, onRedo: redo, onOpenSettings: () => setSettingsOpen(true), onOpenConflicts: () => setConflictsOpen(true), issueCount: issueCount, isSaving: isSaving, isSyncing: isSyncing, isReloading: isReloading, isDirty: isDirty, canUndo: canUndo, canRedo: canRedo, restoredFromLocalDraft: restoredFromLocalDraft, inlineMessage: inlineMessage }), _jsx("main", { className: "planner-layout", children: _jsx("div", { className: "planner-main-column", children: _jsx(PlannerBoard, { days: snapshot.days, dayColors: payload.config.dayColors, activeDay: activeDay, selectedSpotId: selectedSpotId, selectedSegmentId: selectedSegmentId, selectedSpotIds: selectedSpotIds, expectedDayCount: expectedDayCount, onSetActiveDay: setActiveDay, onSelectSpot: selectSpot, onToggleSpotSelection: toggleSpotSelection, onSelectSegment: selectSegment, onAddSpot: handleAddSpot, onQuickAddPlace: handleQuickAddPlace, onMoveSpot: moveSpot, onDuplicateDay: (day) => {
                            duplicateDay(day);
                            addToast('info', `已复制 Day ${day}`);
                        }, onClearDay: handleClearDay, onAutoSortDay: (day) => {
                            autoSortDay(day);
                            setInlineMessage(`Day ${day} 已按地图距离重新排序`);
                        }, onRenameSpot: (spotId, name) => {
                            updateSpot(spotId, { name });
                            if (typeof navigator !== 'undefined' && navigator.vibrate)
                                navigator.vibrate(8);
                        } }) }) }), _jsx(SpotInspectorSheet, { spot: selectedSpot, onClose: () => setSelectedSpotId(null), onUpdateSpot: updateSpot, onDeleteSpot: handleDeleteSpot }), _jsx(SegmentInspectorSheet, { segment: selectedSegment, spotById: snapshot.spotById, onClose: () => setSelectedSegmentId(null), onUpdateLeg: updateLeg, onResetLeg: resetLeg, onDeleteDetachedSegment: deleteDetachedSegment, onFocusSpot: selectSpot }), _jsx(BulkActionsToolbar, { selectedCount: selectedSpotIds.length, dayOptions: dayOptions, onMoveToDay: (day) => {
                    setBulkTargetDay(day);
                    moveSelectedToDay(selectedSpotIds, day);
                    setActiveDay(day);
                    setInlineMessage(`已移动 ${selectedSpotIds.length} 个景点到 Day ${day}`);
                }, onCopyToDay: (day) => {
                    copySelectedToDay(selectedSpotIds, day);
                    setInlineMessage(`已复制 ${selectedSpotIds.length} 个景点到 Day ${day}`);
                }, onSetMustVisit: (mustVisit) => setSelectedMustVisit(selectedSpotIds, mustVisit), onDelete: handleDeleteSelected, onClearSelection: () => setSelectedSpotIds([]) }), _jsx("button", { type: "button", className: "admin-fab-settings", onClick: () => setSettingsOpen(true), "aria-label": "\u6253\u5F00\u8BBE\u7F6E", title: "\u8BBE\u7F6E", children: _jsxs("svg", { viewBox: "0 0 20 20", width: "22", height: "22", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "10", cy: "10", r: "2.5", stroke: "currentColor", strokeWidth: "1.6" }), _jsx("path", { d: "M10 1.2v2.4M10 16.4v2.4M3.5 3.5l1.7 1.7M14.8 14.8l1.7 1.7M1.2 10h2.4M16.4 10h2.4M3.5 16.5l1.7-1.7M14.8 5.2l1.7-1.7", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" })] }) }), _jsx(AdminSettingsSheet, { isOpen: settingsOpen, onClose: () => setSettingsOpen(false), meta: payload.meta, isDefaultTrip: isDefaultTrip, onUpdateMeta: updateMeta, onReload: handleReload, onImport: handleImport, onExport: handleExport, onImportFromFile: handleImportFromFile, onAutoLocateSpots: handleAutoLocateSpots, isAutoLocating: isAutoLocating, missingLocationCount: payload.spots.filter((s) => !Number.isFinite(s.lat) || !Number.isFinite(s.lng)).length, isReloading: isReloading, isSaving: isSaving, isSyncing: isSyncing }), _jsx(ConflictsModal, { isOpen: conflictsOpen, onClose: () => setConflictsOpen(false), trip: payload, onSelectIssue: handleIssueSelect })] }));
}
