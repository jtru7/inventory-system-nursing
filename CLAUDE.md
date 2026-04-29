# Nursing Inventory App — Claude Context

## What This Is
A mobile-friendly web app for the BYU-Idaho Nursing department to track stock room inventory.
No login/auth. All users have identical access. Hosted as a static app in Equella.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS — no frameworks, no build tools (Equella-compatible)
- **Backend**: Google Apps Script Web App (`apps-script/Code.gs`)
- **Database**: Google Sheets (4 tabs: items, rooms, courses, transactions)
- **Hosting**: Equella (static files) | GitHub Pages for testing

## File Structure
```
index.html              — SPA shell, loads CSS and JS
css/styles.css          — All styles, mobile-first, CSS custom properties
js/api.js               — All API calls to Apps Script (CONFIG.SCRIPT_URL goes here)
js/app.js               — App state, routing, view rendering, event handling
apps-script/Code.gs     — Full backend: CRUD + adjustments + audit log
```

## Google Sheets Schema

### items tab
`id | name | category | unit | room_id | location_code | quantity | reorder_threshold | status | created_at`
- `status`: `active` or `archived` (never hard-delete)
- Columns K+ reserved for future fields (vendor, expiration date, etc.)

### rooms tab
`id | name`

### courses tab
`id | name | active`
- `active`: boolean TRUE/FALSE (12–15 nursing courses)

### transactions tab
`id | item_id | item_name | change_type | delta | new_quantity | course_id | course_name | person_name | timestamp`
- `change_type`: `adjustment` or `receive`
- `delta`: signed integer (negative = items removed)
- Timestamps are ISO 8601, set server-side in Apps Script

## App Views / Navigation
- **Home** — search bar, room/category filters, item cards with low-stock badges
- **Item Detail** — location info, large +/− stepper, transaction history
- **Receiving** — bulk restock: all items with qty inputs, submit once
- **Admin** — three tabs: Items (add/edit/archive), Rooms (add/edit), Courses (add/edit/deactivate)

## Key Behaviors
- Every quantity change logs a row in `transactions` (auto-timestamp, server-side)
- Adjustment modal prompts for: quantity, name (optional), course (optional)
- Low stock = `quantity <= reorder_threshold` (threshold > 0)
- Archived items stay in transaction history; hidden from main list
- Search covers: name, category, location_code, room name, unit

## Setup Checklist (for new deployments)
1. Create Google Sheet with 4 tabs and headers matching schema above
2. Open Apps Script (Extensions → Apps Script), paste `Code.gs` contents
3. Replace `SHEET_ID` in `Code.gs` with your sheet's ID
4. Deploy as Web App: Execute as Me, Anyone can access
5. Copy the Web App URL into `js/api.js` as `CONFIG.SCRIPT_URL`
6. Test via GitHub Pages; deploy final version to Equella

## What's Deferred (build later)
- Analytics / trend dashboards (course usage over time)
- Vendor / expiration date fields (columns K+ in items sheet are reserved)
- PIN-gated admin
- Mandatory course logging (currently optional)
- CSV import for bulk item creation
