import { readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const secretPattern =
  /script[.]google[.]com\/macros\/s\/AK|(?:WIFI_PASSWORD|password|WIFI_SSID|ssid)\s*=\s*"[^Y]/;

const secretScanTargets = [
  "apps_script",
  "dashboard",
  "include",
  "src",
  "src_legacy",
  "scripts",
  "platformio.ini",
  "MEMORY.md",
  "NEXT_STEPS.md",
  "docs"
];

for (const target of secretScanTargets) {
  scanPath(target);
}

execFileSync("node", ["--check", "--input-type=commonjs"], {
  input: readFileSync("apps_script/Code.gs"),
  stdio: ["pipe", "inherit", "inherit"]
});

execFileSync("node", ["scripts/test-apps-script-migration.mjs"], {
  stdio: "inherit"
});

execFileSync("node", ["--check", "scripts/flash-device.mjs"], {
  stdio: "inherit"
});

execFileSync("node", ["--check", "scripts/monitor-device.mjs"], {
  stdio: "inherit"
});

const deviceMap = readFileSync("docs/DEVICE_MAP.csv", "utf8").trimEnd().split(/\r?\n/);
const expectedColumns = splitCsvLine(deviceMap[0]).length;
deviceMap.forEach((line, index) => {
  const columns = splitCsvLine(line).length;
  if (columns !== expectedColumns) {
    fail(`docs/DEVICE_MAP.csv line ${index + 1} has ${columns} columns; expected ${expectedColumns}.`);
  }
});

console.log("Repository checks passed.");

function splitCsvLine(line) {
  return line.split(",");
}

function scanPath(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if ([".git", ".pio", "dist", "node_modules"].includes(entry)) continue;
      scanPath(join(path, entry));
    }
    return;
  }

  if (path.endsWith("secrets.h")) return;

  const contents = readFileSync(path, "utf8");
  const match = contents.match(secretPattern);
  if (match) {
    fail(`Secret-like value found in ${path}: ${match[0]}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
