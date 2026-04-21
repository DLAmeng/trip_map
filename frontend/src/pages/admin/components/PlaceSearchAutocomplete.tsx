import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from '../../../utils/debounce';

interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  primaryType: string;
}

interface PlaceSearchAutocompleteProps {
  onSelect: (place: PlaceSearchResult) => void;
  placeholder?: string;
}

export function PlaceSearchAutocomplete({ onSelect, placeholder }: PlaceSearchAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchResults = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const response = await fetch('/api/places/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery }),
        });
        const data = await response.json();
        if (data.ok && Array.isArray(data.places)) {
          setResults(data.places);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsLoading(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    fetchResults(query);
  }, [query, fetchResults]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="place-search-wrap" ref={containerRef}>
      <input
        className="place-search-input"
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder || '搜索地点以补全信息...'}
      />
      
      {isOpen && (results.length > 0 || isLoading) && (
        <ul className="place-results">
          {isLoading ? (
            <li className="place-result-empty">正在搜索...</li>
          ) : (
            results.map((r) => (
              <li
                key={r.placeId}
                className="place-result-item"
                onClick={() => {
                  onSelect(r);
                  setQuery('');
                  setIsOpen(false);
                }}
              >
                <div className="place-result-name">{r.name}</div>
                <div className="place-result-addr">{r.address}</div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
