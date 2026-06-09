import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const DEVICE_MAP_PATH = "docs/DEVICE_MAP.csv";

const args = parseArgs(process.argv.slice(2));
const deviceMap = readDeviceMap();
const { devices } = deviceMap;

if (args.help) {
  printHelp();
  process.exit(0);
}

if (args.list) {
  printDeviceMap(devices);
  process.exit(0);
}

if (args.ports) {
  printUsbPorts();
  process.exit(0);
}

if (!args.env) {
  console.error("Missing --env. Use --list to see available PlatformIO environments or --ports to see connected boards.");
  process.exit(1);
}

const device = devices.find((entry) => entry["PlatformIO Env"] === args.env);
if (!device) {
  console.error(`Unknown PlatformIO env: ${args.env}`);
  console.error("Use --list to see available environments.");
  process.exit(1);
}

if (args.setSerial) {
  updateDeviceSerial(deviceMap, device, args.setSerial, args.write);
  process.exit(0);
}

const knownSerial = device["Known Serial"];
const uploadPort = args.port || findPortForSerial(knownSerial);

if (!uploadPort && args.upload) {
  console.error(`Could not find a USB serial port for ${args.env}.`);
  if (knownSerial) {
    console.error(`Expected a port containing serial ${knownSerial}.`);
  } else {
    console.error("No Known Serial is recorded for this device in docs/DEVICE_MAP.csv.");
  }
  console.error("Connect the board, then run with --port /dev/cu.usbmodem... if needed.");
  process.exit(1);
}

const resolvedPort = uploadPort || "/dev/cu.usbmodem...";
const command = ["pio", "run", "-e", args.env, "-t", "upload", "--upload-port", resolvedPort];

console.log(`Device: ${device.Channel}`);
console.log(`Env: ${args.env}`);
console.log(`Known MAC: ${device["Known MAC"] || "unknown"}`);
console.log(`Known Serial: ${knownSerial || "unknown"}`);
console.log(`Upload port: ${uploadPort || "not found"}`);
console.log(`Command: ${command.join(" ")}`);

if (args.dryRun) {
  if (!uploadPort) {
    console.log("No matching USB serial port is connected right now.");
  }
  console.log("Dry run only. Re-run with --upload to flash.");
  process.exit(0);
}

if (!args.upload) {
  if (!uploadPort) {
    console.log("No matching USB serial port is connected right now.");
  }
  console.log("No upload performed. Add --upload to flash this board.");
  process.exit(0);
}

const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit"
});
process.exit(result.status ?? 1);

function parseArgs(input) {
  const parsed = {
    dryRun: false,
    env: "",
    help: false,
    list: false,
    port: "",
    ports: false,
    setSerial: "",
    upload: false,
    write: false
  };

  for (let index = 0; index < input.length; index++) {
    const arg = input[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--list") parsed.list = true;
    else if (arg === "--ports") parsed.ports = true;
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--write") parsed.write = true;
    else if (arg === "--upload") parsed.upload = true;
    else if (arg === "--env") parsed.env = input[++index] || "";
    else if (arg.startsWith("--env=")) parsed.env = arg.slice("--env=".length);
    else if (arg === "--port") parsed.port = input[++index] || "";
    else if (arg.startsWith("--port=")) parsed.port = arg.slice("--port=".length);
    else if (arg === "--set-serial") parsed.setSerial = input[++index] || "";
    else if (arg.startsWith("--set-serial=")) parsed.setSerial = arg.slice("--set-serial=".length);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  return parsed;
}

function readDeviceMap() {
  if (!existsSync(DEVICE_MAP_PATH)) {
    console.error(`Missing ${DEVICE_MAP_PATH}`);
    process.exit(1);
  }

  const lines = readFileSync(DEVICE_MAP_PATH, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  const headers = splitCsvLine(lines[0]);
  const devices = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
  return { headers, devices };
}

function splitCsvLine(line) {
  return line.split(",");
}

function findPortForSerial(serial) {
  if (!serial) {
    return "";
  }

  let entries = [];
  try {
    entries = readdirSync("/dev");
  } catch {
    return "";
  }

  const matches = entries
    .filter((entry) => entry.startsWith("cu.usbmodem") && entry.includes(serial))
    .map((entry) => `/dev/${entry}`)
    .sort();

  return matches[0] || "";
}

function listUsbModemPorts() {
  try {
    return readdirSync("/dev")
      .filter((entry) => entry.startsWith("cu.usbmodem"))
      .map((entry) => `/dev/${entry}`)
      .sort();
  } catch {
    return [];
  }
}

function printUsbPorts() {
  const ports = listUsbModemPorts();
  if (!ports.length) {
    console.log("No /dev/cu.usbmodem* ports found.");
    return;
  }

  const rows = ports.map((port) => ({
    port,
    serial: port.replace(/^.*cu\.usbmodem/, "").replace(/\d$/, "") || "-"
  }));
  console.table(rows);
}

function printDeviceMap(entries) {
  const rows = entries.map((entry) => ({
    channel: entry.Channel,
    env: entry["PlatformIO Env"],
    serial: entry["Known Serial"] || "-",
    status: entry.Status || "-"
  }));
  console.table(rows);
}

function updateDeviceSerial(deviceMap, device, serial, shouldWrite) {
  if (!/^[A-Fa-f0-9]{12}$/.test(serial)) {
    console.error(`Serial must be 12 hex characters, got: ${serial}`);
    process.exit(1);
  }

  const normalizedSerial = serial.toUpperCase();
  const existing = device["Known Serial"] || "";
  console.log(`Device: ${device.Channel}`);
  console.log(`Env: ${device["PlatformIO Env"]}`);
  console.log(`Known Serial: ${existing || "empty"}`);
  console.log(`New Serial: ${normalizedSerial}`);

  if (!shouldWrite) {
    console.log("Dry run only. Re-run with --write to update docs/DEVICE_MAP.csv.");
    return;
  }

  device["Known Serial"] = normalizedSerial;
  writeDeviceMap(deviceMap.headers, deviceMap.devices);
  console.log(`Updated ${DEVICE_MAP_PATH}.`);
}

function writeDeviceMap(headers, entries) {
  const lines = [headers.join(",")].concat(
    entries.map((entry) => headers.map((header) => entry[header] || "").join(","))
  );
  writeFileSync(DEVICE_MAP_PATH, `${lines.join("\n")}\n`);
}

function printHelp() {
  console.log(`Usage:
  node scripts/flash-device.mjs --list
  node scripts/flash-device.mjs --ports
  node scripts/flash-device.mjs --env temp1 --set-serial 206EF133B55C
  node scripts/flash-device.mjs --env temp1 --set-serial 206EF133B55C --write
  node scripts/flash-device.mjs --env temp6 --dry-run
  node scripts/flash-device.mjs --env temp6 --port /dev/cu.usbmodem206EF133A96C2 --upload

Options:
  --list              Show device map entries.
  --ports             Show connected /dev/cu.usbmodem* ports.
  --env <name>        PlatformIO environment, such as gateway, temp1, or temp6.
  --port <path>       Explicit upload port. Required when Known Serial is missing.
  --set-serial <hex>  Set Known Serial for an environment in docs/DEVICE_MAP.csv.
  --dry-run           Print the resolved command without flashing.
  --upload            Actually run PlatformIO upload.
  --write             Required with --set-serial to update docs/DEVICE_MAP.csv.
  --help, -h          Show this help.
`);
}
