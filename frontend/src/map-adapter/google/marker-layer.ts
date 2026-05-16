import { MarkerClusterer, type Cluster, type Renderer } from '@googlemaps/markerclusterer';
import type { SpotItem } from '../../types/trip';
import type { MarkerLayer } from '../types';
import { buildSpotPopupElement } from '../shared/popup-builder';
import { debugTripMapEvent } from '../debug';
import { SPOT_TYPE_META, coerceSpotType } from '../../constants/spot-types';

interface GoogleMarkerRef {
  marker: google.maps.marker.AdvancedMarkerElement;
  infoWindow: google.maps.InfoWindow;
  spotId: string;
  spot: SpotItem;
  popupContent: HTMLElement;
  /** 该景点在所属 day 内的 1-based 顺序,marker 内显示的 glyph */
  dayIndex: number;
}

export function createGoogleMarkerLayer(config: {
  dayColors: string[];
  onSpotClick?: (id: string) => void;
  onSpotPopupClose?: (id: string) => void;
}) {
  let map: google.maps.Map | null = null;
  let markerRefs: GoogleMarkerRef[] = [];
  let markerCluster: MarkerClusterer | null = null;
  let activeInfoWindow: google.maps.InfoWindow | null = null;

  // 缓冲逻辑
  let pendingSpots: SpotItem[] | null = null;
  let pendingVisibleIds: Set<string> | null = null;
  let selectedId: string | null = null;
  let nextHighlightedIds = new Set<string>();

  /**
   * P36: 自定义 marker — 替代 Google 内置 PinElement(那是默认丑设计)。
   *
   * 设计:
   * - 景点(type=spot):圆形 day color 底 + 白色大数字编号,2px 白边 + 阴影
   * - 其他类型:同样圆形 day color 底 + 大 emoji 居中(住宿/餐厅/咖啡/购物/交通)
   * - mustVisit:加金色 ★ 角标(右上角)
   * - isActive:scale 1.25 + 颜色更深 + 大 halo ring(box-shadow 多层)
   * - isNext:cyan ring outline(吸引视觉跳到下一站)
   * - 普通态:scale 1
   * - 通过 wrapper 0x0 + 子元素 absolute 实现圆心 anchor(跟 P34 cluster 一致)
   *
   * 视觉差异化:
   * - 景点 marker(圆形+数字): 跟 cluster(圆形+数字)很像,但单 marker scale 32px,
   *   cluster scale 32-40px,且 cluster 有 P34 zIndex 2000+ 浮在上层
   * - 非景点 marker(圆形+emoji): emoji 字符让用户一眼区分类型
   */
  function buildMarkerContent(spot: SpotItem, isActive: boolean, isNext: boolean, dayIndex: number): HTMLDivElement {
    const type = coerceSpotType(spot.type);
    const dayColor = config.dayColors[spot.day - 1] || '#ea4335';
    const isSpot = type === 'spot';

    // Wrapper:0x0 占位,让 AdvancedMarker 默认 anchor (bottom-center) 落在 (0,0)
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: relative; width: 0; height: 0;';

    // 主 marker:圆形,绝对定位让圆心对准地理位置
    const baseSize = 30;
    const size = isActive ? baseSize * 1.25 : isNext ? baseSize * 1.1 : baseSize;
    const main = document.createElement('div');
    main.className = `trip-marker-pin${isSpot ? ' is-spot' : ' is-emoji'}${isActive ? ' is-active' : ''}${isNext ? ' is-next' : ''}${spot.mustVisit ? ' is-must' : ''}`;
    // 颜色:active 时混入暗色让对比度更强;否则原 day color
    const bg = isActive ? mixWithBlack(dayColor, 0.15) : dayColor;
    // 阴影/halo:active 用 ocean glow ring,普通用柔阴
    const shadow = isActive
      ? `0 0 0 4px rgba(255,255,255,0.6), 0 0 0 8px ${dayColor}88, 0 4px 14px rgba(0,0,0,0.32)`
      : isNext
        ? `0 0 0 3px rgba(35,111,122,0.45), 0 2px 8px rgba(0,0,0,0.22)`
        : `0 2px 6px rgba(0,0,0,0.22)`;
    main.style.cssText = `
      position: absolute;
      left: ${-size / 2}px;
      top: ${-size / 2}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${bg};
      border: 2px solid #fff;
      box-shadow: ${shadow};
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 800;
      font-family: inherit;
      font-size: ${isSpot ? (size >= 36 ? 0.9 : 0.82) : (size >= 36 ? 1.1 : 1.0)}rem;
      line-height: 1;
      user-select: none;
      cursor: pointer;
      transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
    `;
    main.textContent = isSpot
      ? String(dayIndex || spot.order)
      : SPOT_TYPE_META[type].emoji;
    wrapper.appendChild(main);

    // mustVisit:右上角金色 ★
    if (spot.mustVisit) {
      const star = document.createElement('div');
      star.style.cssText = `
        position: absolute;
        left: ${size / 2 - 6}px;
        top: ${-size / 2 - 6}px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #fbbf24;
        border: 1.5px solid #fff;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        color: #fff;
        font-size: 0.55rem;
        font-weight: 900;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      `;
      star.textContent = '★';
      wrapper.appendChild(star);
    }

    return wrapper;
  }

  /**
   * 把 hex color 混入黑色(percentage 0-1),让 active 状态颜色加深。
   */
  function mixWithBlack(hex: string, ratio: number): string {
    const m = hex.replace('#', '').match(/.{2}/g);
    if (!m || m.length < 3) return hex;
    const [r, g, b] = m.slice(0, 3).map((h) => parseInt(h, 16));
    const mix = (c: number) => Math.max(0, Math.round(c * (1 - ratio)));
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
  }

  function updateMarkerAppearance(ref: GoogleMarkerRef) {
    const isActive = selectedId === ref.spotId;
    const isNext = nextHighlightedIds.has(ref.spotId) && !isActive;
    ref.marker.content = buildMarkerContent(ref.spot, isActive, isNext, ref.dayIndex);
    ref.marker.zIndex = isActive ? 1200 + ref.spot.day : isNext ? 900 + ref.spot.day : 100 + ref.spot.day;
  }

  function updateAllMarkerAppearances() {
    markerRefs.forEach(updateMarkerAppearance);
  }

  function handleInfoWindowClosed(ref: GoogleMarkerRef) {
    debugTripMapEvent('google infoWindow close', {
      spotId: ref.spotId,
      selectedId,
      isActiveInfoWindow: activeInfoWindow === ref.infoWindow,
    });
    if (activeInfoWindow === ref.infoWindow) {
      activeInfoWindow = null;
    }
  }

  function handleInfoWindowCloseClick(ref: GoogleMarkerRef) {
    debugTripMapEvent('google infoWindow closeclick', { spotId: ref.spotId, selectedId });
    if (activeInfoWindow === ref.infoWindow) {
      activeInfoWindow = null;
    }
    if (selectedId === ref.spotId) {
      selectedId = null;
      updateAllMarkerAppearances();
      debugTripMapEvent('selected cleared by google infoWindow closeclick', { spotId: ref.spotId });
      config.onSpotPopupClose?.(ref.spotId);
    }
  }

  function destroy() {
    if (markerCluster) {
      markerCluster.clearMarkers();
      markerCluster = null;
    }
    markerRefs.forEach((ref) => {
      ref.marker.map = null;
      if (typeof google !== 'undefined' && google.maps && google.maps.event) {
        google.maps.event.clearInstanceListeners(ref.marker);
      }
    });
    markerRefs = [];
  }

  /**
   * P31: 动态测量真实顶部遮挡高度,返回让 marker / cluster 视觉位置落在
   *      「可用区域中央」所需的 panY。
   *
   * 之前 P11-1 / P15 都硬编码 panY=120,但只在桌面无顶部 fixed 遮挡时合理。
   * 手机端有 mobile-trip-context-card (53px) + map-search (50px) = 顶部 108 遮挡,
   * 硬编码 120 会让 marker 偏到 viewportH 64% 位置(过分偏下,看起来"位置不对")。
   *
   * 正确公式:panY = 顶部遮挡高度 / 2 — 让 cluster 视觉位置落在 (top+viewportH)/2
   * 即「可用区域几何中央」。桌面无遮挡 → panY=0(直接居中)。
   */
  function calcTopPanOffset(): number {
    if (typeof document === 'undefined' || typeof window === 'undefined') return 0;
    let maxBottom = 0;
    const candidates = [
      '.mobile-trip-context-card',  // 移动端 trip header 卡
      '.map-search',                // 搜索栏
      '.trip-context',              // 桌面端 trip context(如果有 fixed)
    ];
    for (const sel of candidates) {
      const el = document.querySelector<HTMLElement>(sel);
      if (!el) continue;
      const cs = window.getComputedStyle(el);
      // 只有 fixed / sticky 才会持续遮挡 map
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      const bottom = el.getBoundingClientRect().bottom;
      if (bottom > maxBottom) maxBottom = bottom;
    }
    return Math.max(0, Math.floor(maxBottom / 2));
  }

  /**
   * P33: 自定义 cluster renderer 解决「缩小后 cluster 位置上移」的 bug。
   *
   * 根因:@googlemaps/markerclusterer 的默认 renderer 用老 API
   * `google.maps.Marker`(anchor = SVG image center),而我们 spot marker 用新 API
   * `AdvancedMarkerElement + PinElement`(anchor = 底部尖端)。两套 API 的
   * anchor 算法不同,缩小到出现 cluster 时,cluster 的视觉位置比 spot 高半个图标,
   * 看起来「cluster 漂到 spot 上方」。
   *
   * 修复:cluster 也用 AdvancedMarkerElement + PinElement,anchor 跟 spot 一致。
   * 顺带 cluster background 用 cluster 内出现最多的 day color,告诉用户「这一堆
   * markers 主要属于哪天」。
   */
  /**
   * P34: cluster icon 改成自定义圆形 div,跟 spot marker 的 PinElement 滴水形
   *      视觉彻底区分。
   *
   * 设计:
   * - 形状:圆形(spot 是滴水形 / 水珠)— 一眼区分
   * - 颜色:cluster 内出现次数最多的 day 的 color(承接 P30 day color 体系)
   * - 尺寸:48px(单 marker ~30px,cluster 明显更大)
   * - Anchor:wrapper width:0/height:0 让 AdvancedMarker 默认 bottom-center anchor
   *           落在 (0,0),circle 通过 absolute left:-24/top:-24 让圆心对齐 anchor,
   *           cluster 圆心精确对准 cluster.position(地理位置)— 这也修复了 P33
   *           的 anchor 一致性诉求,圆心 anchor 比尖端 anchor 更适合"代表多个 spots"
   */
  const clusterRenderer: Renderer = {
    render(cluster: Cluster) {
      const { count, position, markers } = cluster;
      // 找 cluster 内出现次数最多的 day,作为 cluster 颜色
      const dayCount = new Map<number, number>();
      let dominantDay = 1;
      let maxCnt = 0;
      for (const m of markers ?? []) {
        const ref = markerRefs.find((r) => r.marker === m);
        const d = ref?.spot.day ?? 1;
        const c = (dayCount.get(d) ?? 0) + 1;
        dayCount.set(d, c);
        if (c > maxCnt) {
          maxCnt = c;
          dominantDay = d;
        }
      }
      const background = config.dayColors[dominantDay - 1] || '#0f3d5c';

      // wrapper:0x0 占位,让 AdvancedMarker 默认 anchor(bottom-center)落在 (0,0)
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position: relative; width: 0; height: 0;';

      // circle:绝对定位让圆心对准 wrapper origin(也就是地理位置)
      const circle = document.createElement('div');
      circle.className = 'trip-cluster-icon';
      // P34→精修:size 缩到 32-40,跟 Google Maps 原生 cluster 风格对齐
      //   2-9 个 → 32px;10-49 → 36px;50+ → 40px
      const size = count >= 50 ? 40 : count >= 10 ? 36 : 32;
      const fontSize = count >= 100 ? 0.7 : count >= 10 ? 0.78 : 0.82;
      circle.style.cssText = `
        position: absolute;
        left: ${-size / 2}px;
        top: ${-size / 2}px;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${background};
        border: 2px solid #fff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: ${fontSize}rem;
        font-family: inherit;
        cursor: pointer;
        user-select: none;
      `;
      circle.textContent = String(count);
      wrapper.appendChild(circle);

      return new google.maps.marker.AdvancedMarkerElement({
        position,
        content: wrapper,
        zIndex: 2000 + count,
      });
    },
  };

  function createClusterer() {
    return new MarkerClusterer({
      map,
      renderer: clusterRenderer,
      onClusterClick: (event, cluster, clusterMap) => {
        const domEvent = event.domEvent as Event | undefined;
        domEvent?.stopPropagation?.();
        domEvent?.preventDefault?.();
        // P31: 动态算 panY(顶部遮挡 / 2),让 cluster 视觉位置落在可用区域中央
        const panY = calcTopPanOffset();
        const bounds = cluster.bounds;
        if (bounds && !bounds.isEmpty()) {
          clusterMap.fitBounds(bounds, 64);
          // fitBounds 异步完成 zoom/center,setTimeout 0 让 panBy 跑在之后
          window.setTimeout(() => {
            if (panY > 0) clusterMap.panBy(0, -panY);
          }, 0);
          return;
        }
        const zoom = clusterMap.getZoom() ?? 8;
        clusterMap.setCenter(cluster.position);
        clusterMap.setZoom(Math.min(zoom + 2, 15));
        if (panY > 0) clusterMap.panBy(0, -panY);
      },
    });
  }

  const layer: MarkerLayer & { init: (m: google.maps.Map) => void; destroy: () => void } = {
    init(m: google.maps.Map) {
      map = m;
      markerCluster = createClusterer();
      // 初始化完成后，立刻恢复之前缓冲的数据
      if (pendingSpots) layer.render(pendingSpots);
      if (pendingVisibleIds) layer.setVisibleSpots(pendingVisibleIds);
      if (selectedId) layer.setSelected(selectedId, { pan: false });
    },

    render(spots: SpotItem[]) {
      pendingSpots = spots;
      if (!map) return;
      destroy();
      markerCluster = createClusterer();

      // P7 回退:之前按 spot.id 去重会**丢掉合理的多日访问 spot**,
      // 只保留 jitter 处理同坐标视觉重叠 — 让所有 spot 都建 marker。
      // 重复的 spot.id 仅打 debug 日志,不删除。
      {
        const seenIds = new Set<string>();
        let duplicateCount = 0;
        for (const spot of spots) {
          if (seenIds.has(spot.id)) duplicateCount += 1;
          else seenIds.add(spot.id);
        }
        if (duplicateCount > 0) {
          debugTripMapEvent('google marker render duplicate ids (kept all)', {
            total: spots.length,
            duplicates: duplicateCount,
          });
        }
      }

      // P35: 只有 type='spot' 的景点参与 day 内编号
      // 其他类型(住宿 / 餐厅 / 咖啡 / 购物 / 交通)用 emoji 标识,不占编号
      // 例如 Day 1: NRT(transport)→ Vessel Inn(accommodation)→ 雷门(spot)
      //   原来三者编号 1/2/3 → 现在 -/-/1(只景点拿 1)
      const dayCounters = new Map<number, number>();
      const dayIndexById = new Map<string, number>();
      const sortedForIndex = [...spots].sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return (a.order ?? 0) - (b.order ?? 0);
      });
      for (const spot of sortedForIndex) {
        // 非景点类型不参与编号(留空字符串,buildPinElement 用 emoji 替代)
        if (coerceSpotType(spot.type) !== 'spot') continue;
        const next = (dayCounters.get(spot.day) ?? 0) + 1;
        dayCounters.set(spot.day, next);
        dayIndexById.set(spot.id, next);
      }

      // P7: 同坐标 marker jitter — 业务里"第 N 天访问 X" + "第 M 天再访问 X"
      // 是合理数据,但 lat/lng 完全相同会让 cluster 把它们永远合并显示 "N",
      // 用户点击只能看到一个 popup。给同位置第 2+ 个 marker 加微小角度偏移,
      // ~11 米/个,zoom 16+ 时视觉上能分开,cluster fitBounds 能正常展开。
      const positionGroupCount = new Map<string, number>();
      const POSITION_PRECISION = 6;
      const JITTER_DEG = 0.0001; // ~11 米

      markerRefs = spots.map((spot) => {
        // 同坐标第 N+1 个 spot:沿黄金角圆周偏移,分布均匀
        const posKey = `${spot.lat.toFixed(POSITION_PRECISION)},${spot.lng.toFixed(POSITION_PRECISION)}`;
        const groupIdx = positionGroupCount.get(posKey) ?? 0;
        positionGroupCount.set(posKey, groupIdx + 1);
        let renderLat = spot.lat;
        let renderLng = spot.lng;
        if (groupIdx > 0) {
          const angle = (groupIdx * 137.5 * Math.PI) / 180;
          const r = JITTER_DEG * groupIdx;
          const cosLat = Math.cos((spot.lat * Math.PI) / 180) || 1;
          renderLat += r * Math.cos(angle);
          renderLng += (r * Math.sin(angle)) / cosLat;
        }
        const marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: renderLat, lng: renderLng },
          title: spot.name,
        });
        const popupContent = buildSpotPopupElement(spot, {
          dayColors: config.dayColors,
          onNextSpotClick: config.onSpotClick,
        });

        // P5: 动态 maxWidth — 移动端突破 260 限制至 viewport - 32
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 360;
        const dynamicMaxWidth = Math.max(280, Math.min(viewportWidth - 32, 360));
        const infoWindow = new google.maps.InfoWindow({
          content: popupContent,
          maxWidth: dynamicMaxWidth,
          // P6 回退:让 Google 自己 autoPan 处理边界(默认 false)
          // 我们在 openPopup 里手动 panTo 让 marker 居中,然后 popup 自然跟随 marker
        });

        marker.addListener('gmp-click', () => {
          debugTripMapEvent('google marker click', { spotId: spot.id });
          config.onSpotClick?.(spot.id);
        });

        const dayIndex = dayIndexById.get(spot.id) ?? 0;
        const ref = { marker, infoWindow, spotId: spot.id, spot, popupContent, dayIndex };
        infoWindow.addListener('closeclick', () => {
          handleInfoWindowCloseClick(ref);
        });
        infoWindow.addListener('close', () => {
          handleInfoWindowClosed(ref);
        });
        updateMarkerAppearance(ref);
        return ref;
      });

      const markers = markerRefs.map((r) => r.marker);
      markerCluster.addMarkers(markers);
    },

    setVisibleSpots(visibleIds: Set<string>) {
      pendingVisibleIds = visibleIds;
      if (!map || !markerCluster) return;

      const visibleMarkers: google.maps.marker.AdvancedMarkerElement[] = [];

      markerRefs.forEach((ref) => {
        const isVisible = visibleIds.has(ref.spotId);
        if (isVisible) {
          visibleMarkers.push(ref.marker);
        }

        if (!isVisible && activeInfoWindow === ref.infoWindow) {
          debugTripMapEvent('google infoWindow close by hidden marker', { spotId: ref.spotId });
          activeInfoWindow.close();
          activeInfoWindow = null;
        }
      });

      // 更新聚类器中的标记
      markerCluster.clearMarkers();
      markerCluster.addMarkers(visibleMarkers);
    },

    setSelected(id: string | null, options?: { pan?: boolean }) {
      selectedId = id;
      if (!map) return;
      updateAllMarkerAppearances();

      if (id === null) {
        if (activeInfoWindow) {
          debugTripMapEvent('google infoWindow close by selected null');
          activeInfoWindow.close();
          activeInfoWindow = null;
        }
        return;
      }

      const ref = markerRefs.find((r) => r.spotId === id);
      if (ref) {
        if (options?.pan) {
          map.panTo(ref.marker.position as google.maps.LatLngLiteral);
          // 如果当前缩放层级太小（太远），自动放大到 15 级
          if (map.getZoom()! < 15) {
            map.setZoom(15);
          }
          google.maps.event.addListenerOnce(map, 'idle', () => {
            if (selectedId === id) {
              layer.openPopup(id);
            }
          });
          return;
        }
        // 自动打开气泡弹窗，显示景点信息
        layer.openPopup(id);
      }
    },

    openPopup(id: string) {
      const ref = markerRefs.find((r) => r.spotId === id);
      if (ref && map) {
        if (activeInfoWindow && activeInfoWindow !== ref.infoWindow) {
          debugTripMapEvent('google infoWindow close before opening another', { nextSpotId: id });
          activeInfoWindow.close();
        }
        if (ref.marker.position) {
          ref.infoWindow.setPosition(ref.marker.position);
        }
        // P6 修正:打开 popup 前让 marker 移到屏幕「可用区域」中央(避开顶部 fixed 遮挡)。
        // panTo 让 marker 居中 → 然后再 panBy 调整到可用区域中央。
        // 之后用户拖动地图,popup 因锚定到 marker 会跟着地图一起移动 —
        // 这是 Google InfoWindow 标准行为,符合用户对地图 popup 的直觉。
        const markerPos = ref.marker.position as google.maps.LatLngLiteral | null;
        if (markerPos) {
          map.panTo(markerPos);
          // P31: 动态测顶部遮挡(trip-context-card + map-search),panY = 遮挡 / 2。
          // 桌面无遮挡 panY=0,marker 直接居中;手机遮挡 108 → panY=54,marker 在可用区域中央
          // (取代之前硬编码 120 — 那个在手机上让 marker 偏到屏幕下方 64% 位置)。
          const panY = calcTopPanOffset();
          if (panY > 0) map.panBy(0, -panY);
        }
        ref.infoWindow.open({
          map,
          shouldFocus: false,
        });
        activeInfoWindow = ref.infoWindow;
      }
    },

    setNextHighlight(ids: Set<string>) {
      nextHighlightedIds = ids;
      updateAllMarkerAppearances();
    },

    destroy,
  };

  return layer;
}
