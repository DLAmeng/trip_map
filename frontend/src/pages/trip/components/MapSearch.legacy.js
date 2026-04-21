import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { buildSearchIndex, searchTripData, normalizeText } from '../../../utils/trip-search';
import { importLibrary } from '../../../map-adapter/google/loader';
import { useIsMobile } from '../../../hooks/useIsMobile';
export function MapSearch({ spots, segments, apiKey, onSelectSpot, onSelectRoute, onSelectLocation, onClose, onFocus }) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const isMobile = useIsMobile();
    const searchIndex = useMemo(() => buildSearchIndex(spots, segments), [spots, segments]);
    const [externalResults, setExternalResults] = useState([]);
    const [isSearchingExternal, setIsSearchingExternal] = useState(false);
    const localResults = useMemo(() => {
        return searchTripData(searchIndex, query);
    }, [searchIndex, query]);
    const results = useMemo(() => {
        return [...localResults, ...externalResults];
    }, [localResults, externalResults]);
    // Google Places 外部搜索逻辑
    useEffect(() => {
        const normalized = normalizeText(query);
        if (!apiKey || normalized.length < 2) {
            setExternalResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingExternal(true);
            try {
                const { Place } = (await importLibrary('places'));
                const { SearchByTextRankPreference } = (await importLibrary('places'));
                const request = {
                    textQuery: query,
                    fields: ['displayName', 'location', 'formattedAddress'],
                    maxResultCount: 5,
                    rankPreference: SearchByTextRankPreference.RELEVANCE,
                };
                const { places } = await Place.searchByText(request);
                if (places && Array.isArray(places)) {
                    const mapped = places.map((p) => ({
                        id: p.id || Math.random().toString(36),
                        type: 'external',
                        day: 0,
                        title: p.displayName || '未知地点',
                        subtitle: p.formattedAddress || '',
                        searchText: '',
                        data: {
                            lat: p.location?.lat?.(),
                            lng: p.location?.lng?.(),
                        },
                    }));
                    setExternalResults(mapped);
                }
            }
            catch (err) {
                console.error('[MapSearch] External search failed:', err);
            }
            finally {
                setIsSearchingExternal(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [query, apiKey]);
    // 重置选中项
    useEffect(() => {
        setSelectedIndex(results.length > 0 ? 0 : -1);
    }, [results]);
    // 自动聚焦输入框 (仅桌面或非移动端激活时)
    useEffect(() => {
        if (!isMobile) {
            inputRef.current?.focus();
        }
    }, [isMobile]);
    const handleClose = useCallback(() => {
        if (query) {
            setQuery('');
            inputRef.current?.blur();
        }
        else {
            onClose?.();
        }
    }, [query, onClose]);
    const handleSelect = useCallback((entry) => {
        if (entry.type === 'spot') {
            onSelectSpot(entry.id);
        }
        else if (entry.type === 'route') {
            onSelectRoute(entry.id);
        }
        else if (entry.type === 'external' && onSelectLocation) {
            const lat = typeof entry.data.lat === 'function' ? entry.data.lat() : entry.data.lat;
            const lng = typeof entry.data.lng === 'function' ? entry.data.lng() : entry.data.lng;
            onSelectLocation(lat, lng, entry.title);
        }
        onClose?.();
    }, [onSelectSpot, onSelectRoute, onSelectLocation, onClose]);
    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % results.length);
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        }
        else if (e.key === 'Enter') {
            if (selectedIndex >= 0 && results[selectedIndex]) {
                handleSelect(results[selectedIndex]);
            }
        }
        else if (e.key === 'Escape') {
            if (query) {
                setQuery('');
            }
            else {
                onClose?.();
            }
        }
    };
    // 滚动选中项到视图
    useEffect(() => {
        if (selectedIndex >= 0 && listRef.current) {
            const selectedEl = listRef.current.children[selectedIndex];
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);
    return (_jsxs("div", { className: "map-search tool-panel", onKeyDown: handleKeyDown, children: [_jsxs("div", { className: "map-search-inner", children: [isMobile && query ? (_jsx("button", { className: "mobile-search-back", type: "button", onClick: handleClose, "aria-label": "\u8FD4\u56DE", children: _jsx("svg", { viewBox: "0 0 20 20", fill: "none", width: "20", height: "20", children: _jsx("path", { d: "M12 4 6 10l6 6", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) }) })) : (_jsxs("svg", { className: "map-search-icon", viewBox: "0 0 20 20", fill: "none", width: "18", height: "18", children: [_jsx("circle", { cx: "8.5", cy: "8.5", r: "5.5", stroke: "currentColor", strokeWidth: "1.8" }), _jsx("path", { d: "M13 13l3.5 3.5", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" })] })), _jsx("input", { ref: inputRef, className: "map-search-input", type: "search", placeholder: "\u641C\u7D22\u5730\u70B9 \u00B7 \u666F\u70B9 \u00B7 \u57CE\u5E02", value: query, onChange: (e) => setQuery(e.target.value), onFocus: onFocus, autoComplete: "off", spellCheck: "false" }), query && (_jsx("button", { className: "search-clear", type: "button", onClick: handleClose, children: "\u2715" }))] }), query && (_jsxs("div", { className: "search-results-popover", children: [_jsx("p", { className: "search-results-meta", children: isSearchingExternal ? '正在搜索外部地点...' : results.length > 0 ? `找到 ${results.length} 个结果` : '未找到匹配项' }), _jsx("div", { className: "search-results-list", ref: listRef, role: "listbox", children: results.map((result, index) => {
                            const isSpot = result.type === 'spot';
                            const isRoute = result.type === 'route';
                            const isExternal = result.type === 'external';
                            return (_jsx("button", { className: `search-result-item ${index === selectedIndex ? 'is-selected' : ''}`, onClick: () => handleSelect(result), onMouseMove: () => setSelectedIndex(index), type: "button", role: "option", "aria-selected": index === selectedIndex, children: _jsxs("span", { className: "search-result-top", children: [_jsxs("span", { className: "search-result-copy", children: [_jsx("span", { className: "search-result-title", children: result.title }), result.subtitle && _jsx("span", { className: "search-result-subtitle", children: result.subtitle })] }), _jsxs("span", { className: "search-result-badges", children: [_jsx("span", { className: `search-result-badge ${isRoute ? 'search-result-badge-route' : isExternal ? 'search-result-badge-place' : ''}`, children: isSpot ? '行程内' : isRoute ? '路线' : '外部地点' }), result.day > 0 && _jsxs("span", { className: "search-result-badge", children: ["Day ", result.day] })] })] }) }, `${result.type}-${result.id}`));
                        }) })] }))] }));
}
