// ================================================================
// NURSING INVENTORY — Google Apps Script Backend
// ================================================================
//
// SETUP STEPS:
//  1. Create a new Google Sheet with these exact tab names:
//       items | rooms | courses | transactions
//  2. Add headers to each tab (row 1):
//       items:        id | name | category | unit | room_id | location_code | quantity | reorder_threshold | status | created_at
//       rooms:        id | name
//       courses:      id | name | active
//       transactions: id | item_id | item_name | change_type | delta | new_quantity | course_id | course_name | person_name | timestamp
//  3. Copy the Sheet ID from the URL (the long string between /d/ and /edit)
//  4. Paste it below as SHEET_ID
//  5. Deploy: Extensions → Apps Script → Deploy → New Deployment
//       Type: Web App | Execute as: Me | Who has access: Anyone
//  6. Copy the Web App URL and paste it into js/api.js as SCRIPT_URL
// ================================================================

const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';

// ================================================================
// COLUMN INDEX MAPS (0-based, matching header order above)
// ================================================================
const ITEMS_COLS    = { id:0, name:1, category:2, unit:3, room_id:4, location_code:5, quantity:6, reorder_threshold:7, status:8, created_at:9 };
const ROOMS_COLS    = { id:0, name:1 };
const COURSES_COLS  = { id:0, name:1, active:2 };
const TX_COLS       = { id:0, item_id:1, item_name:2, change_type:3, delta:4, new_quantity:5, course_id:6, course_name:7, person_name:8, timestamp:9 };

// ================================================================
// HTTP ENTRY POINTS
// ================================================================
function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;
    switch (action) {
      case 'getItems':        result = getItems();                              break;
      case 'getItem':         result = getItem(e.parameter.id);                break;
      case 'getRooms':        result = getRooms();                             break;
      case 'getCourses':      result = getCourses(e.parameter);                break;
      case 'getTransactions': result = getTransactions(e.parameter.item_id);   break;
      default:                return respond({ error: 'Unknown action: ' + action });
    }
    return respond(result);
  } catch (err) {
    return respond({ error: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result;
    switch (action) {
      case 'adjustItem':   result = adjustItem(data);   break;
      case 'receiveItems': result = receiveItems(data); break;
      case 'addItem':      result = addItem(data);      break;
      case 'editItem':     result = editItem(data);     break;
      case 'archiveItem':  result = archiveItem(data.id); break;
      case 'addRoom':      result = addRoom(data);      break;
      case 'editRoom':     result = editRoom(data);     break;
      case 'addCourse':    result = addCourse(data);    break;
      case 'editCourse':   result = editCourse(data);   break;
      default:             return respond({ error: 'Unknown action: ' + action });
    }
    return respond(result);
  } catch (err) {
    return respond({ error: err.message });
  }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================================================================
// SHEET HELPERS
// ================================================================
function getSheet(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

function sheetToObjects(sheet, colMap) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => {
    const obj = {};
    for (const [key, idx] of Object.entries(colMap)) {
      obj[key] = row[idx];
    }
    return obj;
  });
}

function newId()  { return Utilities.getUuid(); }
function nowIso() { return new Date().toISOString(); }

// ================================================================
// ITEMS
// ================================================================
function getItems() {
  const items = sheetToObjects(getSheet('items'), ITEMS_COLS);
  return { items };  // return all statuses; frontend filters active/archived
}

function getItem(id) {
  const items = sheetToObjects(getSheet('items'), ITEMS_COLS);
  const item = items.find(i => i.id === id);
  if (!item) throw new Error('Item not found: ' + id);
  return { item };
}

function addItem(data) {
  const sheet = getSheet('items');
  const id = newId();
  sheet.appendRow([
    id,
    data.name,
    data.category    || '',
    data.unit        || '',
    data.room_id     || '',
    data.location_code || '',
    Number(data.quantity)          || 0,
    Number(data.reorder_threshold) || 0,
    'active',
    nowIso()
    // Columns K+ reserved for future fields (vendor, expiration, etc.)
  ]);
  return { success: true, id };
}

function editItem(data) {
  const sheet = getSheet('items');
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][ITEMS_COLS.id] === data.id) {
      const r = i + 1; // 1-based sheet row
      sheet.getRange(r, ITEMS_COLS.name             + 1).setValue(data.name);
      sheet.getRange(r, ITEMS_COLS.category         + 1).setValue(data.category    || '');
      sheet.getRange(r, ITEMS_COLS.unit             + 1).setValue(data.unit        || '');
      sheet.getRange(r, ITEMS_COLS.room_id          + 1).setValue(data.room_id     || '');
      sheet.getRange(r, ITEMS_COLS.location_code    + 1).setValue(data.location_code || '');
      sheet.getRange(r, ITEMS_COLS.reorder_threshold+ 1).setValue(Number(data.reorder_threshold) || 0);
      return { success: true };
    }
  }
  throw new Error('Item not found: ' + data.id);
}

function archiveItem(id) {
  const sheet = getSheet('items');
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][ITEMS_COLS.id] === id) {
      sheet.getRange(i + 1, ITEMS_COLS.status + 1).setValue('archived');
      return { success: true };
    }
  }
  throw new Error('Item not found: ' + id);
}

// ================================================================
// ROOMS
// ================================================================
function getRooms() {
  return { rooms: sheetToObjects(getSheet('rooms'), ROOMS_COLS) };
}

function addRoom(data) {
  const id = newId();
  getSheet('rooms').appendRow([id, data.name]);
  return { success: true, id };
}

function editRoom(data) {
  const sheet = getSheet('rooms');
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][ROOMS_COLS.id] === data.id) {
      sheet.getRange(i + 1, ROOMS_COLS.name + 1).setValue(data.name);
      return { success: true };
    }
  }
  throw new Error('Room not found: ' + data.id);
}

// ================================================================
// COURSES
// ================================================================
function getCourses(params) {
  const all = sheetToObjects(getSheet('courses'), COURSES_COLS);
  // includeInactive=true returns all; default returns only active
  const courses = (params && params.includeInactive === 'true')
    ? all
    : all.filter(c => c.active === true || c.active === 'TRUE');
  return { courses };
}

function addCourse(data) {
  const id = newId();
  getSheet('courses').appendRow([id, data.name, true]);
  return { success: true, id };
}

function editCourse(data) {
  const sheet = getSheet('courses');
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COURSES_COLS.id] === data.id) {
      sheet.getRange(i + 1, COURSES_COLS.name   + 1).setValue(data.name);
      if (data.active !== undefined) {
        sheet.getRange(i + 1, COURSES_COLS.active + 1).setValue(data.active);
      }
      return { success: true };
    }
  }
  throw new Error('Course not found: ' + data.id);
}

// ================================================================
// ADJUSTMENTS & TRANSACTIONS
// ================================================================
function adjustItem(data) {
  // data: { item_id, delta, person_name, course_id, change_type }
  const sheet = getSheet('items');
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][ITEMS_COLS.id] === data.item_id) {
      const currentQty = Number(rows[i][ITEMS_COLS.quantity]);
      const delta      = Number(data.delta);
      const newQty     = currentQty + delta;

      if (newQty < 0) throw new Error('Quantity cannot go below zero.');

      sheet.getRange(i + 1, ITEMS_COLS.quantity + 1).setValue(newQty);

      // Resolve course name for the log
      let courseName = '';
      if (data.course_id) {
        const courses = sheetToObjects(getSheet('courses'), COURSES_COLS);
        const course  = courses.find(c => c.id === data.course_id);
        if (course) courseName = course.name;
      }

      logTransaction({
        item_id:     data.item_id,
        item_name:   rows[i][ITEMS_COLS.name],
        change_type: data.change_type || 'adjustment',
        delta,
        new_quantity: newQty,
        course_id:   data.course_id   || '',
        course_name: courseName,
        person_name: data.person_name || ''
      });

      return { success: true, new_quantity: newQty };
    }
  }
  throw new Error('Item not found: ' + data.item_id);
}

function receiveItems(data) {
  // data: { items: [{ item_id, quantity }], person_name }
  const results = [];
  for (const entry of data.items) {
    const qty = Number(entry.quantity);
    if (qty > 0) {
      const result = adjustItem({
        item_id:     entry.item_id,
        delta:       qty,
        person_name: data.person_name || '',
        course_id:   '',
        change_type: 'receive'
      });
      results.push({ item_id: entry.item_id, ...result });
    }
  }
  return { success: true, results };
}

function logTransaction(data) {
  getSheet('transactions').appendRow([
    newId(),
    data.item_id,
    data.item_name,
    data.change_type,
    data.delta,
    data.new_quantity,
    data.course_id   || '',
    data.course_name || '',
    data.person_name || '',
    nowIso()
  ]);
}

function getTransactions(item_id) {
  const all = sheetToObjects(getSheet('transactions'), TX_COLS);
  const filtered = item_id
    ? all.filter(t => t.item_id === item_id)
    : all;
  return { transactions: filtered.reverse().slice(0, 50) };
}
