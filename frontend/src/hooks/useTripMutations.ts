import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createTrip, deleteTrip, duplicateTrip } from '../api/trip-api';
import type { CreateTripBody, CreateTripResult } from '../types/trip';

/**
 * 集中封装 Dashboard(后续也会被 Trip/Admin 复用)会用到的三个 mutation。
 * 约定:
 *   - 所有成功路径 invalidate ['trips'] 让列表刷新
 *   - 导航由 mutation 统一负责,避免散落在 onSuccess 里
 *   - 错误不在 hook 内吞掉,交给调用方决定展示方式(toast / dialog 内红字)
 */

export function useCreateTripMutation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation<CreateTripResult, Error, CreateTripBody>({
    mutationFn: (body) => createTrip(body),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      navigate(`/trip?id=${encodeURIComponent(result.trip.id)}`);
    },
  });
}

export function useDuplicateTripMutation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation<CreateTripResult, Error, string>({
    mutationFn: (sourceId) => duplicateTrip(sourceId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      navigate(`/admin?id=${encodeURIComponent(result.trip.id)}`);
    },
  });
}

export function useDeleteTripMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) => deleteTrip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
