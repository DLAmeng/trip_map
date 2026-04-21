import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTripFull,
  updateTripFull,
  importLocalToCurrent,
  exportCurrentToLocal,
} from '../../api/trip-api';
import { normalizeTripForSave } from '../../utils/trip-normalize';
import type { TripFullPayload } from '../../types/trip';
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
    mutationFn: (draft: TripFullPayload) => {
      // 保存前统一 normalize:对齐旧版 admin.js normalizeTripForSave,
      // 避免 UI 里残留的空格 / 字符串型数字 / 脏 tags 写进数据库
      const { payload, issues } = normalizeTripForSave(draft);
      if (issues.length > 0) {
        const lines = issues.map(
          (i) => `  - [${i.kind} ${i.id ?? `#${i.index}`}] ${i.field}: ${i.message}`,
        );
        throw new Error(`有 ${issues.length} 处字段格式异常:\n${lines.join('\n')}`);
      }
      return updateTripFull(tripId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', 'full', tripId] });
      alert('保存成功！');
    },
    onError: (err: any) => {
      alert(`保存失败: ${err.message}`);
    },
  });

  const importMutation = useMutation({
    mutationFn: importLocalToCurrent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', 'full', tripId] });
      alert('已从本地 JSON 导入成功');
    },
    onError: (err: any) => alert('导入失败: ' + err.message),
  });

  const exportMutation = useMutation({
    mutationFn: exportCurrentToLocal,
    onSuccess: () => alert('已成功导出到本地 itinerary.json'),
    onError: (err: any) => alert('导出失败: ' + err.message),
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
          <p>{(error as any)?.message || '未知错误'}</p>
          <button className="btn btn-primary" onClick={() => refetch()}>重试</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-bg">
      <AdminEditor
        tripId={tripId}
        initialData={initialData}
        isSaving={mutation.isPending}
        onSave={(payload) => mutation.mutate(payload)}
        onImport={() => importMutation.mutate()}
        onExport={() => exportMutation.mutate()}
        isSyncing={importMutation.isPending || exportMutation.isPending}
      />
    </div>
  );
}

interface AdminEditorProps {
  tripId: string;
  initialData: TripFullPayload;
  isSaving: boolean;
  onSave: (payload: TripFullPayload) => void;
  onImport: () => void;
  onExport: () => void;
  isSyncing: boolean;
}

function AdminEditor({
  tripId,
  initialData,
  isSaving,
  onSave,
  onImport,
  onExport,
  isSyncing,
}: AdminEditorProps) {
  const {
    draft,
    updateMeta,
    updateSpot,
    addSpot,
    addSpots,
    insertAfterSpot,
    deleteSpot,
    updateSegment,
    addSegment,
    deleteSegment,
    reorderSpots,
    reorderSegments,
    sortSpotsByDayOrder,
    sortSegmentsByDay,
    reset,
  } = useTripEditor(initialData);

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

  return (
    <div className="admin-shell">
      <AdminHeader title={draft.meta.title || ''} tripId={tripId} stats={stats} />

      <main className="editor-layout">
        <TripAnalysisReport trip={draft} />

        <TripMetaForm meta={draft.meta} onChange={updateMeta} />

        <SpotListEditor
          spots={draft.spots}
          onUpdateSpot={updateSpot}
          onDeleteSpot={deleteSpot}
          onAddSpot={addSpot}
          onReorderSpots={reorderSpots}
          onInsertAfterSpot={insertAfterSpot}
          onSortByDayOrder={sortSpotsByDayOrder}
        />

        <SegmentListEditor
          segments={draft.routeSegments}
          spots={draft.spots}
          onUpdateSegment={updateSegment}
          onDeleteSegment={deleteSegment}
          onAddSegment={addSegment}
          onReorderSegments={reorderSegments}
          onSortByDay={sortSegmentsByDay}
        />

        <BatchImportPanel spots={draft.spots} onAddSpots={addSpots} />
      </main>

      <SaveBar
        onSave={() => onSave(draft)}
        onReset={() => reset(initialData)}
        onImport={onImport}
        onExport={onExport}
        isSaving={isSaving}
        isSyncing={isSyncing}
        isDirty={isDirty}
      />
    </div>
  );
}
