const MOBILE_BREAKPOINT = 840;
const DEFAULT_DAY = 1;
const DEFAULT_TRIP_ID = 'current';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function getActiveTripId() {
  try {
    const id = new URLSearchParams(window.location.search).get('id');
    return (id && id.trim()) || DEFAULT_TRIP_ID;
  } catch (_err) {
    return DEFAULT_TRIP_ID;
  }
}

function getItinerarySources(tripId) {
  const sources = [
    { url: `/api/trips/${encodeURIComponent(tripId)}/full`, label: '后端 API' },
  ];
  if (tripId === DEFAULT_TRIP_ID) {
    sources.push({ url: 'itinerary.json', label: '本地 JSON' });
  }
  return sources;
}

const activeTripId = getActiveTripId();

const MAP_PROVIDER = {
  GOOGLE: 'google',
  LEAFLET: 'leaflet',
};

const refs = {};

const state = {
  currentDay: null,
  currentCity: null,
  showMustOnly: false,
  showNextOnly: false,
  selectedSpotId: null,
  highlightedSpotId: null,
  drawerState: 'collapsed',
  isMobile: false,
  zoomLevel: 7,
  markersVisible: new Set(),
  isListVisible: true,
  isLegendCollapsed: false,
  mapProvider: MAP_PROVIDER.LEAFLET,
};

const store = {
  itineraryData: null,
  itinerarySourceLabel: null,
  spots: [],
  dayNumbers: [],
  cityNames: [],
  allEntriesById: new Map(),
  spotById: new Map(),
  spotsByDay: new Map(),
  allEntriesByDay: new Map(),
  nextSpotById: new Map(),
  nextStopIds: new Set(),
  dayLastSpot: new Map(),
  panelRefs: {
    desktop: new Map(),
    mobile: new Map(),
  },
  spotRefs: {
    desktop: new Map(),
    mobile: new Map(),
  },
  cityRoutes: [],
  transferRoutes: [],
  routeSegments: [],
  curveMetaBySegmentId: new Map(),
};

let map = null;
let clusterGroup = null;
let normalMarkerGroup = null;
let activeInfoWindow = null;
let hoverInfoWindow = null;
let googleMapsLoadPromise = null;

const markerCache = new Map();
const routeGeometryCache = new Map();
const cityRouteLayer = L.featureGroup();
const transferRouteLayer = L.featureGroup();
const googleLibs = {};

const TRANSPORT_STYLES = {
  walk: { color: '#d36d4a', dashArray: '6, 8', weight: 3.6, opacity: 0.9 },
  metro: { color: '#236f7a', dashArray: null, weight: 4.2, opacity: 0.9 },
  bus: { color: '#888', dashArray: '10, 10', weight: 3.2, opacity: 0.88 },
  shinkansen: { color: '#0066cc', dashArray: null, weight: 4.8, opacity: 0.92 },
  jrrapid: { color: '#00aa68', dashArray: '6, 6', weight: 3.8, opacity: 0.9 },
  nankai: { color: '#cc6600', dashArray: '4, 6', weight: 3.8, opacity: 0.9 },
};

const TRANSPORT_ICONS = {
  walk: '步行',
  metro: '地铁 / 电车',
  bus: '巴士',
  shinkansen: '新干线',
  jrrapid: 'JR 新快速',
  nankai: '南海线 / Rapi:t',
};

const TIME_SLOT_LABELS = {
  morning: '上午',
  noon: '中午',
  afternoon: '下午',
  evening: '晚上',
  上午: '上午',
  中午: '中午',
  下午: '下午',
  傍晚: '傍晚',
  晚上: '晚上',
};

const viewportQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);

const LEAFLET_ROUTING_CONFIG = {
  baseUrl: 'https://router.project-osrm.org/route/v1',
  timeoutMs: 8000,
  concurrency: 4,
  profiles: {
    walk: 'foot',
    bus: 'driving',
  },
};

const GOOGLE_ROUTING_CONFIG = {
  concurrency: 2,
  travelModes: {
    walk: 'WALKING',
    bus: 'DRIVING',
    metro: 'TRANSIT',
    jrrapid: 'TRANSIT',
    shinkansen: 'TRANSIT',
    nankai: 'TRANSIT',
  },
  transitPreferences: {
    metro: {
      allowedTransitModes: ['SUBWAY', 'TRAIN', 'LIGHT_RAIL', 'RAIL'],
      routingPreference: 'LESS_WALKING',
    },
    jrrapid: {
      allowedTransitModes: ['TRAIN', 'RAIL'],
      routingPreference: 'FEWER_TRANSFERS',
    },
    shinkansen: {
      allowedTransitModes: ['TRAIN', 'RAIL'],
      routingPreference: 'FEWER_TRANSFERS',
    },
    nankai: {
      allowedTransitModes: ['TRAIN', 'RAIL'],
      routingPreference: 'FEWER_TRANSFERS',
    },
  },
};

const USE_SCHEMATIC_CURVES = true;

const TRANSIT_STATION_OVERRIDES = {
  'seg-d2-1': {
    origin: [35.6905, 139.7007], // 新宿站
    destination: [35.7107, 139.7982], // 浅草站
  },
  'seg-d2-4': {
    origin: [35.7118, 139.7982], // 浅草站
    destination: [35.7138, 139.7774], // 上野站
  },
  'seg-d2-5': {
    origin: [35.7138, 139.7774], // 上野站
    destination: [35.6986, 139.7731], // 秋叶原站
  },
  'seg-d2-6': {
    origin: [35.6986, 139.7731], // 秋叶原站
    destination: [35.6905, 139.7007], // 新宿站
  },
  'seg-d3-2': {
    origin: [35.6812, 139.7671], // 东京站
    destination: [35.6250, 139.7757], // 台场站
  },
  'seg-d4-3': {
    origin: [35.6580, 139.7016], // 涩谷站
    destination: [35.6905, 139.7007], // 新宿站
  },
  'seg-d5-2': {
    origin: [35.5041, 138.7569], // 河口湖站
    destination: [35.5006, 138.8081], // 下吉田站
  },
  'seg-d7-1': {
    origin: [34.9858, 135.7585], // 京都站
    destination: [34.9675, 135.7729], // 稻荷站
  },
  'seg-d7-2': {
    origin: [34.9685, 135.7708], // 伏见稻荷（京阪）
    destination: [35.0036, 135.7723], // 祇园四条站
  },
  'seg-d8-1': {
    origin: [34.9858, 135.7585], // 京都站
    destination: [35.0170, 135.6814], // 嵯峨岚山站
  },
  'seg-d10-1': {
    origin: [34.9858, 135.7585], // 京都站
    destination: [34.8903, 135.7997], // 宇治站
  },
  'seg-d10-4': {
    origin: [34.9470, 135.7995], // JR 小仓站附近
    destination: [34.9858, 135.7585], // 京都站
  },
  'seg-d11-2': {
    origin: [34.7025, 135.4977], // 梅田站
    destination: [34.6656, 135.5019], // 难波站
  },
  'seg-d12-1': {
    origin: [34.6656, 135.5019], // 难波站
    destination: [34.6812, 135.5208], // 谷町四丁目站
  },
  'seg-d12-2': {
    origin: [34.6812, 135.5208], // 谷町四丁目站
    destination: [34.6765, 135.5005], // 心斋桥站
  },
  'seg-d14-1': {
    origin: [34.6678, 135.5000], // 南海难波站
    destination: [34.4362, 135.2439], // 关西机场站
  },
};

const TRANSIT_ROUTE_OVERRIDES = {
  'seg-d2-1': {
    allowedTransitModes: ['SUBWAY', 'TRAIN', 'RAIL'],
    routingPreference: 'FEWER_TRANSFERS',
  },
  'seg-d2-4': {
    allowedTransitModes: ['SUBWAY', 'TRAIN', 'RAIL'],
    routingPreference: 'FEWER_TRANSFERS',
  },
  'seg-d2-5': {
    allowedTransitModes: ['TRAIN', 'RAIL'],
    routingPreference: 'FEWER_TRANSFERS',
  },
  'seg-d2-6': {
    allowedTransitModes: ['TRAIN', 'RAIL'],
    routingPreference: 'FEWER_TRANSFERS',
  },
};

const INTERCITY_PORT_OVERRIDES = {
  'seg-d5-1': {
    startPort: [35.642, 139.41], // 东京西侧出城
    endPort: [35.523, 138.844], // 河口湖东侧入城
  },
  'seg-d6-2': {
    startPort: [35.468, 138.825], // 河口湖南东侧出城
    endPort: [35.171, 138.893], // 三岛北侧入城
  },
  'seg-d6-3': {
    startPort: [35.098, 138.821], // 三岛西侧出城
    endPort: [35.004, 135.904], // 京都东侧入城
  },
  'seg-d11-1': {
    startPort: [34.965, 135.692], // 京都西侧出城
    endPort: [34.701, 135.556], // 大阪东北侧入城
  },
  'seg-d14-1': {
    startPort: [34.626, 135.452], // 大阪西南侧出城
    endPort: [34.466, 135.286], // KIX 东北侧入场
  },
};

const WALKING_WARNING_COPY = 'Google 官方提醒：步行路线可能缺少部分人行道 / 步道信息，请现场留意。';

function debounce(fn, ms) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

function isGoogleMap() {
  return state.mapProvider === MAP_PROVIDER.GOOGLE;
}

function formatTimeSlot(value) {
  return TIME_SLOT_LABELS[value] || value || '';
}

function getMapFitPadding() {
  if (state.isMobile) {
    return {
      google: { top: 36, right: 28, bottom: 208, left: 28 },
      leaflet: {
        paddingTopLeft: [28, 36],
        paddingBottomRight: [28, 208],
      },
      selectedSpotOffsetY: -132,
    };
  }

  return {
    google: { top: 52, right: 52, bottom: 52, left: 52 },
    leaflet: {
      paddingTopLeft: [52, 52],
      paddingBottomRight: [52, 52],
    },
    selectedSpotOffsetY: 0,
  };
}

function getDayLabel(day) {
  const labels = {
    1: '抵达东京 + 新宿休息',
    2: '新宿 → 浅草 → 上野 → 秋叶原',
    3: '东京站 → 台场高达线',
    4: '明治神宫 → 原宿 → 涩谷',
    5: '东京 → 河口湖 / 富士山',
    6: '河口湖 → 三岛 → 京都',
    7: '伏见稻荷 → 祇园 / 东山',
    8: '岚山整天',
    9: '清水寺 → 二年坂三年坂 → 八坂神社',
    10: '宇治日 / 任天堂博物馆',
    11: '京都 → 大阪难波',
    12: '大阪城 → 心斋桥 → Namba Parks',
    13: '难波分头行动 → 电电城 / 心斋桥 → 南海难波',
    14: '难波 → KIX',
  };
  return labels[day] || `第 ${day} 天`;
}

function cacheDom() {
  refs.body = document.body;
  refs.tripEyebrow = document.getElementById('trip-eyebrow');
  refs.tripTitle = document.getElementById('trip-title');
  refs.tripDesc = document.getElementById('trip-desc');
  refs.editTripLink = document.getElementById('trip-edit-link');
  refs.tripDayCount = document.getElementById('trip-day-count');
  refs.tripCityCount = document.getElementById('trip-city-count');
  refs.tripSpotCount = document.getElementById('trip-spot-count');
  refs.summaryCount = document.getElementById('summary-count');
  refs.summaryDays = document.getElementById('summary-days');
  refs.summaryCities = document.getElementById('summary-cities');
  refs.summaryActive = document.getElementById('summary-active');
  refs.filters = document.getElementById('filters');
  refs.legend = document.getElementById('legend');
  refs.legendBody = document.getElementById('legend-body');
  refs.legendToggleBtn = document.getElementById('legend-toggle');
  refs.legendDots = document.getElementById('legend-dots');
  refs.dayListPanel = document.getElementById('day-list-panel');
  refs.mobileDrawer = document.getElementById('mobile-drawer');
  refs.drawerHandle = document.getElementById('drawer-drag-handle');
  refs.drawerHeader = document.getElementById('drawer-header');
  refs.drawerDayLabel = document.getElementById('drawer-day-label');
  refs.drawerNextStop = document.getElementById('drawer-next-stop');
  refs.drawerContent = document.getElementById('mobile-drawer-content');
  refs.todayBtn = document.getElementById('today-btn');
  refs.menuBtn = document.getElementById('menu-btn');
  refs.mobileFilterTrigger = document.getElementById('mobile-filter-trigger');
  refs.mobileFilterSheet = document.getElementById('mobile-filter-sheet');
  refs.sheetBackdrop = document.getElementById('sheet-backdrop');
  refs.mobileDayChips = document.getElementById('mobile-day-chips');
  refs.mobileCityChips = document.getElementById('mobile-city-chips');
  refs.mobileMustToggle = document.getElementById('mobile-must-toggle');
  refs.mobileNextToggle = document.getElementById('mobile-next-toggle');
  refs.closeFilterSheet = document.getElementById('close-filter-sheet');
  refs.resetViewBtn = document.getElementById('reset-view');
  refs.fitDayBtn = document.getElementById('fit-day');
  refs.toggleListBtn = document.getElementById('toggle-list');
  refs.loadingScreen = document.getElementById('loading-screen');
  refs.loadingMessage = document.getElementById('loading-message');
  refs.mapCanvas = document.getElementById('map');
  refs.mapNotice = document.getElementById('map-notice');
  refs.routeWarningNote = document.getElementById('route-warning-note');
  refs.mapSearch = document.getElementById('map-search');
  refs.mapSearchInput = document.getElementById('map-search-input');
  refs.mapSearchClear = document.getElementById('map-search-clear');
  refs.mapSearchResults = document.getElementById('map-search-results');
}

function setLoading(message) {
  refs.loadingMessage.textContent = message;
  refs.loadingScreen.classList.remove('hidden');
}

function hideLoading() {
  refs.loadingScreen.classList.add('hidden');
}

function showError(message, title = '行程数据加载失败') {
  refs.loadingScreen.classList.remove('hidden');
  const card = refs.loadingScreen.querySelector('.loading-card');
  card.classList.add('error');
  card.querySelector('strong').textContent = title;
  refs.loadingMessage.textContent = message;
}

function showMapNotice(message, tone = 'warning', source = 'runtime') {
  if (!refs.mapNotice) {
    return;
  }
  refs.mapNotice.textContent = message;
  refs.mapNotice.dataset.tone = tone;
  refs.mapNotice.dataset.source = source;
  refs.mapNotice.hidden = false;
}

function hideMapNotice(source) {
  if (!refs.mapNotice) {
    return;
  }
  if (source && refs.mapNotice.dataset.source !== source) {
    return;
  }
  refs.mapNotice.hidden = true;
  refs.mapNotice.textContent = '';
  refs.mapNotice.dataset.tone = '';
  refs.mapNotice.dataset.source = '';
}

function updateRouteWarningVisibility() {
  const shouldShow = isGoogleMap() && !USE_SCHEMATIC_CURVES;
  refs.routeWarningNote.hidden = !shouldShow;
  if (shouldShow) {
    refs.routeWarningNote.textContent = WALKING_WARNING_COPY;
  }
}

function updateLegendState() {
  if (!refs.legend || !refs.legendToggleBtn) {
    return;
  }

  refs.legend.classList.toggle('collapsed', state.isLegendCollapsed);
  if (refs.legendBody) {
    refs.legendBody.hidden = state.isLegendCollapsed;
  }
  refs.legendToggleBtn.setAttribute('aria-expanded', String(!state.isLegendCollapsed));
  refs.legendToggleBtn.setAttribute(
    'aria-label',
    state.isLegendCollapsed ? '显示路线类型图例' : '隐藏路线类型图例'
  );
  refs.legendToggleBtn.title = state.isLegendCollapsed ? '显示路线类型图例' : '隐藏路线类型图例';
  const toggleMark = refs.legendToggleBtn.querySelector('.legend-toggle-mark');
  if (toggleMark) {
    toggleMark.textContent = state.isLegendCollapsed ? '＋' : '－';
  }
}

async function fetchItineraryData(tripId = activeTripId) {
  const failures = [];

  for (const source of getItinerarySources(tripId)) {
    try {
      const response = await fetch(source.url, { cache: 'no-store' });
      if (response.status === 404) {
        throw new Error(`未找到该行程 (id=${tripId})`);
      }
      if (!response.ok) {
        throw new Error(`${source.label} 返回 ${response.status}`);
      }

      return {
        data: await response.json(),
        sourceLabel: source.label,
      };
    } catch (error) {
      failures.push(`${source.label}: ${error.message}`);
    }
  }

  throw new Error(failures.join('；'));
}

async function init() {
  cacheDom();
  setLoading('正在载入点位、路线和界面...');

  try {
    const { data, sourceLabel } = await fetchItineraryData();
    store.itineraryData = data;
    store.itinerarySourceLabel = sourceLabel;
  } catch (error) {
    const helper = '推荐运行 `npm install && npm start`；如果你只想静态预览，也可以先运行 `python3 -m http.server 8080`。';
    showError(`${error.message}. ${helper}`);
    return;
  }

  state.isMobile = viewportQuery.matches;
  if (state.isMobile) {
    state.currentDay = DEFAULT_DAY;
  }

  try {
    setLoading('正在整理行程数据...');
    primeData();
    populateHeader();
    setLoading('正在初始化地图...');
    await initMap();
    setLoading('正在绘制路线和点位...');
    initMarkerLayers();
    initRouteLayers();
    renderLegendDots();
    renderFilters();
    renderDayFocusSelect();
    renderMobileFilterSheet();
    renderDayLists();
    createAllMarkers();
    setupEventListeners();
    refreshUi();

    if (state.currentDay !== null) {
      fitToCurrentDay(false);
    } else {
      resetMapView(false);
    }

    if (state.isMobile) {
      applyDrawerState('collapsed', false);
    }

    hideLoading();
    setTimeout(() => {
      hydrateRealRouteGeometries();
    }, 0);
  } catch (error) {
    showError(error.message || '地图初始化失败', '地图初始化失败');
    return;
  }
}

function primeData() {
  const data = store.itineraryData;
  store.spots = data.spots.filter((spot) => spot.type !== 'transport');
  store.dayNumbers = [...new Set(data.spots.map((spot) => spot.day))].sort((a, b) => a - b);
  store.cityNames = [...new Set(store.spots.map((spot) => spot.city))].sort();

  store.allEntriesById.clear();
  store.spotById.clear();
  store.allEntriesByDay.clear();
  store.nextSpotById.clear();
  store.nextStopIds.clear();
  store.spotsByDay.clear();
  store.dayLastSpot.clear();

  data.spots.forEach((entry) => {
    store.allEntriesById.set(entry.id, entry);
  });

  store.spots.forEach((spot) => {
    store.spotById.set(spot.id, spot);
    if (spot.nextStopId) {
      store.nextStopIds.add(spot.id);
    }
  });

  store.dayNumbers.forEach((day) => {
    const dayEntries = data.spots
      .filter((spot) => spot.day === day)
      .sort((a, b) => a.order - b.order);
    const daySpots = store.spots
      .filter((spot) => spot.day === day)
      .sort((a, b) => a.order - b.order);
    store.allEntriesByDay.set(day, dayEntries);
    store.spotsByDay.set(day, daySpots);
    if (daySpots.length) {
      store.dayLastSpot.set(day, daySpots[daySpots.length - 1]);
    }
  });

  store.spots.forEach((spot) => {
    if (spot.nextStopId) {
      store.nextSpotById.set(spot.id, store.allEntriesById.get(spot.nextStopId) || null);
    }
  });

  primeCurveMeta();
}

function populateHeader() {
  const meta = store.itineraryData.meta || {};
  const title = meta.title || '未命名行程';
  refs.tripTitle.textContent = title;
  refs.tripDesc.textContent = meta.description || (store.spots.length ? '' : '这个行程还没有景点，去「编辑」页添加第一个吧。');
  refs.tripDayCount.textContent = String(store.dayNumbers.length);
  refs.tripCityCount.textContent = String(store.cityNames.length);
  refs.tripSpotCount.textContent = String(store.spots.length);
  document.title = title;
  if (refs.tripEyebrow) {
    const segments = [];
    if (meta.destination) segments.push(meta.destination);
    if (meta.startDate && meta.endDate) segments.push(`${meta.startDate} → ${meta.endDate}`);
    else if (meta.startDate) segments.push(meta.startDate);
    refs.tripEyebrow.textContent = segments.join(' · ') || (store.cityNames.length ? store.cityNames.join(' → ') : 'Trip Map');
  }
  if (refs.editTripLink) {
    refs.editTripLink.href = `/admin?id=${encodeURIComponent(activeTripId)}`;
  }
}

function getGoogleMapsConfig() {
  return store.itineraryData?.config?.googleMaps || {};
}

function getGoogleMapsApiKey() {
  return getGoogleMapsConfig().apiKey || window.GOOGLE_MAPS_API_KEY || '';
}

function getGoogleMapId() {
  const mapId = getGoogleMapsConfig().mapId || '';
  return mapId && mapId !== 'DEMO_MAP_ID' ? mapId : '';
}

function wantsGoogleMaps() {
  const provider = store.itineraryData?.config?.mapProvider;
  return provider === 'googleMaps' || provider === 'google';
}

async function initMap() {
  if (wantsGoogleMaps()) {
    const key = getGoogleMapsApiKey();
    if (key) {
      try {
        await initGoogleMap();
        updateRouteWarningVisibility();
        hideMapNotice();
        return;
      } catch (error) {
        console.warn('Google Maps 初始化失败，回退到 Leaflet:', error);
        if (getGoogleMapsConfig().fallbackToLeaflet !== false) {
          showMapNotice('Google Maps 加载失败，当前已自动回退到 OpenStreetMap。补上 API key 后会直接切回 Google 地图。', 'warning');
        } else {
          throw error;
        }
      }
    } else if (getGoogleMapsConfig().fallbackToLeaflet !== false) {
      showMapNotice('当前未配置 Google Maps API key，地图先用 OpenStreetMap 回退显示。请在服务器环境变量里设置 GOOGLE_MAPS_API_KEY 后再切换。', 'warning');
    } else {
      throw new Error('缺少 Google Maps API key');
    }
  }

  initLeafletMap();
  updateRouteWarningVisibility();
}

function initLeafletMap() {
  const { centerLat, centerLng, defaultZoom } = store.itineraryData.config;
  refs.mapCanvas.classList.remove('is-google');
  map = L.map('map', { zoomControl: true }).setView([centerLat, centerLng], defaultZoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18,
  }).addTo(map);

  state.mapProvider = MAP_PROVIDER.LEAFLET;
  state.zoomLevel = map.getZoom();

  map.on('zoomend', () => {
    state.zoomLevel = map.getZoom();
    switchMarkerMode();
  });

  map.on('click', () => {
    clearSelection();
  });
}

async function initGoogleMap() {
  const { centerLat, centerLng, defaultZoom } = store.itineraryData.config;
  const config = getGoogleMapsConfig();
  setLoading('正在加载 Google Maps API...');
  await loadGoogleMapsApi({
    key: getGoogleMapsApiKey(),
    v: 'weekly',
    language: config.language || 'zh-CN',
    region: config.region || 'JP',
    mapIds: getGoogleMapId(),
  });

  setLoading('正在加载 Google 地图库...');
  await Promise.all([
    google.maps.importLibrary('maps'),
    google.maps.importLibrary('routes'),
    google.maps.importLibrary('core'),
  ]);

  googleLibs.Map = google.maps.Map;
  googleLibs.InfoWindow = google.maps.InfoWindow;
  googleLibs.Polyline = google.maps.Polyline;
  googleLibs.LatLngBounds = google.maps.LatLngBounds;
  googleLibs.Marker = google.maps.Marker;
  googleLibs.Route = google.maps.routes.Route;

  refs.mapCanvas.classList.add('is-google');
  setLoading('正在创建 Google 地图...');
  const mapOptions = {
    center: { lat: centerLat, lng: centerLng },
    zoom: defaultZoom,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    gestureHandling: state.isMobile ? 'greedy' : 'auto',
  };
  const mapId = getGoogleMapId();
  if (mapId) {
    mapOptions.mapId = mapId;
  }
  map = new googleLibs.Map(refs.mapCanvas, mapOptions);

  state.mapProvider = MAP_PROVIDER.GOOGLE;
  state.zoomLevel = map.getZoom() || defaultZoom;
  hoverInfoWindow = new googleLibs.InfoWindow({
    disableAutoPan: true,
    pixelOffset: new google.maps.Size(0, -12),
    maxWidth: 260,
  });

  map.addListener('zoom_changed', () => {
    state.zoomLevel = map.getZoom() || state.zoomLevel;
  });

  map.addListener('click', () => {
    clearSelection();
  });
}

function loadGoogleMapsApi(options) {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve();
  }

  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const callbackName = '__codexGoogleMapsReady';
    const authFailureName = 'gm_authFailure';
    const previousAuthFailure = window[authFailureName];
    let settled = false;
    const params = new URLSearchParams({
      key: options.key,
      v: options.v || 'weekly',
      loading: 'async',
      callback: callbackName,
      libraries: 'routes,marker',
      language: options.language || 'zh-CN',
      region: options.region || 'JP',
    });

    if (options.mapIds) {
      params.set('map_ids', options.mapIds);
    }

    const cleanup = () => {
      delete window[callbackName];
      if (previousAuthFailure) {
        window[authFailureName] = previousAuthFailure;
      } else {
        delete window[authFailureName];
      }
      window.clearTimeout(timer);
    };

    const settleResolve = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };

    const settleReject = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      googleMapsLoadPromise = null;
      reject(error);
    };

    window[callbackName] = () => {
      settleResolve();
    };

    window[authFailureName] = () => {
      settleReject(new Error('Google Maps API 鉴权失败'));
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      settleReject(new Error('Google Maps JavaScript API 加载失败'));
    };
    const timer = window.setTimeout(() => {
      settleReject(new Error('Google Maps JavaScript API 加载超时'));
    }, 12000);

    document.head.append(script);
  });

  return googleMapsLoadPromise;
}

function initMarkerLayers() {
  if (isGoogleMap()) {
    clusterGroup = null;
    normalMarkerGroup = null;
    return;
  }

  clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 46,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
  });

  normalMarkerGroup = L.layerGroup();
  clusterGroup.addTo(map);
  switchMarkerMode();
}

function switchMarkerMode() {
  if (isGoogleMap() || !clusterGroup || !normalMarkerGroup) {
    return;
  }

  const useClusters = state.zoomLevel < 9;
  if (useClusters) {
    map.removeLayer(normalMarkerGroup);
    if (!map.hasLayer(clusterGroup)) {
      clusterGroup.addTo(map);
    }
  } else {
    map.removeLayer(clusterGroup);
    if (!map.hasLayer(normalMarkerGroup)) {
      normalMarkerGroup.addTo(map);
    }
  }
}

function initRouteLayers() {
  if (!isGoogleMap()) {
    cityRouteLayer.addTo(map);
    transferRouteLayer.addTo(map);
  }
  buildRouteLayers();
}

function buildRouteLayers() {
  if (!isGoogleMap()) {
    cityRouteLayer.clearLayers();
    transferRouteLayer.clearLayers();
  }

  store.cityRoutes = [];
  store.transferRoutes = [];
  store.routeSegments = [];

  const routeSegments = Array.isArray(store.itineraryData.routeSegments)
    ? store.itineraryData.routeSegments
    : [];

  routeSegments.forEach((segment) => {
    const points = resolveRoutePoints(segment);
    if (points.length < 2) {
      return;
    }

    const polyline = isGoogleMap()
      ? createGoogleRoutePolyline(segment, points)
      : createLeafletRoutePolyline(segment, points);

    const route = {
      id: segment.id,
      segment,
      scope: segment.scope,
      polyline,
      day: segment.day,
      cities: resolveSegmentCities(segment),
      points,
    };

    if (segment.scope === 'intercity') {
      store.transferRoutes.push(route);
    } else {
      store.cityRoutes.push(route);
    }

    store.routeSegments.push(route);
  });
}

function createLeafletRoutePolyline(segment, points) {
  const polyline = L.polyline(points, getRouteStyle(segment.transportType));
  polyline.bindTooltip(buildRouteTooltip(segment), { sticky: true });

  if (segment.scope === 'intercity') {
    polyline.addTo(transferRouteLayer);
  } else {
    polyline.addTo(cityRouteLayer);
  }

  return polyline;
}

function createGoogleRoutePolyline(segment, points) {
  const isIntercity = segment.scope === 'intercity';
  const outline = new googleLibs.Polyline({
    ...getGoogleRouteOutlineOptions(true, isIntercity),
    path: points.map(([lat, lng]) => ({ lat, lng })),
    map,
  });
  const polyline = new googleLibs.Polyline({
    ...getGooglePolylineOptions(segment.transportType, true, isIntercity),
    path: points.map(([lat, lng]) => ({ lat, lng })),
    map,
  });

  attachGoogleRouteTooltip(polyline, segment);

  return { line: polyline, outline, officialPolylines: [] };
}

function attachGoogleRouteTooltip(polyline, segment) {
  const openTooltip = event => {
    if (!hoverInfoWindow || !event?.latLng) {
      return;
    }
    hoverInfoWindow.setPosition(event.latLng);
    hoverInfoWindow.setContent(`<div class="route-tooltip">${buildRouteTooltip(segment)}</div>`);
    hoverInfoWindow.open({ map, shouldFocus: false });
  };

  polyline.addListener('mouseover', openTooltip);
  polyline.addListener('mousemove', openTooltip);
  polyline.addListener('mouseout', () => {
    hoverInfoWindow?.close();
  });
  polyline.addListener('click', openTooltip);
}

function getRouteStyle(transportType) {
  return TRANSPORT_STYLES[transportType] || TRANSPORT_STYLES.bus;
}

function getGooglePolylineOptions(transportType, isActive, isIntercity = false) {
  const style = getRouteStyle(transportType);
  const opacity = isActive
    ? (isIntercity ? 0.98 : 0.94)
    : (isIntercity ? 0.32 : 0.24);
  const weight = isActive
    ? (isIntercity ? Math.max(5, style.weight + 0.8) : Math.max(4, style.weight + 0.4))
    : (isIntercity ? 3.8 : 3.2);

  return {
    clickable: true,
    geodesic: false,
    strokeColor: style.color,
    strokeOpacity: opacity,
    strokeWeight: Math.round(weight),
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    zIndex: isIntercity ? 220 : 180,
  };
}

function getGoogleRouteOutlineOptions(isActive, isIntercity = false) {
  return {
    clickable: false,
    geodesic: false,
    strokeColor: '#ffffff',
    strokeOpacity: isActive ? 0.9 : 0.2,
    strokeWeight: isIntercity ? 9 : 8,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    zIndex: isIntercity ? 210 : 170,
  };
}

function getGoogleOfficialPolylineOptions(defaultOptions = {}, segment, isActive, isIntercity = false) {
  return {
    ...defaultOptions,
    clickable: true,
    strokeOpacity: isActive
      ? Math.max(defaultOptions.strokeOpacity ?? 0.9, isIntercity ? 0.96 : 0.9)
      : (isIntercity ? 0.28 : 0.22),
    strokeWeight: Math.max(defaultOptions.strokeWeight ?? 0, isIntercity ? 6 : 5),
    zIndex: isIntercity ? 220 : 180,
  };
}

function setGooglePlaceholderVisible(route, visible) {
  const line = route.polyline?.line;
  const outline = route.polyline?.outline;
  if (line) {
    line.setMap(visible ? map : null);
  }
  if (outline) {
    outline.setMap(visible ? map : null);
  }
}

function clearOfficialGooglePolylines(route) {
  const officialPolylines = route.polyline?.officialPolylines || [];
  officialPolylines.forEach((polyline) => {
    polyline.setMap(null);
  });
  if (route.polyline) {
    route.polyline.officialPolylines = [];
  }
}

function applyOfficialGoogleTransitPolylines(route, routeObject) {
  if (!routeObject?.createPolylines || !route.polyline) {
    return false;
  }

  clearOfficialGooglePolylines(route);
  const isIntercity = route.segment.scope === 'intercity';
  const officialPolylines = routeObject.createPolylines({
    polylineOptions: (defaultOptions) => getGoogleOfficialPolylineOptions(defaultOptions, route.segment, true, isIntercity),
  });

  if (!officialPolylines?.length) {
    return false;
  }

  officialPolylines.forEach((polyline) => {
    polyline.setMap(map);
    attachGoogleRouteTooltip(polyline, route.segment);
  });
  route.polyline.officialPolylines = officialPolylines;
  setGooglePlaceholderVisible(route, false);
  return true;
}

function resolveRoutePoints(segment) {
  const endpointPoints = resolveRouteEndpoints(segment);
  if (USE_SCHEMATIC_CURVES && segment.scope === 'intercity' && endpointPoints.length === 2) {
    return buildIntercityRoutePoints(endpointPoints[0], endpointPoints[1], segment);
  }

  if (USE_SCHEMATIC_CURVES && endpointPoints.length === 2 && shouldCurveSegment(segment)) {
    return buildCurvedRoutePoints(endpointPoints[0], endpointPoints[1], segment);
  }

  if (endpointPoints.length >= 2) {
    return endpointPoints;
  }

  if (Array.isArray(segment.path) && segment.path.length >= 2) {
    return segment.path.map(point => [point[0], point[1]]);
  }

  return endpointPoints;
}

function getIntercityPortOverride(segmentId) {
  return INTERCITY_PORT_OVERRIDES[segmentId] || null;
}

function resolveSegmentCities(segment) {
  const fromEntry = segment.fromSpotId ? store.allEntriesById.get(segment.fromSpotId) : null;
  const toEntry = segment.toSpotId ? store.allEntriesById.get(segment.toSpotId) : null;
  return new Set([fromEntry?.city, toEntry?.city].filter(Boolean));
}

function getCurveGroupKey(segment) {
  const cities = [...resolveSegmentCities(segment)].sort();
  const cityKey = cities.length ? cities.join('|') : 'unknown';
  return `${segment.scope}:${segment.day}:${cityKey}`;
}

function shouldCurveSegment(segment) {
  return Boolean(getCurveMeta(segment).needsCurve);
}

function getAlternatingLane(index) {
  const depth = Math.floor(index / 2) + 1;
  return index % 2 === 0 ? depth : -depth;
}

function getStraightRoutePoints(segment) {
  const endpointPoints = resolveRouteEndpoints(segment);
  if (segment.scope === 'intercity' && endpointPoints.length === 2) {
    return buildIntercityRoutePoints(endpointPoints[0], endpointPoints[1], segment);
  }
  if (endpointPoints.length === 2) {
    return endpointPoints;
  }
  if (Array.isArray(segment.path) && segment.path.length >= 2) {
    return dedupePolylinePoints(segment.path.map(point => [point[0], point[1]]));
  }
  return endpointPoints;
}

function pointsNearlyEqual(first, second, epsilon = 1e-5) {
  return Math.abs(first[0] - second[0]) <= epsilon && Math.abs(first[1] - second[1]) <= epsilon;
}

function projectPoint(point, scaleX) {
  return {
    x: point[1] * scaleX,
    y: point[0],
  };
}

function toProjectedSegments(firstPoints, secondPoints) {
  const latitudes = [firstPoints[0][0], firstPoints[firstPoints.length - 1][0], secondPoints[0][0], secondPoints[secondPoints.length - 1][0]];
  const meanLatRad = (latitudes.reduce((sum, value) => sum + value, 0) / latitudes.length) * Math.PI / 180;
  const scaleX = Math.max(Math.cos(meanLatRad), 0.2);
  return {
    firstStart: projectPoint(firstPoints[0], scaleX),
    firstEnd: projectPoint(firstPoints[firstPoints.length - 1], scaleX),
    secondStart: projectPoint(secondPoints[0], scaleX),
    secondEnd: projectPoint(secondPoints[secondPoints.length - 1], scaleX),
  };
}

function crossProduct(origin, first, second) {
  return ((first.x - origin.x) * (second.y - origin.y)) - ((first.y - origin.y) * (second.x - origin.x));
}

function isPointOnSegment(point, start, end, epsilon = 1e-9) {
  return (
    Math.min(start.x, end.x) - epsilon <= point.x &&
    point.x <= Math.max(start.x, end.x) + epsilon &&
    Math.min(start.y, end.y) - epsilon <= point.y &&
    point.y <= Math.max(start.y, end.y) + epsilon
  );
}

function lineSegmentsIntersect(startA, endA, startB, endB) {
  const o1 = crossProduct(startA, endA, startB);
  const o2 = crossProduct(startA, endA, endB);
  const o3 = crossProduct(startB, endB, startA);
  const o4 = crossProduct(startB, endB, endA);
  const epsilon = 1e-9;

  if (((o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon))
      && ((o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon))) {
    return true;
  }

  if (Math.abs(o1) <= epsilon && isPointOnSegment(startB, startA, endA, epsilon)) {
    return true;
  }
  if (Math.abs(o2) <= epsilon && isPointOnSegment(endB, startA, endA, epsilon)) {
    return true;
  }
  if (Math.abs(o3) <= epsilon && isPointOnSegment(startA, startB, endB, epsilon)) {
    return true;
  }
  if (Math.abs(o4) <= epsilon && isPointOnSegment(endA, startB, endB, epsilon)) {
    return true;
  }

  return false;
}

function pointToSegmentDistanceSq(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    return ((point.x - start.x) ** 2) + ((point.y - start.y) ** 2);
  }
  const t = Math.max(0, Math.min(1, (((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / ((dx ** 2) + (dy ** 2))));
  const projectedX = start.x + (t * dx);
  const projectedY = start.y + (t * dy);
  return ((point.x - projectedX) ** 2) + ((point.y - projectedY) ** 2);
}

function getSegmentLength(start, end) {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function getSegmentAngleDelta(startA, endA, startB, endB) {
  const vectorAX = endA.x - startA.x;
  const vectorAY = endA.y - startA.y;
  const vectorBX = endB.x - startB.x;
  const vectorBY = endB.y - startB.y;
  const angle = Math.abs(Math.atan2((vectorAX * vectorBY) - (vectorAY * vectorBX), (vectorAX * vectorBX) + (vectorAY * vectorBY)));
  return Math.min(angle, Math.PI - angle);
}

function getProjectedOverlapRatio(startA, endA, startB, endB) {
  const lengthA = getSegmentLength(startA, endA);
  const lengthB = getSegmentLength(startB, endB);
  if (lengthA < 1e-9 || lengthB < 1e-9) {
    return 0;
  }

  const axisX = (endA.x - startA.x) / lengthA;
  const axisY = (endA.y - startA.y) / lengthA;
  const project = point => ((point.x - startA.x) * axisX) + ((point.y - startA.y) * axisY);
  const rangeB = [project(startB), project(endB)].sort((first, second) => first - second);
  const overlap = Math.max(0, Math.min(lengthA, rangeB[1]) - Math.max(0, rangeB[0]));
  return overlap / Math.min(lengthA, lengthB);
}

function shouldCurveForConflict(currentPoints, previousPoints) {
  if (currentPoints.length !== 2 || previousPoints.length !== 2) {
    return false;
  }

  const sharedEndpoint = currentPoints.some(currentPoint => previousPoints.some(previousPoint => pointsNearlyEqual(currentPoint, previousPoint)));
  const projected = toProjectedSegments(currentPoints, previousPoints);
  const minDistance = Math.sqrt(Math.min(
    pointToSegmentDistanceSq(projected.firstStart, projected.secondStart, projected.secondEnd),
    pointToSegmentDistanceSq(projected.firstEnd, projected.secondStart, projected.secondEnd),
    pointToSegmentDistanceSq(projected.secondStart, projected.firstStart, projected.firstEnd),
    pointToSegmentDistanceSq(projected.secondEnd, projected.firstStart, projected.firstEnd),
  ));

  if (!sharedEndpoint && lineSegmentsIntersect(projected.firstStart, projected.firstEnd, projected.secondStart, projected.secondEnd)) {
    return true;
  }

  if (sharedEndpoint) {
    return false;
  }

  const angleDelta = getSegmentAngleDelta(projected.firstStart, projected.firstEnd, projected.secondStart, projected.secondEnd);
  const overlapRatio = getProjectedOverlapRatio(projected.firstStart, projected.firstEnd, projected.secondStart, projected.secondEnd);
  const nearlyParallel = angleDelta < 0.18;
  return nearlyParallel && minDistance < 0.0012 && overlapRatio > 0.2;
}

function primeCurveMeta() {
  store.curveMetaBySegmentId.clear();

  const grouped = new Map();
  const segments = Array.isArray(store.itineraryData?.routeSegments) ? store.itineraryData.routeSegments : [];
  segments.forEach((segment) => {
    const key = getCurveGroupKey(segment);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(segment);
  });

  grouped.forEach((groupSegments) => {
    const straightPointsBySegmentId = new Map(
      groupSegments.map(segment => [segment.id, getStraightRoutePoints(segment)])
    );

    groupSegments.forEach((segment, index) => {
      const currentPoints = straightPointsBySegmentId.get(segment.id) || [];
      let needsCurve = false;
      let conflictCount = 0;

      if (segment.scope !== 'intercity') {
        for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
          const previousSegment = groupSegments[previousIndex];
          const previousPoints = straightPointsBySegmentId.get(previousSegment.id) || [];
          if (shouldCurveForConflict(currentPoints, previousPoints)) {
            needsCurve = true;
            conflictCount += 1;
          }
        }
      }

      store.curveMetaBySegmentId.set(segment.id, {
        indexInGroup: index,
        groupSize: groupSegments.length,
        lane: getAlternatingLane(index),
        needsCurve,
        conflictCount,
      });
    });
  });
}

function getCurveMeta(segment) {
  return store.curveMetaBySegmentId.get(segment.id) || {
    indexInGroup: 0,
    groupSize: 1,
    lane: 1,
    needsCurve: false,
    conflictCount: 0,
  };
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function getCurveStrength(segment, distance) {
  if (segment.scope === 'intercity') {
    return 0;
  }

  const transportBias = {
    walk: 0.82,
    bus: 0.9,
    metro: 1,
    jrrapid: 1.08,
    shinkansen: 1.12,
    nankai: 1.06,
  };

  // Longer city hops get a higher arc so short intra-area moves stay tidy.
  const normalizedDistance = Math.min(distance / 0.09, 1);
  const easedDistance = 1 - ((1 - normalizedDistance) ** 1.35);
  const minBend = 0.001;
  const maxBend = 0.019;
  const bias = transportBias[segment.transportType] || 1;
  const bend = minBend + ((maxBend - minBend) * easedDistance * bias);
  return Math.min(Math.max(bend, minBend), maxBend);
}

function dedupePolylinePoints(points) {
  return points.filter((point, index) => {
    if (index === 0) {
      return true;
    }
    const previous = points[index - 1];
    return Math.abs(previous[0] - point[0]) > 1e-6 || Math.abs(previous[1] - point[1]) > 1e-6;
  });
}

function buildIntercityRoutePoints(start, end, segment) {
  const override = getIntercityPortOverride(segment.id);
  if (!override) {
    return [start, end];
  }

  return dedupePolylinePoints([
    start,
    override.startPort || start,
    override.endPort || end,
    end,
  ]);
}

function buildCurvedRoutePoints(start, end, segment) {
  const [lat1, lng1] = start;
  const [lat2, lng2] = end;
  const meanLatRad = ((lat1 + lat2) / 2) * Math.PI / 180;
  const scaleX = Math.max(Math.cos(meanLatRad), 0.2);
  const x1 = lng1 * scaleX;
  const y1 = lat1;
  const x2 = lng2 * scaleX;
  const y2 = lat2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);

  if (distance < 1e-6 || segment.scope === 'intercity') {
    return [start, end];
  }

  const curveMeta = getCurveMeta(segment);
  const fallbackSign = hashString(segment.id || `${segment.fromSpotId}-${segment.toSpotId}`) % 2 === 0 ? 1 : -1;
  const lane = curveMeta.lane || fallbackSign;
  const laneSign = Math.sign(lane) || fallbackSign;
  const laneMagnitude = Math.max(1, Math.abs(lane));
  const conflictSpread = curveMeta.conflictCount > 1 ? Math.min(1.34, 1 + ((curveMeta.conflictCount - 1) * 0.12)) : 1;
  const bend = getCurveStrength(segment, distance) * (1 + ((laneMagnitude - 1) * 0.24)) * conflictSpread;
  const perpX = (-dy / distance) * bend * laneSign;
  const perpY = (dx / distance) * bend * laneSign;
  const controlX = ((x1 + x2) / 2) + perpX;
  const controlY = ((y1 + y2) / 2) + perpY;
  const pointCount = Math.max(14, Math.min(22, Math.round(12 + (distance * 120))));
  const points = [];

  for (let index = 0; index <= pointCount; index += 1) {
    const t = index / pointCount;
    const oneMinusT = 1 - t;
    const curveX = (oneMinusT ** 2 * x1) + (2 * oneMinusT * t * controlX) + (t ** 2 * x2);
    const curveY = (oneMinusT ** 2 * y1) + (2 * oneMinusT * t * controlY) + (t ** 2 * y2);
    points.push([curveY, curveX / scaleX]);
  }

  return points;
}

function buildRouteTooltip(segment) {
  const parts = [
    segment.label || TRANSPORT_ICONS[segment.transportType] || '路线',
    segment.duration || '',
  ].filter(Boolean);

  const actualParts = [];
  if (segment.realDistanceMeters) {
    actualParts.push(formatDistance(segment.realDistanceMeters));
  }
  if (segment.realDurationSec) {
    actualParts.push(formatDuration(segment.realDurationSec));
  }

  const warningText = Array.isArray(segment.realWarnings) && segment.realWarnings.length
    ? `<br>${segment.realWarnings.join(' / ')}`
    : '';
  const metaText = actualParts.length ? `<br>贴路参考：${actualParts.join(' · ')}` : '';
  return segment.note
    ? `<strong>${parts.join(' · ')}</strong><br>${segment.note}${metaText}${warningText}`
    : `<strong>${parts.join(' · ')}</strong>${metaText}${warningText}`;
}

function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} 公里`;
  }
  return `${Math.round(meters)} 米`;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `约 ${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `约 ${hours} 小时 ${restMinutes} 分钟` : `约 ${hours} 小时`;
}

function getLeafletRoutingBaseUrl() {
  return store.itineraryData?.config?.routing?.baseUrl || LEAFLET_ROUTING_CONFIG.baseUrl;
}

function getLeafletRoutingProfile(transportType) {
  return LEAFLET_ROUTING_CONFIG.profiles[transportType] || null;
}

function getGoogleTravelMode(transportType) {
  return GOOGLE_ROUTING_CONFIG.travelModes[transportType] || null;
}

function getGoogleTransitPreference(transportType) {
  return GOOGLE_ROUTING_CONFIG.transitPreferences[transportType] || null;
}

function isGoogleTransitMode(travelMode) {
  return travelMode === 'TRANSIT';
}

function isRailTransportType(transportType) {
  return ['metro', 'jrrapid', 'shinkansen', 'nankai'].includes(transportType);
}

function getTransitStationOverride(segmentId) {
  return TRANSIT_STATION_OVERRIDES[segmentId] || null;
}

function getTransitRouteOverride(segmentId) {
  return TRANSIT_ROUTE_OVERRIDES[segmentId] || null;
}

function resolveRouteEndpoints(segment) {
  const fromEntry = segment.fromSpotId ? store.allEntriesById.get(segment.fromSpotId) : null;
  const toEntry = segment.toSpotId ? store.allEntriesById.get(segment.toSpotId) : null;
  if (!fromEntry || !toEntry) {
    return [];
  }

  return [
    [fromEntry.lat, fromEntry.lng],
    [toEntry.lat, toEntry.lng],
  ];
}

function getGoogleRoutingPoints(segment, travelMode) {
  if (isGoogleTransitMode(travelMode)) {
    const spotEndpoints = resolveRouteEndpoints(segment);
    const overrides = getTransitStationOverride(segment.id);
    if (!spotEndpoints.length) {
      return [];
    }

    return [
      overrides?.origin || spotEndpoints[0],
      overrides?.destination || spotEndpoints[1],
    ];
  }

  return Array.isArray(segment.path) && segment.path.length >= 2
    ? segment.path
    : resolveRoutePoints(segment);
}

function getDistanceMetersBetweenPoints([lat1, lng1], [lat2, lng2]) {
  const toRad = value => value * Math.PI / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function maybeAttachAccessPoint(points, point, position = 'start') {
  if (!points.length || !point) {
    return points;
  }

  const edgePoint = position === 'start' ? points[0] : points[points.length - 1];
  if (getDistanceMetersBetweenPoints(edgePoint, point) < 18) {
    return points;
  }

  if (position === 'start') {
    return [point, ...points];
  }

  return [...points, point];
}

function mergeTransitAccessPoints(segment, resolvedPoints, routingPoints) {
  const spotEndpoints = resolveRouteEndpoints(segment);
  if (!spotEndpoints.length || !routingPoints.length) {
    return resolvedPoints;
  }

  let merged = [...resolvedPoints];
  if (getDistanceMetersBetweenPoints(spotEndpoints[0], routingPoints[0]) > 18) {
    merged = maybeAttachAccessPoint(merged, spotEndpoints[0], 'start');
  }
  if (getDistanceMetersBetweenPoints(spotEndpoints[1], routingPoints[routingPoints.length - 1]) > 18) {
    merged = maybeAttachAccessPoint(merged, spotEndpoints[1], 'end');
  }
  return merged;
}

function getGoogleTransitDepartureTime() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  return new Date(`${year}-${month}-${day}T10:00:00+09:00`);
}

function shouldHydrateRoute(segment) {
  if (USE_SCHEMATIC_CURVES) {
    return false;
  }
  if (isGoogleMap()) {
    return Boolean(getGoogleTravelMode(segment.transportType));
  }
  return Boolean(getLeafletRoutingProfile(segment.transportType));
}

function buildRoutingCacheKey(segment) {
  const travelMode = isGoogleMap() ? getGoogleTravelMode(segment.transportType) : null;
  const points = isGoogleMap()
    ? getGoogleRoutingPoints(segment, travelMode)
    : (
        Array.isArray(segment.path) && segment.path.length >= 2
          ? segment.path
          : resolveRoutePoints(segment)
      );
  const serialized = points.map(([lat, lng]) => `${lng},${lat}`).join(';');
  return `${state.mapProvider}:${segment.transportType}:${serialized}`;
}

async function hydrateRealRouteGeometries() {
  const targets = store.routeSegments.filter(route => shouldHydrateRoute(route.segment));
  if (!targets.length) {
    return;
  }

  const concurrency = isGoogleMap()
    ? GOOGLE_ROUTING_CONFIG.concurrency
    : LEAFLET_ROUTING_CONFIG.concurrency;

  await runWithConcurrency(targets, concurrency, async route => {
    await hydrateSingleRouteGeometry(route);
  });

  if (state.currentDay !== null) {
    fitToCurrentDay();
  }
}

async function runWithConcurrency(items, concurrency, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) {
        return;
      }
      try {
        await worker(item);
      } catch (error) {
        console.warn('真实路线贴线失败:', error);
      }
    }
  });

  await Promise.allSettled(runners);
}

async function hydrateSingleRouteGeometry(route) {
  const { segment } = route;
  const cacheKey = buildRoutingCacheKey(segment);

  if (routeGeometryCache.has(cacheKey)) {
    applyResolvedRouteGeometry(route, routeGeometryCache.get(cacheKey));
    return;
  }

  const resolved = await fetchResolvedRouteGeometry(segment);
  if (!resolved) {
    return;
  }

  routeGeometryCache.set(cacheKey, resolved);
  applyResolvedRouteGeometry(route, resolved);
}

async function fetchResolvedRouteGeometry(segment) {
  if (isGoogleMap()) {
    return fetchGoogleRouteGeometry(segment);
  }
  return fetchLeafletResolvedRouteGeometry(segment);
}

async function fetchLeafletResolvedRouteGeometry(segment) {
  const profile = getLeafletRoutingProfile(segment.transportType);
  if (!profile) {
    return null;
  }

  const points = Array.isArray(segment.path) && segment.path.length >= 2
    ? segment.path
    : resolveRoutePoints(segment);
  if (points.length < 2) {
    return null;
  }

  const coordinates = points.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `${getLeafletRoutingBaseUrl()}/${profile}/${coordinates}?overview=full&geometries=geojson&steps=false`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), LEAFLET_ROUTING_CONFIG.timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Routing API ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length || !data.routes[0].geometry?.coordinates?.length) {
      throw new Error(`Routing API 响应异常: ${data.code || 'unknown'}`);
    }

    return {
      points: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceMeters: data.routes[0].distance || null,
      durationSec: data.routes[0].duration || null,
      warnings: null,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchGoogleRouteGeometry(segment) {
  const travelMode = getGoogleTravelMode(segment.transportType);
  if (!travelMode || !googleLibs.Route) {
    return null;
  }

  const spotEndpoints = resolveRouteEndpoints(segment);
  const points = getGoogleRoutingPoints(segment, travelMode);
  if (points.length < 2) {
    return null;
  }

  const request = {
    origin: { location: toLatLngLiteral(points[0]) },
    destination: { location: toLatLngLiteral(points[points.length - 1]) },
    travelMode,
    fields: ['path', 'legs', 'distanceMeters', 'durationMillis', 'warnings'],
    polylineQuality: 'HIGH_QUALITY',
  };

  if (isGoogleTransitMode(travelMode)) {
    request.departureTime = getGoogleTransitDepartureTime();
    request.transitPreference = getTransitRouteOverride(segment.id) || getGoogleTransitPreference(segment.transportType) || {
      allowedTransitModes: ['SUBWAY', 'TRAIN', 'LIGHT_RAIL', 'RAIL'],
      routingPreference: 'LESS_WALKING',
    };
  } else if (points.length > 2) {
    request.intermediates = points.slice(1, -1).map(point => ({
      location: toLatLngLiteral(point),
      via: true,
    }));
  }

  const { routes } = await googleLibs.Route.computeRoutes(request);
  const route = routes?.[0];
  if (!route?.path?.length) {
    return null;
  }

  const resolvedPoints = extractGoogleRoutePath(route, segment.transportType);
  const mergedPoints = isGoogleTransitMode(travelMode)
    ? mergeTransitAccessPoints(segment, resolvedPoints, points, spotEndpoints)
    : resolvedPoints;

  return {
    points: mergedPoints,
    distanceMeters: route.distanceMeters || null,
    durationSec: route.durationMillis ? route.durationMillis / 1000 : null,
    warnings: route.warnings || null,
    routeObject: route,
  };
}

function extractGoogleRoutePath(route, transportType = '') {
  const points = [];
  const transitOnly = isRailTransportType(transportType);

  route.legs?.forEach((leg) => {
    leg.steps?.forEach((step) => {
      if (transitOnly && step.travelMode && step.travelMode !== 'TRANSIT') {
        return;
      }
      step.path?.forEach((point) => {
        const normalized = normalizeGooglePathPoint(point);
        const last = points[points.length - 1];
        if (!last || last[0] !== normalized[0] || last[1] !== normalized[1]) {
          points.push(normalized);
        }
      });
    });
  });

  if (points.length) {
    return points;
  }

  return route.path.map(normalizeGooglePathPoint);
}

function toLatLngLiteral([lat, lng]) {
  return { lat, lng };
}

function normalizeGooglePathPoint(point) {
  const lat = typeof point.lat === 'function' ? point.lat() : point.lat;
  const lng = typeof point.lng === 'function' ? point.lng() : point.lng;
  return [lat, lng];
}

function applyResolvedRouteGeometry(route, resolved) {
  if (!resolved?.points?.length) {
    return;
  }

  route.points = resolved.points;
  route.segment.realDistanceMeters = resolved.distanceMeters;
  route.segment.realDurationSec = resolved.durationSec;
  route.segment.realWarnings = resolved.warnings || null;

  if (isGoogleMap()) {
    const usedOfficialPolylines = isRailTransportType(route.segment.transportType)
      && applyOfficialGoogleTransitPolylines(route, resolved.routeObject);

    if (!usedOfficialPolylines) {
      const path = resolved.points.map(([lat, lng]) => ({ lat, lng }));
      route.polyline.line.setPath(path);
      route.polyline.outline.setPath(path);
      setGooglePlaceholderVisible(route, true);
    }
    updateRouteVisibility();
  } else {
    route.polyline.setLatLngs(resolved.points);
    route.polyline.setTooltipContent(buildRouteTooltip(route.segment));
  }
}

function getPopupHtml(spot) {
  const color = store.itineraryData.config.dayColors[spot.day - 1];
  const nextSpot = store.nextSpotById.get(spot.id);
  const lastSpot = store.dayLastSpot.get(spot.day);
  const hasTransportCallout = Boolean(
    lastSpot &&
      lastSpot.id === spot.id &&
      spot.transportNote &&
      spot.nearNextTransport
  );
  const subLabel = spot.nameEn ? `<div class="popup-name-en">${spot.nameEn}</div>` : '';
  const nextLabel = nextSpot ? nextSpot.name : '';
  const nextNavUrl = nextSpot
    ? `https://www.google.com/maps/dir/?api=1&origin=${spot.lat},${spot.lng}&destination=${nextSpot.lat},${nextSpot.lng}`
    : '';
  const nextNavBtn = nextSpot
    ? `<a class="popup-nav-btn" href="${nextNavUrl}" target="_blank" rel="noopener noreferrer" aria-label="用 Google Maps 导航到${nextSpot.name}">导航</a>`
    : '';

  return `
    <div class="popup-day" style="color:${color}">第 ${spot.day} 天 · ${formatTimeSlot(spot.timeSlot)}</div>
    <div class="popup-name">${spot.name}${spot.mustVisit ? '<span class="popup-must">必去</span>' : ''}</div>
    ${subLabel}
    <div class="popup-meta">
      <span>${spot.area}</span>
      <span>${spot.stayMinutes} 分钟</span>
    </div>
    <div class="popup-desc">${spot.description}</div>
    <div class="popup-why">推荐理由：${spot.whyGo}</div>
    ${hasTransportCallout ? `<div class="popup-transport">${spot.transportNote}</div>` : ''}
    ${nextLabel ? `<div class="popup-next">下一站：${nextLabel}${nextNavBtn}</div>` : ''}
    <div class="popup-mobile-only">${spot.description}</div>
    ${state.isMobile ? `<button class="popup-detail-btn" data-id="${spot.id}" type="button">在下方抽屉展开</button>` : ''}
  `;
}

function buildPopupContentNode(spot) {
  const shell = document.createElement('div');
  shell.className = 'popup-shell';
  shell.innerHTML = getPopupHtml(spot);
  const button = shell.querySelector('.popup-detail-btn');
  if (button) {
    button.addEventListener('click', () => {
      state.selectedSpotId = spot.id;
      state.highlightedSpotId = spot.id;
      openDrawerFull();
      scrollToSpotInDrawer(spot.id);
      updateHighlights();
    });
  }
  return shell;
}

function createAllMarkers() {
  markerCache.clear();

  store.spots.forEach((spot) => {
    if (isGoogleMap()) {
      createGoogleMarker(spot);
      return;
    }
    createLeafletMarker(spot);
  });
}

function createLeafletMarker(spot) {
  const color = store.itineraryData.config.dayColors[spot.day - 1];
  const size = spot.mustVisit ? 24 : 20;
  const icon = L.divIcon({
    html: `<div class="spot-marker${spot.mustVisit ? ' is-must' : ''}" style="--marker-color:${color};--marker-size:${size}px"></div>`,
    className: 'marker-shell',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  const raw = L.marker([spot.lat, spot.lng], {
    icon,
    riseOnHover: true,
    keyboard: true,
  });

  raw.bindPopup(buildPopupContentNode(spot), {
    maxWidth: 240,
    closeButton: false,
    offset: [0, -6],
  });

  raw.on('click', event => {
    L.DomEvent.stopPropagation(event);
    selectSpot(spot.id, true);
  });

  markerCache.set(spot.id, {
    provider: MAP_PROVIDER.LEAFLET,
    raw,
    spotId: spot.id,
    setVisible(visible) {
      if (visible) {
        clusterGroup.addLayer(raw);
        normalMarkerGroup.addLayer(raw);
      } else {
        clusterGroup.removeLayer(raw);
        normalMarkerGroup.removeLayer(raw);
      }
    },
    openPopup() {
      raw.openPopup();
    },
    closePopup() {
      raw.closePopup();
    },
    setPopupContent(content) {
      raw.setPopupContent(content);
    },
    getElement() {
      return raw.getElement();
    },
  });
}

function createGoogleMarker(spot) {
  const marker = new googleLibs.Marker({
    map,
    position: { lat: spot.lat, lng: spot.lng },
    title: spot.name,
    optimized: false,
    clickable: true,
  });

  const infoWindow = new googleLibs.InfoWindow({
    content: buildPopupContentNode(spot),
    maxWidth: 260,
    ariaLabel: spot.name,
  });

  marker.addListener('click', () => {
    selectSpot(spot.id, true);
  });

  const markerRef = {
    provider: MAP_PROVIDER.GOOGLE,
    raw: marker,
    infoWindow,
    spot,
    spotId: spot.id,
    setVisible(visible) {
      marker.setMap(visible ? map : null);
      if (!visible && activeInfoWindow === infoWindow) {
        activeInfoWindow.close();
      }
    },
    openPopup() {
      if (activeInfoWindow && activeInfoWindow !== infoWindow) {
        activeInfoWindow.close();
      }
      infoWindow.open({ anchor: marker, map, shouldFocus: false });
      activeInfoWindow = infoWindow;
    },
    closePopup() {
      infoWindow.close();
      if (activeInfoWindow === infoWindow) {
        activeInfoWindow = null;
      }
    },
    setPopupContent(contentNode) {
      infoWindow.setContent(contentNode);
    },
    getElement() {
      return null;
    },
  };

  markerCache.set(spot.id, markerRef);
  applyGoogleMarkerAppearance(markerRef);
}

function getGoogleMarkerStyle(spot, isActive = false, isNext = false) {
  const color = store.itineraryData.config.dayColors[spot.day - 1];
  const size = isActive
    ? (spot.mustVisit ? 38 : 34)
    : (isNext ? (spot.mustVisit ? 34 : 30) : (spot.mustVisit ? 32 : 28));
  const strokeColor = isActive ? '#183847' : (isNext ? '#236f7a' : '#ffffff');
  const svg = buildGoogleMarkerSvg({
    color,
    strokeColor,
    mustVisit: spot.mustVisit,
  });

  return {
    icon: {
      url: svg,
      scaledSize: new google.maps.Size(size, size),
      anchor: new google.maps.Point(size / 2, size / 2),
    },
    zIndex: isActive ? 1200 + spot.day : (isNext ? 900 + spot.day : 100 + spot.day),
  };
}

function buildGoogleMarkerSvg({ color, strokeColor, mustVisit }) {
  const star = mustVisit
    ? "<text x='24' y='29' text-anchor='middle' font-size='16' font-weight='800' fill='#ffffff'>★</text>"
    : '';
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
      <circle cx='24' cy='24' r='12' fill='${color}' stroke='${strokeColor}' stroke-width='5'/>
      ${star}
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function applyGoogleMarkerAppearance(markerRef) {
  if (!markerRef || markerRef.provider !== MAP_PROVIDER.GOOGLE) {
    return;
  }

  const isActive = markerRef.spotId === state.highlightedSpotId;
  const isNext = state.showNextOnly && store.nextStopIds.has(markerRef.spotId) && !isActive;
  const style = getGoogleMarkerStyle(markerRef.spot, isActive, isNext);
  markerRef.raw.setIcon(style.icon);
  markerRef.raw.setZIndex(style.zIndex);
}

function renderLegendDots() {
  refs.legendDots.innerHTML = store.itineraryData.config.dayColors
    .map(
      (color, index) => `
        <span class="legend-chip">
          <span class="legend-dot" style="background:${color}"></span>
          第 ${index + 1} 天
        </span>
      `
    )
    .join('');
}

function renderFilters() {
  const dayGroup = refs.filters.querySelector('[data-filter="day"]').parentElement;
  const cityGroup = refs.filters.querySelector('[data-filter="city"]').parentElement;

  store.dayNumbers.forEach((day) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-btn';
    button.dataset.filter = 'day';
    button.dataset.value = String(day);
    button.textContent = `第${day}天`;
    dayGroup.appendChild(button);
  });

  store.cityNames.forEach((city) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-btn';
    button.dataset.filter = 'city';
    button.dataset.value = city;
    button.textContent = city;
    cityGroup.appendChild(button);
  });
}

function renderDayFocusSelect() {
  refs.todayBtn.innerHTML = [
    '<option value="all">全部天数</option>',
    ...store.dayNumbers.map(day => `<option value="${day}">第 ${day} 天</option>`),
  ].join('');
}

function renderMobileFilterSheet() {
  refs.mobileDayChips.innerHTML = [
    '<button class="chip-btn active" data-filter="day" data-value="all" type="button">全部</button>',
    ...store.dayNumbers.map(
      day => `<button class="chip-btn" data-filter="day" data-value="${day}" type="button">第${day}天</button>`
    ),
  ].join('');

  refs.mobileCityChips.innerHTML = [
    '<button class="chip-btn active" data-filter="city" data-value="all" type="button">全部</button>',
    ...store.cityNames.map(
      city => `<button class="chip-btn" data-filter="city" data-value="${city}" type="button">${city}</button>`
    ),
  ].join('');
}

function renderDayLists() {
  const markup = store.dayNumbers.map(day => buildDayPanelMarkup(day)).join('');
  refs.dayListPanel.innerHTML = markup;
  refs.drawerContent.innerHTML = markup;
  cacheListRefs();
}

function buildDayPanelMarkup(day) {
  const daySpots = store.spotsByDay.get(day) || [];
  const dayEntries = store.allEntriesByDay.get(day) || [];
  const color = store.itineraryData.config.dayColors[day - 1];
  const travelEntry = dayEntries.find((entry) => entry.type === 'transport');
  const content = daySpots.length
    ? daySpots.map(spot => buildSpotMarkup(spot, color)).join('')
    : `
        <div class="day-empty">
          <p class="day-empty-title">${travelEntry ? '纯交通日' : '待补充日'}</p>
          <p class="day-empty-copy">${travelEntry ? travelEntry.description : '这一天目前还没有安排可显示的景点。'}</p>
          ${travelEntry?.transportNote ? `<span class="transport-badge">${travelEntry.transportNote}</span>` : ''}
        </div>
      `;

  return `
    <section class="day-panel" data-day="${day}">
      <button class="day-header" data-day="${day}" type="button">
        <span class="day-header-copy">
          <span class="day-chip" style="--day-color:${color}">第 ${day} 天</span>
          <span class="day-title">${getDayLabel(day)}</span>
        </span>
        <span class="day-header-meta">
          <span>${daySpots.length} 个点</span>
          <span class="day-toggle">▾</span>
        </span>
      </button>
      <div class="day-spots">
        ${content}
      </div>
    </section>
  `;
}

function buildSpotMarkup(spot, color) {
  const badges = [
    spot.mustVisit ? '<span class="must-badge">必去</span>' : '',
    spot.nextStopId ? '<span class="next-badge">下一段</span>' : '',
  ].join('');
  const subLabel = spot.nameEn ? `<span class="spot-name-en">${spot.nameEn}</span>` : '';

  return `
    <button class="spot-item" data-id="${spot.id}" style="--spot-color:${color}" type="button">
      <span class="spot-index">${String(spot.order).padStart(2, '0')}</span>
      <span class="spot-copy">
        <span class="spot-name">${spot.name}${badges}</span>
        ${subLabel}
        <span class="spot-meta">${formatTimeSlot(spot.timeSlot)} · ${spot.stayMinutes} 分钟 · ${spot.area}</span>
        ${spot.transportNote ? `<span class="spot-note"><span class="transport-badge">${spot.transportNote}</span></span>` : ''}
      </span>
    </button>
  `;
}

function cacheListRefs() {
  store.panelRefs.desktop = cachePanelMap(refs.dayListPanel);
  store.panelRefs.mobile = cachePanelMap(refs.drawerContent);
  store.spotRefs.desktop = cacheSpotMap(refs.dayListPanel);
  store.spotRefs.mobile = cacheSpotMap(refs.drawerContent);
}

function cachePanelMap(container) {
  const mapRef = new Map();
  container.querySelectorAll('.day-panel').forEach((panel) => {
    mapRef.set(Number(panel.dataset.day), panel);
  });
  return mapRef;
}

function cacheSpotMap(container) {
  const mapRef = new Map();
  container.querySelectorAll('.spot-item').forEach((item) => {
    mapRef.set(item.dataset.id, item);
  });
  return mapRef;
}

function getFilteredSpots() {
  return store.spots.filter((spot) => {
    if (state.currentDay !== null && spot.day !== state.currentDay) {
      return false;
    }
    if (state.currentCity !== null && spot.city !== state.currentCity) {
      return false;
    }
    if (state.showMustOnly && !spot.mustVisit) {
      return false;
    }
    if (state.showNextOnly && !spot.nextStopId) {
      return false;
    }
    return true;
  });
}

function getDesiredVisibleIds() {
  return new Set(getFilteredSpots().map(spot => spot.id));
}

function refreshUi() {
  updateMarkerVisibility();
  updateDayPanelVisibility();
  updateSummary();
  updateControlState();
  updateRouteVisibility();
  updateDrawerHeader();
  updateHighlights();
  syncSelectedPopup();
}

function updateMarkerVisibility() {
  const desiredIds = getDesiredVisibleIds();

  markerCache.forEach((markerRef, id) => {
    const shouldShow = desiredIds.has(id);
    const isShowing = state.markersVisible.has(id);
    if (shouldShow === isShowing) {
      return;
    }
    markerRef.setVisible(shouldShow);
  });

  state.markersVisible = desiredIds;
}

function updateDayPanelVisibility() {
  const visibleDays = new Set(getFilteredSpots().map(spot => spot.day));
  if (state.currentDay !== null) {
    visibleDays.add(state.currentDay);
  }
  ['desktop', 'mobile'].forEach((mode) => {
    store.panelRefs[mode].forEach((panel, day) => {
      panel.style.display = visibleDays.has(day) ? '' : 'none';
    });
  });
}

function updateSummary() {
  const visibleSpots = getFilteredSpots();
  const visibleDays = new Set(visibleSpots.map(spot => spot.day));
  const visibleCities = new Set(visibleSpots.map(spot => spot.city));
  const activeBits = [];

  if (state.currentDay !== null) {
    activeBits.push(`第 ${state.currentDay} 天`);
  }
  if (state.currentCity !== null) {
    activeBits.push(state.currentCity);
  }
  if (state.showMustOnly) {
    activeBits.push('只看必去');
  }
  if (state.showNextOnly) {
    activeBits.push('只看下一段');
  }

  refs.summaryCount.textContent = String(visibleSpots.length);
  refs.summaryDays.textContent = String(
    activeBits.length === 0
      ? store.dayNumbers.length
      : (visibleDays.size || (state.currentDay !== null ? 1 : 0))
  );
  refs.summaryCities.textContent = String(visibleCities.size || 0);
  refs.summaryActive.textContent = activeBits.length
    ? `当前显示：${activeBits.join(' · ')}。`
    : '当前显示完整路线。';
}

function updateControlState() {
  refs.todayBtn.classList.toggle('active', state.currentDay !== null);
  refs.todayBtn.value = state.currentDay === null ? 'all' : String(state.currentDay);
  refs.fitDayBtn.disabled = state.currentDay === null;
  refs.toggleListBtn.classList.toggle('active', state.isListVisible);
  refs.toggleListBtn.querySelector('.ctrl-label').textContent = state.isListVisible ? '收起列表' : '展开列表';

  refs.filters.querySelectorAll('.filter-btn').forEach((button) => {
    const { filter, value } = button.dataset;
    if (filter === 'day') {
      button.classList.toggle('active', (state.currentDay === null && value === 'all') || String(state.currentDay) === value);
    }
    if (filter === 'city') {
      button.classList.toggle('active', (state.currentCity === null && value === 'all') || state.currentCity === value);
    }
    if (filter === 'must') {
      button.classList.toggle('active', state.showMustOnly);
    }
    if (filter === 'next') {
      button.classList.toggle('active', state.showNextOnly);
    }
  });

  refs.mobileDayChips.querySelectorAll('.chip-btn').forEach((button) => {
    const value = button.dataset.value;
    button.classList.toggle('active', (state.currentDay === null && value === 'all') || String(state.currentDay) === value);
  });

  refs.mobileCityChips.querySelectorAll('.chip-btn').forEach((button) => {
    const value = button.dataset.value;
    button.classList.toggle('active', (state.currentCity === null && value === 'all') || state.currentCity === value);
  });

  refs.mobileMustToggle.classList.toggle('active', state.showMustOnly);
  refs.mobileNextToggle.classList.toggle('active', state.showNextOnly);
  updateLegendState();
}

function updateRouteVisibility() {
  const { visibleDays, visibleCities } = getVisibleRouteContext();

  store.cityRoutes.forEach((route) => {
    setRouteActiveState(route, routeMatchesCurrentFocus(route, visibleDays, visibleCities), false);
  });

  store.transferRoutes.forEach((route) => {
    setRouteActiveState(route, routeMatchesCurrentFocus(route, visibleDays, visibleCities), true);
  });
}

function getVisibleRouteContext() {
  const visibleDays = new Set(getFilteredSpots().map(spot => spot.day));
  const visibleCities = new Set(getFilteredSpots().map(spot => spot.city));

  if (state.currentDay !== null) {
    visibleDays.add(state.currentDay);
  }
  if (state.currentCity !== null) {
    visibleCities.add(state.currentCity);
  }

  return { visibleDays, visibleCities };
}

function routeMatchesCurrentFocus(route, visibleDays, visibleCities) {
  const routeDays = route.days instanceof Set ? [...route.days] : [route.day];
  const dayMatches = visibleDays.size === 0 || routeDays.some(day => visibleDays.has(day));
  const cityMatches = state.currentCity === null || [...route.cities].some((city) => visibleCities.has(city));
  return dayMatches && cityMatches;
}

function setRouteActiveState(route, isActive, isIntercity) {
  if (isGoogleMap()) {
    if (route.polyline.officialPolylines?.length) {
      route.polyline.officialPolylines.forEach((polyline) => {
        polyline.setOptions(getGoogleOfficialPolylineOptions({}, route.segment, isActive, isIntercity));
      });
      return;
    }

    route.polyline.line.setOptions(getGooglePolylineOptions(route.segment.transportType, isActive, isIntercity));
    route.polyline.outline.setOptions(getGoogleRouteOutlineOptions(isActive, isIntercity));
    return;
  }

  route.polyline.setStyle({
    opacity: isActive ? (isIntercity ? 0.88 : 0.72) : (isIntercity ? 0.15 : 0.1),
    weight: isActive ? (isIntercity ? 3.8 : 3.4) : (isIntercity ? 2.8 : 2.2),
  });
}

function selectSpot(id, pan = true) {
  const spot = store.spotById.get(id);
  if (!spot) {
    return;
  }

  state.highlightedSpotId = id;
  state.selectedSpotId = id;

  if (pan) {
    panMapToSpot(spot);
  }

  const markerRef = markerCache.get(id);
  if (markerRef && state.markersVisible.has(id)) {
    markerRef.openPopup();
  }

  updateHighlights();
  scrollToSpotItem(id);
}

function panMapToSpot(spot) {
  const viewportPadding = getMapFitPadding();
  if (isGoogleMap()) {
    map.panTo({ lat: spot.lat, lng: spot.lng });
    if (state.isMobile && typeof map.panBy === 'function') {
      window.setTimeout(() => {
        map.panBy(0, viewportPadding.selectedSpotOffsetY);
      }, 80);
    }
    return;
  }
  map.panTo([spot.lat, spot.lng], reduceMotion ? { animate: false } : { animate: true, duration: 0.6 });
  if (state.isMobile) {
    map.panBy([0, viewportPadding.selectedSpotOffsetY], reduceMotion ? { animate: false } : { animate: true, duration: 0.35 });
  }
}

function clearSelection() {
  state.highlightedSpotId = null;
  state.selectedSpotId = null;
  if (activeInfoWindow) {
    activeInfoWindow.close();
    activeInfoWindow = null;
  }
  hoverInfoWindow?.close();
  updateHighlights();
}

function updateHighlights() {
  ['desktop', 'mobile'].forEach((mode) => {
    store.spotRefs[mode].forEach((item, id) => {
      item.classList.toggle('highlighted', id === state.highlightedSpotId);
      item.classList.toggle('selected', id === state.selectedSpotId);
    });
  });

  markerCache.forEach((markerRef, id) => {
    if (markerRef.provider === MAP_PROVIDER.GOOGLE) {
      applyGoogleMarkerAppearance(markerRef);
      return;
    }
    const element = markerRef.getElement();
    if (!element) {
      return;
    }
    element.classList.toggle('marker-active', id === state.highlightedSpotId);
    element.classList.toggle('marker-next', state.showNextOnly && store.nextStopIds.has(id) && id !== state.highlightedSpotId);
  });
}

function scrollToSpotItem(id) {
  const behavior = reduceMotion ? 'auto' : 'smooth';
  const desktopItem = store.spotRefs.desktop.get(id);
  const mobileItem = store.spotRefs.mobile.get(id);
  desktopItem?.scrollIntoView({ behavior, block: 'nearest' });
  mobileItem?.scrollIntoView({ behavior, block: 'nearest' });
}

function scrollToSpotInDrawer(id) {
  const behavior = reduceMotion ? 'auto' : 'smooth';
  store.spotRefs.mobile.get(id)?.scrollIntoView({ behavior, block: 'center' });
}

function toggleDayPanel(day) {
  ['desktop', 'mobile'].forEach((mode) => {
    const panel = store.panelRefs[mode].get(day);
    if (panel) {
      panel.classList.toggle('collapsed');
    }
  });
}

function updateDrawerHeader() {
  if (state.currentDay !== null) {
    refs.drawerDayLabel.textContent = `第 ${state.currentDay} 天 · ${getDayLabel(state.currentDay)}`;
    const lastSpot = store.dayLastSpot.get(state.currentDay);
    refs.drawerNextStop.textContent = lastSpot?.transportNote ? lastSpot.transportNote : '';
  } else {
    refs.drawerDayLabel.textContent = '全部天数';
    refs.drawerNextStop.textContent = '';
  }
}

function getDrawerMetrics() {
  const height = Math.min(window.innerHeight - 12, Math.max(420, window.innerHeight * 0.88));
  const collapsedPeek = window.innerHeight < 760 ? 60 : 68;
  const halfVisible = Math.min(height - 20, Math.max(320, height * 0.52));
  return {
    height,
    collapsed: Math.max(0, height - collapsedPeek),
    half: Math.max(0, height - halfVisible),
    full: 0,
  };
}

function getCurrentDrawerTranslateY() {
  const transform = window.getComputedStyle(refs.mobileDrawer).transform;
  if (transform === 'none') {
    return getDrawerMetrics()[state.drawerState];
  }
  return new DOMMatrixReadOnly(transform).m42;
}

function applyDrawerState(nextState, animate = true) {
  if (!state.isMobile) {
    return;
  }
  state.drawerState = nextState;
  const metrics = getDrawerMetrics();
  refs.mobileDrawer.style.height = `${metrics.height}px`;
  refs.mobileDrawer.style.transition = animate ? '' : 'none';
  refs.mobileDrawer.style.transform = `translateY(${metrics[nextState]}px)`;
  if (!animate) {
    requestAnimationFrame(() => {
      refs.mobileDrawer.style.transition = '';
    });
  }
}

function openDrawerFull() {
  applyDrawerState('full');
}

function openFilterSheet() {
  refs.mobileFilterSheet.classList.add('open');
  refs.sheetBackdrop.hidden = false;
}

function closeFilterSheet() {
  refs.mobileFilterSheet.classList.remove('open');
  refs.sheetBackdrop.hidden = true;
}

function fitMapToPoints(focusPoints) {
  if (!focusPoints.length) {
    return;
  }

  if (focusPoints.length === 1) {
    if (isGoogleMap()) {
      map.setCenter(toLatLngLiteral(focusPoints[0]));
      map.setZoom(11);
      const viewportPadding = getMapFitPadding();
      if (state.isMobile && typeof map.panBy === 'function') {
        window.setTimeout(() => {
          map.panBy(0, viewportPadding.selectedSpotOffsetY);
        }, 80);
      }
    } else {
      map.setView(focusPoints[0], 11, { animate: !reduceMotion });
      if (state.isMobile) {
        const viewportPadding = getMapFitPadding();
        map.panBy([0, viewportPadding.selectedSpotOffsetY], { animate: !reduceMotion, duration: 0.35 });
      }
    }
    return;
  }

  const viewportPadding = getMapFitPadding();
  if (isGoogleMap()) {
    const bounds = new googleLibs.LatLngBounds();
    focusPoints.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
    map.fitBounds(bounds, viewportPadding.google);
    return;
  }

  const bounds = L.latLngBounds(focusPoints);
  map.fitBounds(bounds, {
    paddingTopLeft: viewportPadding.leaflet.paddingTopLeft,
    paddingBottomRight: viewportPadding.leaflet.paddingBottomRight,
    animate: !reduceMotion,
    maxZoom: 13,
  });
}

function getActiveFocusPoints() {
  const visibleSpots = getFilteredSpots();
  const { visibleDays, visibleCities } = getVisibleRouteContext();
  const routePoints = store.routeSegments
    .filter((route) => {
      if (!routeMatchesCurrentFocus(route, visibleDays, visibleCities)) {
        return false;
      }
      if (state.currentCity !== null && route.scope === 'intercity') {
        return false;
      }
      return true;
    })
    .flatMap(route => route.points);

  if (routePoints.length) {
    return routePoints;
  }

  if (visibleSpots.length) {
    return visibleSpots.map(spot => [spot.lat, spot.lng]);
  }

  if (state.currentDay !== null) {
    const allStops = store.allEntriesByDay.get(state.currentDay) || [];
    return allStops.map(spot => [spot.lat, spot.lng]);
  }

  if (state.currentCity !== null) {
    return store.allEntries
      .filter(entry => entry.city === state.currentCity)
      .map(entry => [entry.lat, entry.lng]);
  }

  return [];
}

function fitToActiveSelection() {
  const focusPoints = getActiveFocusPoints();
  if (!focusPoints.length) {
    resetMapView();
    return;
  }

  fitMapToPoints(focusPoints);
}

function fitToCurrentDay() {
  if (state.currentDay === null) {
    resetMapView();
    return;
  }

  const dayRoutes = store.routeSegments.filter(route => route.day === state.currentDay);
  const routePoints = dayRoutes.flatMap(route => route.points);
  const visibleStops = store.spotsByDay.get(state.currentDay) || [];
  const allStops = store.allEntriesByDay.get(state.currentDay) || [];
  const focusPoints = routePoints.length
    ? routePoints
    : (visibleStops.length ? visibleStops : allStops).map(spot => [spot.lat, spot.lng]);

  fitMapToPoints(focusPoints);
}

function resetMapView() {
  const { centerLat, centerLng, defaultZoom } = store.itineraryData.config;
  if (isGoogleMap()) {
    map.setCenter({ lat: centerLat, lng: centerLng });
    map.setZoom(defaultZoom);
    return;
  }
  map.setView([centerLat, centerLng], defaultZoom, { animate: !reduceMotion });
}

function hasSpotsForDayAndCity(day, city) {
  return store.spots.some((spot) => spot.day === day && spot.city === city);
}

function applyDaySelection(day, { closeSheet = false } = {}) {
  if (day !== null && state.currentCity !== null && !hasSpotsForDayAndCity(day, state.currentCity)) {
    state.currentCity = null;
  }

  state.currentDay = day;
  refreshUi();

  if (closeSheet) {
    closeFilterSheet();
  }

  if (day === null) {
    if (state.currentCity !== null) {
      requestAnimationFrame(() => {
        fitToActiveSelection();
      });
      return;
    }
    resetMapView();
    return;
  }

  requestAnimationFrame(() => {
    fitToActiveSelection();
  });
}

function applyCitySelection(city, { closeSheet = false } = {}) {
  if (city !== null && state.currentDay !== null && !hasSpotsForDayAndCity(state.currentDay, city)) {
    state.currentDay = null;
  }

  state.currentCity = city;
  refreshUi();

  if (closeSheet) {
    closeFilterSheet();
  }

  if (city === null) {
    if (state.currentDay !== null) {
      requestAnimationFrame(() => {
        fitToActiveSelection();
      });
      return;
    }
    resetMapView();
    return;
  }

  requestAnimationFrame(() => {
    fitToActiveSelection();
  });
}

function syncSelectedPopup() {
  if (!state.selectedSpotId) {
    return;
  }
  const markerRef = markerCache.get(state.selectedSpotId);
  if (markerRef && state.markersVisible.has(state.selectedSpotId)) {
    markerRef.openPopup();
  }
}

function updatePopupsForViewport() {
  markerCache.forEach((markerRef, id) => {
    const spot = store.spotById.get(id);
    if (spot) {
      markerRef.setPopupContent(buildPopupContentNode(spot));
    }
  });
}

function refreshMapSize() {
  if (isGoogleMap()) {
    if (window.google?.maps?.event) {
      google.maps.event.trigger(map, 'resize');
    }
    return;
  }
  map.invalidateSize(false);
}

function setupEventListeners() {
  refs.filters.addEventListener('click', handleDesktopFilterClick);
  refs.dayListPanel.addEventListener('click', handleListClick);
  refs.drawerContent.addEventListener('click', handleListClick);

  refs.todayBtn.addEventListener('change', (event) => {
    const value = event.target.value;
    applyDaySelection(value === 'all' ? null : Number(value));
  });

  refs.menuBtn.addEventListener('click', openFilterSheet);
  refs.mobileFilterTrigger.addEventListener('click', openFilterSheet);
  refs.closeFilterSheet.addEventListener('click', closeFilterSheet);
  refs.sheetBackdrop.addEventListener('click', closeFilterSheet);

  refs.mobileDayChips.addEventListener('click', (event) => {
    const button = event.target.closest('.chip-btn');
    if (!button) {
      return;
    }
    applyDaySelection(button.dataset.value === 'all' ? null : Number(button.dataset.value), { closeSheet: true });
  });

  refs.mobileCityChips.addEventListener('click', (event) => {
    const button = event.target.closest('.chip-btn');
    if (!button) {
      return;
    }
    applyCitySelection(button.dataset.value === 'all' ? null : button.dataset.value, { closeSheet: true });
  });

  refs.mobileMustToggle.addEventListener('click', () => {
    state.showMustOnly = !state.showMustOnly;
    refreshUi();
  });

  refs.mobileNextToggle.addEventListener('click', () => {
    state.showNextOnly = !state.showNextOnly;
    refreshUi();
  });

  refs.resetViewBtn.addEventListener('click', () => resetMapView());
  refs.fitDayBtn.addEventListener('click', () => fitToCurrentDay());
  refs.toggleListBtn.addEventListener('click', () => {
    state.isListVisible = !state.isListVisible;
    refs.dayListPanel.style.display = state.isListVisible ? '' : 'none';
    document.querySelector('.main-content')?.classList.toggle('list-hidden', !state.isListVisible);
    updateControlState();
    requestAnimationFrame(refreshMapSize);
  });
  refs.legendToggleBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.isLegendCollapsed = !state.isLegendCollapsed;
    updateLegendState();
  });

  initMapToolbar();

  initMapSearch();

  refs.drawerHandle.addEventListener('pointerdown', onDrawerPointerDown);
  refs.drawerHeader.addEventListener('click', () => {
    if (state.drawerState === 'collapsed') {
      applyDrawerState('half');
    } else if (state.drawerState === 'half') {
      applyDrawerState('full');
    } else {
      applyDrawerState('collapsed');
    }
  });

  viewportQuery.addEventListener('change', handleViewportChange);
  window.addEventListener(
    'resize',
    debounce(() => {
      if (state.isMobile) {
        applyDrawerState(state.drawerState, false);
      }
      refreshMapSize();
    }, 140)
  );
}

function handleDesktopFilterClick(event) {
  const button = event.target.closest('.filter-btn');
  if (!button) {
    return;
  }

  const { filter, value } = button.dataset;
  if (filter === 'day') {
    applyDaySelection(value === 'all' ? null : Number(value));
    return;
  }
  if (filter === 'city') {
    applyCitySelection(value === 'all' ? null : value);
    return;
  }
  if (filter === 'must') {
    state.showMustOnly = !state.showMustOnly;
  }
  if (filter === 'next') {
    state.showNextOnly = !state.showNextOnly;
  }

  refreshUi();
}

function handleListClick(event) {
  const header = event.target.closest('.day-header');
  if (header) {
    const day = Number(header.dataset.day);
    if (state.currentDay === day) {
      toggleDayPanel(day);
    } else {
      applyDaySelection(day);
    }
    return;
  }

  const spotItem = event.target.closest('.spot-item');
  if (spotItem) {
    selectSpot(spotItem.dataset.id, true);
  }
}

function handleViewportChange(event) {
  state.isMobile = event.matches;
  refs.menuBtn.style.display = state.isMobile ? 'inline-flex' : '';
  if (!state.isMobile) {
    closeFilterSheet();
    refs.dayListPanel.style.display = state.isListVisible ? '' : 'none';
    refreshMapSize();
  } else {
    if (state.currentDay === null) {
      state.currentDay = DEFAULT_DAY;
    }
    applyDrawerState('collapsed', false);
  }
  updatePopupsForViewport();
  refreshUi();
  requestAnimationFrame(refreshMapSize);
}

function onDrawerPointerDown(event) {
  if (!state.isMobile) {
    return;
  }

  const startY = event.clientY;
  const startTranslate = getCurrentDrawerTranslateY();
  const metrics = getDrawerMetrics();
  let dragging = true;

  refs.drawerHandle.setPointerCapture(event.pointerId);
  refs.mobileDrawer.style.transition = 'none';

  function onPointerMove(moveEvent) {
    if (!dragging) {
      return;
    }
    const deltaY = moveEvent.clientY - startY;
    const nextTranslate = Math.min(metrics.collapsed, Math.max(metrics.full, startTranslate + deltaY));
    refs.mobileDrawer.style.transform = `translateY(${nextTranslate}px)`;
  }

  function onPointerEnd(endEvent) {
    if (!dragging) {
      return;
    }
    dragging = false;
    refs.drawerHandle.releasePointerCapture(endEvent.pointerId);
    refs.drawerHandle.removeEventListener('pointermove', onPointerMove);
    refs.drawerHandle.removeEventListener('pointerup', onPointerEnd);
    refs.drawerHandle.removeEventListener('pointercancel', onPointerEnd);
    refs.mobileDrawer.style.transition = '';

    const currentY = getCurrentDrawerTranslateY();
    const distances = {
      collapsed: Math.abs(currentY - metrics.collapsed),
      half: Math.abs(currentY - metrics.half),
      full: Math.abs(currentY - metrics.full),
    };
    const nextState = Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0];
    applyDrawerState(nextState);
  }

  refs.drawerHandle.addEventListener('pointermove', onPointerMove);
  refs.drawerHandle.addEventListener('pointerup', onPointerEnd);
  refs.drawerHandle.addEventListener('pointercancel', onPointerEnd);
}

function initMapToolbar() {
  const toolbar = document.getElementById('map-toolbar');
  if (!toolbar) return;
  const buttons = Array.from(toolbar.querySelectorAll('.tool-btn'));
  const panels = Array.from(document.querySelectorAll('.tool-panel[data-tool-panel]'));
  if (!buttons.length || !panels.length) return;

  const activate = (tool) => {
    buttons.forEach((btn) => {
      const isActive = tool !== null && btn.dataset.tool === tool;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
    panels.forEach((panel) => {
      const isActive = tool !== null && panel.dataset.toolPanel === tool;
      panel.classList.toggle('tool-active', isActive);
    });
    if (tool === 'search') {
      const input = document.getElementById('map-search-input');
      if (input) setTimeout(() => input.focus(), 20);
    }
    requestAnimationFrame(refreshMapSize);
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const tool = btn.dataset.tool;
      const isActive = btn.classList.contains('active');
      activate(isActive ? null : tool);
    });
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (toolbar.contains(target)) return;
    if (panels.some((panel) => panel.contains(target))) return;
    activate(null);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') activate(null);
  });
}

function initMapSearch() {
  const input = refs.mapSearchInput;
  const clearBtn = refs.mapSearchClear;
  const resultsList = refs.mapSearchResults;
  if (!input || !resultsList) {
    return;
  }

  let debounceTimer = null;
  let abortController = null;

  function hideResults() {
    resultsList.hidden = true;
    resultsList.innerHTML = '';
  }

  function clearSearch() {
    input.value = '';
    clearBtn.hidden = true;
    hideResults();
    input.focus();
  }

  function selectResult(item) {
    input.value = item.name || item.display_name.split(',')[0];
    clearBtn.hidden = false;
    hideResults();

    if (!map) {
      return;
    }
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    const bb = item.boundingbox?.map(Number);
    const hasBB = Array.isArray(bb) && bb.length === 4 && bb.every(Number.isFinite);
    const [south, north, west, east] = hasBB ? bb : [lat, lat, lon, lon];
    const span = hasBB ? Math.max(north - south, east - west) : 0;

    if (isGoogleMap()) {
      if (hasBB && span <= 0.8) {
        const bounds = new google.maps.LatLngBounds(
          { lat: south, lng: west },
          { lat: north, lng: east }
        );
        map.fitBounds(bounds);
        google.maps.event.addListenerOnce(map, 'idle', () => {
          if (map.getZoom() > 16) map.setZoom(16);
        });
      } else {
        map.panTo({ lat, lng: lon });
        map.setZoom(hasBB ? 12 : 14);
      }
      return;
    }

    if (hasBB) {
      if (span > 0.8) {
        map.setView([lat, lon], 12, { animate: true });
      } else {
        map.fitBounds([[south, west], [north, east]], { maxZoom: 16, animate: true });
      }
    } else {
      map.setView([lat, lon], 14, { animate: true });
    }
  }

  function renderResults(items) {
    resultsList.innerHTML = '';
    if (items.length === 0) {
      const li = document.createElement('li');
      li.className = 'map-search-empty';
      li.textContent = '没有找到相关地点';
      resultsList.appendChild(li);
    } else {
      items.forEach((item) => {
        const name = item.name || item.display_name.split(',')[0].trim();
        const addr = item.display_name;
        const li = document.createElement('li');
        li.className = 'map-search-result';
        li.setAttribute('role', 'option');
        li.tabIndex = -1;
        li.innerHTML = `<span class="map-search-result-name"></span><span class="map-search-result-addr"></span>`;
        li.querySelector('.map-search-result-name').textContent = name;
        li.querySelector('.map-search-result-addr').textContent = addr;
        li.addEventListener('click', () => selectResult(item));
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectResult(item);
          }
        });
        resultsList.appendChild(li);
      });
    }
    resultsList.hidden = false;
  }

  async function doSearch(query) {
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '5');
      url.searchParams.set('addressdetails', '0');
      url.searchParams.set('accept-language', 'zh-CN,zh,en');
      const response = await fetch(url.toString(), {
        signal: abortController.signal,
        headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      renderResults(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('地点搜索失败:', err);
      }
    } finally {
      abortController = null;
    }
  }

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearBtn.hidden = query.length === 0;
    clearTimeout(debounceTimer);
    if (query.length < 2) {
      hideResults();
      return;
    }
    debounceTimer = setTimeout(() => doSearch(query), 400);
  });

  clearBtn.addEventListener('click', clearSearch);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideResults();
      input.blur();
    }
  });

  document.addEventListener('click', (e) => {
    if (refs.mapSearch && !refs.mapSearch.contains(e.target)) {
      hideResults();
    }
  });
}

function updateOnlineState() {
  if (navigator.onLine) {
    hideMapNotice('offline');
  } else {
    showMapNotice('当前离线 —— 显示缓存数据,部分功能受限', 'warning', 'offline');
  }
}

window.addEventListener('online', updateOnlineState);
window.addEventListener('offline', updateOnlineState);
document.addEventListener('DOMContentLoaded', updateOnlineState);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] register failed', err);
    });
  });
}

window.addEventListener('DOMContentLoaded', init);
