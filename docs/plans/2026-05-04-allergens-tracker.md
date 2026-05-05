# Allergen Tracker — Implementation Plan
**Date:** 2026-05-04

---

## Header

**Goal:** Build a shared mobile web app for three caretakers to coordinate baby allergen testing, track food status, and generate a weekly feeding schedule — backed by Google Sheets as the source of truth.

**Architecture:** A static single-page HTML app fetches all data from a Google Apps Script web app on load and POSTs updates back to it. The Apps Script reads and writes a Google Sheet, which serves as the database. No auth is required — the Apps Script is deployed as "anyone can access." Caretaker identity is captured once via `localStorage` and attached silently to every write.

**Design Patterns:** Repository (Apps Script encapsulates all Sheets I/O), Strategy (scheduler is a pure function swappable independently of UI), Observer-lite (re-fetch + full re-render after every write).

**Tech Stack:** Vanilla HTML/CSS/JS (no build step), Google Apps Script (backend), Google Sheets (data store), Jest (unit tests for scheduler and classifier — run locally).

---

## Block 1 · Google Sheets Schema + Apps Script Backend

**Goal:** Stand up the data layer before any UI work. All subsequent blocks depend on this.

**Success Criteria:**
- [ ] Sheet has three tabs: `Major_Allergens`, `Other_Foods`, `Log`
- [ ] Both food tabs are pre-populated with seed data
- [ ] `GET /exec` returns valid JSON with `{major, otherFoods}`
- [ ] `POST /exec` with a log payload writes to `Log` tab and updates the food row
- [ ] Web app is deployed with "anyone" access and the URL is noted in `SETUP.md`

### Chunk 1.1 — Create Google Sheet + seed data

**Files:** Create: `scripts/seed-data.json`

**What to do (manual):**
1. Create a new Google Sheet named "Allergen Tracker"
2. Add three tabs: `Major_Allergens`, `Other_Foods`, `Log`

**`Major_Allergens` columns:**
```
name | status | test1 | test2 | test3 | test4 | last_consumed
```
Seed rows (10 major allergens, all status=UNKNOWN, dates blank):
Peanut, Almond, Sesame, Egg, Cashew, Walnut, Soy, Dairy, Whitefish, Shellfish

**`Other_Foods` columns:**
```
name | category | status | tests_completed | last_consumed
```
Seed rows: all 100 foods from the food list (see `scripts/seed-data.json`).

**`Log` columns:**
```
timestamp | caretaker | food | is_major | action | reaction | prev_status | new_status
```
Leave empty — rows are appended on each user action.

**Step 5 · Commit:**
```bash
git add scripts/seed-data.json
git commit -m "Add: seed data JSON for Google Sheets pre-population"
```

---

### Chunk 1.2 — Google Apps Script: doGet

**Files:** Create: `apps-script/Code.gs`

**Step 1 · Write failing test** (`apps-script/Code.test.js` — manual verification, no unit test possible for Apps Script; test via curl after deploy):
```bash
# Expected: HTTP 200, Content-Type: application/json, body has .major and .otherFoods arrays
curl -L "https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec"
```

**Step 3 · Implement:**
```javascript
const SHEET_ID = 'YOUR_SHEET_ID';

function doGet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const major = sheetToObjects(ss.getSheetByName('Major_Allergens'));
  const otherFoods = sheetToObjects(ss.getSheetByName('Other_Foods'));
  return json({ major, otherFoods });
}

function sheetToObjects(sheet) {
  const [headers, ...rows] = sheet.getDataRange().getValues();
  return rows.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]]))
  );
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**Step 5 · Commit:**
```bash
git add apps-script/Code.gs
git commit -m "Add: Apps Script doGet — returns Major_Allergens and Other_Foods as JSON"
```

---

### Chunk 1.3 — Apps Script: doPost (log feeding + update status)

**Files:** Modify: `apps-script/Code.gs`

**POST payload shape:**
```json
{
  "action": "log_feeding" | "log_reaction" | "add_food",
  "food": "Egg",
  "isMajor": true,
  "reaction": "none" | "mild" | "severe",
  "caretaker": "Rose"
}
```

**Step 3 · Implement:**
```javascript
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const { action, food, isMajor, reaction, caretaker } = payload;

  const sheetName = isMajor ? 'Major_Allergens' : 'Other_Foods';
  const foodSheet = ss.getSheetByName(sheetName);
  const logSheet  = ss.getSheetByName('Log');
  const today     = new Date().toISOString().slice(0, 10);

  let newStatus = null;

  if (action === 'log_feeding') {
    newStatus = updateFeedingRecord(foodSheet, food, isMajor, reaction, today);
  } else if (action === 'add_food') {
    foodSheet.appendRow([food, payload.category, 'UNKNOWN', 0, '']);
  }

  logSheet.appendRow([
    new Date().toISOString(), caretaker, food,
    isMajor, action, reaction || 'none',
    payload.prevStatus || '', newStatus || ''
  ]);

  return json({ success: true, newStatus });
}

function updateFeedingRecord(sheet, foodName, isMajor, reaction, today) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nameIdx = headers.indexOf('name');

  for (let r = 1; r < data.length; r++) {
    if (data[r][nameIdx] !== foodName) continue;

    if (reaction === 'severe') {
      sheet.getRange(r + 1, headers.indexOf('status') + 1).setValue('NEVER');
      return 'NEVER';
    }
    if (reaction === 'mild') {
      sheet.getRange(r + 1, headers.indexOf('status') + 1).setValue('UNSAFE');
      sheet.getRange(r + 1, headers.indexOf('last_consumed') + 1).setValue(today);
      return 'UNSAFE';
    }

    // No reaction — advance test count or last_consumed
    if (isMajor) {
      return advanceMajorTest(sheet, headers, r, today);
    } else {
      return advanceOtherTest(sheet, headers, r, today);
    }
  }
}

function advanceMajorTest(sheet, headers, r, today) {
  const testCols = ['test1','test2','test3','test4'];
  for (const col of testCols) {
    const idx = headers.indexOf(col);
    if (!sheet.getRange(r + 1, idx + 1).getValue()) {
      sheet.getRange(r + 1, idx + 1).setValue(today);
      const allFilled = testCols.every(c =>
        sheet.getRange(r + 1, headers.indexOf(c) + 1).getValue()
      );
      if (allFilled) {
        sheet.getRange(r + 1, headers.indexOf('status') + 1).setValue('SAFE');
        sheet.getRange(r + 1, headers.indexOf('last_consumed') + 1).setValue(today);
        return 'SAFE';
      }
      sheet.getRange(r + 1, headers.indexOf('status') + 1).setValue('UNSAFE');
      sheet.getRange(r + 1, headers.indexOf('last_consumed') + 1).setValue(today);
      return 'UNSAFE';
    }
  }
  // Already SAFE — update last_consumed only
  sheet.getRange(r + 1, headers.indexOf('last_consumed') + 1).setValue(today);
  return 'SAFE';
}

function advanceOtherTest(sheet, headers, r, today) {
  const doneIdx = headers.indexOf('tests_completed');
  const done = Number(sheet.getRange(r + 1, doneIdx + 1).getValue()) + 1;
  sheet.getRange(r + 1, doneIdx + 1).setValue(done);
  sheet.getRange(r + 1, headers.indexOf('last_consumed') + 1).setValue(today);
  if (done >= 2) {
    sheet.getRange(r + 1, headers.indexOf('status') + 1).setValue('SAFE');
    return 'SAFE';
  }
  sheet.getRange(r + 1, headers.indexOf('status') + 1).setValue('UNSAFE');
  return 'UNSAFE';
}
```

**Step 5 · Commit:**
```bash
git add apps-script/Code.gs
git commit -m "Add: Apps Script doPost — log feedings, reactions, and new foods"
```

---

### Chunk 1.4 — Deploy Apps Script + record URL

**Files:** Create: `SETUP.md`

**Steps (manual):**
1. Open Google Apps Script editor → paste `Code.gs`
2. Deploy → New deployment → Web app → Execute as "Me" → Who has access: "Anyone"
3. Copy the `/exec` URL
4. Record it in `SETUP.md` and as `const API_URL` at the top of `index.html`

**Step 5 · Commit:**
```bash
git add SETUP.md
git commit -m "Add: SETUP.md with Apps Script deployment URL and Sheets ID"
```

---

## Block 2 · App Shell + API Layer + Caretaker Identity

**Success Criteria:**
- [ ] `index.html` loads, fetches from Apps Script, and logs data to console
- [ ] On first load, user is prompted for their name once; name persists in `localStorage`
- [ ] All subsequent loads read name from storage silently
- [ ] `api.js` functions `fetchAll()` and `postAction()` are tested with mock fetch

### Chunk 2.1 — App shell HTML/CSS

**Files:** Create: `index.html`

Copy the full CSS from the approved prototype (`public/prototype_allergens.html`). Add placeholder section divs:
```html
<div id="section-major"></div>
<div id="section-schedule"></div>
<div id="section-other"></div>
```
Add `<script src="js/classifier.js"></script>`, `<script src="js/scheduler.js"></script>`, `<script src="js/api.js"></script>`, `<script src="js/app.js"></script>`.

**Step 5 · Commit:**
```bash
git add index.html
git commit -m "Add: index.html shell with CSS from approved prototype"
```

---

### Chunk 2.2 — Caretaker identity (localStorage)

**Files:** Create: `js/app.js`

**Step 1 · Write failing test** (`js/app.test.js`):
```javascript
test('getCaretaker returns stored name without prompting', () => {
  localStorage.setItem('caretaker_name', 'Rose');
  expect(getCaretaker()).toBe('Rose');
});

test('getCaretaker prompts and stores name when not set', () => {
  localStorage.clear();
  global.prompt = jest.fn(() => 'Alvin');
  const name = getCaretaker();
  expect(name).toBe('Alvin');
  expect(localStorage.getItem('caretaker_name')).toBe('Alvin');
});
```

**Step 2 · Verify failure:** `npx jest js/app.test.js` → ReferenceError: getCaretaker is not defined

**Step 3 · Implement** (`js/app.js`):
```javascript
function getCaretaker() {
  let name = localStorage.getItem('caretaker_name');
  if (!name) {
    name = (prompt('What\'s your name? (Used to track who logs feedings)') || 'Unknown').trim();
    localStorage.setItem('caretaker_name', name);
  }
  return name;
}
```

**Step 4 · Verify pass:** `npx jest js/app.test.js` → PASS

**Step 5 · Commit:**
```bash
git add js/app.js js/app.test.js
git commit -m "Add: caretaker identity — prompt once, persist to localStorage"
```

---

### Chunk 2.3 — API layer (fetch + post)

**Files:** Create: `js/api.js`

**Step 1 · Write failing test** (`js/api.test.js`):
```javascript
global.fetch = jest.fn();

test('fetchAll returns parsed major and otherFoods', async () => {
  fetch.mockResolvedValue({ json: () => ({ major: [], otherFoods: [] }) });
  const result = await fetchAll();
  expect(result).toEqual({ major: [], otherFoods: [] });
  expect(fetch).toHaveBeenCalledWith(API_URL);
});

test('postAction sends correct payload', async () => {
  fetch.mockResolvedValue({ json: () => ({ success: true }) });
  await postAction({ action: 'log_feeding', food: 'Egg', isMajor: true, reaction: 'none', caretaker: 'Rose' });
  expect(fetch).toHaveBeenCalledWith(API_URL, expect.objectContaining({ method: 'POST' }));
});
```

**Step 3 · Implement** (`js/api.js`):
```javascript
const API_URL = 'YOUR_APPS_SCRIPT_EXEC_URL';

async function fetchAll() {
  const res = await fetch(API_URL);
  return res.json();
}

async function postAction(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.json();
}
```

**Step 5 · Commit:**
```bash
git add js/api.js js/api.test.js
git commit -m "Add: API layer — fetchAll and postAction wrappers for Apps Script"
```

---

## Block 3 · Food Classifier

**Success Criteria:**
- [ ] `classifyFood('Blueberry')` → `'Fruits'`
- [ ] `classifyFood('Salmon')` → `'Meats'`
- [ ] `classifyFood('Quinoa')` → `'Other'`
- [ ] `classifyFood('XYZ unknown')` → `'Other'`

### Chunk 3.1 — Classifier function + tests

**Files:** Create: `js/classifier.js`, `js/classifier.test.js`

**Step 1 · Write failing tests:**
```javascript
const { classifyFood } = require('./classifier');

test.each([
  ['Blueberry', 'Fruits'],
  ['Sweet Potato', 'Vegetables'],
  ['Chicken', 'Meats'],
  ['Quinoa', 'Other'],
  ['BLUEBERRY', 'Fruits'],    // case-insensitive
  ['Unknown food XYZ', 'Other'],
])('classifyFood("%s") → "%s"', (input, expected) => {
  expect(classifyFood(input)).toBe(expected);
});
```

**Step 3 · Implement** (`js/classifier.js`) — port the lookup table from the prototype, with `module.exports` for testability.

**Step 5 · Commit:**
```bash
git add js/classifier.js js/classifier.test.js
git commit -m "Add: food classifier — auto-assigns category from lookup table"
```

---

## Block 4 · Scheduling Algorithm

This is the most complex block. Build and test the pure scheduling function before wiring it to the UI.

**Rules encoded:**
1. UNKNOWN/UNSAFE allergens → weekday AM only, max 1 per day
2. SAFE major allergens → at least 3 appearances per week across AM+PM slots
3. No food appears twice in the same day (AM + PM)
4. Nuts (Peanut, Almond, Cashew, Walnut) — if all four are SAFE, they are treated as a single combined slot
5. Maximize combination diversity across the 7-day window

**Input:** `{ major: [...], today: Date }`
**Output:** `{ [dateString]: { am: FoodSlot[], pm: FoodSlot[] } }` for the next 7 days

Where `FoodSlot = { name: string, isTest: boolean, testNumber?: number }`

**Success Criteria:**
- [ ] No UNKNOWN/UNSAFE food appears on a weekend
- [ ] No UNKNOWN/UNSAFE food appears in PM slot
- [ ] No day has more than 1 UNKNOWN/UNSAFE food
- [ ] Every SAFE major allergen appears ≥ 3 times in the 7-day window
- [ ] No food appears in both AM and PM of the same day
- [ ] All-nut group appears as a unit when all 4 nuts are SAFE

### Chunk 4.1 — Weekday/slot constraint tests

**Files:** Create: `js/scheduler.js`, `js/scheduler.test.js`

**Step 1 · Write failing tests:**
```javascript
const { buildSchedule } = require('./scheduler');
const MONDAY = new Date('2026-05-04');

test('UNKNOWN allergen never appears on weekend', () => {
  const major = [{ name: 'Sesame', status: 'UNKNOWN', test1:'', test2:'', test3:'', test4:'' }];
  const schedule = buildSchedule({ major, today: MONDAY });
  ['2026-05-09','2026-05-10'].forEach(date => {
    expect(schedule[date].am.map(f=>f.name)).not.toContain('Sesame');
    expect(schedule[date].pm.map(f=>f.name)).not.toContain('Sesame');
  });
});

test('UNKNOWN allergen never appears in PM slot', () => {
  const major = [{ name: 'Sesame', status: 'UNKNOWN', test1:'', test2:'', test3:'', test4:'' }];
  const schedule = buildSchedule({ major, today: MONDAY });
  Object.values(schedule).forEach(day => {
    expect(day.pm.some(f => f.name === 'Sesame' && f.isTest)).toBe(false);
  });
});

test('No more than 1 test food per day', () => {
  const major = [
    { name: 'Sesame', status: 'UNKNOWN', test1:'', test2:'', test3:'', test4:'' },
    { name: 'Walnut', status: 'UNKNOWN', test1:'', test2:'', test3:'', test4:'' },
  ];
  const schedule = buildSchedule({ major, today: MONDAY });
  Object.values(schedule).forEach(day => {
    const tests = [...day.am, ...day.pm].filter(f => f.isTest);
    expect(tests.length).toBeLessThanOrEqual(1);
  });
});
```

**Step 2 · Verify failure:** `npx jest js/scheduler.test.js` → ReferenceError

**Step 3 · Implement skeleton** (`js/scheduler.js`):
```javascript
const NUT_GROUP = ['Peanut', 'Almond', 'Cashew', 'Walnut'];

function buildSchedule({ major, today }) {
  const days = getNext7Days(today);
  const schedule = Object.fromEntries(days.map(d => [d.iso, { am: [], pm: [], isWeekday: d.isWeekday }]));

  const safe   = major.filter(f => f.status === 'SAFE');
  const toTest = major.filter(f => f.status === 'UNKNOWN' || f.status === 'UNSAFE');

  // Slot test foods: one per weekday AM only
  const weekdays = days.filter(d => d.isWeekday);
  toTest.forEach((food, i) => {
    if (i < weekdays.length) {
      const testNum = countTests(food) + 1;
      schedule[weekdays[i].iso].am.push({ name: food.name, isTest: true, testNumber: testNum });
    }
  });

  // Distribute SAFE foods to meet 3x/week minimum, no same food twice/day
  distributeSafeFoods(schedule, safe, days);

  return schedule;
}
```

**Step 4 · Verify pass:** `npx jest js/scheduler.test.js` → PASS (constraint tests)

**Step 5 · Commit:**
```bash
git add js/scheduler.js js/scheduler.test.js
git commit -m "Add: scheduler skeleton — weekday/slot/daily constraints passing"
```

---

### Chunk 4.2 — Safe food distribution + nut grouping tests

**Step 1 · Write failing tests:**
```javascript
test('SAFE allergen appears at least 3 times in 7 days', () => {
  const major = [{ name: 'Dairy', status: 'SAFE', test1:'x', test2:'x', test3:'x', test4:'x', last_consumed: '2026-05-03' }];
  const schedule = buildSchedule({ major, today: MONDAY });
  const appearances = Object.values(schedule)
    .flatMap(d => [...d.am, ...d.pm])
    .filter(f => f.name === 'Dairy').length;
  expect(appearances).toBeGreaterThanOrEqual(3);
});

test('No food appears in both AM and PM on same day', () => {
  const major = [{ name: 'Dairy', status: 'SAFE', test1:'x', test2:'x', test3:'x', test4:'x' }];
  const schedule = buildSchedule({ major, today: MONDAY });
  Object.values(schedule).forEach(day => {
    const amNames = day.am.map(f => f.name);
    const pmNames = day.pm.map(f => f.name);
    const overlap = amNames.filter(n => pmNames.includes(n));
    expect(overlap).toHaveLength(0);
  });
});

test('All-safe nuts appear as grouped slot', () => {
  const nuts = NUT_GROUP.map(name => ({ name, status: 'SAFE', test1:'x', test2:'x', test3:'x', test4:'x' }));
  const schedule = buildSchedule({ major: nuts, today: MONDAY });
  const nutSlots = Object.values(schedule)
    .flatMap(d => [...d.am, ...d.pm])
    .filter(f => f.name === 'Nuts (mixed)');
  expect(nutSlots.length).toBeGreaterThanOrEqual(3);
});
```

**Step 3 · Implement** `distributeSafeFoods` and nut grouping logic inside `scheduler.js`.

**Step 5 · Commit:**
```bash
git add js/scheduler.js js/scheduler.test.js
git commit -m "Add: safe food distribution — 3x/week minimum, nut grouping, no same-day overlap"
```

---

## Block 5 · Major Allergens UI

**Success Criteria:**
- [ ] Section renders three groups: In Progress, Safe, Not Started
- [ ] Test progress dots reflect actual test count
- [ ] "Next serve" chip shows correct day from schedule output
- [ ] Tapping a row opens the log modal with correct title and sub-text

### Chunk 5.1 — Render major allergens section

**Files:** Create: `js/render-major.js`

**Step 1 · Write failing test:**
```javascript
const { groupMajorAllergens } = require('./render-major');

test('groups allergens into in-progress, safe, not-started', () => {
  const major = [
    { name: 'Egg',    status: 'UNSAFE', test1: '2026-04-01', test2: '2026-04-08', test3: '', test4: '' },
    { name: 'Dairy',  status: 'SAFE',   test1: 'x', test2: 'x', test3: 'x', test4: 'x' },
    { name: 'Sesame', status: 'UNKNOWN', test1: '', test2: '', test3: '', test4: '' },
  ];
  const groups = groupMajorAllergens(major);
  expect(groups.inProgress.map(f=>f.name)).toContain('Egg');
  expect(groups.safe.map(f=>f.name)).toContain('Dairy');
  expect(groups.notStarted.map(f=>f.name)).toContain('Sesame');
});
```

**Step 3 · Implement** the grouping function and DOM rendering function that writes to `#section-major`.

**Step 5 · Commit:**
```bash
git add js/render-major.js js/render-major.test.js
git commit -m "Add: major allergens renderer — three groups with test dots and next-serve chips"
```

---

## Block 6 · Schedule UI

**Success Criteria:**
- [ ] Calendar renders 7 days from today
- [ ] Test slots render in red
- [ ] Calendar scrolls horizontally on mobile
- [ ] Tapping a test slot opens log modal for that food

### Chunk 6.1 — Render schedule section

**Files:** Create: `js/render-schedule.js`

No unit test for DOM rendering — verify visually in browser. Focus tests on the `buildSchedule` output (already covered in Block 4).

**Implement:** Reads schedule from `buildSchedule()`, renders the calendar grid into `#section-schedule` using the prototype's HTML structure (word labels, red `.test` class, horizontal scroll wrapper).

**Step 5 · Commit:**
```bash
git add js/render-schedule.js
git commit -m "Add: schedule renderer — 7-day calendar with AM/PM slots from scheduler output"
```

---

## Block 7 · Other Foods UI + Add Food

**Success Criteria:**
- [ ] All 100 foods render grouped by category
- [ ] Add food: name input → auto-classifies → appends to correct category without page reload
- [ ] New food persists in Sheets on next fetch

### Chunk 7.1 — Render other foods section

**Files:** Create: `js/render-other.js`

Port the `renderOtherFoods()` function from the prototype into `render-other.js`. Feed it live data from `fetchAll()` rather than the hardcoded array. Add food button opens the Add Food modal.

**Step 5 · Commit:**
```bash
git add js/render-other.js
git commit -m "Add: other foods renderer — 100 foods by category, live from Sheets"
```

---

### Chunk 7.2 — Add food flow

**Files:** Modify: `js/render-other.js`, `js/app.js`

On submit:
1. Call `classifyFood(name)`
2. Call `postAction({ action: 'add_food', food: name, category, isMajor: false, caretaker })`
3. On success: call `fetchAll()` and re-render

**Step 5 · Commit:**
```bash
git add js/render-other.js js/app.js
git commit -m "Add: add food flow — classifies, writes to Sheets, re-renders"
```

---

## Block 8 · Log Modal + Write Flow

**Success Criteria:**
- [ ] Tapping any food row opens log modal with correct food name and context
- [ ] "Log Feeding" POST updates Sheets and re-renders the page state
- [ ] "Report a reaction" → Mild sets UNSAFE, Severe sets NEVER
- [ ] Caretaker name is attached to every POST silently

### Chunk 8.1 — Log modal wire-up

**Files:** Modify: `js/app.js`

**Implement:**
```javascript
async function submitLog(food, isMajor, reaction) {
  const caretaker = getCaretaker();
  const prevStatus = getCurrentStatus(food, isMajor);
  await postAction({ action: 'log_feeding', food, isMajor, reaction, caretaker, prevStatus });
  const fresh = await fetchAll();
  renderAll(fresh);
  closeModal();
}
```

`renderAll(data)` calls `renderMajorAllergens`, `renderSchedule`, `renderOtherFoods` in sequence.

**Step 5 · Commit:**
```bash
git add js/app.js
git commit -m "Add: log modal wire-up — POSTs to Sheets, re-fetches, re-renders"
```

---

## Block 9 · Deploy + Mobile QA

**Success Criteria:**
- [ ] App loads correctly on iOS Safari and Android Chrome
- [ ] All three sections render with live Sheets data
- [ ] Log feeding flow completes end-to-end and appears in the Log tab
- [ ] Add food persists across a page reload
- [ ] Caretaker name prompt appears only on first load

### Chunk 9.1 — GitHub Pages deploy

**Files:** No new files. Push `index.html` and `js/` to `main`.

GitHub Pages serves `index.html` from the repo root. Share the `*.github.io` URL with all three caretakers.

**Step 5 · Commit:**
```bash
git add .
git commit -m "Ship: initial deploy of Allergen Tracker"
git push origin main
```

---

## Technical Debt

| Item | Risk | Resolution |
|------|------|------------|
| Apps Script has a 6s request timeout per execution | Low — writes are fast; reads return full dataset each time | Monitor; if data grows large, paginate or cache |
| No optimistic UI — page re-renders only after Sheets write confirms | UX latency ~1-2s per action | Acceptable for this use case; add loading spinner |
| `fetchAll()` on every write fetches the entire dataset | Negligible at this scale | Acceptable |
| Food classifier uses keyword matching, not exact match | Edge cases (e.g. "Pea" matching "Peach") | Longest-match-first ordering in lookup table handles most cases |
| Apps Script URL is hardcoded in `index.html` | Whoever has the URL can write to the sheet | Acceptable — "no auth" is the explicit design choice |

---

## Production & Design Standards

- **Timeouts:** `fetchAll()` and `postAction()` both get a 10-second `AbortController` timeout. If exceeded, show an inline error message (no `alert()`).
- **Error handling:** Every `catch` block renders an error banner at the top of the page and logs to `console.error`.
- **Loading states:** Show a subtle "Loading…" text in each section while `fetchAll()` is in flight on initial load.
- **Mobile:** Max-width 430px, tested on 375px (iPhone SE) viewport.

---

## Completion Requirements

1. `/build` — execute this plan
2. `/audit` — verify all success criteria, test on mobile
3. `/closeout` — document and commit

**Ready to build? Run `/build`.**
