import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  exportCurrentToLocal,
  getTripFull,
  importLocalToCurrent,
  updateTripFull,
} from '../../api/trip-api';
import type { SpotItem, TripFullPayload, UpdateTripResult } from '../../types/trip';
import { normalizeTripForSave } from '../../utils/trip-normalize';
import type { TripIssue } from '../../utils/trip-analysis';
import { useBeforeUnload } from '../../hooks/useBeforeUnload';
import { AdminHeader } from './components/AdminHeader';
import { AdminToastStack, type AdminToast } from './components/AdminToastStack';
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

function sortDays(list: number[]): number[] {
  return Array.from(new Set(list.filter((item) => Number.isFinite(item) && item > 0))).sort((a, b) => a - b);
}

function buildSpotFromPlace(place: {
  id: string;
  day: number;
  name: string;
  lat: number;
  lng: number;
}): Partial<SpotItem> {
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
    mutationFn: (draft: TripFullPayload) => {
      const { payload, issues } = normalizeTripForSave(draft);
      if (issues.length > 0) {
        const lines = issues.map(
          (issue) => `- [${issue.kind} ${issue.id ?? `#${issue.index}`}] ${issue.field}: ${issue.message}`,
        );
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
    return (
      <div className="admin-shell">
        <div className="status-card panel">
          <strong id="status-text">正在加载行程数据...</strong>
        </div>
      </div>
    );
  }

  if (error || !initialData) {
    return (
      <div className="admin-shell">
        <div className="status-card panel is-error">
          <strong id="status-text">加载失败</strong>
          <p>{(error as Error | undefined)?.message || '未知错误'}</p>
          <button className="btn btn-primary" onClick={() => refetch()}>
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-bg">
      <AdminEditor
        tripId={tripId}
        isDefaultTrip={isDefaultTrip}
        initialData={initialData}
        isSaving={mutation.isPending}
        onSave={(payload) => mutation.mutateAsync(payload)}
        onImport={() => importMutation.mutateAsync()}
        onExport={() => exportMutation.mutateAsync()}
        onReload={async () => {
          const result = await refetch();
          if (result.error) throw result.error;
          if (!result.data) throw new Error('未拿到最新行程数据');
          return result.data;
        }}
        isSyncing={importMutation.isPending || exportMutation.isPending}
      />
    </div>
  );
}

interface AdminEditorProps {
  tripId: string;
  isDefaultTrip: boolean;
  initialData: TripFullPayload;
  isSaving: boolean;
  onSave: (payload: TripFullPayload) => Promise<UpdateTripResult>;
  onImport: () => Promise<UpdateTripResult>;
  onExport: () => Promise<{ ok: boolean; path: string }>;
  onReload: () => Promise<TripFullPayload>;
  isSyncing: boolean;
}

function AdminEditor({
  tripId,
  isDefaultTrip,
  initialData,
  isSaving,
  onSave,
  onImport,
  onExport,
  onReload,
  isSyncing,
}: AdminEditorProps) {
  const [isReloading, setIsReloading] = useState(false);
  const [savedPayload, setSavedPayload] = useState(initialData);
  const [activeDay, setActiveDay] = useState<number>(() => initialData.spots[0]?.day || 1);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedSpotIds, setSelectedSpotIds] = useState<string[]>([]);
  const [isMapAddMode, setIsMapAddMode] = useState(false);
  const [bulkTargetDay, setBulkTargetDay] = useState<number>(() => initialData.spots[0]?.day || 1);
  const [bulkTag, setBulkTag] = useState('');
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<AdminToast[]>([]);

  const {
    snapshot,
    payload,
    isDirty,
    canUndo,
    canRedo,
    restoredFromLocalDraft,
    updateMeta,
    addSpot,
    addSpots,
    updateSpot,
    deleteSpot,
    moveSpot,
    duplicateDay,
    clearDay,
    autoSortDay,
    updateLeg,
    resetLeg,
    deleteDetachedSegment,
    moveSelectedToDay,
    copySelectedToDay,
    setSelectedMustVisit,
    appendTagToSelected,
    deleteSelected,
    undo,
    redo,
    resetFromPayload,
    acknowledgeSavedPayload,
  } = useTripPlannerEditor(initialData, tripId);

  useBeforeUnload(isDirty);

  const addToast = useCallback((tone: AdminToast['tone'], title: string, detail?: string) => {
    const nextToast: AdminToast = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tone,
      title,
      detail,
    };
    setToasts((current) => [...current, nextToast]);
  }, []);

  useEffect(() => {
    if (!toasts.length) return undefined;
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
    if (isDirty) return;
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

  const dayOptions = useMemo(
    () => sortDays([...snapshot.dayNumbers, activeDay, bulkTargetDay]),
    [activeDay, bulkTargetDay, snapshot.dayNumbers],
  );

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

  const selectSpot = useCallback((spotId: string) => {
    setSelectedSpotId(spotId);
    setSelectedSegmentId(null);
    const spot = snapshot.spotById.get(spotId);
    if (spot?.day) {
      setActiveDay(spot.day);
    }
  }, [snapshot.spotById]);

  const selectSegment = useCallback((segmentId: string) => {
    setSelectedSegmentId(segmentId);
    setSelectedSpotId(null);
    const segment = snapshot.segmentById.get(segmentId);
    if (segment?.day) {
      setActiveDay(segment.day);
    }
  }, [snapshot.segmentById]);

  const toggleSpotSelection = (spotId: string, checked: boolean) => {
    setSelectedSpotIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, spotId]));
      }
      return current.filter((id) => id !== spotId);
    });
  };

  const handleAddSpot = (day: number, index?: number, partial?: Partial<SpotItem>) => {
    const id = partial?.id || createClientSpotId();
    addSpot(day, { ...partial, id }, index);
    selectSpot(id);
    setInlineMessage(`已在 Day ${day} 新增景点`);
  };

  const handleMapAddSpot = (lat: number, lng: number) => {
    handleAddSpot(activeDay, undefined, {
      name: `Day ${activeDay} 新景点`,
      lat,
      lng,
      day: activeDay,
    });
    addToast('info', '已从地图新增景点', '你可以继续拖动 marker 微调位置。');
  };

  const handleQuickAddPlace = (place: {
    name: string;
    lat: number;
    lng: number;
  }) => {
    const id = createClientSpotId();
    handleAddSpot(activeDay, undefined, buildSpotFromPlace({ ...place, id, day: activeDay }));
  };

  const handleDeleteSpot = (spotId: string) => {
    const spot = snapshot.spotById.get(spotId);
    const confirmed = window.confirm(`删除景点“${spot?.name || spotId}”后不可恢复，继续吗？`);
    if (!confirmed) return;
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
    } catch (error) {
      addToast('error', '保存失败', (error as Error).message);
    }
  };

  const handleReset = () => {
    if (!isDirty) return;
    const confirmed = window.confirm('重置会丢弃当前未保存修改，继续吗？');
    if (!confirmed) return;
    resetFromPayload(savedPayload);
    setSelectedSpotIds([]);
    setSelectedSpotId(null);
    setSelectedSegmentId(null);
    setInlineMessage('已恢复到最近一次保存状态');
  };

  const handleReload = async () => {
    if (isDirty) {
      const confirmed = window.confirm('重载后会丢弃当前未保存修改，继续吗？');
      if (!confirmed) return;
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
    } catch (error) {
      addToast('error', '重载失败', (error as Error).message);
    } finally {
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
    } catch (error) {
      addToast('error', '导入失败', (error as Error).message);
    }
  };

  const handleExport = async () => {
    try {
      const result = await onExport();
      addToast('success', '导出成功', result.path);
    } catch (error) {
      addToast('error', '导出失败', (error as Error).message);
    }
  };

  const handleIssueSelect = (issue: TripIssue) => {
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
    if (!selectedSpotIds.length) return;
    moveSelectedToDay(selectedSpotIds, bulkTargetDay);
    setActiveDay(bulkTargetDay);
    setInlineMessage(`已把 ${selectedSpotIds.length} 个景点移动到 Day ${bulkTargetDay}`);
  };

  const handleCopySelected = () => {
    if (!selectedSpotIds.length) return;
    copySelectedToDay(selectedSpotIds, bulkTargetDay);
    setInlineMessage(`已复制 ${selectedSpotIds.length} 个景点到 Day ${bulkTargetDay}`);
  };

  const handleDeleteSelected = () => {
    if (!selectedSpotIds.length) return;
    const confirmed = window.confirm(`删除选中的 ${selectedSpotIds.length} 个景点吗？`);
    if (!confirmed) return;
    deleteSelected(selectedSpotIds);
    setSelectedSpotIds([]);
    setSelectedSpotId(null);
    addToast('warning', '已删除选中景点');
  };

  const handleAppendTag = () => {
    const tag = bulkTag.trim();
    if (!tag || !selectedSpotIds.length) return;
    appendTagToSelected(selectedSpotIds, tag);
    setBulkTag('');
    setInlineMessage(`已为 ${selectedSpotIds.length} 个景点追加标签 ${tag}`);
  };

  const handleClearDay = (day: number) => {
    const confirmed = window.confirm(`清空 Day ${day} 的全部景点吗？`);
    if (!confirmed) return;
    clearDay(day);
    if (activeDay === day) {
      setSelectedSpotId(null);
      setSelectedSegmentId(null);
    }
    setSelectedSpotIds((current) => current.filter((id) => snapshot.spotById.get(id)?.day !== day));
    addToast('warning', `Day ${day} 已清空`);
  };

  return (
    <div className="admin-shell">
      <AdminToastStack items={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />

      <AdminHeader
        title={payload.meta.title || ''}
        tripId={tripId}
        meta={payload.meta}
        isDefaultTrip={isDefaultTrip}
        stats={stats}
      />

      <SaveBar
        onSave={handleSave}
        onReset={handleReset}
        onReload={handleReload}
        onImport={handleImport}
        onExport={handleExport}
        onUndo={undo}
        onRedo={redo}
        isSaving={isSaving}
        isSyncing={isSyncing}
        isReloading={isReloading}
        isDirty={isDirty}
        isDefaultTrip={isDefaultTrip}
        canUndo={canUndo}
        canRedo={canRedo}
        restoredFromLocalDraft={restoredFromLocalDraft}
        inlineMessage={inlineMessage}
      />

      <TripAnalysisReport trip={payload} onSelectIssue={handleIssueSelect} />

      <section className="panel planner-toolbar-panel">
        <div className="planner-toolbar-section">
          <div>
            <p className="panel-kicker">Quick Add</p>
            <h2>搜索后直接加入 Day {activeDay}</h2>
          </div>
          <PlaceSearchAutocomplete
            onSelect={handleQuickAddPlace}
            placeholder="搜索地点并追加到当前天..."
          />
        </div>

        <div className="planner-toolbar-section planner-bulk-toolbar">
          <div>
            <p className="panel-kicker">Bulk Actions</p>
            <h2>批量处理已勾选景点</h2>
          </div>
          <div className="planner-bulk-actions">
            <span className="planner-bulk-count">{selectedSpotIds.length} 个已选中</span>
            <label className="field planner-inline-field">
              <span>目标 Day</span>
              <select value={bulkTargetDay} onChange={(event) => setBulkTargetDay(Number(event.target.value))}>
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    Day {day}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-ghost" onClick={handleMoveSelected} disabled={!selectedSpotIds.length}>
              移动到目标天
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleCopySelected} disabled={!selectedSpotIds.length}>
              复制到目标天
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSelectedMustVisit(selectedSpotIds, true)}
              disabled={!selectedSpotIds.length}
            >
              设为必去
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSelectedMustVisit(selectedSpotIds, false)}
              disabled={!selectedSpotIds.length}
            >
              取消必去
            </button>
            <input
              className="planner-inline-input"
              type="text"
              value={bulkTag}
              onChange={(event) => setBulkTag(event.target.value)}
              placeholder="批量追加标签"
            />
            <button type="button" className="btn btn-ghost" onClick={handleAppendTag} disabled={!selectedSpotIds.length || !bulkTag.trim()}>
              追加标签
            </button>
            <button type="button" className="btn btn-ghost btn-danger" onClick={handleDeleteSelected} disabled={!selectedSpotIds.length}>
              删除选中
            </button>
          </div>
        </div>
      </section>

      <main className="planner-layout">
        <div className="planner-main-column">
          <PlannerBoard
            days={snapshot.days}
            dayColors={payload.config.dayColors}
            activeDay={activeDay}
            selectedSpotId={selectedSpotId}
            selectedSegmentId={selectedSegmentId}
            selectedSpotIds={selectedSpotIds}
            onSetActiveDay={setActiveDay}
            onSelectSpot={selectSpot}
            onToggleSpotSelection={toggleSpotSelection}
            onSelectSegment={selectSegment}
            onAddSpot={handleAddSpot}
            onMoveSpot={moveSpot}
            onDuplicateDay={(day) => {
              duplicateDay(day);
              addToast('info', `已复制 Day ${day}`);
            }}
            onClearDay={handleClearDay}
            onAutoSortDay={(day) => {
              autoSortDay(day);
              setInlineMessage(`Day ${day} 已按地图距离重新排序`);
            }}
          />

          <AdminTripMap
            config={payload.config}
            days={snapshot.days}
            selectedSpotId={selectedSpotId}
            selectedSegmentId={selectedSegmentId}
            activeDay={activeDay}
            isAddMode={isMapAddMode}
            onToggleAddMode={() => setIsMapAddMode((value) => !value)}
            onSelectSpot={selectSpot}
            onSelectSegment={selectSegment}
            onAddSpotAtPoint={handleMapAddSpot}
            onUpdateSpotPosition={(spotId, lat, lng) => updateSpot(spotId, { lat, lng })}
          />
        </div>

        <PlannerInspector
          meta={payload.meta}
          spots={payload.spots}
          selectedSpot={selectedSpot}
          selectedSegment={selectedSegment}
          spotById={snapshot.spotById}
          onUpdateMeta={updateMeta}
          onUpdateSpot={updateSpot}
          onDeleteSpot={handleDeleteSpot}
          onUpdateLeg={updateLeg}
          onResetLeg={resetLeg}
          onDeleteDetachedSegment={deleteDetachedSegment}
          onFocusSpot={selectSpot}
          onAddImportedSpots={(spots) => {
            addSpots(spots);
            if (spots[0]?.day) {
              setActiveDay(spots[0].day);
            }
            addToast('success', '批量导入完成', `已加入 ${spots.length} 个景点`);
          }}
        />
      </main>
    </div>
  );
}
