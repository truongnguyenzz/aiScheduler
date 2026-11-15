# Legacy: Python HTTPS service (superseded)

> **Do not use these Cloud Run deployment instructions for the current pilot.**
> The selected design is the Google Apps Script Web App in
> [`APPS_SCRIPT_WEB_APP_SETUP.md`](./APPS_SCRIPT_WEB_APP_SETUP.md). No Cloud Run
> deployment or billing is required for that approach. This file is retained as
> historical setup material only.

## Current scope

This service receives source data read by Apps Script, validates and normalizes
Main Tasks, then writes a weekly snapshot to the test `Scheduler Database`.
It does not read or modify the source workbook and does not write to Calendar.
The source is allowlisted to the test workbook during the pilot.

The Cloud Run endpoint is publicly reachable over HTTPS but requires a
timestamped HMAC signature. Do not remove the signature check or place the
shared secret in source code or a Sheet cell.

## Fixed test resources

- Google Cloud Project ID: `ai-adaptive-scheduler-test`
- Google Cloud Project Number: `1021031950464`
- Source test spreadsheet: `1S8ev72pAVVSWEruT7zPziOr954VyiLxPEkFL1sZB01I`
- Source tab: `TUẦN`
- Destination test spreadsheet: `1xKpFyJ1VccERPuvzAaOzx42uOHD91bkTLbOL4-kuFRM`
- Destination workbook title: `Scheduler Database`
- Destination tab: computed from dates in `TUẦN!M16:M22`, reused for the same
  week
- Destination columns: `NGÀY`, `THỨ`, `STT`, `ICON`, `CÔNG VIỆC`, `DESCRIPTION`,
  `DURING`, `CLOCK`, `MÀU NỀN`, `ID TASK`

The source mapping is based on `CHUẨN HOÁ DATABASE.md`; it is not asserted to be
byte-for-byte compatible with SMART CALENDAR SYNC V3.2. `ID TASK` is a stable
internal ID, not a verified V3.2 `SCV2_ID`.

Durations retain their decimal-hour value in `DURING`. For `CLOCK`, the
duration is converted to the nearest second so a value such as `1,67` hours
produces an exact 1 hour, 40 minute, 12 second interval. Seconds are included
in the `CLOCK` string only when nonzero.

A read-only normalization dry run on the supplied test source produced 53 Main
Task rows for `09/11 - 15/11/ 2026`; 40 had no MASTER Start Time and therefore
have blank `CLOCK` values. No row was written to Scheduler Database.

## Deploy prerequisites

1. Google Cloud SDK is installed locally.
2. The signed-in Google account can administer Cloud Run, enable APIs, create a
   service account, and use the enabled billing project.
3. Share the destination test spreadsheet with the Cloud Run service account
   as **Editor**. Do not share source workbooks with it; Apps Script reads the
   source using the user's Google account.
4. The destination tab's `A1:J1` headers match the fixed schema exactly.

PowerShell commands below should be run from the project root. They use the
test-only IDs above; do not replace them with production resources during the
pilot.

## 1. Authenticate and select the project

```powershell
gcloud auth login
gcloud config set project ai-adaptive-scheduler-test
gcloud projects describe ai-adaptive-scheduler-test
```

The project ID must exist and be accessible to the signed-in account. If the
last command fails, stop and resolve project access before proceeding.
The project number is not the project ID. The supplied project number resolved
to the ID above.

## 2. Enable required APIs and create the runtime identity

```powershell
$Project = "ai-adaptive-scheduler-test"
$Region = "asia-southeast1"
$ServiceAccountName = "scheduler-ingest"
$ServiceAccount = "$ServiceAccountName@$Project.iam.gserviceaccount.com"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com sheets.googleapis.com --project $Project
gcloud iam service-accounts create $ServiceAccountName --display-name "Scheduler Database test writer" --project $Project
```

Open the destination test spreadsheet's **Share** dialog and grant
`$ServiceAccount` **Editor** access. This gives the service account edit access
to that workbook, so keep this identity and workbook limited to testing.

## 3. Create the HMAC secret

Generate and store the secret outside the project/OneDrive:

```powershell
$AuthFolder = Join-Path $env:LOCALAPPDATA "AI_Adaptive_SCHEDULER"
New-Item -ItemType Directory -Force $AuthFolder | Out-Null
$SecretPath = Join-Path $AuthFolder "scheduler-ingest-hmac.txt"
$Random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$Bytes = New-Object byte[] 32
$Random.GetBytes($Bytes)
$Secret = [Convert]::ToBase64String($Bytes)
[System.IO.File]::WriteAllText($SecretPath, $Secret, [System.Text.Encoding]::ASCII)
gcloud secrets create scheduler-ingest-hmac --data-file=$SecretPath --project $Project
gcloud secrets add-iam-policy-binding scheduler-ingest-hmac --member="serviceAccount:$ServiceAccount" --role="roles/secretmanager.secretAccessor" --project $Project
```

Keep the secret local. It will also be entered into the Apps Script project's
Script Properties in step 6. Do not paste it into chat or commit it.

## 4. Deploy the test service

```powershell
gcloud run deploy scheduler-normalizer --source . --region $Region --project $Project --service-account $ServiceAccount --allow-unauthenticated --max 1 --concurrency 1 --memory 512Mi --cpu 1 --timeout 120 --set-env-vars "SCHEDULER_DATABASE_ID=1xKpFyJ1VccERPuvzAaOzx42uOHD91bkTLbOL4-kuFRM,ALLOWED_SOURCE_SPREADSHEET_IDS=1S8ev72pAVVSWEruT7zPziOr954VyiLxPEkFL1sZB01I" --set-secrets "INGEST_HMAC_SECRET=scheduler-ingest-hmac:latest"
gcloud run services describe scheduler-normalizer --region $Region --project $Project --format="value(status.url)"
```

`--allow-unauthenticated` makes the HTTPS URL callable from Apps Script; the
service still rejects requests without the HMAC signature. The Cloud Run
instance limit is one and scales to zero while idle, but Google Cloud usage may
still incur charges according to the project's pricing and usage.

Check the deployment before wiring the Sheet:

```powershell
$ServiceUrl = gcloud run services describe scheduler-normalizer --region $Region --project $Project --format="value(status.url)"
Invoke-RestMethod "$ServiceUrl/health"
```

Expected response:

```json
{"status":"ok"}
```

## 5. Add Apps Script to the source test workbook

1. Open the source test spreadsheet and choose **Extensions → Apps Script**.
2. Replace the editor contents with `apps_script/Code.gs` from this project and
   save.
3. In Apps Script **Project Settings → Script Properties**, add:
   - `SCHEDULER_HTTPS_ENDPOINT` = the Cloud Run URL from step 4, without a
     trailing slash.
   - `SCHEDULER_HMAC_SECRET` = the value in
     `%LOCALAPPDATA%\AI_Adaptive_SCHEDULER\scheduler-ingest-hmac.txt`.
4. Reload the spreadsheet. The `Scheduler Database` menu should appear.
5. Select **Preview chuẩn hóa** first. Confirm the week, task count, and
   unassigned-clock count.
6. Only after the preview is correct, select **Ghi vào Scheduler Database**.
   This replaces the task snapshot in the matching weekly tab, preserves the
   header row and formatting, and leaves Calendar untouched.

Assign `normalizeIntoDatabase` to a drawing/button if a button is preferred;
the menu is available without a drawing.

## 6. Validation and cleanup

Local tests:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s .\tests -v
```

The preview reports only aggregate counts in the Sheet UI; task content is
written only after explicit confirmation. Invalid task links, duplicate
normalized MASTER names, invalid durations, malformed dates, or unsupported
overnight tasks stop the operation before the destination is changed.

To delete the test Cloud Run service when finished:

```powershell
gcloud run services delete scheduler-normalizer --region asia-southeast1 --project ai-adaptive-scheduler-test
```

This deletes the service, not the test spreadsheets. Remove the shared secret
from Apps Script Script Properties and delete the test service account/secret
only after confirming they are no longer needed.
