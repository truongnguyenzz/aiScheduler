// Legacy Python HTTPS integration. The current no-hosting web app is in
// apps_script_web/; do not use this file for the selected pilot.
const SOURCE_TAB_NAME = "TUẦN";
const DATABASE_MENU = "Scheduler Database";
const SCRIPT_PROPERTY_ENDPOINT = "SCHEDULER_HTTPS_ENDPOINT";
const SCRIPT_PROPERTY_HMAC_SECRET = "SCHEDULER_HMAC_SECRET";
const MAX_MASTER_ROWS = 10000;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(DATABASE_MENU)
    .addItem("Preview chuẩn hóa", "previewNormalization")
    .addItem("Ghi vào Scheduler Database", "normalizeIntoDatabase")
    .addToUi();
}

function previewNormalization() {
  callNormalizer_("preview");
}

function normalizeIntoDatabase() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert(
    "Ghi dữ liệu tuần",
    "Thao tác sẽ thay snapshot dữ liệu trong tab tuần tương ứng của Scheduler Database. Tiếp tục?",
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;
  callNormalizer_("commit");
}

function callNormalizer_(mode) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) {
    throw new Error("Một lần chuẩn hóa khác đang chạy. Vui lòng thử lại sau.");
  }
  try {
    const properties = PropertiesService.getScriptProperties();
    const endpoint = properties.getProperty(SCRIPT_PROPERTY_ENDPOINT);
    const secret = properties.getProperty(SCRIPT_PROPERTY_HMAC_SECRET);
    if (!endpoint || !secret) {
      throw new Error(
        "Thiếu SCHEDULER_HTTPS_ENDPOINT hoặc SCHEDULER_HMAC_SECRET trong Script Properties."
      );
    }

    const payload = buildSourcePayload_();
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = Utilities.getUuid();
    const signedContent = timestamp + "\n" + nonce + "\n" + body;
    const signatureBytes = Utilities.computeHmacSha256Signature(
      signedContent,
      secret
    );
    const signature = signatureBytes
      .map(function (byte) {
        return ("0" + ((byte + 256) % 256).toString(16)).slice(-2);
      })
      .join("");

    const url = endpoint.replace(/\/+$/, "") + "/v1/normalize?mode=" + mode;
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: body,
      headers: {
        "X-Scheduler-Timestamp": timestamp,
        "X-Scheduler-Nonce": nonce,
        "X-Scheduler-Signature": signature,
      },
      muteHttpExceptions: true,
    });
    const status = response.getResponseCode();
    const text = response.getContentText();
    let result;
    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new Error("HTTPS service trả về nội dung không phải JSON.");
    }
    if (status < 200 || status >= 300) {
      throw new Error(result.error || "HTTPS service trả lỗi HTTP " + status);
    }

    const message =
      "Trạng thái: " +
      result.status +
      "\nTab tuần: " +
      result.destination_tab +
      "\nSố task: " +
      result.task_count +
      "\nTask chưa có CLOCK: " +
      result.unassigned_clock_count;
    SpreadsheetApp.getUi().alert(message);
  } finally {
    lock.releaseLock();
  }
}

function buildSourcePayload_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = spreadsheet.getSheetByName(SOURCE_TAB_NAME);
  if (!sourceSheet) {
    throw new Error("Không tìm thấy tab nguồn " + SOURCE_TAB_NAME + ".");
  }
  const timezone = spreadsheet.getSpreadsheetTimeZone();

  const readyDateValues = sourceSheet.getRange("M16:M22").getValues();
  const readyDateDisplays = sourceSheet.getRange("M16:M22").getDisplayValues();
  const readyTaskValues = sourceSheet.getRange("O16:AK22").getValues();
  const readyTaskDisplays = sourceSheet.getRange("O16:AK22").getDisplayValues();
  const readyRows = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const sourceRow = dayIndex + 16;
    const dateValue = readyDateValues[dayIndex][0];
    const dateDisplay = readyDateDisplays[dayIndex][0];
    const tasks = [];
    for (let offset = 0; offset <= 22; offset += 2) {
      const taskName = String(readyTaskDisplays[dayIndex][offset] || "").trim();
      if (!taskName) continue;
      const sourceColumn = 15 + offset;
      tasks.push({
        cell: columnToLetter_(sourceColumn) + sourceRow,
        name: taskName,
      });
    }
    readyRows.push({
      row_number: sourceRow,
      date: serializeDate_(dateValue, dateDisplay, timezone),
      tasks: tasks,
    });
  }

  const lastRow = sourceSheet.getLastRow();
  if (lastRow < 3) throw new Error("MASTER DATABASE không có task.");
  const masterRowCount = lastRow - 2;
  if (masterRowCount > MAX_MASTER_ROWS) {
    throw new Error(
      "MASTER vượt quá " + MAX_MASTER_ROWS + " dòng; dừng để tránh gửi payload quá lớn."
    );
  }
  const masterRange = sourceSheet.getRange(3, 1, masterRowCount, 9);
  const masterValues = masterRange.getValues();
  const masterDisplays = masterRange.getDisplayValues();
  const masterRows = [];
  let inheritedGroup = "";

  for (let index = 0; index < masterValues.length; index++) {
    const rowValues = masterValues[index];
    const rowDisplays = masterDisplays[index];
    const groupValue = String(rowDisplays[0] || "").trim();
    if (groupValue) inheritedGroup = groupValue;
    const taskName = String(rowDisplays[2] || "").trim();
    if (!taskName) continue;

    const serialized = rowValues.map(function (value, columnIndex) {
      if (columnIndex === 0) return inheritedGroup;
      if (columnIndex === 8) return serializeTime_(value, rowDisplays[8], timezone);
      if (columnIndex === 6 || columnIndex === 4 || columnIndex === 5) {
        return value === "" || value === null ? rowDisplays[columnIndex] : value;
      }
      if (value instanceof Date) {
        return Utilities.formatDate(value, timezone, "yyyy-MM-dd'T'HH:mm:ss");
      }
      return value === "" || value === null
        ? rowDisplays[columnIndex]
        : value;
    });
    masterRows.push({
      row_number: index + 3,
      values: serialized,
    });
  }

  return {
    source_spreadsheet_id: spreadsheet.getId(),
    source_sheet_name: SOURCE_TAB_NAME,
    source_timezone: timezone,
    ready_rows: readyRows,
    master_rows: masterRows,
  };
}

function serializeDate_(value, displayValue, timezone) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, "yyyy-MM-dd");
  }
  return String(displayValue || value || "").trim();
}

function serializeTime_(value, displayValue, timezone) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, "HH:mm");
  }
  if (typeof value === "number") return value;
  return String(displayValue || value || "").trim();
}

function columnToLetter_(column) {
  let result = "";
  let value = column;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}
