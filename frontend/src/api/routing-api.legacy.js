export async function fetchOSRMRoute(profile, coordinates) {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson`;
    try {
        const response = await fetch(url);
        if (!response.ok)
            return null;
        const data = await response.json();
        if (data.code === 'Ok' && data.routes.length > 0) {
            // GeoJSON returns [lng, lat], our system uses [lat, lng]
            return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        }
    }
    catch (err) {
        console.error('OSRM fetch failed:', err);
    }
    return null;
}
