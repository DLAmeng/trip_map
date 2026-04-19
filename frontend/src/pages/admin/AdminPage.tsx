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
    mutationFn: (payload: any) => updateTripFull(tripId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip', 'full', tripId] });
      alert('保存成功！');
    },
    onError: (err: any) => {
      alert(`保存失败: ${err.message}`);
    },
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
        <div className="status-card panel" style={{ borderColor: '#ff4d4f' }}>
          <strong id="status-text" style={{ color: '#ff4d4f' }}>加载失败</strong>
          <p>{(error as any)?.message || '未知错误'}</p>
          <button className="btn btn-primary" onClick={() => refetch()}>重试</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-bg">
      <AdminEditor tripId={tripId} initialData={initialData} isSaving={mutation.isPending} onSave={(payload) => mutation.mutate(payload)} />
    </div>
  );
}

interface AdminEditorProps {
  tripId: string;
  initialData: any;
  isSaving: boolean;
  onSave: (payload: any) => void;
}

function AdminEditor({ tripId, initialData, isSaving, onSave }: AdminEditorProps) {
  const {
    draft,
    updateMeta,
    updateSpot,
    addSpot,
    deleteSpot,
    updateSegment,
    addSegment,
    deleteSegment,
    reset
  } = useTripEditor(initialData);

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

  return (
    <div className="admin-shell">
      <AdminHeader title={draft.meta.title || ''} tripId={tripId} stats={stats} />

      <main className="editor-layout">
        <TripMetaForm meta={draft.meta} onChange={updateMeta} />

        <SpotListEditor
          spots={draft.spots}
          onUpdateSpot={updateSpot}
          onDeleteSpot={deleteSpot}
          onAddSpot={addSpot}
        />

        <SegmentListEditor
          segments={draft.routeSegments}
          spots={draft.spots}
          onUpdateSegment={updateSegment}
          onDeleteSegment={deleteSegment}
          onAddSegment={addSegment}
        />
      </main>

      <SaveBar
        onSave={() => onSave(draft)}
        onReset={() => reset(initialData)}
        isSaving={isSaving}
        isDirty={isDirty}
      />
    </div>
  );
}
