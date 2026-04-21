import { QueryClient } from '@tanstack/react-query';
/**
 * 全局 TanStack Query client。
 * Phase 1 只做占位配置:失败重试一次、窗口聚焦不自动刷新、数据 30s 内视为新鲜。
 * Phase 2/3/4 迁移具体页面时再按需调整 per-query。
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
        },
    },
});
