const endpoint = process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL;

if (!endpoint) {
  console.error("Set APPS_SCRIPT_URL to your Apps Script web app URL.");
  process.exit(1);
}

const count = Number(process.env.SAMPLES || 12);
const delayMs = Number(process.env.DELAY_MS || 1200);
const runId = process.env.RUN_ID || "SIM-CLI-TEST";
const shouldSetRun = process.env.SET_RUN !== "0";

if (shouldSetRun) {
  await setRunId(runId);
}

for (let sample = 0; sample < count; sample++) {
  const payload = makePayload(sample);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow"
  });

  const text = await response.text();
  console.log(`${sample + 1}/${count} HTTP ${response.status}: ${text.trim()}`);
  await wait(delayMs);
}

function makePayload(sample) {
  const payload = {
    method: "append",
    RunID: runId,
    GatewayStatus: "SIMULATOR"
  };

  for (let channel = 1; channel <= 8; channel++) {
    const failure = sample % 10;
    const tempKey = `Temp${channel}`;
    const statusKey = `Temp${channel}_Status`;
    const ageKey = `Temp${channel}_AgeSec`;
    const packetKey = `Temp${channel}_Packets`;
    const faultKey = `Temp${channel}_Fault`;

    if (channel === 3 && failure === 3) {
      payload[tempKey] = null;
      payload[statusKey] = "STALE";
      payload[ageKey] = 35 + sample;
      payload[packetKey] = 50 + sample;
      payload[faultKey] = "NONE";
    } else if (channel === 5 && failure === 5) {
      payload[tempKey] = null;
      payload[statusKey] = "FAULT";
      payload[ageKey] = 0;
      payload[packetKey] = 60 + sample;
      payload[faultKey] = "OPEN";
    } else if (channel === 8 && failure === 7) {
      payload[tempKey] = null;
      payload[statusKey] = "MISSING";
      payload[ageKey] = null;
      payload[packetKey] = 0;
      payload[faultKey] = "NONE";
    } else {
      payload[tempKey] = round1(300 + channel * 24 + Math.sin(sample / 2 + channel) * 12);
      payload[statusKey] = "OK";
      payload[ageKey] = 0;
      payload[packetKey] = 100 + sample * 8 + channel;
      payload[faultKey] = "NONE";
    }
  }

  return payload;
}

async function setRunId(nextRunId) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      method: "setRun",
      RunID: nextRunId,
      Notes: "Set by dashboard simulator upload script"
    }),
    redirect: "follow"
  });

  const text = await response.text();
  let parsed = null;

  try {
    parsed = JSON.parse(text);
  } catch {
    // Older Apps Script deployments return plain text only.
  }

  if (!response.ok || (parsed && parsed.ok === false)) {
    console.warn(`Run setup returned HTTP ${response.status}: ${text.trim()}`);
    console.warn("Continuing uploads anyway. Redeploy apps_script/Code.gs if rows do not land under the expected RunID.");
    return;
  }

  console.log(`Run setup HTTP ${response.status}: ${text.trim()}`);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
