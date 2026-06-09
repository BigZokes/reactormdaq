import { AlertTriangle, Activity, CheckCircle2, Database, Play, Radio, RefreshCw, Thermometer, Wifi } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { APPS_SCRIPT_URL, POLL_INTERVAL_MS } from "./config";
import { fetchLiveSnapshot, makeSimulatedSnapshot, setLiveRunId } from "./data";
import type { DashboardSnapshot, NodeStatus, SensorReading } from "./types";
import "./styles.css";

type Mode = "simulated" | "live";

const statusRank: Record<NodeStatus, number> = {
  FAULT: 4,
  STALE: 3,
  MISSING: 2,
  UNKNOWN: 1,
  OK: 0
};

export default function App() {
  const [mode, setMode] = useState<Mode>(APPS_SCRIPT_URL ? "live" : "simulated");
  const [simulatedRunId, setSimulatedRunId] = useState("SIM-HOME-TEST");
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(() => makeSimulatedSnapshot(Date.now(), "SIM-HOME-TEST"));
  const [loading, setLoading] = useState(false);
  const [runDraft, setRunDraft] = useState(snapshot.runId);
  const [runMessage, setRunMessage] = useState("");
  const [runBusy, setRunBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      setLoading(true);
      try {
        const next = mode === "live" ? await fetchLiveSnapshot() : makeSimulatedSnapshot(Date.now(), simulatedRunId);
        if (!cancelled) {
          setSnapshot(next);
          setRunDraft((current) => current || next.runId);
        }
      } catch (error) {
        const fallback = makeSimulatedSnapshot(Date.now(), simulatedRunId);
        if (!cancelled) {
          setSnapshot({
            ...fallback,
            error: error instanceof Error ? error.message : "Unknown dashboard error"
          });
          setMode("simulated");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [mode, simulatedRunId]);

  useEffect(() => {
    setRunDraft(snapshot.runId);
  }, [snapshot.runId]);

  const health = useMemo(() => summarizeHealth(snapshot.sensors), [snapshot.sensors]);
  const latestRows = snapshot.rows.slice(-10).reverse();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">Dual-bed gasifier</div>
          <h1>Reactor Temperature DAQ</h1>
        </div>
        <div className="topbar-actions">
          <button
            className={`mode-button ${mode === "simulated" ? "active" : ""}`}
            onClick={() => setMode("simulated")}
            type="button"
          >
            <Activity size={16} />
            Sim
          </button>
          <button
            className={`mode-button ${mode === "live" ? "active" : ""}`}
            disabled={!APPS_SCRIPT_URL}
            onClick={() => setMode("live")}
            type="button"
            title={APPS_SCRIPT_URL ? "Read from Apps Script" : "Set VITE_APPS_SCRIPT_URL to enable live mode"}
          >
            <Radio size={16} />
            Live
          </button>
          <div className="refresh-indicator" aria-label="Refresh status">
            <RefreshCw size={16} className={loading ? "spinning" : ""} />
          </div>
        </div>
      </header>

      <section className="status-strip">
        <Metric icon={<Database size={18} />} label="Run ID" value={snapshot.runId} />
        <Metric icon={<Wifi size={18} />} label="Gateway" value={snapshot.gatewayStatus} tone={snapshot.gatewayStatus === "OK" ? "good" : "bad"} />
        <Metric icon={<Thermometer size={18} />} label="Sensors OK" value={`${health.ok}/8`} tone={health.bad ? "warn" : "good"} />
        <Metric icon={<Activity size={18} />} label="Last Update" value={formatTime(snapshot.lastUpdate)} />
      </section>

      <form className="run-control" onSubmit={handleRunSubmit}>
        <label htmlFor="run-id">Current run</label>
        <input
          id="run-id"
          maxLength={80}
          onChange={(event) => setRunDraft(event.target.value)}
          placeholder="EXP-2026-06-09-A"
          value={runDraft}
        />
        <button disabled={runBusy || !runDraft.trim()} type="submit">
          {runBusy ? <RefreshCw size={16} className="spinning" /> : mode === "live" ? <Play size={16} /> : <CheckCircle2 size={16} />}
          {mode === "live" ? "Set Run" : "Use In Sim"}
        </button>
        {runMessage && <span className="run-message">{runMessage}</span>}
      </form>

      {snapshot.error && (
        <div className="notice">
          <AlertTriangle size={18} />
          Live read failed, showing simulator data: {snapshot.error}
        </div>
      )}

      {health.bad > 0 && (
        <section className="alarm-band">
          <AlertTriangle size={22} />
          <div>
            <strong>{health.bad} thermocouple channel{health.bad === 1 ? "" : "s"} need attention.</strong>
            <span> Check stale, missing, or faulted sensors before trusting the run.</span>
          </div>
        </section>
      )}

      <section className="sensor-grid">
        {snapshot.sensors.map((sensor) => (
          <SensorTile key={sensor.channel} sensor={sensor} />
        ))}
      </section>

      <section className="chart-section">
        <div className="section-heading">
          <h2>Temperature History</h2>
          <span>{snapshot.source === "live" ? "Google Sheet" : "simulator"} · {snapshot.rows.length} samples</span>
        </div>
        <TemperatureChart rows={snapshot.rows} />
      </section>

      <section className="table-section">
        <div className="section-heading">
          <h2>Recent Samples</h2>
          <span>Newest first</span>
        </div>
        <div className="sample-table-wrap">
          <table className="sample-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Run</th>
                {Array.from({ length: 8 }, (_, index) => (
                  <th key={index}>T{index + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {latestRows.map((row, rowIndex) => (
                <tr key={`${row.Time}-${rowIndex}`}>
                  <td>{formatTime(row.Time)}</td>
                  <td>{row.RunID}</td>
                  {Array.from({ length: 8 }, (_, index) => {
                    const channel = index + 1;
                    const value = row[`Temp${channel}` as keyof typeof row];
                    const status = row[`Temp${channel}_Status` as keyof typeof row] || "UNKNOWN";
                    return (
                      <td key={channel} className={`table-status ${String(status).toLowerCase()}`}>
                        {typeof value === "number" ? `${value.toFixed(1)}` : String(status)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );

  async function handleRunSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRunId = runDraft.trim();
    if (!nextRunId) return;

    setRunBusy(true);
    setRunMessage("");
    try {
      if (mode === "live") {
        const result = await setLiveRunId(nextRunId, "Updated from dashboard");
        setRunDraft(result.runId);
        setRunMessage(`Live run set to ${result.runId}`);
        const next = await fetchLiveSnapshot();
        setSnapshot(next);
      } else {
        setSimulatedRunId(nextRunId);
        setSnapshot(makeSimulatedSnapshot(Date.now(), nextRunId));
        setRunMessage(`Simulator run set to ${nextRunId}`);
      }
    } catch (error) {
      setRunMessage(error instanceof Error ? error.message : "Run update failed");
    } finally {
      setRunBusy(false);
    }
  }
}

function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className={`metric ${tone || ""}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function SensorTile({ sensor }: { sensor: SensorReading }) {
  return (
    <article className={`sensor-tile ${sensor.status.toLowerCase()}`}>
      <div className="sensor-topline">
        <span>Temp{sensor.channel}</span>
        <span className="badge">{sensor.status}</span>
      </div>
      <div className="sensor-value">{sensor.value === null ? "--" : sensor.value.toFixed(1)}</div>
      <div className="sensor-unit">deg C</div>
    </article>
  );
}

function TemperatureChart({ rows }: { rows: DashboardSnapshot["rows"] }) {
  const series = Array.from({ length: 8 }, (_, index) => {
    const channel = index + 1;
    return rows
      .map((row, pointIndex) => {
        const value = row[`Temp${channel}` as keyof typeof row];
        return typeof value === "number" ? { x: pointIndex, y: value } : null;
      })
      .filter((point): point is { x: number; y: number } => point !== null);
  });

  const values = series.flat().map((point) => point.y);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const width = 920;
  const height = 300;
  const pad = 28;
  const xMax = Math.max(rows.length - 1, 1);
  const colors = ["#d94f30", "#e6a92a", "#3d8f66", "#2c7fb8", "#7d5fb2", "#242a31", "#00a19a", "#c74784"];

  const pathFor = (points: { x: number; y: number }[]) =>
    points
      .map((point, index) => {
        const x = pad + (point.x / xMax) * (width - pad * 2);
        const y = height - pad - ((point.y - min) / (max - min || 1)) * (height - pad * 2);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Temperature history chart">
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="axis" />
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="axis" />
        {[0.25, 0.5, 0.75].map((tick) => (
          <line key={tick} x1={pad} x2={width - pad} y1={pad + tick * (height - pad * 2)} y2={pad + tick * (height - pad * 2)} className="grid-line" />
        ))}
        {series.map((points, index) => (
          <path key={index} d={pathFor(points)} fill="none" stroke={colors[index]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="legend">
        {colors.map((color, index) => (
          <span key={color}>
            <i style={{ background: color }} />
            T{index + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

function summarizeHealth(sensors: SensorReading[]) {
  const ok = sensors.filter((sensor) => sensor.status === "OK").length;
  const worst = sensors.reduce((max, sensor) => Math.max(max, statusRank[sensor.status]), 0);
  return { ok, bad: sensors.length - ok, worst };
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
