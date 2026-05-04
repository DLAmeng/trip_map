import { useEffect, useState } from 'react';
import { importLibrary } from '../../../map-adapter/google/loader';

interface DaySpotSummary {
  id: string;
  name: string;
}

interface ExternalPoiCardProps {
  /** Google Places placeId,组件内部用它 fetch 详情 */
  placeId: string;
  /** 关闭卡片回调(用户点 × 或外层 setActivePoi(null)) */
  onClose: () => void;
  /**
   * "+ 加入行程" 用户最终确认后回调,带上详情 + 选好的 day + insertIndex。
   * 上层(TripPage) navigate 到 admin 页 + URL 预填这些参数。
   * 不传则不显示该按钮。
   */
  onAddToTrip?: (data: {
    placeId: string;
    name: string;
    address: string;
    /** 用户选的目标 day */
    day: number;
    /**
     * 插入位置索引(在该 day 的 spots 数组里):
     *   0 = 加到开头,n = 加到末尾(n 等于现有 spots 长度)
     *   undefined 也表示末尾(简化语义)
     */
    insertIndex?: number;
  }) => void;
  /** 行程现有的 day 编号(1-based,如 [1,2,3,...,12]),用户从中选 day */
  dayNumbers?: number[];
  /** 每个 day 的现有 spots(按 order 排好),用户能选"在 X 之前/末尾"的位置 */
  spotsByDay?: Map<number, DaySpotSummary[]>;
  /** 默认选中的 day(优先用 trip 当前 filter.day,fallback 第一个 day) */
  defaultDay?: number;
}

interface PoiDetails {
  name: string;
  address: string;
  rating: number | null;
  userRatingCount: number | null;
  photoUrl: string | null;
  websiteUri: string | null;
  googleMapsUri: string | null;
}

type Mode = 'detail' | 'select';

/**
 * 自渲染的 Google POI 详情卡 — 替代 Google Maps 自带 InfoWindow,
 * 由我们控制位置和样式,避让 mobile bottom switcher / fab 等浮层按钮。
 *
 * 两阶段交互:
 *   1. mode='detail'(默认):显示照片 / 名称 / 评分 / 地址 + Google 地图/官网/+加入行程
 *   2. 点 "+ 加入行程" → mode='select':替换内容为
 *      - Day chips 横向滚动(D1 D2 ...)
 *      - 该 day 的现有 spots 列表(加到开头 / 在 X 之前 / 加到末尾)
 *      - [取消] [确认]
 *      用户选好后调 onAddToTrip(data + day + insertIndex)
 */
export function ExternalPoiCard({
  placeId,
  onClose,
  onAddToTrip,
  dayNumbers = [],
  spotsByDay,
  defaultDay,
}: ExternalPoiCardProps) {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<PoiDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('detail');
  const [selectedDay, setSelectedDay] = useState<number>(
    defaultDay ?? dayNumbers[0] ?? 1,
  );
  /** 插入位置:undefined 表示末尾,数字表示插到该 index 之前(0-based) */
  const [selectedInsertIndex, setSelectedInsertIndex] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetails(null);
    setError(null);
    setMode('detail');

    (async () => {
      try {
        const { Place } = (await importLibrary('places')) as any;
        const place = new Place({ id: placeId });
        await place.fetchFields({
          fields: [
            'displayName',
            'formattedAddress',
            'rating',
            'userRatingCount',
            'photos',
            'websiteURI',
            'googleMapsURI',
          ],
        });
        if (cancelled) return;

        const photoUrl = place.photos?.[0]?.getURI({ maxWidth: 480, maxHeight: 320 }) ?? null;
        setDetails({
          name: place.displayName ?? '未命名地点',
          address: place.formattedAddress ?? '',
          rating: typeof place.rating === 'number' ? place.rating : null,
          userRatingCount:
            typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
          photoUrl,
          websiteUri: place.websiteURI ?? null,
          googleMapsUri: place.googleMapsURI ?? null,
        });
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.warn('[ExternalPoiCard] fetch place failed:', err);
        setError((err as Error).message || '无法加载地点详情');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [placeId]);

  // 切换 day 时重置 insertIndex(避免索引越界)
  useEffect(() => {
    setSelectedInsertIndex(undefined);
  }, [selectedDay]);

  const currentDaySpots = spotsByDay?.get(selectedDay) ?? [];

  const handleEnterSelect = () => {
    setMode('select');
  };

  const handleConfirmAdd = () => {
    if (!details || !onAddToTrip) return;
    onAddToTrip({
      placeId,
      name: details.name,
      address: details.address,
      day: selectedDay,
      insertIndex: selectedInsertIndex,
    });
  };

  return (
    <div className="external-poi-card" role="dialog" aria-label="地点详情">
      <button
        type="button"
        className="external-poi-close"
        onClick={onClose}
        aria-label="关闭详情"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {loading ? (
        <div className="external-poi-body external-poi-loading">
          <div className="external-poi-skeleton-line" style={{ width: '60%' }} />
          <div className="external-poi-skeleton-line" style={{ width: '90%' }} />
          <div className="external-poi-skeleton-line" style={{ width: '40%' }} />
        </div>
      ) : error ? (
        <div className="external-poi-body external-poi-error">
          <p className="external-poi-error-msg">{error}</p>
        </div>
      ) : details ? (
        <>
          {details.photoUrl && mode === 'detail' ? (
            <div
              className="external-poi-photo"
              style={{ backgroundImage: `url("${details.photoUrl}")` }}
              aria-hidden="true"
            />
          ) : null}
          <div className="external-poi-body">
            {mode === 'detail' ? (
              <>
                <div className="external-poi-name">{details.name}</div>
                {details.rating != null ? (
                  <div className="external-poi-rating">
                    <span className="external-poi-star" aria-hidden="true">★</span>
                    <span className="external-poi-rating-value">{details.rating.toFixed(1)}</span>
                    {details.userRatingCount != null ? (
                      <span className="external-poi-rating-count">({details.userRatingCount})</span>
                    ) : null}
                  </div>
                ) : null}
                {details.address ? (
                  <div className="external-poi-address">{details.address}</div>
                ) : null}
                {/* 主操作:加入行程(primary) — 进入 select 模式 */}
                {onAddToTrip ? (
                  <div className="external-poi-actions">
                    <button
                      type="button"
                      className="external-poi-action external-poi-action-primary"
                      onClick={handleEnterSelect}
                    >
                      ＋ 加入行程
                    </button>
                  </div>
                ) : null}
                {/* 次操作:在 Google 地图打开 / 官方网站 */}
                {(details.googleMapsUri || details.websiteUri) ? (
                  <div className="external-poi-actions">
                    {details.googleMapsUri ? (
                      <a
                        className="external-poi-action external-poi-action-secondary"
                        href={details.googleMapsUri}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Google 地图
                      </a>
                    ) : null}
                    {details.websiteUri ? (
                      <a
                        className="external-poi-action external-poi-action-secondary"
                        href={details.websiteUri}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        官方网站
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              // mode === 'select':选 day + position
              <>
                <div className="external-poi-select-title">
                  加入到行程
                </div>
                <div className="external-poi-select-eyebrow">
                  正在添加 <strong>{details.name}</strong>
                </div>

                {/* Day 选择(横向滚动 chips) */}
                <div className="external-poi-select-section">
                  <div className="external-poi-select-label">选择天数</div>
                  <div className="external-poi-day-chips">
                    {dayNumbers.length > 0 ? (
                      dayNumbers.map((day) => (
                        <button
                          key={day}
                          type="button"
                          className={`external-poi-day-chip${
                            day === selectedDay ? ' is-active' : ''
                          }`}
                          onClick={() => setSelectedDay(day)}
                        >
                          D{day}
                        </button>
                      ))
                    ) : (
                      <span className="external-poi-day-empty">暂无天数</span>
                    )}
                  </div>
                </div>

                {/* Position 选择 — radio 列表 */}
                <div className="external-poi-select-section">
                  <div className="external-poi-select-label">选择位置</div>
                  <div className="external-poi-position-list">
                    <label className="external-poi-position-row">
                      <input
                        type="radio"
                        name="poi-position"
                        checked={selectedInsertIndex === 0}
                        onChange={() => setSelectedInsertIndex(0)}
                      />
                      <span>加到开头</span>
                    </label>
                    {currentDaySpots.map((spot, idx) => (
                      <label key={spot.id} className="external-poi-position-row">
                        <input
                          type="radio"
                          name="poi-position"
                          checked={selectedInsertIndex === idx + 1}
                          onChange={() => setSelectedInsertIndex(idx + 1)}
                        />
                        <span>
                          在 <strong>{spot.name}</strong> 之后
                        </span>
                      </label>
                    ))}
                    <label className="external-poi-position-row">
                      <input
                        type="radio"
                        name="poi-position"
                        checked={selectedInsertIndex === undefined}
                        onChange={() => setSelectedInsertIndex(undefined)}
                      />
                      <span>加到末尾(默认)</span>
                    </label>
                  </div>
                </div>

                {/* Action: 取消 / 确认 */}
                <div className="external-poi-actions external-poi-select-actions">
                  <button
                    type="button"
                    className="external-poi-action external-poi-action-secondary"
                    onClick={() => setMode('detail')}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="external-poi-action external-poi-action-primary"
                    onClick={handleConfirmAdd}
                    disabled={dayNumbers.length === 0}
                  >
                    确认加入
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
