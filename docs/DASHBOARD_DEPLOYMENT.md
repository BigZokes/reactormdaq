# Dashboard Deployment

This dashboard is a Vite React app in:

```text
dashboard
```

It can run in simulator mode without hardware. Live mode needs the Google Apps Script web app URL set as a Vercel environment variable.

## Required Environment Variable

Set this in the Vercel project:

```text
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Optional:

```text
VITE_POLL_INTERVAL_MS=5000
```

Do not commit real deployment URLs to the repo.

## Git Import Deployment

1. Import the GitHub repo into Vercel.
2. Set the root directory to:

```text
dashboard
```

3. Use these build settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm ci
```

4. Add `VITE_APPS_SCRIPT_URL` in Vercel project settings.
5. Deploy a preview first, confirm simulator mode loads, then confirm live mode after the Apps Script URL is configured.

## CLI Deployment From This Mac

From the dashboard folder:

```sh
cd /Users/peterzokoro/Downloads/PlatformIO-ReactorCore/reactor_temperature_daq/dashboard
npx vercel login
npx vercel link
npx vercel env add VITE_APPS_SCRIPT_URL
npm run build
npx vercel deploy
```

For production:

```sh
npx vercel deploy --prod
```

Current note: the local CLI was not authenticated during the last Codex run, so deployment stopped at login. The Vercel account connector could list projects, but local deployment still needs CLI auth or Git import.

## Manual GitHub Action Deployment

The repo includes a manual workflow:

```text
.github/workflows/vercel-dashboard.yml
```

Before using it, add these GitHub repository secrets:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Then run the workflow from GitHub Actions and choose `preview` or `production`.

Use this route after the Vercel project exists. It is intentionally manual so normal firmware/dashboard CI does not fail just because Vercel secrets are not configured yet.

## Quick Checks After Deployment

- Page loads without a blank screen.
- Simulator mode works if no Apps Script URL is configured.
- Live mode appears when `VITE_APPS_SCRIPT_URL` is configured.
- Current run input can update the Apps Script `Control!B1`.
- Sensor tiles show temperature, status, age, packet count, and fault.
