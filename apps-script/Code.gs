// Allergen Tracker — Google Apps Script backend
// Deploy as: Execute as Me, Who has access: Anyone
// All requests use GET to avoid CORS preflight issues.
// Writes pass payload as ?payload=JSON_encoded_string

var SHEET_ID = '1aImPcGOuzH-a4LdD0t8UohtOcsICmXOkiZmYria6zPo';

function doGet(e) {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // Write operation encoded as GET param
  if (e.parameter && e.parameter.payload) {
    var payload = JSON.parse(e.parameter.payload);
    return handleWrite(ss, payload);
  }

  // Read operation
  var major      = sheetToObjects(ss.getSheetByName('Major_Allergens'));
  var otherFoods = sheetToObjects(ss.getSheetByName('Other_Foods'));
  return json({ major: major, otherFoods: otherFoods });
}

function handleWrite(ss, payload) {
  var logSheet  = ss.getSheetByName('Log');
  var today     = payload.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var action    = payload.action;
  var foodName  = payload.food;
  var isMajor   = payload.isMajor;
  var reaction  = payload.reaction || 'none';
  var caretaker = payload.caretaker || 'Unknown';
  var prevStatus = payload.prevStatus || '';
  var newStatus = '';

  if (action === 'add_food') {
    var otherSheet = ss.getSheetByName('Other_Foods');
    otherSheet.appendRow([foodName, payload.category, 'UNKNOWN', 0, '']);
    newStatus = 'UNKNOWN';
  } else if (action === 'log_feeding') {
    var sheetName = isMajor ? 'Major_Allergens' : 'Other_Foods';
    var foodSheet = ss.getSheetByName(sheetName);
    newStatus = updateFeedingRecord(foodSheet, foodName, isMajor, reaction, today);
  }

  logSheet.appendRow([
    new Date().toISOString(),
    caretaker,
    foodName,
    isMajor ? 'major' : 'other',
    action,
    reaction,
    prevStatus,
    newStatus
  ]);

  return json({ success: true, newStatus: newStatus });
}

// ── Helpers ───────────────────────────────────────────────────────────────

function updateFeedingRecord(sheet, foodName, isMajor, reaction, today) {
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var nameIdx = headers.indexOf('name');

  for (var r = 1; r < data.length; r++) {
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

    if (isMajor) {
      return advanceMajorTest(sheet, headers, r, today);
    } else {
      return advanceOtherTest(sheet, headers, r, today);
    }
  }
  return '';
}

function advanceMajorTest(sheet, headers, r, today) {
  var testCols = ['test1', 'test2', 'test3', 'test4'];
  for (var i = 0; i < testCols.length; i++) {
    var idx = headers.indexOf(testCols[i]);
    if (!sheet.getRange(r + 1, idx + 1).getValue()) {
      sheet.getRange(r + 1, idx + 1).setValue(today);
      var allFilled = testCols.every(function(col) {
        return !!sheet.getRange(r + 1, headers.indexOf(col) + 1).getValue();
      });
      sheet.getRange(r + 1, headers.indexOf('last_consumed') + 1).setValue(today);
      if (allFilled) {
        sheet.getRange(r + 1, headers.indexOf('status') + 1).setValue('SAFE');
        return 'SAFE';
      }
      sheet.getRange(r + 1, headers.indexOf('status') + 1).setValue('UNSAFE');
      return 'UNSAFE';
    }
  }
  sheet.getRange(r + 1, headers.indexOf('last_consumed') + 1).setValue(today);
  return 'SAFE';
}

function advanceOtherTest(sheet, headers, r, today) {
  var doneIdx = headers.indexOf('tests_completed');
  var done    = Number(sheet.getRange(r + 1, doneIdx + 1).getValue()) + 1;
  sheet.getRange(r + 1, doneIdx + 1).setValue(done);
  sheet.getRange(r + 1, headers.indexOf('last_consumed') + 1).setValue(today);
  if (done >= 2) {
    sheet.getRange(r + 1, headers.indexOf('status') + 1).setValue('SAFE');
    return 'SAFE';
  }
  sheet.getRange(r + 1, headers.indexOf('status') + 1).setValue('UNSAFE');
  return 'UNSAFE';
}

function sheetToObjects(sheet) {
  var values  = sheet.getDataRange().getValues();
  var headers = values[0];
  return values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
