import { useEffect, useState } from 'react';

/**
 * 基于 `matchMedia` 的断点 hook。默认 1024px 对齐"地图 App 布局"断点:
 * - iPhone 13 (390) / 14 Pro Max (430) / Pixel 7 (412) 都命中 true
 * - iPad portrait (768x1024) / iPad mini 都命中 true —— 走沉浸地图布局
 * - iPad landscape (1024x768+) 及桌面浏览器走完整桌面(站顶 header + 右边栏)
 *
 * 用 matchMedia 的 change 事件而非 resize,避免旋转 / 键盘弹出时被误触发。
 * SSR 安全:window 不存在时初始返回 false(按桌面降级)。
 */
export function useIsMobile(query = '(max-width: 1024px)'): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
