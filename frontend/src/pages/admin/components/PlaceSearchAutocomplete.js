import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from '../../../utils/debounce';
export function PlaceSearchAutocomplete({ onSelect, placeholder }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    // P3-Bug B: 加 error state + 显式记录"已搜索过"标志,
    // 让用户在网络失败 / 0 结果时也能看到反馈,而不是无限"加载中"
    const [error, setError] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);
    const containerRef = useRef(null);
    const fetchResults = useCallback(debounce(async (searchQuery) => {
        if (!searchQuery.trim()) {
            setResults([]);
            setError(null);
            setHasSearched(false);
            return;
        }
        setIsLoading(true);
        setError(null);
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
            else {
                // 后端返回 ok=false / places 不是数组 → 视为空结果
                setResults([]);
            }
        }
        catch (err) {
            console.error('Search failed:', err);
            setError('搜索失败,请检查网络后重试');
            setResults([]);
        }
        finally {
            setIsLoading(false);
            setHasSearched(true);
        }
    }, 500), []);
    useEffect(() => {
        fetchResults(query);
    }, [query, fetchResults]);
    useEffect(() => {
        // P3-Bug D: pointerdown 同时覆盖 mouse + touch + pen,
        // 避免移动端 touch → mouse 模拟 300ms 延迟导致点别处下拉关闭滞后
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('pointerdown', handleClickOutside);
        return () => document.removeEventListener('pointerdown', handleClickOutside);
    }, []);
    // P3-Bug B: 显示下拉的条件 — 任意三态(loading/error/empty/有结果)都需要让用户看到反馈
    const trimmedQuery = query.trim();
    const showEmpty = !isLoading && !error && hasSearched && results.length === 0 && trimmedQuery.length > 0;
    const showDropdown = isOpen && (isLoading || !!error || results.length > 0 || showEmpty);
    return (_jsxs("div", { className: "place-search-wrap", ref: containerRef, children: [_jsx("input", { className: "place-search-input", type: "text", value: query, onChange: (e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                }, onFocus: () => setIsOpen(true), placeholder: placeholder || '搜索地点以补全信息...' }), showDropdown && (_jsxs("ul", { className: "place-results", children: [isLoading && _jsx("li", { className: "place-result-empty", children: "\u6B63\u5728\u641C\u7D22..." }), !isLoading && error && _jsx("li", { className: "place-result-error", children: error }), !isLoading && !error && results.length > 0 && results.map((r) => (_jsxs("li", { className: "place-result-item", onClick: () => {
                            onSelect(r);
                            setQuery('');
                            setIsOpen(false);
                            setHasSearched(false);
                        }, children: [_jsx("div", { className: "place-result-name", children: r.name }), _jsx("div", { className: "place-result-addr", children: r.address })] }, r.placeId))), showEmpty && _jsx("li", { className: "place-result-empty", children: "\u6CA1\u6709\u5339\u914D\u7684\u5730\u70B9" })] }))] }));
}
