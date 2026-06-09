const endpoint = process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL;

if (!endpoint) {
  console.error("Set APPS_SCRIPT_URL to your Apps Script web app URL.");
  process.exit(1);
}

const runId = process.env.RUN_ID || `SIM-CONTRACT-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;

console.log(`Testing Apps Script endpoint: ${endpoint}`);
console.log(`Contract run: ${runId}`);

try {
  await runContract();
  console.log("Apps Script backend contract passed.");
} catch (error) {
  console.error(`Apps Script backend contract failed: ${error.message}`);
  process.exit(1);
}

async function runContract() {
  const health = await getJson("mode=health");
  assert(health.ok === true, "Health endpoint did not return ok=true.");
  assert(typeof health.runId === "string", "Health endpoint did not return a runId.");

  const setRun = await postJson({
    method: "setRun",
    RunID: runId,
    Notes: "Set by dashboard backend contract test"
  });
  assert(setRun.ok === true, "setRun did not return ok=true. Redeploy apps_script/Code.gs if this endpoint is old.");
  assert(setRun.runId === runId, `setRun returned runId=${setRun.runId}, expected ${runId}.`);

  const beforeAppend = await getJson("mode=dashboard&limit=5");
  assert(beforeAppend.ok === true, "Dashboard endpoint did not return ok=true.");
  assert(beforeAppend.runId === runId, `Dashboard runId=${beforeAppend.runId}, expected ${runId}.`);
  assert(Array.isArray(beforeAppend.rows), "Dashboard endpoint did not return rows array.");

  const appendText = await postText(makePayload());
  assert(appendText.trim() === "Success", `Append returned ${appendText.trim()}, expected Success.`);

  const afterAppend = await getJson("mode=dashboard&limit=20");
  assert(afterAppend.ok === true, "Dashboard endpoint after append did not return ok=true.");
  assert(Array.isArray(afterAppend.rows), "Dashboard endpoint after append did not return rows array.");

  const matchingRow = afterAppend.rows.find((row) => row.RunID === runId && row.GatewayStatus === "SIM-CONTRACT");
  assert(Boolean(matchingRow), "Could not find the contract-test row in the latest dashboard rows.");
}

async function getJson(query) {
  const separator = endpoint.includes("?") ? "&" : "?";
  const response = await fetch(`${endpoint}${separator}${query}`, { redirect: "follow" });
  const text = await response.text();
  const data = parseJson(text, `GET ${query}`);

  if (!response.ok) {
    throw new Error(`GET ${query} failed with HTTP ${response.status}: ${text}`);
  }

  return data;
}

async function postJson(payload) {
  const text = await postText(payload);
  return parseJson(text, `POST ${payload.method || "append"}`);
}

async function postText(payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow"
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`POST ${payload.method || "append"} failed with HTTP ${response.status}: ${text}`);
  }

  return text;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} did not return JSON. Redeploy apps_script/Code.gs with doGet/setRun support. Response was: ${text.slice(0, 200)}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makePayload() {
  const payload = {
    method: "append",
    GatewayStatus: "SIM-CONTRACT"
  };

  for (let channel = 1; channel <= 8; channel++) {
    payload[`Temp${channel}`] = 200 + channel;
    payload[`Temp${channel}_Status`] = "OK";
  }

  return payload;
}
