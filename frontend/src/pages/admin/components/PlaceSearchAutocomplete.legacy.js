import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from '../../../utils/debounce';
export function PlaceSearchAutocomplete({ onSelect, placeholder }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const fetchResults = useCallback(debounce(async (searchQuery) => {
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
        }
        catch (err) {
            console.error('Search failed:', err);
        }
        finally {
            setIsLoading(false);
        }
    }, 500), []);
    useEffect(() => {
        fetchResults(query);
    }, [query, fetchResults]);
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    return (_jsxs("div", { className: "place-search-wrap", ref: containerRef, children: [_jsx("input", { className: "place-search-input", type: "text", value: query, onChange: (e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                }, onFocus: () => setIsOpen(true), placeholder: placeholder || '搜索地点以补全信息...' }), isOpen && (results.length > 0 || isLoading) && (_jsx("ul", { className: "place-results", children: isLoading ? (_jsx("li", { className: "place-result-empty", children: "\u6B63\u5728\u641C\u7D22..." })) : (results.map((r) => (_jsxs("li", { className: "place-result-item", onClick: () => {
                        onSelect(r);
                        setQuery('');
                        setIsOpen(false);
                    }, children: [_jsx("div", { className: "place-result-name", children: r.name }), _jsx("div", { className: "place-result-addr", children: r.address })] }, r.placeId)))) }))] }));
}
