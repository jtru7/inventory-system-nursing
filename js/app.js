// ================================================================
// NURSING INVENTORY — Main App
// Single-page app: no framework, vanilla JS
// ================================================================

// ================================================================
// STATE
// ================================================================
const state = {
  view:           'home',    // 'home' | 'item' | 'admin' | 'receiving'
  adminTab:       'items',   // 'items' | 'rooms' | 'courses'
  items:          [],        // all items (active + archived)
  rooms:          [],
  courses:        [],        // all courses (active + inactive)
  transactions:   [],        // transactions for the currently viewed item
  searchQuery:    '',
  filterRoom:     '',
  filterCategory: '',
  selectedItemId: null,
  showArchived:   false,
};

// ================================================================
// UTILITIES
// ================================================================
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getRoomName(room_id) {
  const room = state.rooms.find(r => r.id === room_id);
  return room ? room.name : (room_id || '—');
}

function isLowStock(item) {
  return Number(item.reorder_threshold) > 0 &&
         Number(item.quantity) <= Number(item.reorder_threshold);
}

function isOutOfStock(item) {
  return Number(item.quantity) === 0;
}

function getCategories() {
  const cats = new Set(state.items
    .filter(i => i.status === 'active' && i.category)
    .map(i => i.category));
  return [...cats].sort();
}

function getActiveCourses() {
  return state.courses.filter(c => c.active === true || c.active === 'TRUE');
}

function getFilteredItems() {
  const q = state.searchQuery.toLowerCase().trim();
  return state.items
    .filter(i => i.status === 'active')
    .filter(i => {
      if (!q) return true;
      const room = getRoomName(i.room_id).toLowerCase();
      return (
        (i.name          || '').toLowerCase().includes(q) ||
        (i.category      || '').toLowerCase().includes(q) ||
        (i.location_code || '').toLowerCase().includes(q) ||
        (i.unit          || '').toLowerCase().includes(q) ||
        room.includes(q)
      );
    })
    .filter(i => !state.filterRoom     || i.room_id  === state.filterRoom)
    .filter(i => !state.filterCategory || i.category === state.filterCategory)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getSelectedItem() {
  return state.items.find(i => i.id === state.selectedItemId);
}

// ================================================================
// NAVIGATION
// ================================================================
function navigate(view, params = {}) {
  state.view = view;
  if (params.itemId    !== undefined) state.selectedItemId = params.itemId;
  if (params.adminTab  !== undefined) state.adminTab       = params.adminTab;
  document.getElementById('main-content').scrollTop = 0;
  render();
}

// ================================================================
// LOADING & FEEDBACK
// ================================================================
function setLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !on);
}

let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast-' + type;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ================================================================
// MODAL
// ================================================================
function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}

// ================================================================
// DATA LOADING
// ================================================================
async function loadAll() {
  setLoading(true);
  try {
    const [itemsRes, roomsRes, coursesRes] = await Promise.all([
      API.getItems(),
      API.getRooms(),
      API.getCourses(true),   // includeInactive=true so admin sees everything
    ]);
    state.items   = itemsRes.items    || [];
    state.rooms   = roomsRes.rooms    || [];
    state.courses = coursesRes.courses || [];
  } catch (err) {
    showToast('Error loading data: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function loadTransactions(itemId) {
  try {
    const res = await API.getTransactions(itemId);
    state.transactions = res.transactions || [];
  } catch (_) {
    state.transactions = [];
  }
}

// ================================================================
// RENDER DISPATCHER
// ================================================================
function render() {
  const main = document.getElementById('main-content');
  switch (state.view) {
    case 'home':
      renderHeader('Nursing Inventory', false, true);
      main.innerHTML = buildHome();
      attachHomeEvents();
      break;
    case 'item':
      renderHeader(getSelectedItem()?.name || 'Item', true, false);
      main.innerHTML = buildItemDetail(getSelectedItem());
      attachItemDetailEvents();
      break;
    case 'receiving':
      renderHeader('Restock / Receiving', true, false);
      main.innerHTML = buildReceiving();
      attachReceivingEvents();
      break;
    case 'admin':
      renderHeader('Admin', true, false);
      main.innerHTML = buildAdmin();
      attachAdminEvents();
      break;
  }
}

function renderHeader(title, showBack, showNav) {
  document.getElementById('header-title').textContent = title;
  document.getElementById('btn-back').classList.toggle('hidden', !showBack);
  document.getElementById('btn-receiving').classList.toggle('hidden', !showNav);
  document.getElementById('btn-admin').classList.toggle('hidden', !showNav);
}

// ================================================================
// HOME VIEW
// ================================================================
function buildHome() {
  const items      = getFilteredItems();
  const rooms      = state.rooms;
  const categories = getCategories();
  const lowCount   = state.items.filter(i => i.status === 'active' && isLowStock(i)).length;

  return `
    <div class="home-view">
      <div class="search-bar-wrapper">
        <div class="search-bar">
          <span class="search-icon">&#128269;</span>
          <input type="text" id="search-input"
                 placeholder="Search items, rooms, locations..."
                 value="${esc(state.searchQuery)}"
                 autocomplete="off" autocorrect="off" spellcheck="false">
          ${state.searchQuery ? `<button id="btn-clear-search" class="btn-clear">&#10005;</button>` : ''}
        </div>
      </div>

      <div class="filter-bar">
        <select id="filter-room">
          <option value="">All Rooms</option>
          ${rooms.map(r =>
            `<option value="${r.id}" ${state.filterRoom === r.id ? 'selected' : ''}>${esc(r.name)}</option>`
          ).join('')}
        </select>
        <select id="filter-category">
          <option value="">All Categories</option>
          ${categories.map(c =>
            `<option value="${c}" ${state.filterCategory === c ? 'selected' : ''}>${esc(c)}</option>`
          ).join('')}
        </select>
        ${lowCount > 0
          ? `<button id="btn-filter-low" class="filter-btn badge-low-stock">&#9888; ${lowCount} Low</button>`
          : ''}
      </div>

      <div class="results-meta">
        <span>${items.length} item${items.length !== 1 ? 's' : ''}</span>
      </div>

      <div class="item-list">
        ${items.length === 0
          ? `<div class="empty-state">No items found</div>`
          : items.map(buildItemCard).join('')}
      </div>
    </div>
  `;
}

function buildItemCard(item) {
  const roomName = getRoomName(item.room_id);
  const low      = isLowStock(item);
  const out      = isOutOfStock(item);

  return `
    <div class="item-card ${low ? 'item-card--low' : ''}" data-item-id="${item.id}">
      <div class="item-card-main">
        <div class="item-card-name">${esc(item.name)}</div>
        <div class="item-card-meta">
          ${esc(item.category || '')}${item.unit ? ' &middot; ' + esc(item.unit) : ''}
        </div>
        <div class="item-card-location">
          <span class="location-room">${esc(roomName)}</span>
          ${item.location_code
            ? `<span class="location-code">${esc(item.location_code)}</span>`
            : ''}
        </div>
      </div>
      <div class="item-card-qty">
        ${out ? `<span class="qty-badge qty-badge--out">OUT</span>`
              : low ? `<span class="qty-badge qty-badge--low">LOW</span>` : ''}
        <span class="qty-number ${out ? 'qty-out' : low ? 'qty-low' : ''}">${item.quantity}</span>
        <span class="qty-unit">${esc(item.unit || '')}</span>
      </div>
    </div>
  `;
}

function attachHomeEvents() {
  const searchInput = document.getElementById('search-input');

  // Live search — re-renders only the list, not the whole view
  searchInput?.addEventListener('input', e => {
    state.searchQuery = e.target.value;
    refreshItemList();
  });

  document.getElementById('btn-clear-search')?.addEventListener('click', () => {
    state.searchQuery = '';
    searchInput.value = '';
    refreshItemList();
  });

  document.getElementById('filter-room')?.addEventListener('change', e => {
    state.filterRoom = e.target.value;
    refreshItemList();
  });

  document.getElementById('filter-category')?.addEventListener('change', e => {
    state.filterCategory = e.target.value;
    refreshItemList();
  });

  document.getElementById('btn-filter-low')?.addEventListener('click', () => {
    // Toggle low-stock filter by showing only items at/below threshold
    // Simple approach: filter by a sentinel; reset to show all
    state.filterLowOnly = !state.filterLowOnly;
    refreshItemList();
  });

  attachItemCardEvents();
  setTimeout(() => searchInput?.focus(), 150);
}

function refreshItemList() {
  const items   = getFilteredItems();
  const listEl  = document.querySelector('.item-list');
  const metaEl  = document.querySelector('.results-meta');
  const wrapper = document.querySelector('.search-bar');

  if (listEl) {
    listEl.innerHTML = items.length === 0
      ? `<div class="empty-state">No items found</div>`
      : items.map(buildItemCard).join('');
    attachItemCardEvents();
  }

  if (metaEl) {
    metaEl.innerHTML = `<span>${items.length} item${items.length !== 1 ? 's' : ''}</span>`;
  }

  // Sync clear button
  const hasClear = !!document.getElementById('btn-clear-search');
  if (state.searchQuery && !hasClear && wrapper) {
    const btn = document.createElement('button');
    btn.id        = 'btn-clear-search';
    btn.className = 'btn-clear';
    btn.innerHTML = '&#10005;';
    btn.addEventListener('click', () => {
      state.searchQuery = '';
      document.getElementById('search-input').value = '';
      refreshItemList();
    });
    wrapper.appendChild(btn);
  } else if (!state.searchQuery && hasClear) {
    document.getElementById('btn-clear-search').remove();
  }
}

function attachItemCardEvents() {
  document.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', async () => {
      const itemId = card.dataset.itemId;
      state.selectedItemId = itemId;
      setLoading(true);
      await loadTransactions(itemId);
      setLoading(false);
      navigate('item', { itemId });
    });
  });
}

// ================================================================
// ITEM DETAIL VIEW
// ================================================================
function buildItemDetail(item) {
  if (!item) return '<div class="empty-state">Item not found.</div>';

  const roomName = getRoomName(item.room_id);
  const low      = isLowStock(item);
  const out      = isOutOfStock(item);

  return `
    <div class="detail-view">

      <div class="detail-card">
        <div class="detail-category-unit">
          ${esc(item.category || '—')} &middot; ${esc(item.unit || '—')}
        </div>
        <div class="detail-location-block">
          <div class="detail-location-label">Location</div>
          <div class="detail-location-room">${esc(roomName)}</div>
          ${item.location_code
            ? `<div class="detail-location-code">${esc(item.location_code)}</div>`
            : ''}
        </div>
        ${low && !out ? `<div class="detail-low-warning">&#9888; Low Stock &mdash; reorder at ${item.reorder_threshold}</div>` : ''}
        ${out          ? `<div class="detail-out-warning">&#9940; Out of Stock</div>` : ''}
      </div>

      <div class="qty-control-card">
        <div class="qty-control-label">Current Quantity</div>
        <div class="qty-control-row">
          <button class="btn-adjust btn-minus" data-dir="-1" ${out ? 'disabled' : ''}>&#8722;</button>
          <span class="qty-display ${out ? 'qty-out' : low ? 'qty-low' : ''}">${item.quantity}</span>
          <button class="btn-adjust btn-plus" data-dir="1">&#43;</button>
        </div>
      </div>

      <div class="tx-section">
        <div class="tx-section-title">Recent Activity</div>
        ${buildTransactionList()}
      </div>

    </div>
  `;
}

function buildTransactionList() {
  if (!state.transactions.length) {
    return '<div class="tx-empty">No activity recorded yet.</div>';
  }
  return `
    <div class="tx-list">
      ${state.transactions.map(tx => {
        const delta    = Number(tx.delta);
        const sign     = delta > 0 ? '+' : '';
        const typeLabel = tx.change_type === 'receive' ? 'Received' : 'Adjusted';
        const date     = tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '';
        return `
          <div class="tx-row">
            <div class="tx-delta ${delta > 0 ? 'tx-pos' : 'tx-neg'}">${sign}${delta}</div>
            <div class="tx-details">
              <div class="tx-type">${typeLabel} &rarr; ${tx.new_quantity}</div>
              ${tx.course_name  ? `<div class="tx-course">${esc(tx.course_name)}</div>`  : ''}
              ${tx.person_name  ? `<div class="tx-person">${esc(tx.person_name)}</div>`  : ''}
              <div class="tx-date">${date}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function attachItemDetailEvents() {
  document.querySelectorAll('.btn-adjust').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = parseInt(btn.dataset.dir);
      showModal(buildAdjustModal(dir));
      attachAdjustModalEvents(dir);
    });
  });
}

// ================================================================
// ADJUSTMENT MODAL
// ================================================================
function buildAdjustModal(direction) {
  const label    = direction > 0 ? 'Adding Stock' : 'Removing Stock';
  const btnClass = direction > 0 ? 'btn-primary'  : 'btn-danger';
  const courses  = getActiveCourses();

  return `
    <div class="modal-body">
      <div class="modal-title">${label}</div>

      <div class="form-group">
        <label>Quantity</label>
        <div class="qty-input-row">
          <button class="btn-qty-adj" id="modal-qty-minus">&#8722;</button>
          <input type="number" id="modal-qty" value="1" min="1" max="9999" class="qty-input">
          <button class="btn-qty-adj" id="modal-qty-plus">&#43;</button>
        </div>
      </div>

      <div class="form-group">
        <label>Your Name <span class="optional">(optional)</span></label>
        <input type="text" id="modal-name" placeholder="Enter your name..." class="text-input">
      </div>

      <div class="form-group">
        <label>Course / Consumer <span class="optional">(optional)</span></label>
        <select id="modal-course" class="select-input">
          <option value="">&#8212; Select a course &#8212;</option>
          ${courses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
      </div>

      <div class="modal-actions">
        <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
        <button class="btn ${btnClass}" id="modal-confirm">Confirm</button>
      </div>
    </div>
  `;
}

function attachAdjustModalEvents(direction) {
  const qtyInput = document.getElementById('modal-qty');

  document.getElementById('modal-qty-minus').addEventListener('click', () => {
    const v = parseInt(qtyInput.value) || 1;
    if (v > 1) qtyInput.value = v - 1;
  });

  document.getElementById('modal-qty-plus').addEventListener('click', () => {
    qtyInput.value = (parseInt(qtyInput.value) || 1) + 1;
  });

  document.getElementById('modal-cancel').addEventListener('click', hideModal);

  document.getElementById('modal-confirm').addEventListener('click', async () => {
    const qty      = parseInt(qtyInput.value) || 1;
    const name     = document.getElementById('modal-name').value.trim();
    const courseId = document.getElementById('modal-course').value;
    const delta    = direction * qty;

    hideModal();
    setLoading(true);
    try {
      const res = await API.adjustItem({
        item_id:     state.selectedItemId,
        delta,
        person_name: name,
        course_id:   courseId
      });

      // Update local item quantity without a full reload
      const item = state.items.find(i => i.id === state.selectedItemId);
      if (item) item.quantity = res.new_quantity;

      await loadTransactions(state.selectedItemId);
      showToast(direction > 0 ? `Added ${qty}` : `Removed ${qty}`);
      render();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  });

  // Tap outside modal to dismiss
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) hideModal();
  }, { once: true });
}

// ================================================================
// RECEIVING VIEW
// ================================================================
function buildReceiving() {
  const items = [...state.items]
    .filter(i => i.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name));

  return `
    <div class="receiving-view">
      <div class="receiving-intro">
        Enter received quantities. Leave blank for items not received this time.
      </div>

      <div class="form-group">
        <label>Your Name <span class="optional">(optional)</span></label>
        <input type="text" id="receiving-name" placeholder="Enter your name..." class="text-input">
      </div>

      <div class="receiving-list">
        ${items.map(item => `
          <div class="receiving-row">
            <div class="receiving-item-info">
              <div class="receiving-item-name">${esc(item.name)}</div>
              <div class="receiving-item-meta">${esc(getRoomName(item.room_id))}${item.location_code ? ' &middot; ' + esc(item.location_code) : ''}</div>
              <div class="receiving-item-qty">In stock: ${item.quantity} ${esc(item.unit || '')}</div>
            </div>
            <div class="receiving-input-wrap">
              <input type="number"
                     class="receiving-qty-input"
                     data-item-id="${item.id}"
                     placeholder="0"
                     min="0"
                     max="99999">
            </div>
          </div>
        `).join('')}
      </div>

      <div class="receiving-footer">
        <button class="btn btn-primary btn-full" id="btn-submit-receiving">Submit Receiving</button>
      </div>
    </div>
  `;
}

function attachReceivingEvents() {
  document.getElementById('btn-submit-receiving').addEventListener('click', async () => {
    const name   = document.getElementById('receiving-name').value.trim();
    const inputs = document.querySelectorAll('.receiving-qty-input');

    const entries = [];
    inputs.forEach(input => {
      const qty = parseInt(input.value);
      if (qty > 0) entries.push({ item_id: input.dataset.itemId, quantity: qty });
    });

    if (entries.length === 0) {
      showToast('No quantities entered', 'error');
      return;
    }

    setLoading(true);
    try {
      await API.receiveItems({ items: entries, person_name: name });
      await loadAll();
      showToast(`Updated ${entries.length} item${entries.length !== 1 ? 's' : ''}`);
      navigate('home');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  });
}

// ================================================================
// ADMIN VIEW
// ================================================================
function buildAdmin() {
  return `
    <div class="admin-view">
      <div class="admin-tabs">
        <button class="admin-tab ${state.adminTab === 'items'   ? 'active' : ''}" data-tab="items">Items</button>
        <button class="admin-tab ${state.adminTab === 'rooms'   ? 'active' : ''}" data-tab="rooms">Rooms</button>
        <button class="admin-tab ${state.adminTab === 'courses' ? 'active' : ''}" data-tab="courses">Courses</button>
      </div>
      <div class="admin-content">
        ${{ items: buildAdminItems, rooms: buildAdminRooms, courses: buildAdminCourses }[state.adminTab]()}
      </div>
    </div>
  `;
}

function buildAdminItems() {
  const items = [...state.items]
    .filter(i => state.showArchived ? true : i.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name));

  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <label class="toggle-label">
          <input type="checkbox" id="toggle-archived" ${state.showArchived ? 'checked' : ''}>
          Show Archived
        </label>
        <button class="btn btn-primary btn-sm" id="btn-add-item">+ Add Item</button>
      </div>
      <div class="admin-list">
        ${items.length === 0
          ? `<div class="empty-state">No items yet.</div>`
          : items.map(item => `
            <div class="admin-row ${item.status === 'archived' ? 'admin-row--archived' : ''}">
              <div class="admin-row-info">
                <div class="admin-row-name">${esc(item.name)}</div>
                <div class="admin-row-meta">
                  ${esc(item.category || '—')} &middot; ${esc(getRoomName(item.room_id))}
                  ${item.location_code ? ' &middot; ' + esc(item.location_code) : ''}
                </div>
                <div class="admin-row-meta">
                  Qty: ${item.quantity} &middot; Threshold: ${item.reorder_threshold} &middot; ${item.status}
                </div>
              </div>
              <div class="admin-row-actions">
                <button class="btn btn-ghost btn-sm btn-edit-item" data-item-id="${item.id}">Edit</button>
                ${item.status === 'active'
                  ? `<button class="btn btn-danger-ghost btn-sm btn-archive-item" data-item-id="${item.id}">Archive</button>`
                  : ''}
              </div>
            </div>
          `).join('')}
      </div>
    </div>
  `;
}

function buildAdminRooms() {
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <span></span>
        <button class="btn btn-primary btn-sm" id="btn-add-room">+ Add Room</button>
      </div>
      <div class="admin-list">
        ${state.rooms.length === 0
          ? `<div class="empty-state">No rooms yet.</div>`
          : state.rooms.map(room => `
            <div class="admin-row">
              <div class="admin-row-info">
                <div class="admin-row-name">${esc(room.name)}</div>
              </div>
              <div class="admin-row-actions">
                <button class="btn btn-ghost btn-sm btn-edit-room"
                        data-room-id="${room.id}"
                        data-room-name="${esc(room.name)}">Edit</button>
              </div>
            </div>
          `).join('')}
      </div>
    </div>
  `;
}

function buildAdminCourses() {
  const courses = [...state.courses].sort((a, b) => a.name.localeCompare(b.name));
  return `
    <div class="admin-section">
      <div class="admin-section-header">
        <span></span>
        <button class="btn btn-primary btn-sm" id="btn-add-course">+ Add Course</button>
      </div>
      <div class="admin-list">
        ${courses.length === 0
          ? `<div class="empty-state">No courses yet.</div>`
          : courses.map(course => {
              const active = course.active === true || course.active === 'TRUE';
              return `
                <div class="admin-row ${!active ? 'admin-row--archived' : ''}">
                  <div class="admin-row-info">
                    <div class="admin-row-name">${esc(course.name)}</div>
                    <div class="admin-row-meta">${active ? 'Active' : 'Inactive'}</div>
                  </div>
                  <div class="admin-row-actions">
                    <button class="btn btn-ghost btn-sm btn-edit-course"
                            data-course-id="${course.id}"
                            data-course-name="${esc(course.name)}">Edit</button>
                    <button class="btn btn-danger-ghost btn-sm btn-toggle-course"
                            data-course-id="${course.id}"
                            data-active="${active}">
                      ${active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
      </div>
    </div>
  `;
}

function attachAdminEvents() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.adminTab = tab.dataset.tab;
      render();
    });
  });

  if (state.adminTab === 'items')   attachAdminItemEvents();
  if (state.adminTab === 'rooms')   attachAdminRoomEvents();
  if (state.adminTab === 'courses') attachAdminCourseEvents();
}

// ---- Admin: Items ----

function attachAdminItemEvents() {
  document.getElementById('toggle-archived')?.addEventListener('change', e => {
    state.showArchived = e.target.checked;
    render();
  });

  document.getElementById('btn-add-item')?.addEventListener('click', () => {
    showModal(buildItemForm());
    attachItemFormEvents(null);
  });

  document.querySelectorAll('.btn-edit-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = state.items.find(i => i.id === btn.dataset.itemId);
      if (item) { showModal(buildItemForm(item)); attachItemFormEvents(item); }
    });
  });

  document.querySelectorAll('.btn-archive-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Archive this item? It will be hidden from the main list but its history is kept.')) return;
      setLoading(true);
      try {
        await API.archiveItem(btn.dataset.itemId);
        await loadAll();
        showToast('Item archived');
        render();
      } catch (err) { showToast(err.message, 'error'); }
      finally { setLoading(false); }
    });
  });
}

function buildItemForm(item = null) {
  const isEdit = !!item;
  const roomOptions = state.rooms.map(r =>
    `<option value="${r.id}" ${item && item.room_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`
  ).join('');

  return `
    <div class="modal-body">
      <div class="modal-title">${isEdit ? 'Edit Item' : 'Add New Item'}</div>

      <div class="form-group">
        <label>Name *</label>
        <input type="text" id="form-name" class="text-input" value="${esc(item?.name || '')}" placeholder="Item name">
      </div>
      <div class="form-group">
        <label>Category</label>
        <input type="text" id="form-category" class="text-input" value="${esc(item?.category || '')}" placeholder="e.g. PPE, Wound Care">
      </div>
      <div class="form-group">
        <label>Unit</label>
        <input type="text" id="form-unit" class="text-input" value="${esc(item?.unit || '')}" placeholder="e.g. boxes, units, cases">
      </div>
      <div class="form-group">
        <label>Room</label>
        <select id="form-room" class="select-input">
          <option value="">&#8212; Select Room &#8212;</option>
          ${roomOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Location Code</label>
        <input type="text" id="form-location" class="text-input" value="${esc(item?.location_code || '')}" placeholder="e.g. 3 Yellow 1E">
      </div>
      <div class="form-group">
        <label>Reorder Threshold</label>
        <input type="number" id="form-threshold" class="text-input" value="${item?.reorder_threshold ?? 0}" min="0">
      </div>
      ${!isEdit ? `
        <div class="form-group">
          <label>Initial Quantity</label>
          <input type="number" id="form-qty" class="text-input" value="0" min="0">
        </div>
      ` : ''}

      <div class="modal-actions">
        <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-save-item" data-item-id="${item?.id || ''}">
          ${isEdit ? 'Save Changes' : 'Add Item'}
        </button>
      </div>
    </div>
  `;
}

function attachItemFormEvents(existingItem) {
  document.getElementById('modal-cancel').addEventListener('click', hideModal);

  document.getElementById('modal-save-item').addEventListener('click', async () => {
    const name = document.getElementById('form-name').value.trim();
    if (!name) { showToast('Name is required', 'error'); return; }

    const payload = {
      name,
      category:          document.getElementById('form-category').value.trim(),
      unit:              document.getElementById('form-unit').value.trim(),
      room_id:           document.getElementById('form-room').value,
      location_code:     document.getElementById('form-location').value.trim(),
      reorder_threshold: parseInt(document.getElementById('form-threshold').value) || 0,
    };
    if (!existingItem) {
      payload.quantity = parseInt(document.getElementById('form-qty').value) || 0;
    }

    hideModal();
    setLoading(true);
    try {
      if (existingItem) {
        await API.editItem({ ...payload, id: existingItem.id });
        showToast('Item updated');
      } else {
        await API.addItem(payload);
        showToast('Item added');
      }
      await loadAll();
      render();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  });
}

// ---- Admin: Rooms ----

function attachAdminRoomEvents() {
  document.getElementById('btn-add-room')?.addEventListener('click', () => {
    showModal(buildRoomForm());
    attachRoomFormEvents(null);
  });

  document.querySelectorAll('.btn-edit-room').forEach(btn => {
    btn.addEventListener('click', () => {
      const room = state.rooms.find(r => r.id === btn.dataset.roomId);
      if (room) { showModal(buildRoomForm(room)); attachRoomFormEvents(room); }
    });
  });
}

function buildRoomForm(room = null) {
  return `
    <div class="modal-body">
      <div class="modal-title">${room ? 'Edit Room' : 'Add Room'}</div>
      <div class="form-group">
        <label>Room Name *</label>
        <input type="text" id="form-room-name" class="text-input"
               value="${esc(room?.name || '')}" placeholder="e.g. Room 204">
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-save-room" data-room-id="${room?.id || ''}">
          ${room ? 'Save' : 'Add Room'}
        </button>
      </div>
    </div>
  `;
}

function attachRoomFormEvents(existingRoom) {
  document.getElementById('modal-cancel').addEventListener('click', hideModal);

  document.getElementById('modal-save-room').addEventListener('click', async () => {
    const name = document.getElementById('form-room-name').value.trim();
    if (!name) { showToast('Room name is required', 'error'); return; }

    hideModal();
    setLoading(true);
    try {
      if (existingRoom) {
        await API.editRoom(existingRoom.id, name);
        showToast('Room updated');
      } else {
        await API.addRoom(name);
        showToast('Room added');
      }
      await loadAll();
      render();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  });
}

// ---- Admin: Courses ----

function attachAdminCourseEvents() {
  document.getElementById('btn-add-course')?.addEventListener('click', () => {
    showModal(buildCourseForm());
    attachCourseFormEvents(null);
  });

  document.querySelectorAll('.btn-edit-course').forEach(btn => {
    btn.addEventListener('click', () => {
      const course = state.courses.find(c => c.id === btn.dataset.courseId);
      if (course) { showModal(buildCourseForm(course)); attachCourseFormEvents(course); }
    });
  });

  document.querySelectorAll('.btn-toggle-course').forEach(btn => {
    btn.addEventListener('click', async () => {
      const course    = state.courses.find(c => c.id === btn.dataset.courseId);
      if (!course) return;
      const newActive = !(course.active === true || course.active === 'TRUE');
      setLoading(true);
      try {
        await API.editCourse(course.id, course.name, newActive);
        await loadAll();
        showToast(newActive ? 'Course activated' : 'Course deactivated');
        render();
      } catch (err) { showToast(err.message, 'error'); }
      finally { setLoading(false); }
    });
  });
}

function buildCourseForm(course = null) {
  return `
    <div class="modal-body">
      <div class="modal-title">${course ? 'Edit Course' : 'Add Course'}</div>
      <div class="form-group">
        <label>Course Name *</label>
        <input type="text" id="form-course-name" class="text-input"
               value="${esc(course?.name || '')}" placeholder="e.g. NUR 101">
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-save-course" data-course-id="${course?.id || ''}">
          ${course ? 'Save' : 'Add Course'}
        </button>
      </div>
    </div>
  `;
}

function attachCourseFormEvents(existingCourse) {
  document.getElementById('modal-cancel').addEventListener('click', hideModal);

  document.getElementById('modal-save-course').addEventListener('click', async () => {
    const name = document.getElementById('form-course-name').value.trim();
    if (!name) { showToast('Course name is required', 'error'); return; }

    hideModal();
    setLoading(true);
    try {
      if (existingCourse) {
        const active = existingCourse.active === true || existingCourse.active === 'TRUE';
        await API.editCourse(existingCourse.id, name, active);
        showToast('Course updated');
      } else {
        await API.addCourse(name);
        showToast('Course added');
      }
      await loadAll();
      render();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  });
}

// ================================================================
// GLOBAL EVENTS (wired once at init)
// ================================================================
function setupGlobalEvents() {
  document.getElementById('btn-back').addEventListener('click', () => navigate('home'));
  document.getElementById('btn-receiving').addEventListener('click', () => navigate('receiving'));
  document.getElementById('btn-admin').addEventListener('click', () => navigate('admin'));
}

// ================================================================
// INIT
// ================================================================
async function init() {
  setupGlobalEvents();
  await loadAll();
  render();
}

document.addEventListener('DOMContentLoaded', init);
