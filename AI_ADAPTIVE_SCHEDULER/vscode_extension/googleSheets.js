"use strict";

const fs = require("node:fs/promises");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");

const SPREADSHEET_ID = "1xKpFyJ1VccERPuvzAaOzx42uOHD91bkTLbOL4-kuFRM";
const SPREADSHEET_TITLE = "Scheduler Database";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const HEADERS = [
  "NGÀY",
  "THỨ",
  "STT",
  "ICON",
  "CÔNG VIỆC",
  "DESCRIPTION",
  "DURING",
  "CLOCK",
  "MÀU NỀN",
  "ID TASK",
];
const SECONDARY_HEADERS = [
  "NGÀY",
  "THỨ",
  "BUỔI",
  "KHUNG GIỜ",
  "STT",
  "NHÓM",
  "ICON",
  "CÔNG VIỆC",
  "DESCRIPTION",
  "DURING",
  "CLOCK",
  "MÀU NỀN",
  "ID TASK",
];
const SHEETS_EPOCH = Date.UTC(1899, 11, 30);

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body === undefined
      ? null
      : Buffer.from(JSON.stringify(options.body), "utf8");
    const request = https.request(
      url,
      {
        method: options.method || "GET",
        headers: {
          ...(options.headers || {}),
          ...(body
            ? {
                "Content-Type": "application/json",
                "Content-Length": body.length,
              }
            : {}),
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let data = {};
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (error) {
              reject(new Error("Google API returned invalid JSON."));
              return;
            }
          }
          resolve({ status: response.statusCode || 0, data });
        });
      },
    );
    request.setTimeout(30000, () => {
      request.destroy(new Error("Google API request timed out."));
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

function getAuthDirectory() {
  const localAppData = process.env.LOCALAPPDATA;
  return path.join(
    localAppData || path.join(os.homedir(), "AppData", "Local"),
    "AI_Adaptive_SCHEDULER",
  );
}

async function loadOAuthFiles() {
  const authDirectory = getAuthDirectory();
  const credentialsPath = path.join(authDirectory, "credentials.json");
  const tokenPath = path.join(authDirectory, ".google-token.json");
  let credentials;
  let token;
  try {
    [credentials, token] = await Promise.all([
      fs.readFile(credentialsPath, "utf8").then((value) => JSON.parse(value)),
      fs.readFile(tokenPath, "utf8").then((value) => JSON.parse(value)),
    ]);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `Google OAuth files were not found in ${authDirectory}. Complete the one-time setup in GOOGLE_ACCESS_SETUP.md.`,
      );
    }
    throw new Error(`Could not read local Google OAuth files: ${error.message}`);
  }
  const client = credentials.installed || credentials.web;
  if (!client || !client.client_id || !client.client_secret) {
    throw new Error("credentials.json is not a valid Google OAuth client file.");
  }
  if (token.client_id && token.client_id !== client.client_id) {
    throw new Error("The saved Google token belongs to a different OAuth client.");
  }
  const scopes = Array.isArray(token.scopes)
    ? token.scopes
    : String(token.scopes || token.scope || "").split(/[,\s]+/).filter(Boolean);
  if (!scopes.includes(SHEETS_SCOPE)) {
    throw new Error(
      "The saved Google token lacks the Google Sheets scope. Reauthorize once using the documented Google access setup.",
    );
  }
  if (!token.refresh_token) {
    throw new Error(
      "The saved Google token has no refresh token. Reauthorize once using the documented Google access setup.",
    );
  }
  return { client, token, tokenPath };
}

async function saveToken(tokenPath, token) {
  const temporaryPath = `${tokenPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(token, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.rename(temporaryPath, tokenPath);
}

async function refreshAccessToken(auth) {
  const tokenUri = auth.client.token_uri || "https://oauth2.googleapis.com/token";
  const parameters = new URLSearchParams({
    client_id: auth.client.client_id,
    client_secret: auth.client.client_secret,
    refresh_token: auth.token.refresh_token,
    grant_type: "refresh_token",
  });
  const response = await requestForm(tokenUri, parameters.toString());
  if (response.status < 200 || response.status >= 300) {
    const message = response.data.error_description || response.data.error || "unknown error";
    throw new Error(`Google OAuth token refresh failed: ${message}`);
  }
  if (!response.data.access_token || !response.data.expires_in) {
    throw new Error("Google OAuth token refresh returned incomplete data.");
  }
  const updatedToken = {
    ...auth.token,
    token: response.data.access_token,
    token_type: response.data.token_type || auth.token.token_type || "Bearer",
    expiry: new Date(Date.now() + Number(response.data.expires_in) * 1000).toISOString(),
  };
  await saveToken(auth.tokenPath, updatedToken);
  auth.token = updatedToken;
  return updatedToken.token;
}

function requestForm(url, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(body, "utf8");
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": data.length,
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let result = {};
          if (text) {
            try {
              result = JSON.parse(text);
            } catch (error) {
              reject(new Error("Google OAuth returned invalid JSON."));
              return;
            }
          }
          resolve({ status: response.statusCode || 0, data: result });
        });
      },
    );
    request.setTimeout(30000, () => {
      request.destroy(new Error("Google OAuth request timed out."));
    });
    request.on("error", reject);
    request.write(data);
    request.end();
  });
}

async function accessToken(auth, forceRefresh = false) {
  const expiry = Date.parse(auth.token.expiry || "");
  if (
    !forceRefresh &&
    typeof auth.token.token === "string" &&
    Number.isFinite(expiry) &&
    expiry > Date.now() + 60000
  ) {
    return auth.token.token;
  }
  return refreshAccessToken(auth);
}

async function sheetsRequest(auth, resource, options = {}, retry = true) {
  const token = await accessToken(auth);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${resource}`;
  const response = await requestJson(url, {
    method: options.method,
    headers: { Authorization: `Bearer ${token}` },
    body: options.body,
  });
  if (response.status === 401 && retry) {
    await accessToken(auth, true);
    return sheetsRequest(auth, resource, options, false);
  }
  if (response.status < 200 || response.status >= 300) {
    const message =
      response.data.error && response.data.error.message
        ? response.data.error.message
        : `HTTP ${response.status}`;
    throw new Error(`Google Sheets API request failed: ${message}`);
  }
  return response.data;
}

function quoteSheetName(name) {
  return `'${String(name).replace(/'/g, "''")}'`;
}

function toSheetSerial(isoDate) {
  const timestamp = Date.parse(`${isoDate}T00:00:00Z`);
  return (timestamp - SHEETS_EPOCH) / 86400000;
}

function toCellData(row) {
  return row.map((value, index) => {
    if (index === 0) {
      return { userEnteredValue: { numberValue: toSheetSerial(value) } };
    }
    if (typeof value === "number") {
      return { userEnteredValue: { numberValue: value } };
    }
    return { userEnteredValue: { stringValue: String(value) } };
  });
}

function buildBatchUpdateBody(
  sheetId,
  rowCount,
  rows,
  secondaryRowCount = 0,
  secondaryRows = [],
) {
  const rangeRows = Math.max(rowCount, rows.length);
  const secondaryRangeRows = Math.max(secondaryRowCount, secondaryRows.length);
  const requests = [
    {
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 1 + rangeRows,
          startColumnIndex: 0,
          endColumnIndex: HEADERS.length,
        },
        rows: rows.map((row) => ({ values: toCellData(row) })),
        fields: "userEnteredValue",
      },
    },
  ];
  if (secondaryRangeRows > 0) {
    requests.push({
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 1 + secondaryRangeRows,
          startColumnIndex: 12,
          endColumnIndex: 12 + SECONDARY_HEADERS.length,
        },
        rows: secondaryRows.map((row) => ({ values: toCellData(row) })),
        fields: "userEnteredValue",
      },
    });
  }
  return {
    requests,
  };
}

function normalizeValueRow(row, length = HEADERS.length) {
  const normalized = row.slice(0, length);
  while (normalized.length < length) normalized.push("");
  return normalized;
}

function valuesMatch(actual, expected) {
  if (typeof expected === "number" && typeof actual === "number") {
    return Math.abs(actual - expected) < 1e-8;
  }
  return actual === expected;
}

async function writeSchedule(destinationTab, rows, secondaryRows = []) {
  const auth = await loadOAuthFiles();
  const metadataFields =
    "properties(title),sheets(properties(sheetId,title,gridProperties(rowCount)))";
  const metadata = await sheetsRequest(
    auth,
    `?fields=${encodeURIComponent(metadataFields)}`,
  );
  if (metadata.properties.title !== SPREADSHEET_TITLE) {
    throw new Error(
      `Refusing to write: destination workbook title is ${JSON.stringify(metadata.properties.title)}.`,
    );
  }
  const sheets = (metadata.sheets || []).filter(
    (sheet) => sheet.properties.title === destinationTab,
  );
  if (sheets.length !== 1) {
    throw new Error(
      `Expected one existing tab named ${JSON.stringify(destinationTab)} in Scheduler Database; found ${sheets.length}.`,
    );
  }
  const sheet = sheets[0].properties;
  const quotedTab = quoteSheetName(destinationTab);
  const headerRange = `${quotedTab}!A1:J1`;
  const headerResult = await sheetsRequest(
    auth,
    `/values/${encodeURIComponent(headerRange)}?valueRenderOption=FORMATTED_VALUE`,
  );
  const header = (headerResult.values || [])[0] || [];
  if (
    header.length !== HEADERS.length ||
    !HEADERS.every((value, index) => header[index] === value)
  ) {
    throw new Error(
      "Scheduler Database header does not match the required 10-column schema; no data was written.",
    );
  }
  const secondaryHeaderRange = `${quotedTab}!M1:Y1`;
  const secondaryHeaderResult = await sheetsRequest(
    auth,
    `/values/${encodeURIComponent(secondaryHeaderRange)}?valueRenderOption=FORMATTED_VALUE`,
  );
  const secondaryHeader = (secondaryHeaderResult.values || [])[0] || [];
  if (
    secondaryHeader.length !== SECONDARY_HEADERS.length ||
    !SECONDARY_HEADERS.every((value, index) => secondaryHeader[index] === value)
  ) {
    throw new Error(
      "Scheduler Database Secondary Task header does not match the required 13-column schema; no data was written.",
    );
  }
  if (!rows.length || rows.some((row) => row.length !== HEADERS.length)) {
    throw new Error("No task rows or an invalid database row was supplied.");
  }
  if (secondaryRows.some((row) => row.length !== SECONDARY_HEADERS.length)) {
    throw new Error("An invalid Secondary Task database row was supplied.");
  }

  const currentRange = `${quotedTab}!A2:J`;
  const secondaryCurrentRange = `${quotedTab}!M2:Y`;
  const [currentResult, secondaryCurrentResult] = await Promise.all([
    sheetsRequest(
      auth,
      `/values/${encodeURIComponent(currentRange)}?valueRenderOption=UNFORMATTED_VALUE`,
    ),
    sheetsRequest(
      auth,
      `/values/${encodeURIComponent(secondaryCurrentRange)}?valueRenderOption=UNFORMATTED_VALUE`,
    ),
  ]);
  const currentRows = currentResult.values || [];
  const currentSecondaryRows = secondaryCurrentResult.values || [];
  const rowsToUpdate = Math.max(currentRows.length, rows.length);
  const secondaryRowsToUpdate = Math.max(
    currentSecondaryRows.length,
    secondaryRows.length,
  );
  const maxRowsToUpdate = Math.max(rowsToUpdate, secondaryRowsToUpdate);
  if (maxRowsToUpdate + 1 > sheet.gridProperties.rowCount) {
    throw new Error(
      `The target tab has only ${sheet.gridProperties.rowCount} grid rows; refusing to expand or alter its structure.`,
    );
  }

  const requestBody = buildBatchUpdateBody(
    sheet.sheetId,
    currentRows.length,
    rows,
    currentSecondaryRows.length,
    secondaryRows,
  );
  await sheetsRequest(auth, ":batchUpdate", {
    method: "POST",
    body: requestBody,
  });

  const verifyRange = `${quotedTab}!A2:J${rowsToUpdate + 1}`;
  const verifiedResult = await sheetsRequest(
    auth,
    `/values/${encodeURIComponent(verifyRange)}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  const verifiedRows = verifiedResult.values || [];
  for (let index = 0; index < rows.length; index += 1) {
    const actual = normalizeValueRow(verifiedRows[index] || []);
    if (!rows[index].every((value, column) => valuesMatch(actual[column], column === 0
      ? toSheetSerial(value)
      : value))) {
      throw new Error(
        `Google Sheets write verification failed at task row ${index + 2}.`,
      );
    }
  }
  for (let index = rows.length; index < verifiedRows.length; index += 1) {
    if (verifiedRows[index].some((value) => value !== "" && value !== null)) {
      throw new Error(
        `Old task content remains at Scheduler Database row ${index + 2}.`,
      );
    }
  }
  let verifiedSecondaryRows = [];
  if (secondaryRowsToUpdate > 0) {
    const secondaryVerifyRange =
      `${quotedTab}!M2:Y${secondaryRowsToUpdate + 1}`;
    const secondaryVerifiedResult = await sheetsRequest(
      auth,
      `/values/${encodeURIComponent(secondaryVerifyRange)}?valueRenderOption=UNFORMATTED_VALUE`,
    );
    verifiedSecondaryRows = secondaryVerifiedResult.values || [];
  }
  for (let index = 0; index < secondaryRows.length; index += 1) {
    const actual = normalizeValueRow(
      verifiedSecondaryRows[index] || [],
      SECONDARY_HEADERS.length,
    );
    if (!secondaryRows[index].every((value, column) => valuesMatch(
      actual[column],
      column === 0 ? toSheetSerial(value) : value,
    ))) {
      throw new Error(
        `Google Sheets Secondary Task write verification failed at task row ${index + 2}.`,
      );
    }
  }
  for (
    let index = secondaryRows.length;
    index < verifiedSecondaryRows.length;
    index += 1
  ) {
    if (verifiedSecondaryRows[index].some((value) => value !== "" && value !== null)) {
      throw new Error(
        `Old Secondary Task content remains at Scheduler Database row ${index + 2}.`,
      );
    }
  }
  const verifiedHeader = await sheetsRequest(
    auth,
    `/values/${encodeURIComponent(headerRange)}?valueRenderOption=FORMATTED_VALUE`,
  );
  const finalHeader = (verifiedHeader.values || [])[0] || [];
  if (!HEADERS.every((value, index) => finalHeader[index] === value)) {
    throw new Error("The Scheduler Database header changed during import.");
  }
  const finalSecondaryHeaderResult = await sheetsRequest(
    auth,
    `/values/${encodeURIComponent(secondaryHeaderRange)}?valueRenderOption=FORMATTED_VALUE`,
  );
  const finalSecondaryHeader =
    (finalSecondaryHeaderResult.values || [])[0] || [];
  if (!SECONDARY_HEADERS.every(
    (value, index) => finalSecondaryHeader[index] === value,
  )) {
    throw new Error("The Scheduler Database Secondary Task header changed during import.");
  }
  return {
    destinationTab,
    taskCount: rows.length + secondaryRows.length,
    mainTaskCount: rows.length,
    secondaryTaskCount: secondaryRows.length,
    replacedRows: currentRows.length,
    replacedSecondaryRows: currentSecondaryRows.length,
  };
}

module.exports = {
  HEADERS,
  SECONDARY_HEADERS,
  buildBatchUpdateBody,
  writeSchedule,
};
