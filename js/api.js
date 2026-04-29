// ================================================================
// API — All communication with the Google Apps Script backend
//
// ACTION REQUIRED: After deploying your Apps Script Web App,
// paste the URL below to replace 'YOUR_APPS_SCRIPT_URL_HERE'.
// ================================================================

const CONFIG = {
  SCRIPT_URL: 'YOUR_APPS_SCRIPT_URL_HERE'
};

const API = {

  // ---- internal helpers ----------------------------------------

  async _get(action, params = {}) {
    const url = new URL(CONFIG.SCRIPT_URL);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    const res  = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  async _post(payload) {
    const res = await fetch(CONFIG.SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  },

  // ---- items ---------------------------------------------------

  getItems:    ()     => API._get('getItems'),
  getItem:     (id)   => API._get('getItem', { id }),
  addItem:     (data) => API._post({ action: 'addItem',    ...data }),
  editItem:    (data) => API._post({ action: 'editItem',   ...data }),
  archiveItem: (id)   => API._post({ action: 'archiveItem', id }),

  // ---- rooms ---------------------------------------------------

  getRooms:  ()         => API._get('getRooms'),
  addRoom:   (name)     => API._post({ action: 'addRoom',  name }),
  editRoom:  (id, name) => API._post({ action: 'editRoom', id, name }),

  // ---- courses -------------------------------------------------

  // includeInactive=true fetches all courses (used by admin panel)
  getCourses: (includeInactive = false) =>
    API._get('getCourses', includeInactive ? { includeInactive: 'true' } : {}),

  addCourse:  (name)              => API._post({ action: 'addCourse',  name }),
  editCourse: (id, name, active)  => API._post({ action: 'editCourse', id, name, active }),

  // ---- transactions --------------------------------------------

  getTransactions: (item_id) => API._get('getTransactions', { item_id }),

  // ---- adjustments ---------------------------------------------

  adjustItem:   (data) => API._post({ action: 'adjustItem',   ...data }),
  receiveItems: (data) => API._post({ action: 'receiveItems', ...data }),
};
