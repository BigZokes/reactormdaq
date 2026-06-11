import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("apps_script/Code.gs", "utf8");
const context = {};
vm.createContext(context);
vm.runInContext(
  `${source}
this.__appsScriptExports = {
  HEADERS,
  LEGACY_V1_HEADERS,
  ensureDataSheet_
};`,
  context,
  { filename: "apps_script/Code.gs" }
);

const appsScript = context.__appsScriptExports;

function testLegacyV1Migration() {
  const legacyHeaders = appsScript.LEGACY_V1_HEADERS.slice();
  const legacyRow = [
    "2026-06-09T00:00:00.000Z",
    "EXP-OLD",
    101,
    102,
    103,
    104,
    105,
    106,
    107,
    108,
    "OK",
    "MISSING",
    "STALE",
    "FAULT",
    "OK",
    "OK",
    "OK",
    "OK",
    "LEGACY-GATEWAY"
  ];

  const ss = new FakeSpreadsheet(new FakeSheet("Data", [legacyHeaders, legacyRow]));
  const sheet = appsScript.ensureDataSheet_(ss);
  const migratedHeaders = sheet.rows[0];
  const migratedRow = sheet.rows[1];

  assertEqual(migratedHeaders.length, appsScript.HEADERS.length, "legacy sheet should have v2 header width");
  assertArrayEqual(migratedHeaders, appsScript.HEADERS, "legacy sheet headers should migrate to v2 headers");
  assertEqual(migratedRow[migratedHeaders.indexOf("GatewayStatus")], "LEGACY-GATEWAY", "legacy GatewayStatus should stay under GatewayStatus");
  assertEqual(migratedRow[migratedHeaders.indexOf("Temp1_AgeSec")], "", "inserted Temp1_AgeSec cell should be blank for old rows");
  assertEqual(migratedRow[migratedHeaders.indexOf("Temp8_Fault")], "", "inserted Temp8_Fault cell should be blank for old rows");
}

function testV2HeadersStayStable() {
  const headers = appsScript.HEADERS.slice();
  const row = headers.map((header) => `${header}-value`);
  const ss = new FakeSpreadsheet(new FakeSheet("Data", [headers, row]));
  const sheet = appsScript.ensureDataSheet_(ss);

  assertArrayEqual(sheet.rows[0], headers, "v2 headers should remain unchanged");
  assertArrayEqual(sheet.rows[1], row, "v2 row values should remain unchanged");
}

class FakeSpreadsheet {
  constructor(sheet) {
    this.sheet = sheet;
  }

  getSheetByName(name) {
    return this.sheet.name === name ? this.sheet : null;
  }

  insertSheet(name) {
    this.sheet = new FakeSheet(name, []);
    return this.sheet;
  }
}

class FakeSheet {
  constructor(name, rows) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
    this.frozenRows = 0;
  }

  getLastColumn() {
    return this.rows.reduce((max, row) => Math.max(max, row.length), 0);
  }

  getRange(row, column, rowCount = 1, columnCount = 1) {
    return new FakeRange(this, row - 1, column - 1, rowCount, columnCount);
  }

  insertColumnBefore(column) {
    const index = column - 1;
    this.rows.forEach((row) => {
      while (row.length < index) row.push("");
      row.splice(index, 0, "");
    });
  }

  setFrozenRows(count) {
    this.frozenRows = count;
  }
}

class FakeRange {
  constructor(sheet, row, column, rowCount, columnCount) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }

  getValues() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) => {
      const row = this.sheet.rows[this.row + rowOffset] || [];
      return Array.from({ length: this.columnCount }, (_, columnOffset) => row[this.column + columnOffset] ?? "");
    });
  }

  setValues(values) {
    values.forEach((valueRow, rowOffset) => {
      const targetRow = this.row + rowOffset;
      if (!this.sheet.rows[targetRow]) {
        this.sheet.rows[targetRow] = [];
      }
      valueRow.forEach((value, columnOffset) => {
        this.sheet.rows[targetRow][this.column + columnOffset] = value;
      });
    });
  }
}

testLegacyV1Migration();
testV2HeadersStayStable();

console.log("Apps Script migration checks passed.");

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertArrayEqual(actual, expected, message) {
  if (actual.length !== expected.length) {
    throw new Error(`${message}: expected length ${expected.length}, got ${actual.length}`);
  }
  actual.forEach((value, index) => {
    assertEqual(value, expected[index], `${message} at index ${index}`);
  });
}
