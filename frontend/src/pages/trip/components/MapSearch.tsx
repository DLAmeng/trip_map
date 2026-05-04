import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { SpotItem, RouteSegment } from '../../../types/trip';
import { buildSearchIndex, searchTripData, type SearchEntry, normalizeText } from '../../../utils/trip-search';
import { importLibrary } from '../../../map-adapter/google/loader';
import { useIsMobile } from '../../../hooks/useIsMobile';

interface MapSearchProps {
  spots: SpotItem[];
  segments: RouteSegment[];
  apiKey?: string;
  onSelectSpot: (id: string) => void;
  onSelectRoute: (id: string) => void;
  /**
   * 选中外部地点(Google Places / Nominatim)后触发。
   * placeId 仅 Google Places 结果有,可拿来调 Place.fetchFields 自渲染详情卡。
   * Nominatim 没 placeId,上层做法不同(只 setView 不显示卡片)。
   */
  onSelectLocation?: (lat: number, lng: number, name: string, placeId?: string) => void;
  onClose?: () => void;
  onFocus?: () => void;
}

export function MapSearch({ spots, segments, apiKey, onSelectSpot, onSelectRoute, onSelectLocation, onClose, onFocus }: MapSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const searchIndex = useMemo(() => buildSearchIndex(spots, segments), [spots, segments]);
  const [externalResults, setExternalResults] = useState<SearchEntry[]>([]);
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
    if (normalized.length < 2) {
      setExternalResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearchingExternal(true);
      try {
        if (apiKey) {
          try {
            const { Place } = (await importLibrary('places')) as any;
            const { SearchByTextRankPreference } = (await importLibrary('places')) as any;

            const request = {
              textQuery: query,
              fields: ['displayName', 'location', 'formattedAddress'],
              maxResultCount: 5,
              rankPreference: SearchByTextRankPreference.RELEVANCE,
            };

            const { places } = await Place.searchByText(request);
            if (places && Array.isArray(places)) {
              const mapped: SearchEntry[] = places.map((p: any) => ({
                id: p.id || Math.random().toString(36),
                type: 'external',
                day: 0,
                title: p.displayName || '未知地点',
                subtitle: p.formattedAddress || '',
                searchText: '',
                data: {
                  lat: p.location?.lat?.(),
                  lng: p.location?.lng?.(),
                  // Google Places id 即 placeId,后续 onSelectLocation 透传给 ExternalPoiCard
                  placeId: p.id,
                },
              }));
              setExternalResults(mapped);
              return;
            }
          } catch (googleErr) {
            console.warn('[MapSearch] Google Places search failed, falling back to Nominatim:', googleErr);
          }
        }

        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '5');
        url.searchParams.set('addressdetails', '0');
        url.searchParams.set('accept-language', 'zh-CN,zh,en');

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
        });
        if (!response.ok) {
          setExternalResults([]);
          return;
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
          setExternalResults([]);
          return;
        }

        const mapped: SearchEntry[] = data.map((item: any) => ({
          id: `nominatim-${item.place_id ?? item.osm_id ?? Math.random().toString(36)}`,
          type: 'external',
          day: 0,
          title: item.name || String(item.display_name || '').split(',')[0] || '未知地点',
          subtitle: item.display_name || '',
          searchText: '',
          data: {
            lat: Number(item.lat),
            lng: Number(item.lon),
          },
        }));
        setExternalResults(mapped);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[MapSearch] External search failed:', err);
          setExternalResults([]);
        }
      } finally {
        setIsSearchingExternal(false);
      }
    }, 500);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
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
    } else {
      onClose?.();
    }
  }, [query, onClose]);

  // P5-L: 用户点中结果后,先标记 confirming(列表项加 .is-confirming 高亮),
  // 150ms 后再触发实际的 onSelect/onClose,让用户看到点击反馈而非"刚点完就消失"
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleSelect = useCallback((entry: SearchEntry) => {
    setConfirmingId(`${entry.type}-${entry.id}`);
    window.setTimeout(() => {
      if (entry.type === 'spot') {
        onSelectSpot(entry.id);
      } else if (entry.type === 'route') {
        onSelectRoute(entry.id);
      } else if (entry.type === 'external' && onSelectLocation) {
        const lat = typeof entry.data.lat === 'function' ? entry.data.lat() : entry.data.lat;
        const lng = typeof entry.data.lng === 'function' ? entry.data.lng() : entry.data.lng;
        // 透传 placeId — Google Places 结果有,Nominatim 没;
        // 上层据此决定显示 ExternalPoiCard(placeId) 还是只 setView
        const placeId = (entry.data as { placeId?: string }).placeId;
        onSelectLocation(lat, lng, entry.title, placeId);
      }
      onClose?.();
      setConfirmingId(null);
    }, 150);
  }, [onSelectSpot, onSelectRoute, onSelectLocation, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      if (query) {
        setQuery('');
      } else {
        onClose?.();
      }
    }
  };

  // 滚动选中项到视图
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <div className="map-search tool-panel" onKeyDown={handleKeyDown}>
      <div className="map-search-inner">
        {isMobile && query ? (
          <button className="mobile-search-back" type="button" onClick={handleClose} aria-label="返回">
            <svg viewBox="0 0 20 20" fill="none" width="20" height="20">
              <path d="M12 4 6 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          <svg className="map-search-icon" viewBox="0 0 20 20" fill="none" width="18" height="18">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
        <input
          ref={inputRef}
          className="map-search-input"
          type="search"
          placeholder="搜索地点 · 景点 · 城市"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={onFocus}
          autoComplete="off"
          spellCheck="false"
        />
        {query && (
          <button className="search-clear" type="button" onClick={handleClose}>
            ✕
          </button>
        )}
      </div>

      {query && (
        <div className="search-results-popover">
          <p className="search-results-meta">
            {isSearchingExternal ? '正在搜索外部地点...' : results.length > 0 ? `找到 ${results.length} 个结果` : '未找到匹配项'}
          </p>
          <div className="search-results-list" ref={listRef} role="listbox">
            {results.map((result, index) => {
              const isSpot = result.type === 'spot';
              const isRoute = result.type === 'route';
              const isExternal = result.type === 'external';

              const itemKey = `${result.type}-${result.id}`;
              const isConfirming = confirmingId === itemKey;
              return (
                <button
                  key={itemKey}
                  className={`search-result-item ${index === selectedIndex ? 'is-selected' : ''}${isConfirming ? ' is-confirming' : ''}`}
                  onClick={() => handleSelect(result)}
                  onMouseMove={() => setSelectedIndex(index)}
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <span className="search-result-top">
                    <span className="search-result-copy">
                      <span className="search-result-title">{result.title}</span>
                      {result.subtitle && <span className="search-result-subtitle">{result.subtitle}</span>}
                    </span>
                    <span className="search-result-badges">
                      <span className={`search-result-badge ${isRoute ? 'search-result-badge-route' : isExternal ? 'search-result-badge-place' : ''}`}>
                        {isSpot ? '行程内' : isRoute ? '路线' : '外部地点'}
                      </span>
                      {result.day > 0 && <span className="search-result-badge">Day {result.day}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
