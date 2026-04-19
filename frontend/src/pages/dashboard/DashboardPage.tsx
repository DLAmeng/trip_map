import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listTrips } from '../../api/trip-api';
import type { TripListItem } from '../../types/trip';
import { filterAndSort, type SortBy } from '../../utils/format';
import { Toast } from '../../components/Toast';
import {
  useDeleteTripMutation,
  useDuplicateTripMutation,
} from '../../hooks/useTripMutations';
import { CreateTripDialog, type CreateTripDialogHandle } from './CreateTripDialog';
import { TripCard } from './TripCard';
import './dashboard.css';

interface ToastState {
  message: string;
  tone: 'default' | 'error';
}

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
  const [sortBy, setSortBy] = useState<SortBy>('updated');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dialogRef = useRef<CreateTripDialogHandle>(null);

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

  const showToast = (message: string, tone: 'default' | 'error' = 'default') => {
    setToast({ message, tone });
  };

  const handleDuplicate = (trip: TripListItem) => {
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

  const handleDelete = (trip: TripListItem) => {
    const confirmed = window.confirm(
      `确定删除「${trip.name || trip.id}」这个行程吗?此操作不可恢复。`,
    );
    if (!confirmed) return;
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
    } else {
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

  return (
    <div className="dash-shell">
      <header className="dash-header">
        <div className="dash-header-copy">
          <span className="eyebrow">Trip Map</span>
          <h1>我的旅行计划</h1>
          <p className="dash-subtitle">
            {isError ? '加载失败' : subtitle}
          </p>
        </div>
        <div className="dash-header-actions">
          <button
            type="button"
            className="secondary-btn"
            title="基于默认日本行程快速复制一份可编辑的副本"
            disabled={duplicatingId === 'current'}
            onClick={handleDuplicateCurrent}
          >
            <span aria-hidden="true">⎘</span> 复制默认行程
          </button>
          <button type="button" className="primary-btn" onClick={openCreate}>
            ＋ 新建行程
          </button>
        </div>
      </header>

      <section className="dash-toolbar" aria-label="筛选行程">
        <label className="dash-search">
          <span className="sr-only">搜索行程</span>
          <input
            type="search"
            placeholder="按名称、目的地、描述搜索..."
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="dash-sort">
          <span className="dash-sort-label">排序</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
          >
            <option value="updated">最近更新</option>
            <option value="name">名称 A→Z</option>
            <option value="spots">景点数量</option>
            <option value="created">创建时间</option>
          </select>
        </label>
        <div className="dash-result-count" aria-live="polite">
          {resultCountText}
        </div>
      </section>

      <main className="dash-main">
        {isLoading ? (
          <div className="empty-state compact">
            <p>加载中...</p>
          </div>
        ) : isError ? (
          <div className="empty-state compact">
            <p>无法加载行程列表:{(error as Error).message}</p>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? '重试中...' : '重试'}
            </button>
          </div>
        ) : total === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden="true">
              🧭
            </div>
            <h2>开启你的第一段旅程</h2>
            <p>收集景点、勾画路线、离线带走地图。一切从这里开始。</p>
            <div className="empty-state-actions">
              <button type="button" className="primary-btn" onClick={openCreate}>
                创建新行程
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={handleDuplicateCurrent}
                disabled={duplicatingId === 'current'}
              >
                复制默认日本行程作为模板
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state compact">
            <p>没有匹配的行程,换个关键字试试。</p>
          </div>
        ) : (
          <div className="trip-grid" aria-live="polite">
            {filtered.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                duplicating={duplicatingId === trip.id}
                deleting={deletingId === trip.id}
              />
            ))}
          </div>
        )}
      </main>

      <CreateTripDialog ref={dialogRef} />

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
