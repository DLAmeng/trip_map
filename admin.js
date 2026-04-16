const API = {
  currentTrip: '/api/trips/current/full',
  importLocal: '/api/trips/current/import-local',
  exportLocal: '/api/trips/current/export-local',
}

const state = {
  trip: null,
  originalTrip: null,
  dirty: false,
  saving: false,
  spotFilterDay: 'all',
  routeFilterDay: 'all',
  spotQuery: '',
  segmentQuery: '',
}

const refs = {
  statusText: document.querySelector('#status-text'),
  statusSubtext: document.querySelector('#status-subtext'),
  tripCountDays: document.querySelector('#trip-count-days'),
  tripCountSpots: document.querySelector('#trip-count-spots'),
  tripCountSegments: document.querySelector('#trip-count-segments'),
  metaTitle: document.querySelector('#meta-title'),
  metaDescription: document.querySelector('#meta-description'),
  reloadBtn: document.querySelector('#reload-btn'),
  importLocalBtn: document.querySelector('#import-local-btn'),
  saveBtn: document.querySelector('#save-btn'),
  saveExportBtn: document.querySelector('#save-export-btn'),
  sortSpotsBtn: document.querySelector('#sort-spots-btn'),
  addSpotBtn: document.querySelector('#add-spot-btn'),
  sortSegmentsBtn: document.querySelector('#sort-segments-btn'),
  addSegmentBtn: document.querySelector('#add-segment-btn'),
  dayFilter: document.querySelector('#day-filter'),
  routeDayFilter: document.querySelector('#route-day-filter'),
  spotSearch: document.querySelector('#spot-search'),
  segmentSearch: document.querySelector('#segment-search'),
  spotResultsText: document.querySelector('#spot-results-text'),
  segmentResultsText: document.querySelector('#segment-results-text'),
  spotList: document.querySelector('#spot-list'),
  segmentList: document.querySelector('#segment-list'),
}

const SPOT_NUMBER_FIELDS = new Set(['day', 'order', 'lat', 'lng', 'stayMinutes'])
const SPOT_BOOLEAN_FIELDS = new Set(['mustVisit', 'nearNextTransport'])
const SEGMENT_NUMBER_FIELDS = new Set(['day'])

function cloneData(value) {
  return JSON.parse(JSON.stringify(value))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function setStatus(text, subtext = '', tone = 'default') {
  refs.statusText.textContent = text
  refs.statusSubtext.textContent = subtext
  refs.statusText.style.color = tone === 'error'
    ? '#aa3d1d'
    : tone === 'success'
      ? '#2f6b41'
      : '#25180f'
}

function sortNumbersAscending(list) {
  return [...list].sort((a, b) => a - b)
}

function getDayOptions() {
  if (!state.trip) {
    return []
  }
  return sortNumbersAscending(new Set(state.trip.spots.map((spot) => Number(spot.day) || 0).filter(Boolean)))
}

function parseCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeString(value) {
  return String(value ?? '').trim()
}

function normalizeNullableString(value) {
  const nextValue = normalizeString(value)
  return nextValue || null
}

function parseNumber(value, fallback = 0) {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : fallback
}

function parsePathInput(value) {
  if (!String(value ?? '').trim()) {
    return []
  }
  const raw = JSON.parse(value)
  if (!Array.isArray(raw)) {
    throw new Error('路径必须是数组。')
  }
  return raw
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) {
        return null
      }
      const lat = Number(pair[0])
      const lng = Number(pair[1])
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null
      }
      return [lat, lng]
    })
    .filter(Boolean)
}

function normalizeSpot(spot) {
  return {
    id: normalizeString(spot.id),
    day: parseNumber(spot.day, 1),
    city: normalizeString(spot.city),
    area: normalizeString(spot.area),
    name: normalizeString(spot.name),
    nameEn: normalizeString(spot.nameEn),
    timeSlot: normalizeString(spot.timeSlot),
    order: parseNumber(spot.order, 1),
    lat: parseNumber(spot.lat, 0),
    lng: parseNumber(spot.lng, 0),
    mustVisit: Boolean(spot.mustVisit),
    type: normalizeString(spot.type || 'spot'),
    description: normalizeString(spot.description),
    whyGo: normalizeString(spot.whyGo),
    stayMinutes: parseNumber(spot.stayMinutes, 0),
    nextStopId: normalizeNullableString(spot.nextStopId),
    nearNextTransport: Boolean(spot.nearNextTransport),
    tags: Array.isArray(spot.tags) ? spot.tags.map(normalizeString).filter(Boolean) : parseCsv(spot.tags),
    transportNote: normalizeString(spot.transportNote),
  }
}

function normalizeSegment(segment) {
  let path = segment.path
  if (typeof path === 'string') {
    path = parsePathInput(path)
  }
  if (!Array.isArray(path)) {
    path = []
  }

  return {
    id: normalizeString(segment.id),
    day: parseNumber(segment.day, 1),
    scope: normalizeString(segment.scope || 'city'),
    fromSpotId: normalizeString(segment.fromSpotId),
    toSpotId: normalizeString(segment.toSpotId),
    transportType: normalizeString(segment.transportType),
    label: normalizeString(segment.label),
    duration: normalizeString(segment.duration),
    note: normalizeString(segment.note),
    path: path
      .map((pair) => Array.isArray(pair) ? [parseNumber(pair[0], NaN), parseNumber(pair[1], NaN)] : null)
      .filter((pair) => Array.isArray(pair) && Number.isFinite(pair[0]) && Number.isFinite(pair[1])),
  }
}

function normalizeTripForSave(trip) {
  return {
    ...cloneData(trip),
    meta: {
      title: normalizeString(trip.meta?.title),
      description: normalizeString(trip.meta?.description),
    },
    spots: trip.spots.map(normalizeSpot),
    routeSegments: trip.routeSegments.map(normalizeSegment),
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const errorMessage = typeof payload === 'string'
      ? payload
      : payload?.error || `请求失败：${response.status}`
    throw new Error(errorMessage)
  }

  return payload
}

async function loadTrip(message = '已从数据库载入最新行程。') {
  const payload = await fetchJson(API.currentTrip)
  state.trip = cloneData(payload)
  state.originalTrip = cloneData(payload)
  state.dirty = false
  renderAll()
  setStatus('编辑页已连接到数据库', message, 'success')
}

function updateDirtyState(dirty = true) {
  state.dirty = dirty
  if (dirty) {
    setStatus('有未保存修改', '保存后前台地图会读取新的行程数据。')
  }
}

function renderAll() {
  if (!state.trip) {
    return
  }
  renderMeta()
  renderDayFilters()
  renderSummary()
  renderSpots()
  renderSegments()
}

function renderMeta() {
  refs.metaTitle.value = state.trip.meta?.title || ''
  refs.metaDescription.value = state.trip.meta?.description || ''
}

function renderSummary() {
  const days = new Set(state.trip.spots.map((spot) => spot.day))
  refs.tripCountDays.textContent = String(days.size)
  refs.tripCountSpots.textContent = String(state.trip.spots.length)
  refs.tripCountSegments.textContent = String(state.trip.routeSegments.length)
}

function renderDayFilters() {
  const options = getDayOptions()
  const markup = [
    '<option value="all">全部天数</option>',
    ...options.map((day) => `<option value="${day}">第 ${day} 天</option>`),
  ].join('')

  refs.dayFilter.innerHTML = markup
  refs.routeDayFilter.innerHTML = markup
  refs.dayFilter.value = options.includes(Number(state.spotFilterDay)) ? state.spotFilterDay : 'all'
  refs.routeDayFilter.value = options.includes(Number(state.routeFilterDay)) ? state.routeFilterDay : 'all'
}

function matchesQuery(text, query) {
  return normalizeString(text).toLowerCase().includes(query.toLowerCase())
}

function getFilteredSpots() {
  if (!state.trip) {
    return []
  }

  const query = normalizeString(state.spotQuery)

  return state.trip.spots
    .map((spot, index) => ({ spot, index }))
    .filter(({ spot }) => state.spotFilterDay === 'all' || String(spot.day) === String(state.spotFilterDay))
    .filter(({ spot }) => {
      if (!query) {
        return true
      }
      const haystack = [
        spot.id,
        spot.name,
        spot.city,
        spot.area,
        spot.timeSlot,
        ...(Array.isArray(spot.tags) ? spot.tags : []),
      ].join(' ')
      return matchesQuery(haystack, query)
    })
}

function getFilteredSegments() {
  if (!state.trip) {
    return []
  }

  const query = normalizeString(state.segmentQuery)

  return state.trip.routeSegments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => state.routeFilterDay === 'all' || String(segment.day) === String(state.routeFilterDay))
    .filter(({ segment }) => {
      if (!query) {
        return true
      }
      const fromName = resolveSpotName(segment.fromSpotId)
      const toName = resolveSpotName(segment.toSpotId)
      const haystack = [
        segment.id,
        segment.label,
        segment.transportType,
        segment.scope,
        segment.fromSpotId,
        segment.toSpotId,
        fromName,
        toName,
      ].join(' ')
      return matchesQuery(haystack, query)
    })
}

function resolveSpotName(spotId) {
  const spot = state.trip?.spots.find((item) => item.id === spotId)
  return spot ? spot.name : ''
}

function buildTextField(collection, index, field, label, value, options = {}) {
  const type = options.type || 'text'
  const wideClass = options.wide ? ' field-wide' : ''
  return `
    <label class="field${wideClass}">
      <span>${label}</span>
      <input
        type="${type}"
        value="${escapeHtml(value)}"
        data-collection="${collection}"
        data-index="${index}"
        data-field="${field}"
      >
    </label>
  `
}

function buildTextAreaField(collection, index, field, label, value, options = {}) {
  const wideClass = options.wide ? ' field-wide' : ''
  const rows = options.rows || 3
  return `
    <label class="field${wideClass}">
      <span>${label}</span>
      <textarea
        rows="${rows}"
        data-collection="${collection}"
        data-index="${index}"
        data-field="${field}"
      >${escapeHtml(value)}</textarea>
    </label>
  `
}

function buildCheckboxField(collection, index, field, label, checked) {
  return `
    <label class="field">
      <span>${label}</span>
      <input
        type="checkbox"
        ${checked ? 'checked' : ''}
        data-collection="${collection}"
        data-index="${index}"
        data-field="${field}"
      >
    </label>
  `
}

function renderSpots() {
  const items = getFilteredSpots()

  refs.spotResultsText.textContent = `当前显示 ${items.length} / ${state.trip.spots.length} 个景点`

  if (!items.length) {
    refs.spotList.innerHTML = '<div class="empty-state">当前筛选条件下没有景点。</div>'
    return
  }

  refs.spotList.innerHTML = items.map(({ spot, index }) => `
    <article class="editor-card" data-kind="spot-card" data-index="${index}">
      <div class="card-head">
        <div class="card-title-wrap">
          <div class="card-badges">
            <span class="badge">第 ${escapeHtml(spot.day)} 天</span>
            <span class="badge">${escapeHtml(spot.city || '未设城市')}</span>
            <span class="badge">${escapeHtml(spot.area || '未设区域')}</span>
            ${spot.mustVisit ? '<span class="badge">必去</span>' : ''}
          </div>
          <div class="card-title">${escapeHtml(spot.name || '未命名景点')}</div>
          <div class="card-subtitle">ID: ${escapeHtml(spot.id)} · 顺序 ${escapeHtml(spot.order)} · 下一站 ${escapeHtml(spot.nextStopId || '无')}</div>
        </div>
        <div class="card-tools">
          <button type="button" data-action="delete-spot" data-index="${index}">删除景点</button>
        </div>
      </div>

      <div class="field-grid">
        ${buildTextField('spots', index, 'id', 'ID', spot.id)}
        ${buildTextField('spots', index, 'day', '天数', spot.day, { type: 'number' })}
        ${buildTextField('spots', index, 'order', '顺序', spot.order, { type: 'number' })}
        ${buildTextField('spots', index, 'city', '城市', spot.city)}
        ${buildTextField('spots', index, 'area', '区域', spot.area)}
        ${buildTextField('spots', index, 'name', '名称', spot.name, { wide: true })}
        ${buildTextField('spots', index, 'nameEn', '英文名', spot.nameEn)}
        ${buildTextField('spots', index, 'timeSlot', '时段', spot.timeSlot)}
        ${buildTextField('spots', index, 'lat', '纬度', spot.lat, { type: 'number' })}
        ${buildTextField('spots', index, 'lng', '经度', spot.lng, { type: 'number' })}
        ${buildTextField('spots', index, 'stayMinutes', '停留分钟', spot.stayMinutes, { type: 'number' })}
        ${buildTextField('spots', index, 'nextStopId', '下一站 ID', spot.nextStopId || '')}
        ${buildTextField('spots', index, 'type', '类型', spot.type)}
        ${buildTextField('spots', index, 'tags', '标签（逗号分隔）', (spot.tags || []).join(', '), { wide: true })}
        ${buildCheckboxField('spots', index, 'mustVisit', '必去', spot.mustVisit)}
        ${buildCheckboxField('spots', index, 'nearNextTransport', '临近下一段交通', spot.nearNextTransport)}
      </div>

      <details class="card-advanced">
        <summary>展开说明字段</summary>
        <div class="card-advanced-body field-grid">
          ${buildTextAreaField('spots', index, 'description', '景点说明', spot.description, { wide: true, rows: 3 })}
          ${buildTextAreaField('spots', index, 'whyGo', '为什么去', spot.whyGo, { wide: true, rows: 3 })}
          ${buildTextAreaField('spots', index, 'transportNote', '交通提示', spot.transportNote, { wide: true, rows: 3 })}
        </div>
      </details>
    </article>
  `).join('')
}

function renderSegments() {
  const items = getFilteredSegments()

  refs.segmentResultsText.textContent = `当前显示 ${items.length} / ${state.trip.routeSegments.length} 段路线`

  if (!items.length) {
    refs.segmentList.innerHTML = '<div class="empty-state">当前筛选条件下没有路线。</div>'
    return
  }

  refs.segmentList.innerHTML = items.map(({ segment, index }) => `
    <article class="editor-card" data-kind="segment-card" data-index="${index}">
      <div class="card-head">
        <div class="card-title-wrap">
          <div class="card-badges">
            <span class="badge">第 ${escapeHtml(segment.day)} 天</span>
            <span class="badge">${escapeHtml(segment.scope || 'city')}</span>
            <span class="badge">${escapeHtml(segment.transportType || '未设交通方式')}</span>
          </div>
          <div class="card-title">${escapeHtml(segment.label || '未命名路线')}</div>
          <div class="card-subtitle">
            ${escapeHtml(resolveSpotName(segment.fromSpotId) || segment.fromSpotId)} → ${escapeHtml(resolveSpotName(segment.toSpotId) || segment.toSpotId)}
            · ID: ${escapeHtml(segment.id)}
          </div>
        </div>
        <div class="card-tools">
          <button type="button" data-action="move-segment-up" data-index="${index}">上移</button>
          <button type="button" data-action="move-segment-down" data-index="${index}">下移</button>
          <button type="button" data-action="delete-segment" data-index="${index}">删除路线</button>
        </div>
      </div>

      <div class="field-grid">
        ${buildTextField('routeSegments', index, 'id', 'ID', segment.id)}
        ${buildTextField('routeSegments', index, 'day', '天数', segment.day, { type: 'number' })}
        ${buildTextField('routeSegments', index, 'scope', '范围', segment.scope)}
        ${buildTextField('routeSegments', index, 'transportType', '交通方式', segment.transportType)}
        ${buildTextField('routeSegments', index, 'fromSpotId', '起点 Spot ID', segment.fromSpotId)}
        ${buildTextField('routeSegments', index, 'toSpotId', '终点 Spot ID', segment.toSpotId)}
        ${buildTextField('routeSegments', index, 'label', '显示标题', segment.label, { wide: true })}
        ${buildTextField('routeSegments', index, 'duration', '时长', segment.duration)}
      </div>

      <details class="card-advanced">
        <summary>展开说明与路径</summary>
        <div class="card-advanced-body field-grid">
          ${buildTextAreaField('routeSegments', index, 'note', '说明', segment.note, { wide: true, rows: 3 })}
          ${buildTextAreaField('routeSegments', index, 'path', '路径 JSON', JSON.stringify(segment.path || [], null, 2), { wide: true, rows: 5 })}
        </div>
      </details>
    </article>
  `).join('')
}

function readCollectionTarget(element) {
  const collection = element.dataset.collection
  const index = Number(element.dataset.index)
  const field = element.dataset.field

  if (!collection || !Number.isInteger(index) || !field) {
    return null
  }

  const list = state.trip?.[collection]
  if (!Array.isArray(list) || !list[index]) {
    return null
  }

  return {
    collection,
    index,
    field,
    item: list[index],
  }
}

function updateFieldValue(element) {
  const target = readCollectionTarget(element)
  if (!target) {
    return
  }

  const { collection, field, item } = target

  element.closest('.field')?.classList.remove('is-invalid')
  element.closest('.editor-card')?.classList.remove('is-invalid')

  try {
    if (collection === 'spots') {
      if (SPOT_BOOLEAN_FIELDS.has(field)) {
        item[field] = element.checked
      } else if (field === 'tags') {
        item[field] = parseCsv(element.value)
      } else if (field === 'nextStopId') {
        item[field] = normalizeNullableString(element.value)
      } else if (SPOT_NUMBER_FIELDS.has(field)) {
        item[field] = parseNumber(element.value, item[field] || 0)
      } else {
        item[field] = element.value
      }
    } else if (collection === 'routeSegments') {
      if (field === 'path') {
        item[field] = parsePathInput(element.value)
      } else if (SEGMENT_NUMBER_FIELDS.has(field)) {
        item[field] = parseNumber(element.value, item[field] || 0)
      } else {
        item[field] = element.value
      }
    }
    updateDirtyState(true)
  } catch (error) {
    element.closest('.field')?.classList.add('is-invalid')
    element.closest('.editor-card')?.classList.add('is-invalid')
    setStatus('有字段格式不正确', error.message, 'error')
  }
}

function moveArrayItem(list, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= list.length) {
    return
  }
  const [item] = list.splice(fromIndex, 1)
  list.splice(toIndex, 0, item)
}

function sortSpotsByDayAndOrder() {
  state.trip.spots.sort((a, b) => {
    if (a.day !== b.day) {
      return a.day - b.day
    }
    if (a.order !== b.order) {
      return a.order - b.order
    }
    return a.id.localeCompare(b.id)
  })
  updateDirtyState(true)
  renderSpots()
}

function sortSegmentsByDay() {
  state.trip.routeSegments = state.trip.routeSegments
    .map((segment, index) => ({ segment, index }))
    .sort((first, second) => {
      if (first.segment.day !== second.segment.day) {
        return first.segment.day - second.segment.day
      }
      return first.index - second.index
    })
    .map((entry) => entry.segment)
  updateDirtyState(true)
  renderSegments()
}

function createNewSpot() {
  const day = state.spotFilterDay === 'all' ? 1 : Number(state.spotFilterDay)
  const sameDay = state.trip.spots.filter((spot) => Number(spot.day) === day)
  const nextOrder = sameDay.length ? Math.max(...sameDay.map((spot) => Number(spot.order) || 0)) + 1 : 1

  state.trip.spots.push({
    id: `spot-${Date.now()}`,
    day,
    city: '',
    area: '',
    name: '新景点',
    nameEn: '',
    timeSlot: '',
    order: nextOrder,
    lat: 0,
    lng: 0,
    mustVisit: false,
    type: 'spot',
    description: '',
    whyGo: '',
    stayMinutes: 60,
    nextStopId: null,
    nearNextTransport: false,
    tags: [],
    transportNote: '',
  })

  updateDirtyState(true)
  renderDayFilters()
  renderSummary()
  renderSpots()
}

function createNewSegment() {
  const day = state.routeFilterDay === 'all' ? 1 : Number(state.routeFilterDay)
  state.trip.routeSegments.push({
    id: `seg-${Date.now()}`,
    day,
    scope: 'city',
    fromSpotId: '',
    toSpotId: '',
    transportType: 'walk',
    label: '新路线',
    duration: '',
    note: '',
    path: [],
  })

  updateDirtyState(true)
  renderSummary()
  renderSegments()
}

async function saveTrip({ exportLocal = false } = {}) {
  if (!state.trip || state.saving) {
    return
  }

  state.saving = true
  setStatus('正在保存...', exportLocal ? '会同时写回本地 itinerary.json' : '正在写入 SQLite 数据库')

  try {
    const payload = normalizeTripForSave(state.trip)
    const result = await fetchJson(API.currentTrip, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })

    if (exportLocal) {
      await fetchJson(API.exportLocal, { method: 'POST' })
    }

    state.trip = cloneData(result.payload)
    state.originalTrip = cloneData(result.payload)
    state.dirty = false
    renderAll()
    setStatus(
      exportLocal ? '已保存到数据库，并写回 itinerary.json' : '已保存到数据库',
      `更新时间：${result.updatedAt || '刚刚'}`
    )
  } catch (error) {
    setStatus('保存失败', error.message, 'error')
  } finally {
    state.saving = false
  }
}

function bindMetaEditors() {
  refs.metaTitle.addEventListener('input', () => {
    if (!state.trip) {
      return
    }
    state.trip.meta.title = refs.metaTitle.value
    updateDirtyState(true)
  })

  refs.metaDescription.addEventListener('input', () => {
    if (!state.trip) {
      return
    }
    state.trip.meta.description = refs.metaDescription.value
    updateDirtyState(true)
  })
}

function bindFilterEditors() {
  refs.dayFilter.addEventListener('change', () => {
    state.spotFilterDay = refs.dayFilter.value
    renderSpots()
  })

  refs.routeDayFilter.addEventListener('change', () => {
    state.routeFilterDay = refs.routeDayFilter.value
    renderSegments()
  })

  refs.spotSearch.addEventListener('input', () => {
    state.spotQuery = refs.spotSearch.value
    renderSpots()
  })

  refs.segmentSearch.addEventListener('input', () => {
    state.segmentQuery = refs.segmentSearch.value
    renderSegments()
  })
}

function bindActionButtons() {
  refs.reloadBtn.addEventListener('click', async () => {
    if (state.dirty && !window.confirm('当前有未保存修改，确定要重新载入数据库内容吗？')) {
      return
    }
    try {
      setStatus('正在重新载入...', '从数据库读取最新行程')
      await loadTrip('已重新载入数据库中的当前行程。')
    } catch (error) {
      setStatus('重新载入失败', error.message, 'error')
    }
  })

  refs.importLocalBtn.addEventListener('click', async () => {
    if (!window.confirm('这会用本地 itinerary.json 覆盖数据库当前行程，确定继续吗？')) {
      return
    }
    try {
      setStatus('正在导入本地文件...', '使用 itinerary.json 覆盖数据库')
      const result = await fetchJson(API.importLocal, { method: 'POST' })
      state.trip = cloneData(result.payload)
      state.originalTrip = cloneData(result.payload)
      state.dirty = false
      renderAll()
      setStatus('已用本地 itinerary.json 覆盖数据库', `更新时间：${result.updatedAt || '刚刚'}`, 'success')
    } catch (error) {
      setStatus('导入失败', error.message, 'error')
    }
  })

  refs.saveBtn.addEventListener('click', () => saveTrip())
  refs.saveExportBtn.addEventListener('click', () => saveTrip({ exportLocal: true }))
  refs.sortSpotsBtn.addEventListener('click', () => sortSpotsByDayAndOrder())
  refs.addSpotBtn.addEventListener('click', () => createNewSpot())
  refs.sortSegmentsBtn.addEventListener('click', () => sortSegmentsByDay())
  refs.addSegmentBtn.addEventListener('click', () => createNewSegment())
}

function bindListEditors() {
  const handleEvent = (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }
    if (!target.dataset.collection) {
      return
    }
    if (event.type === 'input' && target.dataset.field === 'path') {
      return
    }
    updateFieldValue(target)
  }

  refs.spotList.addEventListener('input', handleEvent)
  refs.segmentList.addEventListener('input', handleEvent)
  refs.spotList.addEventListener('change', handleEvent)
  refs.segmentList.addEventListener('change', handleEvent)

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]')
    if (!button || !state.trip) {
      return
    }

    const action = button.dataset.action
    const index = Number(button.dataset.index)

    if (action === 'delete-spot' && Number.isInteger(index)) {
      if (!window.confirm('确定删除这个景点吗？')) {
        return
      }
      state.trip.spots.splice(index, 1)
      updateDirtyState(true)
      renderDayFilters()
      renderSummary()
      renderSpots()
      return
    }

    if (action === 'delete-segment' && Number.isInteger(index)) {
      if (!window.confirm('确定删除这段路线吗？')) {
        return
      }
      state.trip.routeSegments.splice(index, 1)
      updateDirtyState(true)
      renderSummary()
      renderSegments()
      return
    }

    if (action === 'move-segment-up' && Number.isInteger(index)) {
      moveArrayItem(state.trip.routeSegments, index, index - 1)
      updateDirtyState(true)
      renderSegments()
      return
    }

    if (action === 'move-segment-down' && Number.isInteger(index)) {
      moveArrayItem(state.trip.routeSegments, index, index + 1)
      updateDirtyState(true)
      renderSegments()
    }
  })
}

async function init() {
  bindMetaEditors()
  bindFilterEditors()
  bindActionButtons()
  bindListEditors()

  try {
    await loadTrip()
  } catch (error) {
    setStatus('后台编辑页加载失败', error.message, 'error')
  }
}

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) {
    return
  }
  event.preventDefault()
  event.returnValue = ''
})

init()
