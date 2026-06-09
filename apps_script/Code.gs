const DATA_SHEET_NAME = "Data";
const CONTROL_SHEET_NAME = "Control";
const RUNS_SHEET_NAME = "Runs";
const DEFAULT_RUN_ID = "TEST-001";
const SCHEMA_VERSION = "temperature-daq-v1";

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
    return jsonResponse_({
      ok: false,
      error: "No POST data received"
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const control = ensureControlSheet_(ss);
  const dataSheet = ensureDataSheet_(ss);
  const runsSheet = ensureRunsSheet_(ss);
  const data = parsePostData_(e);
  if (data.error) {
    return jsonResponse_(data);
  }

  const method = String(data.method || "append");

  if (method === "setRun") {
    const runId = sanitizeRunId_(data.RunID || data.runId || DEFAULT_RUN_ID);
    control.getRange("B1").setValue(runId);
    if (data.Notes || data.notes) {
      control.getRange("B2").setValue(String(data.Notes || data.notes));
    }
    runsSheet.appendRow([
      new Date(),
      runId,
      String(data.Notes || data.notes || ""),
      "setRun"
    ]);

    return jsonResponse_({
      ok: true,
      method,
      runId,
      schemaVersion: SCHEMA_VERSION,
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
  const row = [
    new Date(),
    runId,
    normalizeTemperature_(data.Temp1),
    normalizeTemperature_(data.Temp2),
    normalizeTemperature_(data.Temp3),
    normalizeTemperature_(data.Temp4),
    normalizeTemperature_(data.Temp5),
    normalizeTemperature_(data.Temp6),
    normalizeTemperature_(data.Temp7),
    normalizeTemperature_(data.Temp8),
    normalizeStatus_(data.Temp1_Status),
    normalizeStatus_(data.Temp2_Status),
    normalizeStatus_(data.Temp3_Status),
    normalizeStatus_(data.Temp4_Status),
    normalizeStatus_(data.Temp5_Status),
    normalizeStatus_(data.Temp6_Status),
    normalizeStatus_(data.Temp7_Status),
    normalizeStatus_(data.Temp8_Status),
    String(data.GatewayStatus || "UNKNOWN")
  ];

  dataSheet.appendRow(row);

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
      runsSheet: RUNS_SHEET_NAME,
      schemaVersion: SCHEMA_VERSION,
      time: new Date().toISOString()
    });
  }

  const rows = getRecentRows_(dataSheet, Math.min(Math.max(limit || 80, 1), 500));
  const latest = rows.length ? rows[rows.length - 1] : null;

  return jsonResponse_({
    ok: true,
    mode,
    runId,
    schemaVersion: SCHEMA_VERSION,
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
  const hasHeaders = firstRow.some(value => String(value || "").trim() !== "");
  const headersMatch = HEADERS.every((header, index) => String(firstRow[index] || "").trim() === header);
  if (!hasHeaders || !headersMatch) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function ensureRunsSheet_(ss) {
  let sheet = ss.getSheetByName(RUNS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(RUNS_SHEET_NAME);
  }

  const headers = ["Time", "RunID", "Notes", "Action"];
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const headersMatch = headers.every((header, index) => String(firstRow[index] || "").trim() === header);
  if (!headersMatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
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

function parsePostData_(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (!data || typeof data !== "object") {
      return {
        ok: false,
        error: "POST body must be a JSON object"
      };
    }
    return data;
  } catch (error) {
    return {
      ok: false,
      error: "Invalid JSON",
      detail: String(error && error.message ? error.message : error)
    };
  }
}

function normalizeTemperature_(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : "";
}

function normalizeStatus_(value) {
  const status = String(value || "MISSING").trim().toUpperCase();
  return ["OK", "MISSING", "STALE", "FAULT", "UNKNOWN"].indexOf(status) >= 0 ? status : "UNKNOWN";
}

function sanitizeRunId_(value) {
  const runId = String(value || DEFAULT_RUN_ID).trim();
  if (!runId) {
    return DEFAULT_RUN_ID;
  }
  return runId.slice(0, 80);
}
