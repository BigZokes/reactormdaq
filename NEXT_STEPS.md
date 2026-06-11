# Reactor Temperature DAQ Next Steps

Saved: 2026-06-08 22:11 CDT

## Current Working State

- Project folder: `/Users/peterzokoro/Downloads/PlatformIO-ReactorCore/reactor_temperature_daq`
- Gateway firmware is flashed and working on the central Arduino Nano ESP32.
- Gateway currently uses the deployed Apps Script web app:
  - `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`
- Temp6 node is working:
  - MAC: `20:6E:F1:33:A9:6C`
  - Last verified value: about `24.25 C`
- Gateway receives Temp6 over ESP-NOW and uploads to Google Sheets.
- Upload payload now includes:
  - `Temp1` through `Temp8`
  - `Temp1_Status` through `Temp8_Status`
  - `Temp1_AgeSec` / `Temp1_Packets` / `Temp1_Fault` through `Temp8_*`
  - `GatewayStatus`
- Missing thermocouples are marked as `MISSING` instead of blocking the whole row.
- The spreadsheet Apps Script now supports:
  - `Control` sheet with `CurrentRunID` in `B1`
  - `Data` sheet as the main append-only experiment table
  - `RunID` on every row so separate experiments do not overwrite each other
- Important: the local repo source supports the dashboard read API, but the Google Apps Script editor was verified on 2026-06-09 to still contain an older script missing `doGet`. Paste/deploy `apps_script/Code.gs` before expecting live dashboard mode to work.

## Tomorrow Priority

1. Update and test the remaining thermocouple nodes.
   - Use `docs/THERMOCOUPLE_UPDATE_WORKFLOW.md` as the hardware-only execution log.
   - Confirm each node's MAC address.
   - Flash each node with the shared `tc_node.cpp` firmware using its correct `NODE_ID`.
   - Confirm the gateway receives each node as the correct `TempN`.
   - Verify Google Sheets rows show `OK` for active nodes and `MISSING` or `STALE` for inactive nodes.

2. Build a clean device map.
   - Physical label on each Arduino/thermocouple circuit.
   - MAC address.
   - `TempN` assignment.
   - Reactor position.
   - Notes about wiring/amplifier behavior.
   - Use `docs/DEVICE_MAP.csv` as the working table.

3. Improve fault handling.
   - Distinguish disconnected thermocouple amplifier faults from powered-off nodes.
   - Decide stale timeout behavior for experiment logging.
   - Consider adding packet counters, last-seen age, and maybe RSSI if available.
   - Packet counters, last-seen age, and MAX31855 fault fields are now in the v2 schema; verify them on real hardware.

4. Tighten experiment workflow.
   - Before each run, set `Control!B1` to a run name like `EXP-2026-06-09-A`.
   - Confirm all expected thermocouples are `OK`.
   - Keep all data in the `Data` sheet and filter by `RunID`.
   - Follow `docs/OPERATING_PROCEDURE.md` for startup, troubleshooting, and shutdown.

## Web App Idea

Build a small dashboard that can be deployed to Vercel or similar.

Useful first version:

- Live table for `Temp1` through `Temp8`.
- Status indicators: `OK`, `MISSING`, `STALE`, `FAULT`.
- Current `RunID`.
- Last update time.
- Simple line chart for temperature history.
- Big visual warning if a thermocouple stops reporting during a run.

Possible architecture:

- Google Sheets remains the experiment log.
- Apps Script exposes a read endpoint for latest rows/status.
- Vercel web app polls every 5 seconds.
- Later, move from polling to a proper database/API if the system grows.

Deployment note:

- GitHub is authenticated and the draft PR is live.
- The Vercel account connector can see the team, but the local Vercel CLI is not authenticated yet.
- The live Apps Script endpoint must pass `node scripts/preflight.mjs` or `npm run test:backend` before the Vercel dashboard can show real sheet data.
- To deploy from this Mac, run the deploy from the `dashboard` folder after Vercel CLI login/linking.
- Detailed deployment steps and the manual GitHub Actions deploy workflow are in `docs/DASHBOARD_DEPLOYMENT.md`.

## Commands Used Recently

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
