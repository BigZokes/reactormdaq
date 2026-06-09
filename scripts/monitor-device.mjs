import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const DEVICE_MAP_PATH = "docs/DEVICE_MAP.csv";
const DEFAULT_BAUD = "115200";

const args = parseArgs(process.argv.slice(2));
const { devices } = readDeviceMap();

if (args.help) {
  printHelp();
  process.exit(0);
}

if (args.ports) {
  printUsbPorts();
  process.exit(0);
}

if (args.list) {
  printDeviceMap(devices);
  process.exit(0);
}

if (!args.env) {
  console.error("Missing --env. Use --list to see available devices or --ports to see connected boards.");
  process.exit(1);
}

const device = devices.find((entry) => entry["PlatformIO Env"] === args.env);
if (!device) {
  console.error(`Unknown PlatformIO env: ${args.env}`);
  console.error("Use --list to see available environments.");
  process.exit(1);
}

const knownSerial = device["Known Serial"];
const monitorPort = args.port || findPortForSerial(knownSerial);

if (!monitorPort && args.monitor) {
  console.error(`Could not find a USB serial port for ${args.env}.`);
  if (knownSerial) {
    console.error(`Expected a port containing serial ${knownSerial}.`);
  } else {
    console.error("No Known Serial is recorded for this device in docs/DEVICE_MAP.csv.");
  }
  console.error("Connect the board, then run with --port /dev/cu.usbmodem... if needed.");
  process.exit(1);
}

const resolvedPort = monitorPort || "/dev/cu.usbmodem...";
const baud = args.baud || DEFAULT_BAUD;
const command = ["pio", "device", "monitor", "-p", resolvedPort, "-b", baud];

console.log(`Device: ${device.Channel}`);
console.log(`Env: ${args.env}`);
console.log(`Known MAC: ${device["Known MAC"] || "unknown"}`);
console.log(`Known Serial: ${knownSerial || "unknown"}`);
console.log(`Monitor port: ${monitorPort || "not found"}`);
console.log(`Command: ${command.join(" ")}`);

if (!args.monitor) {
  if (!monitorPort) {
    console.log("No matching USB serial port is connected right now.");
  }
  console.log("No monitor opened. Add --monitor to start reading serial logs.");
  process.exit(0);
}

const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit"
});
process.exit(result.status ?? 1);

function parseArgs(input) {
  const parsed = {
    baud: "",
    env: "",
    help: false,
    list: false,
    monitor: false,
    port: "",
    ports: false
  };

  for (let index = 0; index < input.length; index++) {
    const arg = input[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--list") parsed.list = true;
    else if (arg === "--ports") parsed.ports = true;
    else if (arg === "--monitor") parsed.monitor = true;
    else if (arg === "--env") parsed.env = input[++index] || "";
    else if (arg.startsWith("--env=")) parsed.env = arg.slice("--env=".length);
    else if (arg === "--port") parsed.port = input[++index] || "";
    else if (arg.startsWith("--port=")) parsed.port = arg.slice("--port=".length);
    else if (arg === "--baud") parsed.baud = input[++index] || "";
    else if (arg.startsWith("--baud=")) parsed.baud = arg.slice("--baud=".length);
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

function printHelp() {
  console.log(`Usage:
  node scripts/monitor-device.mjs --list
  node scripts/monitor-device.mjs --ports
  node scripts/monitor-device.mjs --env gateway
  node scripts/monitor-device.mjs --env temp6
  node scripts/monitor-device.mjs --env temp1 --port /dev/cu.usbmodemXXXXXXXXXXXX2 --monitor

Options:
  --list         Show device map entries.
  --ports        Show connected /dev/cu.usbmodem* ports.
  --env <name>   PlatformIO environment, such as gateway, temp1, or temp6.
  --port <path>  Explicit serial monitor port. Required when Known Serial is missing.
  --baud <rate>  Serial baud rate. Defaults to ${DEFAULT_BAUD}.
  --monitor      Actually open the PlatformIO serial monitor.
  --help, -h     Show this help.
`);
}
