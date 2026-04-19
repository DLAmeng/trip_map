'use strict';

const refs = {
  subtitle: document.getElementById('dash-subtitle'),
  grid: document.getElementById('trip-grid'),
  emptyState: document.getElementById('empty-state'),
  noMatchState: document.getElementById('no-match-state'),
  newTripBtn: document.getElementById('new-trip-btn'),
  duplicateCurrentBtn: document.getElementById('duplicate-current-btn'),
  searchInput: document.getElementById('search-input'),
  sortSelect: document.getElementById('sort-select'),
  resultCount: document.getElementById('result-count'),
  createDialog: document.getElementById('create-dialog'),
  createForm: document.getElementById('create-form'),
  cancelCreate: document.getElementById('cancel-create'),
  createError: document.getElementById('create-error'),
  toast: document.getElementById('toast'),
};

const state = {
  trips: [],
  query: '',
  sortBy: 'updated',
  loaded: false,
};

let toastTimer = null;

function showToast(message, tone = 'default') {
  if (!refs.toast) return;
  refs.toast.textContent = message;
  refs.toast.classList.toggle('is-error', tone === 'error');
  refs.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    refs.toast.hidden = true;
  }, 2800);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseTimestamp(value) {
  if (!value) return 0;
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z';
  const time = new Date(normalized).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function formatUpdatedAt(trip) {
  const time = parseTimestamp(trip.updatedAt);
  if (!time) return '';
  const date = new Date(time);
  const now = Date.now();
  const diff = now - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚更新';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return `更新于 ${date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}`;
}

function formatDurationChip(trip) {
  const meta = trip.meta || {};
  const summary = trip.summary || {};
  // 优先用真实日期
  if (meta.startDate && meta.endDate) {
    const start = new Date(meta.startDate);
    const end = new Date(meta.endDate);
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      const days = Math.max(1, Math.round((end - start) / (24 * 3600 * 1000)) + 1);
      return `${days} 天`;
    }
  }
  // 否则用景点推导的 day 范围
  if (summary.startDay && summary.endDay) {
    const span = summary.endDay - summary.startDay + 1;
    return span === 1 ? `第 ${summary.startDay} 天` : `${span} 天行程`;
  }
  return '未安排日程';
}

function formatDestination(trip) {
  const dest = (trip.meta || {}).destination;
  return dest ? dest.trim() : '';
}

function renderTripCard(trip) {
  const isCurrent = trip.id === 'current';
  const summary = trip.summary || {};
  const spotCount = Number(summary.spotCount ?? 0);
  const isEmpty = spotCount === 0;
  const description = (trip.meta?.description || '').trim();
  const destination = formatDestination(trip);
  const classes = ['trip-card'];
  if (isCurrent) classes.push('is-current');
  if (isEmpty) classes.push('is-empty');

  return `
    <article class="${classes.join(' ')}" data-id="${escapeHtml(trip.id)}">
      <header class="trip-card-head">
        <div class="trip-card-title">
          <h2>${escapeHtml(trip.name || '未命名行程')}</h2>
          ${destination ? `<p class="trip-destination">📍 ${escapeHtml(destination)}</p>` : ''}
        </div>
        ${isCurrent ? '<span class="trip-badge trip-badge-current">默认</span>' : ''}
      </header>
      ${description ? `<p class="trip-description">${escapeHtml(description)}</p>` : '<p class="trip-description trip-description-placeholder">还没有描述</p>'}
      <div class="trip-stats">
        <span class="stat-chip"><strong>${escapeHtml(spotCount)}</strong> 景点</span>
        <span class="stat-chip"><strong>${escapeHtml(summary.routeSegmentCount ?? 0)}</strong> 路线</span>
        <span class="stat-chip">${escapeHtml(formatDurationChip(trip))}</span>
      </div>
      <div class="trip-meta-line">${escapeHtml(formatUpdatedAt(trip))}</div>
      <div class="trip-actions">
        <a class="open-btn" href="/trip?id=${encodeURIComponent(trip.id)}">打开地图</a>
        <a class="edit-btn" href="/admin?id=${encodeURIComponent(trip.id)}">编辑</a>
        <button class="duplicate-btn" type="button" data-action="duplicate" data-id="${escapeHtml(trip.id)}" data-name="${escapeHtml(trip.name || '')}" aria-label="复制行程" title="复制此行程">⎘</button>
        ${isCurrent ? '' : `<button class="delete-btn" type="button" data-action="delete" data-id="${escapeHtml(trip.id)}" data-name="${escapeHtml(trip.name || '')}" aria-label="删除行程">✕</button>`}
      </div>
    </article>
  `;
}

function filterAndSort(trips) {
  const query = state.query.trim().toLowerCase();
  let list = trips;
  if (query) {
    list = list.filter((trip) => {
      const haystack = [trip.name, trip.meta?.destination, trip.meta?.description, trip.slug]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .join(' \u0001 ');
      return haystack.includes(query);
    });
  }
  const sorted = [...list];
  switch (state.sortBy) {
    case 'name':
      sorted.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN'));
      break;
    case 'spots':
      sorted.sort((a, b) => (b.summary?.spotCount || 0) - (a.summary?.spotCount || 0));
      break;
    case 'created':
      sorted.sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));
      break;
    case 'updated':
    default:
      sorted.sort((a, b) => parseTimestamp(b.updatedAt) - parseTimestamp(a.updatedAt));
      break;
  }
  // 默认行程常驻顶部(仅在按名称/景点排序时不强制)
  if (state.sortBy === 'updated' || state.sortBy === 'created') {
    const currentIdx = sorted.findIndex((t) => t.id === 'current');
    if (currentIdx > 0) {
      const [current] = sorted.splice(currentIdx, 1);
      sorted.unshift(current);
    }
  }
  return sorted;
}

function renderList() {
  const filtered = filterAndSort(state.trips);
  const total = state.trips.length;

  if (!total) {
    refs.grid.innerHTML = '';
    refs.emptyState.hidden = false;
    refs.noMatchState.hidden = true;
    refs.subtitle.textContent = '还没有行程。创建第一个，或基于默认日本行程复制一份。';
    refs.resultCount.textContent = '';
    return;
  }

  refs.emptyState.hidden = true;
  if (!filtered.length) {
    refs.grid.innerHTML = '';
    refs.noMatchState.hidden = false;
    refs.resultCount.textContent = `0 / ${total}`;
    return;
  }
  refs.noMatchState.hidden = true;
  refs.grid.innerHTML = filtered.map(renderTripCard).join('');
  refs.subtitle.textContent = `共 ${total} 个行程，继续规划吧。`;
  refs.resultCount.textContent = filtered.length === total ? `${total} 个` : `${filtered.length} / ${total}`;
}

async function refreshTripList() {
  try {
    state.trips = await TripApi.listTrips();
    state.loaded = true;
    renderList();
  } catch (error) {
    refs.subtitle.textContent = '加载失败';
    refs.grid.innerHTML = `
      <div class="empty-state compact">
        <p>无法加载行程列表：${escapeHtml(error.message)}</p>
        <button type="button" class="secondary-btn" data-action="retry">重试</button>
      </div>
    `;
    refs.emptyState.hidden = true;
    refs.noMatchState.hidden = true;
  }
}

function openCreateDialog() {
  if (!refs.createDialog) return;
  refs.createForm.reset();
  refs.createError.hidden = true;
  refs.createError.textContent = '';
  if (typeof refs.createDialog.showModal === 'function') {
    refs.createDialog.showModal();
  } else {
    refs.createDialog.setAttribute('open', '');
  }
  const nameInput = refs.createForm.querySelector('input[name="name"]');
  setTimeout(() => nameInput?.focus(), 30);
}

function closeCreateDialog() {
  if (refs.createDialog?.open) refs.createDialog.close();
}

async function handleCreateSubmit(event) {
  event.preventDefault();
  const form = refs.createForm;
  const submitBtn = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const payload = {
    name: String(data.get('name') || '').trim(),
    destination: String(data.get('destination') || '').trim(),
    description: String(data.get('description') || '').trim(),
    startDate: String(data.get('startDate') || '').trim(),
    endDate: String(data.get('endDate') || '').trim(),
    template: String(data.get('template') || 'empty'),
  };
  if (!payload.name) {
    refs.createError.textContent = '请填写行程名称';
    refs.createError.hidden = false;
    return;
  }
  if (payload.startDate && payload.endDate && payload.endDate < payload.startDate) {
    refs.createError.textContent = '结束日期不能早于开始日期';
    refs.createError.hidden = false;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '创建中...';
  refs.createError.hidden = true;

  try {
    const result = await TripApi.createTrip(payload);
    closeCreateDialog();
    window.location.href = `/trip?id=${encodeURIComponent(result.trip.id)}`;
  } catch (error) {
    refs.createError.textContent = error.message;
    refs.createError.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = '创建并进入';
  }
}

async function handleDuplicate(id, _name, trigger) {
  const originalLabel = trigger?.textContent;
  if (trigger) {
    trigger.disabled = true;
    trigger.textContent = '...';
  }
  try {
    const result = await TripApi.duplicateTrip(id);
    showToast(`已复制为「${result.trip.name}」`);
    window.location.href = `/admin?id=${encodeURIComponent(result.trip.id)}`;
  } catch (error) {
    showToast(error.message, 'error');
    if (trigger) {
      trigger.disabled = false;
      trigger.textContent = originalLabel;
    }
  }
}

async function handleDelete(id, name) {
  if (!window.confirm(`确定删除「${name || id}」这个行程吗？此操作不可恢复。`)) return;
  try {
    await TripApi.deleteTrip(id);
    showToast('已删除');
    await refreshTripList();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function bindEvents() {
  refs.newTripBtn?.addEventListener('click', openCreateDialog);
  refs.duplicateCurrentBtn?.addEventListener('click', async () => {
    refs.duplicateCurrentBtn.disabled = true;
    try {
      const result = await TripApi.duplicateTrip('current');
      showToast(`已复制为「${result.trip.name}」`);
      window.location.href = `/admin?id=${encodeURIComponent(result.trip.id)}`;
    } catch (error) {
      showToast(error.message, 'error');
      refs.duplicateCurrentBtn.disabled = false;
    }
  });

  refs.emptyState?.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="new-trip"]')) openCreateDialog();
    if (event.target.closest('[data-action="duplicate-current"]')) {
      refs.duplicateCurrentBtn?.click();
    }
  });

  refs.cancelCreate?.addEventListener('click', closeCreateDialog);
  refs.createForm?.addEventListener('submit', handleCreateSubmit);

  refs.searchInput?.addEventListener('input', (event) => {
    state.query = event.target.value || '';
    if (state.loaded) renderList();
  });
  refs.sortSelect?.addEventListener('change', (event) => {
    state.sortBy = event.target.value || 'updated';
    if (state.loaded) renderList();
  });

  refs.grid?.addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      event.preventDefault();
      handleDelete(deleteBtn.dataset.id, deleteBtn.dataset.name);
      return;
    }
    const duplicateBtn = event.target.closest('[data-action="duplicate"]');
    if (duplicateBtn) {
      event.preventDefault();
      handleDuplicate(duplicateBtn.dataset.id, duplicateBtn.dataset.name, duplicateBtn);
      return;
    }
    const retryBtn = event.target.closest('[data-action="retry"]');
    if (retryBtn) {
      event.preventDefault();
      refreshTripList();
    }
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] register failed', err);
    });
  });
}

bindEvents();
refreshTripList();
