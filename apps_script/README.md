# Apps Script Deployment

The dashboard live mode needs the Apps Script code in `Code.gs` to be deployed as a web app.

## Deploy

1. Open the Google Sheet that stores the experiment data.
2. Go to `Extensions` -> `Apps Script`.
3. Replace the script content with `apps_script/Code.gs`.
4. Click `Deploy` -> `Manage deployments`.
5. Edit the active web app deployment or create a new deployment.
6. Use:
   - Execute as: `Me`
   - Who has access: `Anyone`
7. Copy the web app URL ending in `/exec`.

## Verify

From the dashboard folder:

```sh
APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" npm run test:backend
```

Expected result:

```text
Apps Script backend contract passed.
```

If it returns HTML or says the response is not JSON, the deployed web app is still running old Apps Script code.

## Sheet Layout

The script manages two sheets:

- `Control`: stores the active `RunID` in `B1` and optional notes in `B2`.
- `Data`: append-only experiment table with `Time`, `RunID`, `Temp1` through `Temp8`, per-channel status, age seconds, packet count, fault fields, and `GatewayStatus`.
- `Runs`: small run-change log written whenever `method=setRun` is used.

Rows are not overwritten. A new experiment is separated by changing `Control!B1` before or during the run.

When the script starts against an older v1 `Data` sheet, it inserts the missing diagnostic columns before `GatewayStatus` and then writes the current header row. Existing old rows are not deleted, and their old `GatewayStatus` values stay under the correct column. New rows use the current `temperature-daq-v2` schema.
