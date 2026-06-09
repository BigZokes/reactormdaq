# Temperature DAQ Operating Procedure

This procedure is for temperature-only reactor experiments using the gateway plus thermocouple nodes.

## Before The Experiment

1. Open the Google Sheet and confirm the Apps Script deployment is the current `apps_script/Code.gs`.
2. From `dashboard/`, run the backend contract test:

   ```sh
   APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" npm run test:backend
   ```

   The current Apps Script can migrate an older v1 `Data` sheet by inserting the v2 diagnostic columns before `GatewayStatus`. It should not delete existing rows.

3. Set a run name, for example `EXP-2026-06-09-A`, using one of:
   - the dashboard run-control input in live mode
   - `Control!B1` in the Google Sheet
   - `npm run test:backend` or `npm run simulate` for test-only runs
4. Power the gateway first.
5. Power each thermocouple node one at a time and confirm the dashboard or sheet shows that channel as `OK`.
6. Fill in or verify `docs/DEVICE_MAP.csv` for every physical board.

## During The Experiment

- Keep the dashboard open in live mode.
- Treat `OK` as usable data.
- Treat `MISSING` as no packet received since gateway boot.
- Treat `STALE` as the node reported earlier but stopped reporting for the configured timeout.
- Treat `FAULT` as the node reported a thermocouple/MAX31855 fault or invalid temperature.
- Use the tile diagnostics to compare last packet age and packet count. A rising age with a fixed packet count means communication stopped.
- If one channel fails, continue logging the other channels; the gateway is designed to write partial rows.

## If A Channel Is Bad

1. Check the physical switch and power source for that node.
2. Check the thermocouple wiring into the MAX31855 board.
3. If available, connect the node to USB and open serial monitor at `115200`.
4. Look for:
   - `Thermocouple fault: OPEN`
   - `Thermocouple fault: SHORT_GND`
   - `Thermocouple fault: SHORT_VCC`
   - `ESP-NOW send ... failed`
5. Confirm the gateway serial monitor logs `RX ... TempN`.
6. Check the dashboard or `Data` sheet diagnostic columns:
   - `TempN_AgeSec`
   - `TempN_Packets`
   - `TempN_Fault`
7. If the wrong `TempN` appears, reflash the node using the correct PlatformIO environment.

## Flashing A Node

Build all firmware:

```sh
pio run -e gateway -e temp1 -e temp2 -e temp3 -e temp4 -e temp5 -e temp6 -e temp7 -e temp8
```

Flash only the target node environment:

```sh
pio run -e temp6 -t upload
```

Safer helper flow:

```sh
node scripts/flash-device.mjs --list
node scripts/flash-device.mjs --env temp6 --dry-run
node scripts/flash-device.mjs --env temp6 --upload
```

If the board serial is not filled in yet in `docs/DEVICE_MAP.csv`, pass the port explicitly:

```sh
node scripts/flash-device.mjs --env temp1 --port /dev/cu.usbmodemXXXXXXXXXXXX2 --upload
```

Use the environment that matches the intended thermocouple channel. Do not flash a board until its physical label, MAC, and intended `TempN` are clear.

## After The Experiment

1. Confirm the final rows use the intended `RunID`.
2. Filter the `Data` sheet by `RunID` for analysis.
3. Record any channel faults or wiring changes in `docs/DEVICE_MAP.csv`.
4. Save notes about the run in the Google Sheet `Runs` sheet or lab notebook.
