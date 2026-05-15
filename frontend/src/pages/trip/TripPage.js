import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import 'leaflet/dist/leaflet.css';
import './trip.css';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getTripFull, DEFAULT_TRIP_ID } from '../../api/trip-api';
import { normalizeTripData, computeStats, isDisplayAttractionStop } from '../../selectors/tripSelectors';
import { TripHeader } from './TripHeader';
import { TripMapCanvas } from './TripMapCanvas';
import { SpotList } from './SpotList';
import { MobileFilterSheet } from './components/MobileFilterSheet';
import { MobileDrawer } from './components/MobileDrawer';
import { SummaryBar } from './components/SummaryBar';
import { LoadingScreen } from './components/LoadingScreen';
import { MobileTripHeaderCard } from './components/MobileTripHeaderCard';
import { MobileTripBottomSwitcher } from './components/MobileTripBottomSwitcher';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useIsMobile } from '../../hooks/useIsMobile';
// TripStats 类型现在统一从 selectors/tripSelectors 导出,此处保留空位以便阅读代码时知道它在哪里。
/**
 * Phase 3 Trip 页壳组件。
 *
 * 职责:
 *   - 从 URL ?id= 读 tripId(默认 'current',跟原生 app.js 对齐)
 *   - useQuery 拉 /full,管 loading / error / 空态 / 重试
 *   - useMemo 把 payload normalize 成各种索引(Phase 4 Admin 也复用 selectors)
 *   - 持有 filter + selectedSpotId 两个 UI state,所有子组件都是受控的
 *
 * 边界:本文件不 import leaflet,地图生命周期在 TripMapCanvas 里,
 * 地图 API 调用在 useTripMap + adapter 里。
 */
export function TripPage() {
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const tripId = params.get('id') || DEFAULT_TRIP_ID;
    /**
     * ExternalPoiCard "+ 加入行程"按钮回调:
     * 跳转到 admin 编辑器,带上 prefillSpot URL 参数(JSON encoded)。
     * AdminPage 在 mount 时读这个参数,自动打开新建表单并预填名称/坐标/placeId。
     */
    const handleAddPoiToTrip = useCallback((data) => {
        const prefill = encodeURIComponent(JSON.stringify(data));
        navigate(`/admin?id=${encodeURIComponent(tripId)}&prefillSpot=${prefill}`);
    }, [navigate, tripId]);
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['trip', tripId],
        queryFn: () => getTripFull(tripId),
        staleTime: 30_000,
    });
    // P25: URL 参数 logistics=true 表示要显示住宿/交通节点(默认只显示景点)
    // 用 URL 而不是 useState 让用户能 bookmark / 分享 URL 时保留状态
    const showLogistics = params.get('logistics') === 'true';
    const normalized = useMemo(() => {
        if (!data)
            return null;
        return normalizeTripData(data, { showLogistics });
    }, [data, showLogistics]);
    // P25: 被隐藏的 logistics 节点数 — 给 filter sheet 的 toggle 显示数字。
    // 不依赖当前 showLogistics 状态,始终算「如果关闭开关会被排除多少个」(不含 hideFromMap=true)
    const hiddenLogisticsCount = useMemo(() => {
        if (!data)
            return 0;
        const allEntries = Array.isArray(data.spots) ? data.spots : [];
        return allEntries.filter((s) => s.hideFromMap !== true && !isDisplayAttractionStop(s, false)).length;
    }, [data]);
    const toggleLogistics = useCallback(() => {
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (prev.get('logistics') === 'true')
                next.delete('logistics');
            else
                next.set('logistics', 'true');
            return next;
        });
    }, [setParams]);
    const stats = useMemo(() => {
        if (!normalized)
            return { days: 0, cities: 0, spots: 0 };
        return computeStats(normalized);
    }, [normalized]);
    // 从 URL 参数派生 UI 状态
    const filter = useMemo(() => {
        const dayParam = params.get('day');
        return {
            day: dayParam ? Number(dayParam) : null,
            city: params.get('city') || null,
            mustOnly: params.get('mustVisit') === 'true',
            nextOnly: params.get('nextOnly') === 'true',
        };
    }, [params]);
    const selectedSpotId = params.get('spot') || null;
    const [isListVisible, setIsListVisible] = useState(() => window.innerWidth > 1024);
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
    const [activeTool, setActiveTool] = useState(null);
    const isOnline = useOnlineStatus();
    const isMobile = useIsMobile();
    // 当前激活的底部 switcher 模式(仅手机端用)。
    // 'summary' / 'list' / 'filter' / null;null = 纯地图视图
    const activeMobileMode = activeTool === 'summary' ? 'summary' : isListVisible ? 'list' : isFilterSheetOpen ? 'filter' : null;
    const hasActiveFilter = filter.day !== null ||
        filter.city !== null ||
        filter.mustOnly ||
        filter.nextOnly;
    const hasSpotsForDayAndCity = useCallback((day, city) => {
        if (!normalized)
            return false;
        return normalized.spots.some((spot) => spot.day === day && spot.city === city);
    }, [normalized]);
    const normalizeFilter = useCallback((nextFilter) => {
        let day = nextFilter.day;
        let city = nextFilter.city;
        if (day !== null && city !== null && !hasSpotsForDayAndCity(day, city)) {
            const dayChanged = day !== filter.day;
            const cityChanged = city !== filter.city;
            if (dayChanged && !cityChanged) {
                city = null;
            }
            else if (cityChanged && !dayChanged) {
                day = null;
            }
            else {
                city = null;
            }
        }
        return {
            ...nextFilter,
            day,
            city,
        };
    }, [filter.day, filter.city, hasSpotsForDayAndCity]);
    const closeAllPopups = useCallback(() => {
        // 桌面默认展开列表,手机点空白处会收起所有 sheet(list / filter / summary)
        setIsListVisible(!isMobile);
        setIsFilterSheetOpen(false);
        setActiveTool(null);
    }, [isMobile]);
    // 状态更新函数改为修改 URL 参数
    const setFilter = useCallback((updater) => {
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            const current = {
                day: prev.get('day') ? Number(prev.get('day')) : null,
                city: prev.get('city') || null,
                mustOnly: prev.get('mustVisit') === 'true',
                nextOnly: prev.get('nextOnly') === 'true',
            };
            const nextFilter = normalizeFilter(typeof updater === 'function' ? updater(current) : updater);
            if (nextFilter.day !== null)
                next.set('day', String(nextFilter.day));
            else
                next.delete('day');
            if (nextFilter.city)
                next.set('city', nextFilter.city);
            else
                next.delete('city');
            if (nextFilter.mustOnly)
                next.set('mustVisit', 'true');
            else
                next.delete('mustVisit');
            if (nextFilter.nextOnly)
                next.set('nextOnly', 'true');
            else
                next.delete('nextOnly');
            // 切换过滤条件时通常需要清除具体选中，以触发 Fit Day
            next.delete('spot');
            return next;
        }, { replace: true });
    }, [normalizeFilter, setParams]);
    const handleSelectSpot = useCallback((id) => {
        setParams((prev) => {
            const next = new URLSearchParams(prev);
            if (prev.get('spot') === id)
                return prev;
            next.set('spot', id);
            return next;
        }, { replace: true });
    }, [setParams]);
    const handleMapClick = useCallback(() => {
        setParams((prev) => {
            if (!prev.has('spot'))
                return prev;
            const next = new URLSearchParams(prev);
            next.delete('spot');
            return next;
        }, { replace: true });
    }, [setParams]);
    // loading 态:用全屏 loading card 对齐旧版
    if (isLoading) {
        return (_jsx("div", { className: "trip-shell", children: _jsx(LoadingScreen, { eyebrow: "\u6B63\u5728\u6574\u7406\u8DEF\u7EBF", title: "\u6B63\u5728\u52A0\u8F7D\u884C\u7A0B...", message: `正在读取行程 ${tripId}` }) }));
    }
    // error 态
    if (isError || !data || !normalized) {
        const message = isError
            ? error?.message || '未知错误'
            : '这个行程没有返回有效数据。';
        return (_jsx("div", { className: "trip-shell", children: _jsxs("div", { className: "trip-status", role: "alert", children: [_jsx("h2", { children: "\u65E0\u6CD5\u52A0\u8F7D\u884C\u7A0B" }), _jsx("p", { children: message }), _jsxs("div", { className: "trip-status-actions", children: [_jsx("button", { type: "button", onClick: () => refetch(), disabled: isFetching, children: isFetching ? '重试中…' : '重试' }), _jsx("a", { href: `/trip?id=${encodeURIComponent(tripId)}`, target: "_blank", rel: "noreferrer", children: "\u65B0\u6807\u7B7E\u9875\u6253\u5F00\u5F53\u524D Trip \u9875\u9762" })] })] }) }));
    }
    return (_jsxs("div", { className: `trip-shell${isMobile ? ' trip-shell-mobile' : ''}`, children: [isMobile ? (_jsx(MobileTripHeaderCard, { meta: data.meta, tripId: tripId, cityNames: normalized.cityNames })) : (_jsx(TripHeader, { meta: data.meta, tripId: tripId, stats: stats, dayNumbers: normalized.dayNumbers, cityNames: normalized.cityNames, filter: filter, onDaySelect: (day) => setFilter((prev) => ({ ...prev, day })) })), normalized.spots.length === 0 ? (_jsx("div", { className: "trip-empty-onboarding", role: "status", "aria-live": "polite", children: _jsxs("div", { className: "trip-empty-onboarding-card", children: [_jsx("div", { className: "trip-empty-onboarding-icon", "aria-hidden": "true", children: "\uD83D\uDDFA\uFE0F" }), _jsx("h2", { children: "\u8FD9\u4E2A\u884C\u7A0B\u8FD8\u6CA1\u6709\u666F\u70B9" }), _jsx("p", { children: "\u53BB\u7F16\u8F91\u5668\u6DFB\u52A0\u4F60\u7684\u7B2C\u4E00\u4E2A\u666F\u70B9\u5427\u3002" }), _jsx("a", { className: "trip-empty-onboarding-cta", href: `/admin?id=${encodeURIComponent(tripId)}`, children: "\uFF0B \u53BB\u6DFB\u52A0\u666F\u70B9" })] }) })) : null, _jsxs("div", { className: `main-content ${!isListVisible ? 'list-hidden' : ''}`, children: [_jsx(TripMapCanvas, { config: data.config, spots: normalized.spots, segments: normalized.routeSegments, spotById: normalized.allEntriesById, cityNames: normalized.cityNames, filter: filter, onFilterChange: setFilter, selectedSpotId: selectedSpotId, onSelectSpot: handleSelectSpot, onMapClick: handleMapClick, stats: stats, onToggleList: () => setIsListVisible(!isListVisible), isListVisible: isListVisible, activeTool: activeTool, setActiveTool: setActiveTool, isOnline: isOnline, isMobile: isMobile, onAddPoiToTrip: handleAddPoiToTrip }), isListVisible && (_jsx(_Fragment, { children: isMobile ? (_jsx(MobileDrawer, { isOpen: isListVisible, spotsByDay: normalized.spotsByDay, dayNumbers: normalized.dayNumbers, dayColors: data.config.dayColors, filter: filter, selectedSpotId: selectedSpotId, onSelect: handleSelectSpot, onDayClick: (day) => setFilter((prev) => ({ ...prev, day })), onClose: () => setIsListVisible(false) })) : (_jsx("div", { className: "spot-list-wrapper", children: _jsx(SpotList, { spotsByDay: normalized.spotsByDay, dayNumbers: normalized.dayNumbers, dayColors: data.config.dayColors, filter: filter, selectedSpotId: selectedSpotId, onSelect: handleSelectSpot, onDayClick: (day) => setFilter((prev) => ({ ...prev, day })) }) })) }))] }), isMobile ? (_jsx(MobileTripBottomSwitcher, { activeMode: activeMobileMode, hasActiveFilter: hasActiveFilter, onSelectSummary: () => {
                    setActiveTool(activeTool === 'summary' ? null : 'summary');
                    setIsListVisible(false);
                    setIsFilterSheetOpen(false);
                }, onSelectList: () => {
                    setIsListVisible(!isListVisible);
                    setActiveTool(null);
                    setIsFilterSheetOpen(false);
                }, onSelectFilter: () => {
                    setIsFilterSheetOpen(true);
                    setActiveTool(null);
                    setIsListVisible(false);
                } })) : null, activeTool === 'summary' && isMobile && (_jsxs(_Fragment, { children: [_jsx("div", { className: "sheet-backdrop", onClick: closeAllPopups }), _jsxs("div", { className: "mobile-summary-modal", children: [_jsx("div", { className: "modal-header", children: _jsx("h3", { children: "\u884C\u7A0B\u6982\u51B5" }) }), _jsx("div", { className: "modal-body", children: _jsx(SummaryBar, { stats: stats, isFiltered: filter.day !== null ||
                                        filter.city !== null ||
                                        filter.mustOnly ||
                                        filter.nextOnly }) })] })] })), _jsx(MobileFilterSheet, { isOpen: isFilterSheetOpen, onClose: () => setIsFilterSheetOpen(false), dayNumbers: normalized.dayNumbers, dayColors: data.config.dayColors, cityNames: normalized.cityNames, filter: filter, onChange: setFilter, showLogistics: showLogistics, hiddenLogisticsCount: hiddenLogisticsCount, onToggleLogistics: toggleLogistics })] }));
}
