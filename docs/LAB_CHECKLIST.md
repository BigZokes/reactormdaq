# Lab Checklist

Use this when you are back with the boards. The goal is to update and verify one board at a time without accidentally flashing the wrong channel.

## Start Of Session

1. Pull the latest code or confirm this folder is current:

   ```sh
   cd /Users/peterzokoro/Downloads/PlatformIO-ReactorCore/reactor_temperature_daq
   git status --short
   node scripts/check-repo.mjs
   node scripts/preflight.mjs
   ```

2. Paste and deploy `apps_script/Code.gs` in Google Apps Script.
3. Confirm the backend has the dashboard read endpoint:

   ```sh
   cd dashboard
   APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" npm run test:backend
   cd ..
   APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" node scripts/preflight.mjs
   ```

4. Open the Google Sheet and dashboard.
5. Power the gateway first.

## For Each Thermocouple Board

1. Plug exactly one board into USB.
2. List ports:

   ```sh
   node scripts/flash-device.mjs --ports
   ```

3. If the board serial is not in `docs/DEVICE_MAP.csv`, record it:

   ```sh
   node scripts/flash-device.mjs --env temp1 --set-serial 206EF133B55C
   node scripts/flash-device.mjs --env temp1 --set-serial 206EF133B55C --write
   ```

4. Dry-run the flash command:

   ```sh
   node scripts/flash-device.mjs --env temp1 --dry-run
   ```

5. Flash only after the physical board label matches the intended channel:

   ```sh
   node scripts/flash-device.mjs --env temp1 --upload
   ```

6. Open serial monitor:

   ```sh
   node scripts/monitor-device.mjs --env temp1 --monitor
   ```

7. Power the board from its reactor circuit and confirm the sheet/dashboard shows that `TempN` as `OK`.
8. Update `docs/DEVICE_MAP.csv` status, physical label, reactor position, wiring notes, and last verified date.

## Stop Rules

- Stop if two boards appear on USB at the same time and you are unsure which one is which.
- Stop if the serial monitor identity does not match the intended `TempN`.
- Stop if Apps Script contract test fails; the dashboard will fall back to simulator mode until `doGet` is deployed.
- Stop if a thermocouple reports `OPEN`, `SHORT_GND`, or `SHORT_VCC`; fix wiring before trusting that channel.

## End Of Session

1. Run:

   ```sh
   node scripts/check-repo.mjs
   ```

2. Commit the updated device map and notes.
3. Leave the Google Sheet filtered or grouped by the final run ID.
