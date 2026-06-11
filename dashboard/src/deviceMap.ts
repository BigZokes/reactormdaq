// Generated from docs/DEVICE_MAP.csv on 2026-06-11.
// Run node scripts/generate-dashboard-device-map.mjs after editing the CSV.

export type DeviceMapEntry = {
  channel: string;
  knownMac: string;
  knownSerial: string;
  platformioEnv: string;
  status: string;
  physicalLabel: string;
  reactorPosition: string;
  wiringNotes: string;
  lastVerified: string;
};

export const deviceMap: DeviceMapEntry[] = [
  {
    channel: "Gateway",
    knownMac: "E4:B0:63:AE:B7:2C",
    knownSerial: "E4B063AEB72C",
    platformioEnv: "gateway",
    status: "Working",
    physicalLabel: "Gateway",
    reactorPosition: "",
    wiringNotes: "",
    lastVerified: "2026-06-08"
  },
  {
    channel: "Temp1",
    knownMac: "20:6E:F1:33:B5:5C",
    knownSerial: "206EF133B55C",
    platformioEnv: "temp1",
    status: "Wireless OK; thermocouple OPEN",
    physicalLabel: "Temp1",
    reactorPosition: "",
    wiringNotes: "Convex saw fresh packets with thermocouple OPEN; flashed after explicit ESP-NOW channel handling patch",
    lastVerified: "2026-06-10"
  },
  {
    channel: "Temp2",
    knownMac: "20:6E:F1:33:A8:B8",
    knownSerial: "206EF133A8B8",
    platformioEnv: "temp2",
    status: "Wireless OK; thermocouple OPEN",
    physicalLabel: "Temp2",
    reactorPosition: "",
    wiringNotes: "Convex saw fresh packets with thermocouple OPEN; ESP-NOW successes observed",
    lastVerified: "2026-06-10"
  },
  {
    channel: "Temp3",
    knownMac: "20:6E:F1:32:7E:EC",
    knownSerial: "206EF1327EEC",
    platformioEnv: "temp3",
    status: "Wireless OK; sensor reads 0C",
    physicalLabel: "Temp3",
    reactorPosition: "",
    wiringNotes: "Check MAX31855 power/data wiring; value stuck at 0.00 C",
    lastVerified: "2026-06-10"
  },
  {
    channel: "Temp4",
    knownMac: "E4:B0:63:AF:0B:30",
    knownSerial: "E4B063AF0B30",
    platformioEnv: "temp4",
    status: "Wireless OK; thermocouple OPEN",
    physicalLabel: "Temp4",
    reactorPosition: "",
    wiringNotes: "Convex saw fresh packets with thermocouple OPEN; ESP-NOW channel set to 6",
    lastVerified: "2026-06-10"
  },
  {
    channel: "Temp5",
    knownMac: "E4:B0:63:AE:66:74",
    knownSerial: "E4B063AE6674",
    platformioEnv: "temp5",
    status: "Wireless OK; thermocouple OPEN",
    physicalLabel: "Temp5",
    reactorPosition: "",
    wiringNotes: "Cable swap restored USB; Convex saw fresh packets with thermocouple OPEN; physical label replaced old map MAC 20:6E:F1:31:23:94",
    lastVerified: "2026-06-10"
  },
  {
    channel: "Temp6",
    knownMac: "20:6E:F1:33:A9:6C",
    knownSerial: "206EF133A96C",
    platformioEnv: "temp6",
    status: "Working",
    physicalLabel: "Temp6",
    reactorPosition: "",
    wiringNotes: "",
    lastVerified: "2026-06-08"
  },
  {
    channel: "Temp7",
    knownMac: "20:6E:F1:33:A4:B8",
    knownSerial: "206EF133A4B8",
    platformioEnv: "temp7",
    status: "Wireless OK; thermocouple OPEN",
    physicalLabel: "Temp7",
    reactorPosition: "",
    wiringNotes: "Check thermocouple/probe/MAX31855 connection; gateway packets verified",
    lastVerified: "2026-06-10"
  },
  {
    channel: "Temp8",
    knownMac: "E4:B0:63:AE:07:84",
    knownSerial: "E4B063AE0784",
    platformioEnv: "temp8",
    status: "Wireless OK; thermocouple OPEN",
    physicalLabel: "Temp8",
    reactorPosition: "",
    wiringNotes: "Convex saw fresh packets with thermocouple OPEN; ESP-NOW successes observed",
    lastVerified: "2026-06-10"
  }
];
