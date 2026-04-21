import { useEffect, useState } from 'react';
/**
 * 监听 `navigator.onLine` 变化。
 * 初始值取当前 navigator.onLine,之后绑定 window online/offline 事件。
 *
 * SSR 安全:navigator 不存在时返回 true(假设在线)。
 */
export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
    useEffect(() => {
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);
    return isOnline;
}
