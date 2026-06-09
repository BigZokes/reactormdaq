const DATA_SHEET_NAME = "Data";
const CONTROL_SHEET_NAME = "Control";
const DEFAULT_RUN_ID = "TEST-001";

const HEADERS = [
  "Time",
  "RunID",
  "Temp1",
  "Temp2",
  "Temp3",
  "Temp4",
  "Temp5",
  "Temp6",
  "Temp7",
  "Temp8",
  "Temp1_Status",
  "Temp2_Status",
  "Temp3_Status",
  "Temp4_Status",
  "Temp5_Status",
  "Temp6_Status",
  "Temp7_Status",
  "Temp8_Status",
  "GatewayStatus"
];

function doPost(e) {
  if (!e || !e.postData) {
    return ContentService.createTextOutput("No POST data received");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const control = ensureControlSheet_(ss);
  const dataSheet = ensureDataSheet_(ss);
  const data = JSON.parse(e.postData.contents);
  const method = String(data.method || "append");

  if (method === "setRun") {
    const runId = sanitizeRunId_(data.RunID || data.runId || DEFAULT_RUN_ID);
    control.getRange("B1").setValue(runId);
    if (data.Notes || data.notes) {
      control.getRange("B2").setValue(String(data.Notes || data.notes));
    }

    return jsonResponse_({
      ok: true,
      method,
      runId,
      message: "Run ID updated"
    });
  }

  if (method !== "append") {
    return jsonResponse_({
      ok: false,
      error: "Unsupported method",
      method
    });
  }

  const runId = String(control.getRange("B1").getValue() || DEFAULT_RUN_ID).trim();

  dataSheet.appendRow([
    new Date(),
    runId,
    data.Temp1 ?? "",
    data.Temp2 ?? "",
    data.Temp3 ?? "",
    data.Temp4 ?? "",
    data.Temp5 ?? "",
    data.Temp6 ?? "",
    data.Temp7 ?? "",
    data.Temp8 ?? "",
    data.Temp1_Status || "MISSING",
    data.Temp2_Status || "MISSING",
    data.Temp3_Status || "MISSING",
    data.Temp4_Status || "MISSING",
    data.Temp5_Status || "MISSING",
    data.Temp6_Status || "MISSING",
    data.Temp7_Status || "MISSING",
    data.Temp8_Status || "MISSING",
    data.GatewayStatus || "UNKNOWN"
  ]);

  return ContentService.createTextOutput("Success");
}

function doGet(e) {
  const mode = e && e.parameter && e.parameter.mode ? String(e.parameter.mode) : "dashboard";
  const limit = e && e.parameter && e.parameter.limit ? Number(e.parameter.limit) : 80;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const control = ensureControlSheet_(ss);
  const dataSheet = ensureDataSheet_(ss);
  const runId = String(control.getRange("B1").getValue() || DEFAULT_RUN_ID).trim();

  if (mode === "health") {
    return jsonResponse_({
      ok: true,
      runId,
      dataSheet: DATA_SHEET_NAME,
      controlSheet: CONTROL_SHEET_NAME,
      time: new Date().toISOString()
    });
  }

  const rows = getRecentRows_(dataSheet, Math.min(Math.max(limit || 80, 1), 500));
  const latest = rows.length ? rows[rows.length - 1] : null;

  return jsonResponse_({
    ok: true,
    mode,
    runId,
    latest,
    rows
  });
}

function ensureControlSheet_(ss) {
  let sheet = ss.getSheetByName(CONTROL_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONTROL_SHEET_NAME);
  }

  if (!sheet.getRange("A1").getValue()) sheet.getRange("A1").setValue("CurrentRunID");
  if (!sheet.getRange("B1").getValue()) sheet.getRange("B1").setValue(DEFAULT_RUN_ID);
  if (!sheet.getRange("A2").getValue()) sheet.getRange("A2").setValue("Notes");

  return sheet;
}

function ensureDataSheet_(ss) {
  let sheet = ss.getSheetByName(DATA_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(DATA_SHEET_NAME);
  }

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = firstRow.some(value => value !== "");
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function getRecentRows_(sheet, limit) {
  const lastRow = sheet.getLastRow();
  const lastColumn = HEADERS.length;
  if (lastRow < 2) {
    return [];
  }

  const startRow = Math.max(2, lastRow - limit + 1);
  const values = sheet.getRange(startRow, 1, lastRow - startRow + 1, lastColumn).getValues();

  return values.map(row => {
    const record = {};
    HEADERS.forEach((header, index) => {
      const value = row[index];
      record[header] = value instanceof Date ? value.toISOString() : value;
    });
    return record;
  });
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function sanitizeRunId_(value) {
  const runId = String(value || DEFAULT_RUN_ID).trim();
  if (!runId) {
    return DEFAULT_RUN_ID;
  }
  return runId.slice(0, 80);
}
