export type NodeStatus = "OK" | "MISSING" | "STALE" | "FAULT" | "UNKNOWN";

export type TemperatureKey =
  | "Temp1"
  | "Temp2"
  | "Temp3"
  | "Temp4"
  | "Temp5"
  | "Temp6"
  | "Temp7"
  | "Temp8";

export type StatusKey =
  | "Temp1_Status"
  | "Temp2_Status"
  | "Temp3_Status"
  | "Temp4_Status"
  | "Temp5_Status"
  | "Temp6_Status"
  | "Temp7_Status"
  | "Temp8_Status";

export type SensorReading = {
  channel: number;
  label: TemperatureKey;
  value: number | null;
  status: NodeStatus;
};

export type DataRow = {
  Time: string;
  RunID: string;
  GatewayStatus: string;
} & Partial<Record<TemperatureKey, number | null>> &
  Partial<Record<StatusKey, NodeStatus>>;

export type DashboardSnapshot = {
  source: "live" | "simulated";
  runId: string;
  lastUpdate: string;
  gatewayStatus: string;
  sensors: SensorReading[];
  rows: DataRow[];
  error?: string;
};
