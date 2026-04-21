import { useEffect } from 'react';

/**
 * 当 isDirty === true 时,拦截浏览器关闭 / 刷新 / 关标签页。
 * 对齐旧版 `legacy/old-frontend/admin.js` L1277-1283 的 beforeunload 行为。
 *
 * 注意:
 * - 现代浏览器只要 preventDefault + returnValue = '' 就会弹原生确认框,
 *   确认文案由浏览器决定,无法自定义。
 * - React Router 的 SPA 路由跳转触发不了 beforeunload;
 *   那种场景需要 useBlocker(v6.4+),本 hook 不处理。
 */
export function useBeforeUnload(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
    };
  }, [isDirty]);
}
