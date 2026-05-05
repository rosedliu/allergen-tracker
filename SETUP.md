# Setup Guide

## 1. Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet named **"Allergen Tracker"**
2. Create three tabs (sheets) with exact names:
   - `Major_Allergens`
   - `Other_Foods`
   - `Log`

### Major_Allergens — paste these headers in row 1:
```
name  status  test1  test2  test3  test4  last_consumed
```
Then paste the 10 rows from `scripts/seed-data.json` → `majorAllergens`.

### Other_Foods — paste these headers in row 1:
```
name  category  status  tests_completed  last_consumed
```
Then paste all 100 rows from `scripts/seed-data.json` → `otherFoods`.

### Log — paste these headers in row 1:
```
timestamp  caretaker  food  is_major  action  reaction  prev_status  new_status
```
Leave data rows empty — they are appended automatically.

---

## 2. Note the Sheet ID

Copy the ID from the URL:  
`https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit`

---

## 3. Deploy the Apps Script

1. In your Google Sheet: **Extensions → Apps Script**
2. Delete the default code. Paste the contents of `apps-script/Code.gs`
3. Replace `REPLACE_WITH_YOUR_SHEET_ID` with your actual Sheet ID
4. Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy** and copy the `/exec` URL

---

## 4. Wire up the app

In `js/api.js`, replace:
```javascript
const API_URL = 'REPLACE_WITH_YOUR_APPS_SCRIPT_EXEC_URL';
```
with your actual `/exec` URL.

---

## 5. Deploy to GitHub Pages

```bash
git add .
git commit -m "Ship: wire up Apps Script URL"
git push origin main
```

Enable GitHub Pages in repo Settings → Pages → Source: main branch, root folder.

Share the `https://YOUR_USERNAME.github.io/allergens-testing/` URL with all caretakers.

---

## Apps Script URL
```
REPLACE_WITH_YOUR_APPS_SCRIPT_EXEC_URL
```
*(Fill this in after deploy)*
