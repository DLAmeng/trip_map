import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import type { RouteSegment, SpotItem, TripConfig } from '../../../types/trip';
import { buildRouteHeadline, buildRouteMetaLine } from '../../../utils/route-detail';
import type { PlannerDay } from '../hooks/useTripPlannerEditor';

interface AdminTripMapProps {
  config: TripConfig;
  days: PlannerDay[];
  selectedSpotId: string | null;
  selectedSegmentId: string | null;
  activeDay: number;
  isAddMode: boolean;
  onToggleAddMode: () => void;
  onSelectSpot: (spotId: string) => void;
  onSelectSegment: (segmentId: string) => void;
  onAddSpotAtPoint: (lat: number, lng: number) => void;
  onUpdateSpotPosition: (spotId: string, lat: number, lng: number) => void;
}

function buildMarkerIcon(label: string, color: string, selected: boolean, transport: boolean) {
  return L.divIcon({
    className: '',
    html: `
      <div class="admin-map-marker${selected ? ' is-selected' : ''}${transport ? ' is-transport' : ''}" style="--marker-color: ${color}">
        <span>${label}</span>
      </div>
    `,
    iconSize: transport ? [24, 24] : [30, 30],
    iconAnchor: transport ? [12, 12] : [15, 15],
  });
}

function resolveSegmentPath(segment: RouteSegment, spotById: Map<string, SpotItem>): Array<[number, number]> {
  if (Array.isArray(segment.path) && segment.path.length >= 2) {
    return segment.path;
  }
  const from = spotById.get(segment.fromSpotId);
  const to = spotById.get(segment.toSpotId);
  if (!from || !to) return [];
  return [
    [from.lat, from.lng],
    [to.lat, to.lng],
  ];
}

export function AdminTripMap({
  config,
  days,
  selectedSpotId,
  selectedSegmentId,
  activeDay,
  isAddMode,
  onToggleAddMode,
  onSelectSpot,
  onSelectSegment,
  onAddSpotAtPoint,
  onUpdateSpotPosition,
}: AdminTripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const markerRef = useRef<Map<string, L.Marker>>(new Map());
  const addModeRef = useRef(isAddMode);
  const onAddSpotRef = useRef(onAddSpotAtPoint);

  const allSpots = useMemo(() => days.flatMap((day) => day.spots), [days]);
  const allSegments = useMemo(() => days.flatMap((day) => day.segments), [days]);
  const spotById = useMemo(
    () => new Map(allSpots.map((spot) => [spot.id, spot])),
    [allSpots],
  );

  useEffect(() => {
    addModeRef.current = isAddMode;
  }, [isAddMode]);

  useEffect(() => {
    onAddSpotRef.current = onAddSpotAtPoint;
  }, [onAddSpotAtPoint]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      [config.centerLat, config.centerLng],
      config.defaultZoom,
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);

    map.on('click', (event) => {
      if (!addModeRef.current) return;
      onAddSpotRef.current(event.latlng.lat, event.latlng.lng);
    });

    mapRef.current = map;
    markerLayerRef.current = markerLayer;
    routeLayerRef.current = routeLayer;

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      routeLayerRef.current = null;
      markerRef.current.clear();
    };
  }, [config.centerLat, config.centerLng, config.defaultZoom]);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !markerLayer || !routeLayer) return;

    markerLayer.clearLayers();
    routeLayer.clearLayers();
    markerRef.current.clear();

    allSegments.forEach((segment) => {
      const path = resolveSegmentPath(segment, spotById);
      if (path.length < 2) return;
      const dayIndex = Math.max(0, days.findIndex((day) => day.day === segment.day));
      const color = config.dayColors[dayIndex % config.dayColors.length] || '#b85c38';
      const isSelected = segment.id === selectedSegmentId;
      const isActiveDay = segment.day === activeDay;
      const line = L.polyline(path, {
        color,
        weight: isSelected ? 7 : 4,
        opacity: isActiveDay ? 0.92 : 0.38,
        dashArray: segment.detached ? '10 8' : undefined,
      });
      const meta = buildRouteMetaLine(segment);
      line.bindTooltip(
        [buildRouteHeadline(segment), meta.join(' · ')].filter(Boolean).join(' · '),
        { sticky: true },
      );
      line.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        onSelectSegment(segment.id);
      });
      line.addTo(routeLayer);
    });

    allSpots.forEach((spot) => {
      const dayIndex = Math.max(0, days.findIndex((day) => day.day === spot.day));
      const color = config.dayColors[dayIndex % config.dayColors.length] || '#b85c38';
      const marker = L.marker([spot.lat, spot.lng], {
        draggable: true,
        icon: buildMarkerIcon(String(spot.order), color, selectedSpotId === spot.id, spot.type === 'transport'),
        keyboard: false,
      });
      marker.bindTooltip(spot.name || '未命名景点', { direction: 'top', offset: [0, -14] });
      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        onSelectSpot(spot.id);
      });
      marker.on('dragend', () => {
        const latLng = marker.getLatLng();
        onUpdateSpotPosition(spot.id, latLng.lat, latLng.lng);
      });
      marker.addTo(markerLayer);
      markerRef.current.set(spot.id, marker);
    });
  }, [
    activeDay,
    allSegments,
    allSpots,
    config.dayColors,
    days,
    onSelectSegment,
    onSelectSpot,
    onUpdateSpotPosition,
    selectedSegmentId,
    selectedSpotId,
    spotById,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedSpotId) return;
    const marker = markerRef.current.get(selectedSpotId);
    if (!marker) return;
    const latLng = marker.getLatLng();
    map.panTo(latLng, { animate: true });
    marker.openTooltip();
  }, [selectedSpotId]);

  const fitAll = () => {
    const map = mapRef.current;
    if (!map || allSpots.length === 0) return;
    const bounds = L.latLngBounds(allSpots.map((spot) => [spot.lat, spot.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], animate: true });
  };

  const fitActiveDay = () => {
    const map = mapRef.current;
    if (!map) return;
    const daySpots = days.find((day) => day.day === activeDay)?.spots || [];
    if (!daySpots.length) return;
    const bounds = L.latLngBounds(daySpots.map((spot) => [spot.lat, spot.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], animate: true });
  };

  return (
    <section className="panel admin-trip-map-panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">Map Studio</p>
          <h2>地图联动编辑</h2>
        </div>
        <div className="admin-trip-map-actions">
          <button type="button" className={`btn ${isAddMode ? 'btn-primary' : 'btn-ghost'}`} onClick={onToggleAddMode}>
            {isAddMode ? '点地图即可新增' : '地图新增模式'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={fitActiveDay}>
            适配当天
          </button>
          <button type="button" className="btn btn-ghost" onClick={fitAll}>
            全部适配
          </button>
        </div>
      </div>

      <div className="admin-trip-map-frame">
        <div ref={containerRef} className="admin-trip-map-canvas" />
        {isAddMode ? (
          <div className="admin-map-add-hint">
            点地图空白处即可把景点追加到 Day {activeDay}
          </div>
        ) : null}
      </div>
    </section>
  );
}
