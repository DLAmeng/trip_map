export function debugTripMapEvent(eventName, detail) {
    if (typeof window === 'undefined')
        return;
    try {
        const params = new URLSearchParams(window.location.search);
        const enabled = params.get('debugMap') === '1' || window.localStorage.getItem('tripDebugMap') === '1';
        if (!enabled)
            return;
        if (detail === undefined) {
            console.info(`[trip-map] ${eventName}`);
        }
        else {
            console.info(`[trip-map] ${eventName}`, detail);
        }
    }
    catch {
        // Debug logging must never affect map interactions.
    }
}
