import { useEffect } from 'react';
import { getVisibleSpotIds, } from '../selectors/filterState';
/**
 * 串联 React 状态 ↔ adapter 的 hook。所有地图 API 调用都在这里集中,
 * React 组件(TripMapCanvas / TripPage)不直接碰 Leaflet。
 *
 * 4 个 useEffect 按依赖分工:
 *   1. [spots] → 重建 marker
 *   2. [segments, spotById] → 重建 route
 *   3. [filter, spots, segments] → 同步显隐
 *   4. [selectedSpotId] → 同步选中 + pan
 */
export function useTripMap(controllerRef, params) {
    const { spots, segments, spotById, filter, selectedSpotId } = params;
    // 1. spots 变化 → 重建 marker
    useEffect(() => {
        const controller = controllerRef.current;
        if (!controller)
            return;
        controller.markers.render(spots);
        // render 后立刻同步一次显隐,避免首帧闪一下
        controller.markers.setVisibleSpots(getVisibleSpotIds(spots, filter));
        if (selectedSpotId) {
            controller.markers.setSelected(selectedSpotId, { pan: false });
        }
        // filter/selectedSpotId 有各自的 effect 再跑一次,这里只做首帧 sync
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spots]);
    // 2. segments 或 spotById 变化 → 重建 route
    useEffect(() => {
        const controller = controllerRef.current;
        if (!controller)
            return;
        controller.routes.render(segments, spotById);
        controller.routes.setActiveFilter({ day: filter.day });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [segments, spotById]);
    // 3. filter 变化 → 同步 marker 显隐 + route 过滤
    useEffect(() => {
        const controller = controllerRef.current;
        if (!controller)
            return;
        controller.markers.setVisibleSpots(getVisibleSpotIds(spots, filter));
        controller.routes.setActiveFilter({ day: filter.day });
    }, [controllerRef, filter, spots]);
    // 4. selectedSpotId 变化 → 同步选中
    useEffect(() => {
        const controller = controllerRef.current;
        if (!controller)
            return;
        controller.markers.setSelected(selectedSpotId, { pan: true });
    }, [controllerRef, selectedSpotId]);
}
