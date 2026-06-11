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

export type AgeKey =
  | "Temp1_AgeSec"
  | "Temp2_AgeSec"
  | "Temp3_AgeSec"
  | "Temp4_AgeSec"
  | "Temp5_AgeSec"
  | "Temp6_AgeSec"
  | "Temp7_AgeSec"
  | "Temp8_AgeSec";

export type PacketKey =
  | "Temp1_Packets"
  | "Temp2_Packets"
  | "Temp3_Packets"
  | "Temp4_Packets"
  | "Temp5_Packets"
  | "Temp6_Packets"
  | "Temp7_Packets"
  | "Temp8_Packets";

export type FaultKey =
  | "Temp1_Fault"
  | "Temp2_Fault"
  | "Temp3_Fault"
  | "Temp4_Fault"
  | "Temp5_Fault"
  | "Temp6_Fault"
  | "Temp7_Fault"
  | "Temp8_Fault";

export type SensorReading = {
  channel: number;
  label: TemperatureKey;
  value: number | null;
  status: NodeStatus;
  ageSec: number | null;
  packets: number;
  fault: string;
};

export type DataRow = {
  Time: string;
  RunID: string;
  GatewayStatus: string;
} & Partial<Record<TemperatureKey, number | null>> &
  Partial<Record<StatusKey, NodeStatus>> &
  Partial<Record<AgeKey | PacketKey, number | null>> &
  Partial<Record<FaultKey, string>>;

export type DashboardSnapshot = {
  source: "live" | "simulated";
  runId: string;
  schemaVersion: string;
  lastUpdate: string;
  gatewayStatus: string;
  sensors: SensorReading[];
  rows: DataRow[];
  error?: string;
};
