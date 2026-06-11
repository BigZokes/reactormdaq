import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const appsScriptUrl = args.appsScriptUrl || process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL || "";
const results = [];

await main();

async function main() {
  section("Reactor DAQ Preflight");
  info(`Repo: ${repoRoot}`);

  checkCommand("Repository checks", "node", ["scripts/check-repo.mjs"], { required: true });

  if (!args.skipBuild) {
    checkCommand("Dashboard build", "npm", ["run", "build"], {
      cwd: "dashboard",
      required: true
    });
  } else {
    skip("Dashboard build", "Skipped by --skip-build");
  }

  checkDeviceMap();
  checkUsbPorts();
  await checkAppsScript(appsScriptUrl);
  checkVercelCli();

  section("Summary");
  for (const result of results) {
    console.log(`${symbolFor(result.status)} ${result.label}${result.message ? ` - ${result.message}` : ""}`);
  }

  const failedRequired = results.some((result) => result.status === "fail" && result.required);
  const failedStrict = args.strict && results.some((result) => result.status === "fail" || result.status === "warn");

  if (failedRequired || failedStrict) {
    process.exit(1);
  }
}

function parseArgs(input) {
  const parsed = {
    appsScriptUrl: "",
    help: false,
    skipBuild: false,
    strict: false
  };

  for (let index = 0; index < input.length; index++) {
    const arg = input[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--skip-build") parsed.skipBuild = true;
    else if (arg === "--strict") parsed.strict = true;
    else if (arg === "--apps-script-url") parsed.appsScriptUrl = input[++index] || "";
    else if (arg.startsWith("--apps-script-url=")) parsed.appsScriptUrl = arg.slice("--apps-script-url=".length);
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  return parsed;
}

function checkCommand(label, command, commandArgs, options = {}) {
  const cwd = options.cwd || ".";
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    timeout: options.timeoutMs || 120000
  });

  if (result.status === 0) {
    pass(label, options.successMessage || "OK", options.required);
    return;
  }

  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  const message = result.error?.code === "ETIMEDOUT" ? "Timed out" : summarize(output || result.error?.message || "Command failed");
  fail(label, message, options.required);
}

function checkDeviceMap() {
  const path = "docs/DEVICE_MAP.csv";
  if (!existsSync(path)) {
    fail("Device map", `${path} missing`, true);
    return;
  }

  const lines = readFileSync(path, "utf8").trim().split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines[0]);
  const entries = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });

  const working = entries.filter((entry) => entry.Status === "Working").length;
  const needsTest = entries.filter((entry) => /Needs/.test(entry.Status)).length;
  pass("Device map", `${entries.length} devices, ${working} working, ${needsTest} need testing`);
}

function checkUsbPorts() {
  const ports = listUsbModemPorts();
  if (!ports.length) {
    warn("USB boards", "No /dev/cu.usbmodem* ports connected");
    return;
  }

  pass("USB boards", `${ports.length} connected: ${ports.map((port) => port.replace("/dev/", "")).join(", ")}`);
}

async function checkAppsScript(endpoint) {
  if (!endpoint) {
    warn("Apps Script health", "No APPS_SCRIPT_URL or VITE_APPS_SCRIPT_URL provided");
    return;
  }

  const healthUrl = new URL(endpoint);
  healthUrl.searchParams.set("mode", "health");

  try {
    const response = await fetch(healthUrl, { redirect: "follow" });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (/Script function not found: doGet/.test(text)) {
        fail("Apps Script health", "Deployment is missing doGet; paste and redeploy apps_script/Code.gs");
        return;
      }
      fail("Apps Script health", `Expected JSON, got ${summarize(text)}`);
      return;
    }

    if (!response.ok || data.ok !== true) {
      fail("Apps Script health", `Endpoint returned ${response.status} ${JSON.stringify(data).slice(0, 120)}`);
      return;
    }

    if (data.schemaVersion !== "temperature-daq-v2") {
      fail("Apps Script health", `Schema is ${data.schemaVersion || "missing"}, expected temperature-daq-v2`);
      return;
    }

    pass("Apps Script health", `OK, runId=${data.runId || "unknown"}`);
  } catch (error) {
    fail("Apps Script health", summarize(error.message || String(error)));
  }
}

function checkVercelCli() {
  const result = spawnSync("npx", ["--yes", "vercel", "whoami"], {
    cwd: "dashboard",
    encoding: "utf8",
    timeout: 10000
  });

  if (result.status === 0) {
    pass("Vercel CLI auth", summarize(result.stdout || "Logged in"));
    return;
  }

  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (/Starting login flow|No existing credentials|Waiting for authentication|oauth\/device/.test(output)) {
    warn("Vercel CLI auth", "Not logged in locally; use Git import or finish `npx vercel login`");
    return;
  }

  warn("Vercel CLI auth", summarize(output || result.error?.message || "Could not verify"));
}

function splitCsvLine(line) {
  return line.split(",");
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

function summarize(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .replace(/https:\/\/script[.]google[.]com\/macros\/s\/[^/\s]+\/exec/g, "https://script.google.com/macros/s/.../exec")
    .trim()
    .slice(0, 180);
}

function section(title) {
  console.log(`\n${title}`);
}

function info(message) {
  console.log(`  ${message}`);
}

function pass(label, message, required = false) {
  results.push({ label, message, required, status: "pass" });
  console.log(`${symbolFor("pass")} ${label}: ${message}`);
}

function warn(label, message, required = false) {
  results.push({ label, message, required, status: "warn" });
  console.log(`${symbolFor("warn")} ${label}: ${message}`);
}

function fail(label, message, required = false) {
  results.push({ label, message, required, status: "fail" });
  console.log(`${symbolFor("fail")} ${label}: ${message}`);
}

function skip(label, message) {
  results.push({ label, message, required: false, status: "skip" });
  console.log(`${symbolFor("skip")} ${label}: ${message}`);
}

function symbolFor(status) {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  if (status === "fail") return "FAIL";
  return "SKIP";
}

function printHelp() {
  console.log(`Usage:
  node scripts/preflight.mjs
  APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" node scripts/preflight.mjs
  node scripts/preflight.mjs --apps-script-url "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"

Options:
  --apps-script-url <url>  Apps Script web app URL for read-only health check.
  --skip-build            Skip dashboard production build.
  --strict                Exit non-zero on warnings as well as required failures.
  --help, -h              Show this help.
`);
}
