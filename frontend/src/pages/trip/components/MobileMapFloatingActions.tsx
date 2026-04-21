interface MobileMapFloatingActionsProps {
  /** 点击"回到行程初始视角"(config.center + defaultZoom) */
  onResetView: () => void;
  /** 点击"适配当前可见景点"(filter.day / mustOnly / city 命中的 spots 的 bounds) */
  onFitVisible: () => void;
  /** 点击"定位我"—— 调 geolocation 并让地图飞过去,lat/lng 拿不到时回调收到 null */
  onLocate: (coords: { lat: number; lng: number } | null) => void;
  /** 适配按钮是否禁用(当前没有可见景点时) */
  fitDisabled?: boolean;
}

/**
 * 手机端右侧垂直浮动按钮组(Google Maps / Apple Maps 风格):
 * - 圆形白色按钮,44x44 点击区,符合 iOS 触达标准
 * - 垂直堆叠,贴右侧 12px,离底部 Switcher 有 16px 安全间距
 * - 内含 3 个按钮:重置行程视角 / 适配可见 / 我的位置
 *
 * "图层"按钮暂未加,后续如果要切 底图(OSM vs 卫星图)或切 2D/3D,可以在这里补。
 * 定位失败(权限拒绝 / 不支持)时通过 onLocate(null) 通知上层,父级可以弹 toast。
 */
export function MobileMapFloatingActions({
  onResetView,
  onFitVisible,
  onLocate,
  fitDisabled = false,
}: MobileMapFloatingActionsProps) {
  const handleLocate = () => {
    if (!navigator.geolocation) {
      onLocate(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocate({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        onLocate(null);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  return (
    <div className="mobile-map-float-actions" role="toolbar" aria-label="地图操作">
      <button
        type="button"
        className="mobile-map-fab"
        onClick={onResetView}
        aria-label="回到行程初始视角"
        title="回到行程初始视角"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
          <path
            d="M4 4v6h6M20 20v-6h-6M20 10A8 8 0 0 0 6 5M4 14a8 8 0 0 0 14 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <button
        type="button"
        className="mobile-map-fab"
        onClick={onFitVisible}
        disabled={fitDisabled}
        aria-label="适配当前可见景点"
        title="适配当前可见景点"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
          <path
            d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <button
        type="button"
        className="mobile-map-fab mobile-map-fab-primary"
        onClick={handleLocate}
        aria-label="定位到我"
        title="定位到我"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="4"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M12 3v2M12 19v2M3 12h2M19 12h2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
