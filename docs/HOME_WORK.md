# Work We Can Do Away From The Hardware

This project can keep moving even when the microcontrollers are not available.

## From Home

- Build and refine the dashboard UI in simulator mode.
- Deploy the dashboard to Vercel once CLI auth or Git integration is fixed.
- Paste/redeploy `apps_script/Code.gs` and run the backend contract test.
- Use `npm run simulate` to send fake experiment rows into the sheet.
- Improve the Google Sheet layout and run naming convention.
- Add GitHub CI and repo hygiene checks.
- Write operating procedures for experiments, startup, shutdown, and troubleshooting.
- Plan the physical board labels and final `TempN` reactor position map.
- Decide the stale-node policy: keep last value, blank it out, or mark it separately.
- Decide whether Google Sheets remains enough or whether Convex becomes the real backend later.

## Needs Hardware

- Flash the remaining thermocouple nodes.
- Confirm each board serial number and MAC address.
- Verify each MAX31855/amplifier wiring path.
- Confirm the gateway receives each node as the correct `TempN`.
- Confirm each powered node appears as `OK` in the Google Sheet and dashboard.
- Label each physical board and thermocouple circuit.
- Test behavior when one node is off, stale, disconnected, or faulting.
- Test reactor-adjacent range and power reliability.

## Best Next Session

1. Redeploy `apps_script/Code.gs`.
2. Run:

   ```sh
   cd /Users/peterzokoro/Downloads/PlatformIO-ReactorCore/reactor_temperature_daq/dashboard
   APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" npm run test:backend
   ```

3. If the backend contract passes, configure `VITE_APPS_SCRIPT_URL` locally and on Vercel.
4. When the boards are available, flash and verify `temp1` through `temp8` one at a time.
