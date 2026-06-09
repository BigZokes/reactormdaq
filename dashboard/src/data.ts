import { APPS_SCRIPT_URL, HISTORY_LIMIT, SENSOR_COUNT } from "./config";
import type { AgeKey, DashboardSnapshot, DataRow, FaultKey, NodeStatus, PacketKey, SensorReading, StatusKey, TemperatureKey } from "./types";

const tempKey = (index: number) => `Temp${index}` as TemperatureKey;
const statusKey = (index: number) => `Temp${index}_Status` as StatusKey;
const ageKey = (index: number) => `Temp${index}_AgeSec` as AgeKey;
const packetKey = (index: number) => `Temp${index}_Packets` as PacketKey;
const faultKey = (index: number) => `Temp${index}_Fault` as FaultKey;
const knownStatuses: NodeStatus[] = ["OK", "MISSING", "STALE", "FAULT", "UNKNOWN"];

const baseProfiles = [520, 505, 480, 430, 390, 24.5, 310, 285];
const amplitudes = [24, 20, 18, 16, 14, 1.2, 10, 12];

export function rowToSensors(row: DataRow): SensorReading[] {
  return Array.from({ length: SENSOR_COUNT }, (_, offset) => {
    const channel = offset + 1;
    const key = tempKey(channel);
    const status = statusKey(channel);
    const age = ageKey(channel);
    const packets = packetKey(channel);
    const fault = faultKey(channel);
    return {
      channel,
      label: key,
      value: typeof row[key] === "number" ? row[key] ?? null : null,
      status: normalizeStatus(row[status]),
      ageSec: typeof row[age] === "number" ? row[age] ?? null : null,
      packets: typeof row[packets] === "number" ? row[packets] || 0 : 0,
      fault: String(row[fault] || "NONE")
    };
  });
}

export async function fetchLiveSnapshot(): Promise<DashboardSnapshot> {
  if (!APPS_SCRIPT_URL) {
    throw new Error("VITE_APPS_SCRIPT_URL is not configured");
  }

  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set("mode", "dashboard");
  url.searchParams.set("limit", String(HISTORY_LIMIT));

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Apps Script returned HTTP ${response.status}`);
  }

  const payload = await parseJsonResponse(response);
  const rows = normalizeRows(payload.rows || []);
  const latest = rows.at(-1) || emptyRow(payload.runId || "UNKNOWN");

  return {
    source: "live",
    runId: payload.runId || latest.RunID || "UNKNOWN",
    lastUpdate: latest.Time,
    gatewayStatus: latest.GatewayStatus || "UNKNOWN",
    sensors: rowToSensors(latest),
    rows
  };
}

export async function setLiveRunId(runId: string, notes = ""): Promise<{ runId: string }> {
  if (!APPS_SCRIPT_URL) {
    throw new Error("VITE_APPS_SCRIPT_URL is not configured");
  }

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      method: "setRun",
      RunID: runId,
      Notes: notes
    }),
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Apps Script returned HTTP ${response.status}`);
  }

  const text = await response.text();
  try {
    const payload = JSON.parse(text);
    if (payload.ok === false) {
      throw new Error(payload.error || "Apps Script rejected run update");
    }
    return { runId: String(payload.runId || runId) };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { runId };
    }
    throw error;
  }
}

export function makeSimulatedSnapshot(seed = Date.now(), runId = "SIM-HOME-TEST"): DashboardSnapshot {
  const now = new Date();
  const rows = Array.from({ length: HISTORY_LIMIT }, (_, index) => {
    const age = HISTORY_LIMIT - index - 1;
    const timestamp = new Date(now.getTime() - age * 5000);
    return makeSimulatedRow(timestamp, seed - age * 5000, runId, index + 1);
  });
  const latest = rows.at(-1) || emptyRow(runId);

  return {
    source: "simulated",
    runId: latest.RunID,
    lastUpdate: latest.Time,
    gatewayStatus: latest.GatewayStatus,
    sensors: rowToSensors(latest),
    rows
  };
}

function makeSimulatedRow(timestamp: Date, seed: number, runId: string, sampleNumber: number): DataRow {
  const row: DataRow = {
    Time: timestamp.toISOString(),
    RunID: runId,
    GatewayStatus: "OK"
  };

  for (let channel = 1; channel <= SENSOR_COUNT; channel++) {
    const temp = tempKey(channel);
    const status = statusKey(channel);
    const age = ageKey(channel);
    const packets = packetKey(channel);
    const fault = faultKey(channel);
    const wave = Math.sin(seed / (18000 + channel * 1200) + channel);
    const noise = pseudoNoise(seed, channel) * 3.2;
    const faultWindow = Math.floor(seed / 30000) % 19;
    const simulatedAge = Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 1000));
    const samplePackets = sampleNumber * 2 + channel;

    if (channel === 3 && faultWindow === 7) {
      row[temp] = null;
      row[status] = "STALE";
      row[age] = 35 + simulatedAge;
      row[packets] = Math.max(1, samplePackets - 12);
      row[fault] = "NONE";
    } else if (channel === 5 && faultWindow === 11) {
      row[temp] = null;
      row[status] = "FAULT";
      row[age] = simulatedAge;
      row[packets] = samplePackets;
      row[fault] = "OPEN";
    } else if (channel === 8 && faultWindow === 3) {
      row[temp] = null;
      row[status] = "MISSING";
      row[age] = null;
      row[packets] = 0;
      row[fault] = "NONE";
    } else {
      row[temp] = round1(baseProfiles[channel - 1] + wave * amplitudes[channel - 1] + noise);
      row[status] = "OK";
      row[age] = simulatedAge;
      row[packets] = samplePackets;
      row[fault] = "NONE";
    }
  }

  return row;
}

function normalizeRows(input: unknown[]): DataRow[] {
  return input
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => {
      const normalized: DataRow = {
        Time: String(row.Time || row.time || new Date().toISOString()),
        RunID: String(row.RunID || row.runId || "UNKNOWN"),
        GatewayStatus: String(row.GatewayStatus || row.gatewayStatus || "UNKNOWN")
      };

      for (let channel = 1; channel <= SENSOR_COUNT; channel++) {
        const temp = tempKey(channel);
        const status = statusKey(channel);
        const age = ageKey(channel);
        const packets = packetKey(channel);
        const fault = faultKey(channel);
        const value = row[temp];
        normalized[temp] = typeof value === "number" ? value : value === "" || value == null ? null : Number(value);
        if (Number.isNaN(normalized[temp])) normalized[temp] = null;
        normalized[status] = normalizeStatus(row[status]);
        normalized[age] = normalizeNullableNumber(row[age]);
        normalized[packets] = normalizeNullableNumber(row[packets]) ?? 0;
        normalized[fault] = String(row[fault] || "NONE");
      }

      return normalized;
    });
}

function emptyRow(runId: string): DataRow {
  const row: DataRow = {
    Time: new Date().toISOString(),
    RunID: runId,
    GatewayStatus: "UNKNOWN"
  };
  for (let channel = 1; channel <= SENSOR_COUNT; channel++) {
    row[tempKey(channel)] = null;
    row[statusKey(channel)] = "UNKNOWN";
    row[ageKey(channel)] = null;
    row[packetKey(channel)] = 0;
    row[faultKey(channel)] = "NONE";
  }
  return row;
}

async function parseJsonResponse(response: Response): Promise<Record<string, any>> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Apps Script did not return JSON: ${text.slice(0, 140)}`);
  }
}

function normalizeStatus(value: unknown): NodeStatus {
  const status = String(value || "UNKNOWN").trim().toUpperCase() as NodeStatus;
  return knownStatuses.includes(status) ? status : "UNKNOWN";
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function pseudoNoise(seed: number, salt: number): number {
  const x = Math.sin(seed * 0.0001 + salt * 99.123) * 10000;
  return x - Math.floor(x) - 0.5;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
