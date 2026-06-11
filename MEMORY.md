# Reactor Temperature DAQ Project Memory

This file is the working context for the reactor thermocouple DAQ system so the project can be resumed without re-explaining the setup.

## Project Goal

Build a reliable wireless temperature data acquisition system for a reactor experiment.

Current priority is temperature only. The system uses multiple Arduino Nano ESP32 boards with thermocouple amplifier circuits. Individual thermocouple nodes read temperature and send readings wirelessly to a central gateway board. The gateway collates the readings and uploads rows to a Google Sheet.

The previous code was written by someone else and was functional but fragile. Main design concerns:

- The gateway should not fail just because one thermocouple is off, missing, stale, or faulty.
- Thermocouple nodes may be powered on at different times.
- During an experiment, the system should make it obvious which thermocouples are reporting and which are not.
- Spreadsheet data from different experiments should not overwrite or mix ambiguously.
- Eventually, a live dashboard/web app should make monitoring easier than reading serial logs.

## Active Project Folder

```text
/Users/peterzokoro/Downloads/PlatformIO-ReactorCore/reactor_temperature_daq
```

Old reference code is kept separately:

```text
/Users/peterzokoro/Downloads/PlatformIO-ReactorCore/original_reference
```

## Hardware Roles

### Gateway / Central Node

- Board: Arduino Nano ESP32
- Role: receives ESP-NOW thermocouple packets, connects to Wi-Fi, uploads rows to Google Sheets
- Serial / MAC-like device ID: `E4B063AEB72C`
- Common port: `/dev/cu.usbmodemE4B063AEB72C2`
- Verified flashed and working on 2026-06-08

### Temp6 Node

- Board: Arduino Nano ESP32
- Role: thermocouple node for `Temp6`
- MAC: `20:6E:F1:33:A9:6C`
- Serial / device ID: `206EF133A96C`
- Common port: `/dev/cu.usbmodem206EF133A96C2`
- Verified working over ESP-NOW on 2026-06-08
- Last observed readings were around `24.25 C` to `24.50 C`

## Known Device Map

| Temp Channel | MAC Address | Status |
| --- | --- | --- |
| Temp1 | `20:6E:F1:33:B5:5C` | Needs updated/tested |
| Temp2 | `20:6E:F1:33:A8:B8` | Needs updated/tested |
| Temp3 | `20:6E:F1:32:7E:EC` | Needs updated/tested |
| Temp4 | `E4:B0:63:AF:0B:30` | Needs updated/tested |
| Temp5 | `20:6E:F1:31:23:94` | Needs updated/tested |
| Temp6 | `20:6E:F1:33:A9:6C` | Working |
| Temp7 | `20:6E:F1:33:A4:B8` | Needs updated/tested |
| Temp8 | `E4:B0:63:AE:07:84` | Needs updated/tested |
| Gateway | `E4:B0:63:AE:B7:2C` | Working |

Need confirm this map physically by labeling each board/circuit and matching it to reactor position.

## Wireless Design

- Thermocouple nodes use ESP-NOW to communicate with the gateway.
- ESP-NOW does not require a separate Wi-Fi access point for node-to-gateway communication.
- Gateway also connects to Wi-Fi so it can upload to Google Apps Script.
- Thermocouple nodes should send packets independently. Gateway should build rows from the latest known values rather than waiting for all eight nodes to be alive.

## Current Firmware Behavior

Main source files:

```text
src/gateway.cpp
src/tc_node.cpp
include/secrets.h
```

Gateway firmware behavior:

- Scans/connects to configured Wi-Fi.
- Initializes ESP-NOW receiver.
- Tracks last value and last-seen time for each thermocouple.
- Sends partial rows to Google Sheets.
- Adds status fields:
  - `OK`: node is recently seen and reading is valid
  - `MISSING`: node has never been seen since gateway boot
  - `STALE`: node was seen before but has not sent recently
  - `FAULT`: node sent a bad/NaN thermocouple value
- Adds `GatewayStatus`.
- Adds per-channel diagnostics in the v2 schema:
  - `TempN_AgeSec`: seconds since the gateway last heard from that channel
  - `TempN_Packets`: number of packets received for that channel since gateway boot
  - `TempN_Fault`: MAX31855 fault name such as `NONE`, `OPEN`, `SHORT_GND`, or `SHORT_VCC`
- Treats Google `2xx` and `3xx` response codes as accepted. Google Apps Script often returns `302`, which is OK.

Example verified gateway upload payload:

```json
{
  "method": "append",
  "GatewayStatus": "OK",
  "Temp1": null,
  "Temp1_Status": "MISSING",
  "Temp2": null,
  "Temp2_Status": "MISSING",
  "Temp3": null,
  "Temp3_Status": "MISSING",
  "Temp4": null,
  "Temp4_Status": "MISSING",
  "Temp5": null,
  "Temp5_Status": "MISSING",
  "Temp6": 24.25,
  "Temp6_Status": "OK",
  "Temp6_AgeSec": 0,
  "Temp6_Packets": 42,
  "Temp6_Fault": "NONE",
  "Temp7": null,
  "Temp7_Status": "MISSING",
  "Temp8": null,
  "Temp8_Status": "MISSING"
}
```

## Google Sheets / Apps Script

Current deployed Apps Script web app:

```text
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

This URL is configured in:

```text
include/secrets.h
```

Apps Script source copy is saved locally:

```text
apps_script/Code.gs
```

Spreadsheet design:

- `Control` sheet stores run metadata.
- `Control!B1` is the current experiment/run name.
- `Data` sheet is the master append-only table.
- Every row includes `RunID`, so different experiments do not overwrite each other.
- Old `Exp1` may still exist as legacy data, but new logging should go to `Data`.

Expected `Data` headers:

```text
Time
RunID
Temp1
Temp2
Temp3
Temp4
Temp5
Temp6
Temp7
Temp8
Temp1_Status
Temp2_Status
Temp3_Status
Temp4_Status
Temp5_Status
Temp6_Status
Temp7_Status
Temp8_Status
Temp1_AgeSec
Temp2_AgeSec
Temp3_AgeSec
Temp4_AgeSec
Temp5_AgeSec
Temp6_AgeSec
Temp7_AgeSec
Temp8_AgeSec
Temp1_Packets
Temp2_Packets
Temp3_Packets
Temp4_Packets
Temp5_Packets
Temp6_Packets
Temp7_Packets
Temp8_Packets
Temp1_Fault
Temp2_Fault
Temp3_Fault
Temp4_Fault
Temp5_Fault
Temp6_Fault
Temp7_Fault
Temp8_Fault
GatewayStatus
```

Before a new experiment:

1. Open the Google Sheet.
2. Go to `Control`.
3. Change `B1` to something like `EXP-2026-06-09-A`.
4. Confirm incoming rows in `Data` have that `RunID`.

## Verified End-to-End State

On 2026-06-08:

- New Apps Script deployment was tested from the Mac with `curl` and returned `Success`.
- Gateway was rebuilt with the new deployment URL.
- Gateway was flashed by serial number `E4B063AEB72C`.
- Serial monitor confirmed:
  - Gateway connected to Wi-Fi.
  - Gateway received Temp6 from MAC `20:6E:F1:33:A9:6C`.
  - Gateway uploaded payloads with status fields.
  - Google accepted uploads with `Sheet upload accepted. code=302`.

## Common Commands

Build gateway:

```sh
source /Users/peterzokoro/.zshrc >/dev/null 2>&1
pio run -d /Users/peterzokoro/Downloads/PlatformIO-ReactorCore/reactor_temperature_daq -e gateway
```

Flash gateway by serial number:

```sh
/Users/peterzokoro/.platformio/packages/tool-dfuutil-arduino/dfu-util \
  -d 0x2341:0x0070 \
  -S E4B063AEB72C \
  -Q \
  -D /Users/peterzokoro/Downloads/PlatformIO-ReactorCore/reactor_temperature_daq/.pio/build/gateway/firmware.bin
```

Monitor gateway:

```sh
source /Users/peterzokoro/.zshrc >/dev/null 2>&1
pio device monitor -p /dev/cu.usbmodemE4B063AEB72C2 -b 115200
```

List connected boards:

```sh
source /Users/peterzokoro/.zshrc >/dev/null 2>&1
pio device list
```

## Next Hardware Work

1. Update remaining thermocouple nodes.
2. For each board:
   - plug in one node at a time
   - identify serial/MAC
   - set correct `TEMP_INDEX`
   - flash `tc_node.cpp`
   - confirm gateway logs `RX ... TempN`
   - confirm sheet row shows `TempN_Status = OK`
3. Label every board physically.
4. Build final map:
   - board label
   - MAC
   - `TempN`
   - reactor location
   - thermocouple amplifier/wiring notes

## Next System Improvements

- Improve status logic and troubleshooting.
- Consider adding:
  - packet counters per node
  - last-seen seconds per node
  - boot ID or gateway uptime
  - node battery/power state if hardware supports it
  - thermocouple fault subtype if MAX31855 exposes it cleanly
- Decide whether stale nodes should keep last temperature value or write blank after timeout.
- Decide experiment sampling interval and whether 5 seconds is the right upload cadence.

## Web App / Dashboard Idea

Possible next product layer: a live dashboard deployable to Vercel.

First useful version:

- Shows current `RunID`.
- Shows latest temperature for `Temp1` through `Temp8`.
- Shows status badges: `OK`, `MISSING`, `STALE`, `FAULT`.
- Shows last update time.
- Shows a line chart of temperature history.
- Gives a visible warning if an expected thermocouple stops reporting.

Likely simple architecture:

- Google Sheets remains the main experiment log.
- Apps Script gets an additional `doGet` endpoint for latest rows/status.
- Vercel app polls Apps Script every 5 seconds.
- Later, replace Google Sheets polling with a database/API if needed.

Dashboard v1 has been started in:

```text
dashboard/
```

It is a Vite React app that works from home with simulator data and can switch to live mode when `VITE_APPS_SCRIPT_URL` is configured. It includes sensor tiles, status badges, run ID, gateway status, last update time, a temperature history chart, and recent sample table.

The dashboard now also includes a run-control input. In simulator mode it changes the local simulated `RunID`; in live mode it calls Apps Script with:

```json
{"method":"setRun","RunID":"EXP-2026-06-09-A"}
```

The Apps Script source handles this by updating `Control!B1`. This means an operator can start/switch experiment runs from the dashboard instead of manually editing the sheet.

The dashboard tooling now includes:

```sh
npm run test:backend
```

This is an Apps Script contract test that checks `doGet` health/dashboard reads, `setRun`, append, and whether the appended row can be read back. It requires `APPS_SCRIPT_URL` or `VITE_APPS_SCRIPT_URL` and will add one synthetic row with `GatewayStatus = SIM-CONTRACT`.

The simulator upload script now also sends `method=setRun` before appending fake rows unless `SET_RUN=0` is set. This keeps simulator rows grouped under the chosen `RUN_ID`.

The data contract is now `temperature-daq-v2`. Each channel includes:

```text
TempN
TempN_Status
TempN_AgeSec
TempN_Packets
TempN_Fault
```

The gateway remains backward-compatible with the old two-field ESP-NOW packet shape, but updated thermocouple node firmware sends a fault code so the gateway can distinguish MAX31855 faults more clearly.

GitHub CI has been added in:

```text
.github/workflows/reactor-daq-ci.yml
```

It checks the new safe project paths for obvious committed secrets, builds the dashboard, creates `include/secrets.h` from `include/secrets.example.h`, and compiles `gateway` plus `temp1` through `temp8`.

Home-vs-lab work is documented in:

```text
docs/HOME_WORK.md
```

The lab operating procedure and working device map are now in:

```text
docs/OPERATING_PROCEDURE.md
docs/DEVICE_MAP.csv
```

`DEVICE_MAP.csv` includes the known MAC addresses for Temp1 through Temp8 and the gateway, plus columns for physical labels, serial numbers, reactor position, wiring notes, and last verification date.

The local Apps Script source now includes a `doGet` endpoint for dashboard reads:

```text
GET ?mode=dashboard&limit=80
```

This updated `apps_script/Code.gs` still needs to be pasted/deployed in Apps Script before live dashboard mode can read the Google Sheet. The already deployed `doPost` path continues to work for gateway uploads.

Convex is available as a future backend option, but it is not required for dashboard v1 because Google Sheets remains the experiment log. Consider Convex later if the project needs authentication, richer run metadata, faster live state, or long-term experiment review tools.

## Important Caution

Do not flash the wrong board. Use serial-specific flashing where possible.

- Gateway serial: `E4B063AEB72C`
- Temp6 serial: `206EF133A96C`

Do not expose Wi-Fi credentials in chat, docs, or committed public code.

`include/secrets.h` is intentionally ignored by Git. Use `include/secrets.example.h` as the safe template for new machines.
