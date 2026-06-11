import { readFileSync, writeFileSync } from "node:fs";

const DEVICE_MAP_PATH = "docs/DEVICE_MAP.csv";
const OUTPUT_PATH = "dashboard/src/deviceMap.ts";
const args = new Set(process.argv.slice(2));

const output = renderDeviceMap(readDeviceMap());

if (args.has("--check")) {
  const current = readFileSync(OUTPUT_PATH, "utf8");
  if (current !== output) {
    console.error(`${OUTPUT_PATH} is out of sync with ${DEVICE_MAP_PATH}. Run node scripts/generate-dashboard-device-map.mjs.`);
    process.exit(1);
  }
  console.log("Dashboard device map is up to date.");
  process.exit(0);
}

writeFileSync(OUTPUT_PATH, output);
console.log(`Wrote ${OUTPUT_PATH}.`);

function readDeviceMap() {
  const lines = readFileSync(DEVICE_MAP_PATH, "utf8").trim().split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function splitCsvLine(line) {
  return line.split(",");
}

function renderDeviceMap(entries) {
  const generatedAt = new Date().toISOString().slice(0, 10);
  const body = entries
    .map((entry) => {
      const fields = [
        ["channel", entry.Channel],
        ["knownMac", entry["Known MAC"]],
        ["knownSerial", entry["Known Serial"]],
        ["platformioEnv", entry["PlatformIO Env"]],
        ["status", entry.Status],
        ["physicalLabel", entry["Physical Label"]],
        ["reactorPosition", entry["Reactor Position"]],
        ["wiringNotes", entry["Amplifier/Wiring Notes"]],
        ["lastVerified", entry["Last Verified"]]
      ];
      const renderedFields = fields.map(([key, value]) => `    ${key}: ${JSON.stringify(value)}`).join(",\n");
      return `  {\n${renderedFields}\n  }`;
    })
    .join(",\n");

  return `// Generated from ${DEVICE_MAP_PATH} on ${generatedAt}.\n// Run node scripts/generate-dashboard-device-map.mjs after editing the CSV.\n\nexport type DeviceMapEntry = {\n  channel: string;\n  knownMac: string;\n  knownSerial: string;\n  platformioEnv: string;\n  status: string;\n  physicalLabel: string;\n  reactorPosition: string;\n  wiringNotes: string;\n  lastVerified: string;\n};\n\nexport const deviceMap: DeviceMapEntry[] = [\n${body}\n];\n`;
}
