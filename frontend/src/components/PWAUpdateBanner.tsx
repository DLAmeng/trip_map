import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * P27: PWA 更新提示
 *
 * 工作流:
 * 1. App 启动时调 useRegisterSW 注册 SW(替代之前 registerSW.js 的简单 register)
 * 2. onRegisteredSW 拿到 registration,设置定时 update(每 30 分钟后台 fetch 一次 sw.js)
 * 3. 检测到新 SW 时 needRefresh → true,显示底部 banner
 * 4. 用户点「立即刷新」→ updateServiceWorker(true) 强制激活新 SW + reload
 * 5. 用户点「稍后」→ 关闭 banner,SW 等用户下次 reload 时自动激活
 *
 * 为什么是 prompt 模式而不是 autoUpdate:
 * - autoUpdate 默认装新 SW 后不强制 reload,React app 继续用旧资源 → 用户看不到改动
 * - 自动 reload 又会丢 admin 未保存编辑(isDirty 状态)
 * - prompt 让用户决定何时刷新最安全
 */
export function PWAUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // 每 30 分钟后台检查一次 sw.js 是否更新(用户不会一直打开页面,
      // 但保留这一层兜底,长时间停留用户也能看到更新提示)
      if (registration) {
        const HOUR_HALF = 30 * 60 * 1000;
        setInterval(() => {
          registration.update().catch(() => {
            // 网络错误或 sw.js 没变,静默忽略
          });
        }, HOUR_HALF);
      }
    },
    onRegisterError(err) {
      // SW 注册失败(比如 https 证书问题、文件 404)— dev 模式或本地访问可能
      console.warn('[PWA] SW register error:', err);
    },
  });

  // dev 模式短路 — VitePWA 的 devOptions.enabled = false,理论上 SW 不会注册,
  // 这里 useRegisterSW 仍会被调用但 needRefresh 永远 false
  useEffect(() => {
    if (needRefresh) {
      console.info('[PWA] 检测到新版本可用,提示用户刷新');
    }
  }, [needRefresh]);

  if (!needRefresh) return null;

  return (
    <div className="pwa-update-banner" role="status" aria-live="polite">
      <span className="pwa-update-banner-icon" aria-hidden="true">🚀</span>
      <span className="pwa-update-banner-text">有新版本可用</span>
      <div className="pwa-update-banner-actions">
        <button
          type="button"
          className="pwa-update-banner-btn pwa-update-banner-btn-primary"
          onClick={() => updateServiceWorker(true)}
        >
          立即刷新
        </button>
        <button
          type="button"
          className="pwa-update-banner-btn pwa-update-banner-btn-ghost"
          onClick={() => setNeedRefresh(false)}
        >
          稍后
        </button>
      </div>
    </div>
  );
}
