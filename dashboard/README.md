# Reactor Temperature Dashboard

This is the from-home web app for the reactor thermocouple DAQ system. It can run without microcontrollers by using built-in simulator data, and it can switch to live Google Sheets data after the Apps Script `doGet` endpoint is deployed.

## What It Shows

- Current `RunID`
- Gateway status
- Backend/schema status
- `Temp1` through `Temp8`
- Status badges: `OK`, `MISSING`, `STALE`, `FAULT`, `UNKNOWN`
- Per-channel diagnostics: last packet age, packet count, and thermocouple fault
- Last update time
- Temperature history chart
- Recent samples table
- Run-control input for setting the current run

## Local Development

```sh
cd /Users/peterzokoro/Downloads/PlatformIO-ReactorCore/reactor_temperature_daq/dashboard
npm install
npm run dev
```

Open:

```text
http://localhost:5173/
```

If no live endpoint is configured, the dashboard starts in simulator mode.

## Enable Live Mode

Create a local `.env` file:

```sh
cp .env.example .env
```

Set:

```text
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
VITE_POLL_INTERVAL_MS=5000
```

Then restart:

```sh
npm run dev
```

## Apps Script Requirement

The dashboard live mode expects the Apps Script web app to support:

```text
GET ?mode=dashboard&limit=80
POST {"method":"setRun","RunID":"EXP-2026-06-09-A"}
```

The live dashboard also expects the endpoint to report:

```text
schemaVersion = temperature-daq-v2
```

If the deployed Apps Script is older or missing that schema version, live mode falls back to simulator mode and shows a redeploy warning.

The local Apps Script source with this support is:

```text
../apps_script/Code.gs
```

Paste/deploy that script in Apps Script before expecting live mode to work.

In simulator mode, the run-control input only changes local simulated data. In live mode, it updates `Control!B1` in the Google Sheet through Apps Script.

## Simulator Uploads

You can also push fake rows into the Google Sheet through the existing `doPost` endpoint:

```sh
APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" npm run simulate
```

Optional controls:

```sh
RUN_ID=SIM-CLI-TEST SAMPLES=20 DELAY_MS=1000 APPS_SCRIPT_URL="..." npm run simulate
```

By default, the simulator first sends `method=setRun`, so the fake rows land under the `RUN_ID` you supplied. To skip that and only append rows:

```sh
SET_RUN=0 APPS_SCRIPT_URL="..." npm run simulate
```

## Backend Contract Test

After pasting/deploying `../apps_script/Code.gs`, run:

```sh
APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" npm run test:backend
```

This checks:

- `GET ?mode=health`
- `POST method=setRun`
- `GET ?mode=dashboard`
- `POST method=append`
- that the appended row is readable by the dashboard endpoint
- that the deployed script reports the current `temperature-daq-v2` schema
- that per-channel diagnostics round-trip through the sheet

If this fails with a non-JSON response, the deployed Apps Script is probably still the older version and needs to be redeployed.

## Vercel Deployment

Detailed deployment notes are in:

```text
../docs/DASHBOARD_DEPLOYMENT.md
```

From this `dashboard` folder:

```sh
npm run build
npx vercel deploy
```

For production:

```sh
npx vercel deploy --prod
```

In Vercel project settings, add this environment variable when the Apps Script `doGet` endpoint is deployed:

```text
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Last local deploy attempt:

```text
npx vercel --yes
```

Result:

```text
Error: The specified token is not valid. Use `vercel login` to generate a new token.
```

So the app is build-ready, but this Mac needs a fresh Vercel login before CLI deployment works.

For Git-based Vercel deployment, import the GitHub repo and set the project root directory to:

```text
dashboard
```

Then set:

```text
Build Command: npm run build
Output Directory: dist
Install Command: npm ci
```

## Convex Note

Convex is not required for v1 because Google Sheets is already the experiment log and Apps Script is enough for read/write endpoints. Convex becomes useful if we want:

- authenticated users
- richer run metadata
- faster live queries
- long-term experiment history outside Sheets
- annotations, comments, and run review workflows
