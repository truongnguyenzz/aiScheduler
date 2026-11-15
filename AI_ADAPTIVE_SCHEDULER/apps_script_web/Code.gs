// Bump this value before each Web App deployment.
const APP_VERSION = "2026.11.14.8";
const TEST_SOURCE_SPREADSHEET_ID =
  "1S8ev72pAVVSWEruT7zPziOr954VyiLxPEkFL1sZB01I";
const DATABASE_SPREADSHEET_ID =
  "1xKpFyJ1VccERPuvzAaOzx42uOHD91bkTLbOL4-kuFRM";
const DATABASE_SPREADSHEET_TITLE = "Scheduler Database";
const TEST_CALENDAR_TITLE = "AI Scheduler API TEST";
const SOURCE_TAB_NAME = "TUẦN";
const DATABASE_HEADERS = [
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
const SECONDARY_DATABASE_HEADERS = [
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
const WEEKDAYS_VI = [
  "THỨ HAI",
  "THỨ BA",
  "THỨ TƯ",
  "THỨ NĂM",
  "THỨ SÁU",
  "THỨ BẢY",
  "CHỦ NHẬT",
];
const LAST_WRITTEN_TAB_PROPERTY = "SCHEDULER_LAST_WRITTEN_TAB";
const MAX_MASTER_ROWS = 10000;
const EVENT_TAG_SOURCE = "adaptiveSchedulerTest";
const TRANSFER_SCHEMA_VERSION = 4;
const SECONDARY_COLOR = "MÀU HOA ANH ĐÀO";
const SECONDARY_GROUP_ICONS = {
  "VỆ SINH": "💦",
  "VẬN ĐỘNG": "💪",
  "TIN TỨC": "🌏",
  "SINH HOẠT": "⛅️",
};
const DEFAULT_DAY_START = "07:30";
const DEFAULT_BREAK_MINUTES = 15;
const DEFAULT_SLEEP_START = "03:00";
const DEFAULT_SLEEP_DURATION_HOURS = 5;

function doGet() {
  const template = HtmlService.createTemplateFromFile("Index");
  template.appVersion = APP_VERSION;
  return template.evaluate()
    .setTitle("Scheduler Control");
}

function getUiConfig() {
  return {
    defaultSourceId: TEST_SOURCE_SPREADSHEET_ID,
    databaseTitle: DATABASE_SPREADSHEET_TITLE,
    calendarTitle: TEST_CALENDAR_TITLE,
    defaultStartTime: DEFAULT_DAY_START,
    defaultBreakMinutes: DEFAULT_BREAK_MINUTES,
    sleepStartTime: DEFAULT_SLEEP_START,
    sleepDurationHours: DEFAULT_SLEEP_DURATION_HOURS,
    lastWrittenTab:
      PropertiesService.getScriptProperties().getProperty(
        LAST_WRITTEN_TAB_PROPERTY
      ) || "",
  };
}

function previewNormalization(sourceInput, settingsInput) {
  const settings = normalizeScheduleSettings_(settingsInput);
  const result = normalizeSourceSpreadsheet_(sourceInput, settings);
  return {
    sourceTitle: result.source_title,
    sourceId: result.source_spreadsheet_id,
    destinationTab: result.destination_tab,
    taskCount: result.task_count,
    mainTaskCount: result.main_task_count,
    secondaryTaskCount: result.secondary_task_count,
    sleepTaskCount: result.sleep_task_count,
    unassignedClockCount: result.unassigned_clock_count,
    flexibleTaskCount: result.flexible_task_count,
    reducedTaskCount: result.reduced_task_count,
    scheduleSettings: settings,
    fingerprint: normalizationFingerprint_(result, settings),
    taskModes: result.task_modes,
    taskOriginalDurations: result.task_original_durations,
    scheduleWarnings: result.schedule_warnings,
    rows: result.rows,
    secondaryRows: result.secondary_rows,
    previewItems: result.preview_items,
  };
}

function exportNormalizationData(sourceInput, settingsInput) {
  const settings = normalizeScheduleSettings_(settingsInput);
  const result = normalizeSourceSpreadsheet_(
    sourceInput,
    settings,
    { transferMode: true }
  );
  const transfer = {
    format: "AI_ADAPTIVE_SCHEDULER_TRANSFER",
    schema_version: TRANSFER_SCHEMA_VERSION,
    kind: "normalized_input",
    source: {
      spreadsheet_id: result.source_spreadsheet_id,
      spreadsheet_title: result.source_title,
      source_tab: SOURCE_TAB_NAME,
      destination_tab: result.destination_tab,
      week_start: result.week_start,
      week_end: result.week_end,
    },
    schedule_settings: settings,
    tasks: result.transfer_tasks,
    secondary_tasks: result.transfer_secondary_tasks,
    scheduling_warnings: result.schedule_warnings,
  };
  transfer.source_fingerprint = transferSourceFingerprint_(transfer);
  validateNormalizationTransfer_(transfer);
  return transfer;
}

function writeDatabaseSnapshot(sourceInput, expectedFingerprint, settingsInput) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const settings = normalizeScheduleSettings_(settingsInput);
    const result = normalizeSourceSpreadsheet_(sourceInput, settings);
    if (result.schedule_warnings.length) {
      throw new Error(
        "Bản xem trước có " + result.schedule_warnings.length +
          " cảnh báo chồng lấn/không thể xếp hết task. Hãy xem và tải JSON để điều chỉnh; chưa ghi snapshot vào Scheduler Database."
      );
    }
    const fingerprint = normalizationFingerprint_(result, settings);
    if (!expectedFingerprint || expectedFingerprint !== fingerprint) {
      throw new Error(
        "Dữ liệu nguồn đã thay đổi sau preview. Hãy preview lại trước khi ghi."
      );
    }
    const database = openDatabase_();
    const sheet = getOrCreateDatabaseTab_(database, result.destination_tab);
    const previousLastRow = sheet.getLastRow();
    if (previousLastRow > 1) {
      sheet.getRange(2, 1, previousLastRow - 1, DATABASE_HEADERS.length)
        .clearContent();
      sheet.getRange(2, 13, previousLastRow - 1, SECONDARY_DATABASE_HEADERS.length)
        .clearContent();
    }
    if (result.rows.length) {
      sheet.getRange(2, 1, result.rows.length, DATABASE_HEADERS.length)
        .setValues(result.rows);
    }
    if (result.secondary_rows.length) {
      sheet.getRange(
        2,
        13,
        result.secondary_rows.length,
        SECONDARY_DATABASE_HEADERS.length
      ).setValues(result.secondary_rows);
    }
    PropertiesService.getScriptProperties().setProperty(
      LAST_WRITTEN_TAB_PROPERTY,
      result.destination_tab
    );
    return {
      status: "written",
      sourceTitle: result.source_title,
      destinationTab: result.destination_tab,
      taskCount: result.task_count,
      secondaryTaskCount: result.secondary_task_count,
      unassignedClockCount: result.unassigned_clock_count,
      flexibleTaskCount: result.flexible_task_count,
      reducedTaskCount: result.reduced_task_count,
      sleepTaskCount: result.sleep_task_count,
    };
  } finally {
    lock.releaseLock();
  }
}

function getCalendarSyncDays(tabName) {
  return readCalendarDatabase_(tabName).days;
}

function getCalendarDatabaseTabs() {
  const database = openDatabase_();
  return database.getSheets()
    .map(function (sheet) {
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return null;
      const headers = sheet
        .getRange(1, 1, 1, DATABASE_HEADERS.length)
        .getDisplayValues()[0];
      if (!sameRow_(headers, DATABASE_HEADERS)) return null;
      const secondaryHeaders = sheet
        .getRange(1, 13, 1, SECONDARY_DATABASE_HEADERS.length)
        .getDisplayValues()[0];
      if (
        secondaryHeaders.some(function (value) { return text_(value) !== ""; }) &&
        !sameRow_(secondaryHeaders, SECONDARY_DATABASE_HEADERS)
      ) {
        return null;
      }
      const rows = sheet
        .getRange(2, 1, lastRow - 1, DATABASE_HEADERS.length)
        .getValues();
      const secondaryRows = sheet
        .getRange(2, 13, lastRow - 1, SECONDARY_DATABASE_HEADERS.length)
        .getValues();
      const hasSecondaryData = secondaryRows.some(function (row) {
        return row.some(function (value) {
          return value !== "" && value !== null;
        });
      });
      if (!sameRow_(secondaryHeaders, SECONDARY_DATABASE_HEADERS) &&
          hasSecondaryData) {
        return null;
      }
      const counts = Object.create(null);
      let taskCount = 0;
      rows.concat(secondaryRows).forEach(function (row, index) {
        if (!row.some(function (value) {
          return value !== "" && value !== null;
        })) {
          return;
        }
        taskCount++;
        const date = formatDate_(
          parseDate_(row[0], sheet.getName() + " row " + (index + 2))
        );
        counts[date] = (counts[date] || 0) + 1;
      });
      const days = Object.keys(counts).sort();
      if (!days.length) return null;
      return {
        tabName: sheet.getName(),
        taskCount: taskCount,
        firstDate: days[0],
        lastDate: days[days.length - 1],
        dayCount: days.length,
      };
    })
    .filter(function (tab) { return tab !== null; })
    .sort(function (left, right) {
      return right.firstDate.localeCompare(left.firstDate) ||
        left.tabName.localeCompare(right.tabName);
    });
}

function previewCalendarImport(tabName, selectedDates, optionsInput) {
  const options = normalizeCalendarSyncOptions_(optionsInput);
  const plan = prepareCalendarPlan_(tabName, selectedDates, options);
  return Object.assign({}, plan.summary, { fingerprint: plan.fingerprint });
}

function importCalendarEvents(
  tabName,
  expectedFingerprint,
  selectedDates,
  optionsInput
) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const options = normalizeCalendarSyncOptions_(optionsInput);
    const plan = prepareCalendarPlan_(tabName, selectedDates, options);
    if (!expectedFingerprint || expectedFingerprint !== plan.fingerprint) {
      throw new Error(
        "Database, lựa chọn ngày hoặc Calendar đã thay đổi sau khi quét. Hãy quét lại trước khi đồng bộ."
      );
    }
    const counts = {
      created: 0,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      deleted: 0,
    };
    plan.deleteEvents.forEach(function (event) {
      try {
        event.deleteEvent();
        counts.deleted++;
      } catch (error) {
        throw new Error(
          "Không thể xóa event '" +
            event.getTitle() +
            "'. Đã xóa " +
            counts.deleted +
            " event trước đó. " +
            error.message
        );
      }
    });
    plan.items.forEach(function (item) {
      if (item.status === "skip") {
        counts.skipped++;
        return;
      }
      if (item.status === "unchanged") {
        counts.unchanged++;
        return;
      }

      let event = item.existing;
      try {
        if (!event) {
          event = plan.calendar.createEvent(
            item.title,
            item.start,
            item.end,
            { description: item.description }
          );
          event.setTag(EVENT_TAG_SOURCE, "1");
          event.setTag("schedulerTaskId", item.taskId);
          event.setTag("schedulerTaskDate", item.date);
          counts.created++;
        } else {
          event
            .setTitle(item.title)
            .setDescription(item.description)
            .setTime(item.start, item.end);
          counts.updated++;
        }
        if (item.color) event.setColor(item.color);
        if (
          event.getTag(EVENT_TAG_SOURCE) !== "1" ||
          event.getTag("schedulerTaskId") !== item.taskId ||
          event.getTag("schedulerTaskDate") !== item.date ||
          event.getTitle() !== item.title ||
          event.getDescription() !== item.description ||
          event.getStartTime().getTime() !== item.start.getTime() ||
          event.getEndTime().getTime() !== item.end.getTime()
        ) {
          throw new Error("Calendar verification did not match the requested event.");
        }
      } catch (error) {
        throw new Error(
          "Calendar sync stopped after " +
            counts.created +
            " created, " +
            counts.updated +
            " updated, and " +
            counts.unchanged +
            " unchanged event(s). " +
            error.message
        );
      }
    });
    return {
      status: "synced",
      destinationTab: plan.summary.destinationTab,
      calendarTitle: TEST_CALENDAR_TITLE,
      selectedDates: plan.selectedDates,
      counts: counts,
    };
  } finally {
    lock.releaseLock();
  }
}

function normalizeSourceSpreadsheet_(sourceInput, settings, options) {
  const sourceId = extractSpreadsheetId_(sourceInput);
  const source = SpreadsheetApp.openById(sourceId);
  const sourceSheet = source.getSheetByName(SOURCE_TAB_NAME);
  if (!sourceSheet) {
    throw new Error("Không tìm thấy tab nguồn '" + SOURCE_TAB_NAME + "'.");
  }
  const timezone = source.getSpreadsheetTimeZone();
  const readyDateValues = sourceSheet.getRange("M16:M22").getValues();
  const readyDateDisplays = sourceSheet.getRange("M16:M22").getDisplayValues();
  const readyTaskDisplays = sourceSheet.getRange("O16:AK22").getDisplayValues();
  const readyRows = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const sourceRow = dayIndex + 16;
    const tasks = [];
    for (let offset = 0; offset <= 22; offset += 2) {
      const taskName = text_(readyTaskDisplays[dayIndex][offset]);
      if (!taskName) continue;
      tasks.push({
        cell: columnToLetter_(15 + offset) + sourceRow,
        name: taskName,
      });
    }
    readyRows.push({
      row_number: sourceRow,
      date: serializeDate_(
        readyDateValues[dayIndex][0],
        readyDateDisplays[dayIndex][0],
        timezone
      ),
      tasks: tasks,
    });
  }

  const lastRow = findLastMasterRow_(sourceSheet);
  if (lastRow < 3) throw new Error("MASTER DATABASE không có task trong cột C.");
  const masterRowCount = lastRow - 2;
  if (masterRowCount > MAX_MASTER_ROWS) {
    throw new Error(
      "MASTER vượt quá " +
        MAX_MASTER_ROWS +
        " dòng; dừng để tránh xử lý nhầm vùng dữ liệu."
    );
  }
  const masterRange = sourceSheet.getRange(3, 1, masterRowCount, 9);
  const masterValues = masterRange.getValues();
  const masterDisplays = masterRange.getDisplayValues();
  const masterFormulas = masterRange.getFormulas();
  const masterRows = [];
  let inheritedGroup = "";
  let inheritedCategory = "";

  for (let index = 0; index < masterValues.length; index++) {
    const values = masterValues[index];
    const displays = masterDisplays[index];
    const formulas = masterFormulas[index];
    const group = text_(displays[0]);
    const formula = formulas && formulas.length ? formulas[0] : "";
    const category = categoryFromGroupFormula_(formula, group);
    if (group) inheritedGroup = group;
    if (category) inheritedCategory = category;
    if (!text_(displays[2])) continue;
    masterRows.push({
      row_number: index + 3,
      values: [
        category || inheritedCategory || group || inheritedGroup,
        text_(displays[1]),
        text_(displays[2]),
        text_(displays[3]),
        serializeMasterValue_(values[4], displays[4], timezone),
        serializeMasterValue_(values[5], displays[5], timezone),
        serializeMasterValue_(values[6], displays[6], timezone),
        serializeMasterValue_(values[7], displays[7], timezone),
        serializeStartTime_(values[8], displays[8], timezone),
      ],
    });
  }

  const secondaryDays = readSecondaryTasks_(source, readyRows);
  const normalized = normalizePayload_({
    source_spreadsheet_id: sourceId,
    ready_rows: readyRows,
    master_rows: masterRows,
    secondary_days: secondaryDays,
  }, settings, options);
  normalized.source_title = source.getName();
  return normalized;
}

function readSecondaryTasks_(source, readyRows) {
  if (!Array.isArray(readyRows) || readyRows.length !== 7) {
    throw new Error("Không thể ánh xạ Secondary Tasks khi READY không đủ 7 ngày.");
  }
  return readyRows.map(function (readyRow, dayIndex) {
    const weekday = WEEKDAYS_VI[dayIndex];
    const sheet = source.getSheetByName(weekday);
    if (!sheet) {
      throw new Error("Không tìm thấy tab Secondary Task '" + weekday + "'.");
    }
    const catalogRange = sheet.getRange("A1:F25");
    const catalog = catalogRange.getDisplayValues();
    const catalogValues = catalogRange.getValues();
    const formulas = catalogRange.getFormulas();
    const distribution = sheet.getRange("H1:T17").getDisplayValues();
    const distributionDay = text_(
      distribution[0] && distribution[0][2]
    ).normalize("NFC").toUpperCase();
    if (distributionDay !== weekday) {
      throw new Error(
        "Header ngày tại " + weekday + "!J1 không khớp ngày READY (" +
          distributionDay + ")."
      );
    }

    const catalogByName = Object.create(null);
    let inheritedCategory = "";
    let inheritedGroup = "";
    let inheritedTaskClass = "";
    for (let rowIndex = 2; rowIndex < catalog.length; rowIndex++) {
      const displayed = catalog[rowIndex] || [];
      const rowFormulas = formulas[rowIndex] || [];
      const group = text_(displayed[0]);
      const formulaCategory = categoryFromGroupFormula_(
        rowFormulas[0],
        group
      );
      if (group) inheritedGroup = group;
      if (formulaCategory) inheritedCategory = formulaCategory;
      const taskClass = text_(displayed[1]);
      if (taskClass) inheritedTaskClass = taskClass;
      const taskName = text_(displayed[2]);
      if (!taskName) continue;
      const key = normalizedName_(taskName);
      if (Object.prototype.hasOwnProperty.call(catalogByName, key)) {
        throw new Error(
          "Tên Secondary Task trùng trong " + weekday +
            "!A1:F25: '" + taskName + "'."
        );
      }
      catalogByName[key] = {
        row: rowIndex + 1,
        category: formulaCategory || inheritedCategory || group || inheritedGroup,
        taskClass: taskClass || inheritedTaskClass,
        group: taskClass || inheritedTaskClass,
        description: text_(displayed[3]),
        hours: (catalogValues[rowIndex] || [])[4],
        minutes: displayed[5],
      };
    }

    let periodDisplay = "";
    let inheritedAssignmentGroup = "";
    let sourceOrder = 0;
    const periodOrder = Object.create(null);
    const tasks = [];
    for (let rowNumber = 4; rowNumber <= 16; rowNumber++) {
      const row = distribution[rowNumber - 1] || [];
      if (text_(row[0])) periodDisplay = text_(row[0]);
      if (!periodDisplay) continue;
      const parsedWindow = parseSecondaryWindow_(periodDisplay);
      const period = secondaryPeriodName_(periodDisplay);
      if (text_(row[1])) inheritedAssignmentGroup = text_(row[1]);
      const group = inheritedAssignmentGroup;
      const slots = [
        { nameIndex: 2, durationIndex: 3, nameColumn: "J", durationColumn: "K" },
        { nameIndex: 4, durationIndex: 5, nameColumn: "L", durationColumn: "M" },
        { nameIndex: 6, durationIndex: 7, nameColumn: "N", durationColumn: "O" },
        { nameIndex: 8, durationIndex: 9, nameColumn: "P", durationColumn: "Q" },
      ];
      slots.forEach(function (slot) {
        const taskName = text_(row[slot.nameIndex]);
        if (!taskName) return;
        if (normalizedName_(taskName) === normalizedName_("Ngủ khuya")) return;
        const entry = catalogByName[normalizedName_(taskName)];
        if (!entry) {
          throw new Error(
            "Không tìm thấy Secondary Task '" + taskName + "' tại " +
              weekday + "!" + slot.nameColumn + rowNumber +
              " trong danh mục cột C."
          );
        }
        if (!group) {
          throw new Error(
            "Thiếu NHÓM tại " + weekday + "!I" + rowNumber +
              " cho task '" + taskName + "'."
          );
        }
        const minutes = parseDecimal_(
          row[slot.durationIndex],
          weekday + "!" + slot.durationColumn + rowNumber +
            " (thời lượng phút)"
        );
        const catalogMinutes = parseDecimal_(
          entry.minutes,
          weekday + "!F" + entry.row + " (thời lượng phút danh mục)"
        );
        const catalogHours = Number(entry.hours);
        if (
          minutes <= 0 ||
          Math.abs(minutes - catalogMinutes) > 0.0001 ||
          !Number.isFinite(catalogHours) ||
          catalogHours <= 0 ||
          Math.abs(catalogHours * 60 - catalogMinutes) > 0.01
        ) {
          throw new Error(
            "Thời lượng Secondary Task '" + taskName + "' tại " +
              weekday + "!" + slot.durationColumn + rowNumber +
              " không khớp giữa phân bố và danh mục E/F (" +
              minutes + " phút / " + catalogHours + " giờ / " +
              catalogMinutes + " phút)."
          );
        }
        sourceOrder++;
        periodOrder[period] = (periodOrder[period] || 0) + 1;
        const sourceCell = slot.nameColumn + rowNumber;
        const category = entry.category || "";
        const taskClass = entry.taskClass || "";
        tasks.push({
          task_id: internalTaskId_(
            source.getId(),
            readyRow.date,
            "SECONDARY:" + weekday + "!" + sourceCell
          ),
          date: readyRow.date,
          weekday: weekday,
          source_order: sourceOrder,
          period_order: periodOrder[period],
          task_type: "secondary",
          task_name: taskName,
          period: period,
          window_start: parsedWindow.start,
          window_end: parsedWindow.end,
          window_label: parsedWindow.label,
          group: group,
          category: category,
          class: taskClass,
          context_type: secondaryContextType_(
            taskName,
            group,
            entry.description
          ),
          icon: secondaryIcon_(group, category, taskClass),
          description: entry.description,
          duration_minutes: minutes,
          duration_hours: minutes / 60,
          original_duration_hours: minutes / 60,
          fixed_start: null,
          clock: null,
          suggested_clock: null,
          color: SECONDARY_COLOR,
          source: {
            day_tab: weekday,
            task_cell: sourceCell,
            duration_cell: slot.durationColumn + rowNumber,
            catalog_row: entry.row,
          },
        });
      });
    }
    return {
      date: readyRow.date,
      weekday: weekday,
      tasks: tasks,
    };
  });
}

function parseSecondaryWindow_(displayValue) {
  const value = text_(displayValue);
  const match = value.match(
    /(?:^|\()\s*(\d{1,2})(?::(\d{2}))?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?\s*\)?/i
  );
  if (!match) {
    throw new Error(
      "Không đọc được KHUNG GIỜ Secondary Task từ giá trị hiển thị '" +
        value + "'."
    );
  }
  const startHour = Number(match[1]);
  const startMinute = Number(match[2] || 0);
  const endHour = Number(match[3]);
  const endMinute = Number(match[4] || 0);
  if (
    startHour > 23 ||
    endHour > 23 ||
    startMinute > 59 ||
    endMinute > 59
  ) {
    throw new Error("KHUNG GIỜ Secondary Task không hợp lệ: '" + value + "'.");
  }
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  if (endMinutes <= startMinutes) {
    throw new Error(
      "KHUNG GIỜ Secondary Task phải nằm trong cùng ngày và có độ dài dương: '" +
        value + "'."
    );
  }
  return {
    start: twoDigits_(startHour) + ":" + twoDigits_(startMinute),
    end: twoDigits_(endHour) + ":" + twoDigits_(endMinute),
    label:
      twoDigits_(startHour) + ":" + twoDigits_(startMinute) +
      "-" + twoDigits_(endHour) + ":" + twoDigits_(endMinute),
  };
}

function secondaryPeriodName_(displayValue) {
  const match = text_(displayValue).normalize("NFC").toUpperCase().match(
    /^(SÁNG|TRƯA|CHIỀU|TỐI)(?:\s|$)/
  );
  if (!match) {
    throw new Error(
      "Không nhận diện được BUỔI Secondary Task từ giá trị '" +
        displayValue + "'."
    );
  }
  return match[1];
}

function secondaryContextType_(taskName, group, description) {
  const name = normalizedName_(taskName);
  const detail = normalizedName_(description);
  const combined = name + " " + detail;
  const normalizedGroup = text_(group).normalize("NFC").toUpperCase();
  if (
    normalizedGroup === "VỆ SINH" &&
    (name.indexOf("sáng") >= 0 || detail.indexOf("đánh răng") >= 0)
  ) {
    return "morning_hygiene";
  }
  if (
    name === "aus" ||
    combined.indexOf("ăn uống sáng") >= 0
  ) {
    return "breakfast";
  }
  if (
    name === "aut" ||
    combined.indexOf("ăn uống trưa") >= 0
  ) {
    return "lunch";
  }
  if (
    name === "auc" ||
    combined.indexOf("ăn uống chiều") >= 0
  ) {
    return "evening_meal";
  }
  if (combined.indexOf("nghỉ") >= 0) return "rest";
  if (normalizedGroup === "VẬN ĐỘNG") return "movement";
  if (normalizedGroup === "TIN TỨC") return "news";
  if (normalizedGroup === "VỆ SINH") return "personal_hygiene";
  return "routine";
}

function secondaryIcon_(group, category, taskClass) {
  const normalizedGroup = text_(group).normalize("NFC").toUpperCase();
  if (Object.prototype.hasOwnProperty.call(SECONDARY_GROUP_ICONS, normalizedGroup)) {
    return SECONDARY_GROUP_ICONS[normalizedGroup];
  }
  return icon_(category, taskClass);
}

function categoryFromGroupFormula_(formula, displayValue) {
  const match = String(formula || "").match(
    /\[\s*phân\s*loại\s*:\s*(?:\[([^\]]+)\]|([^\]]+?))\s*\]/i
  );
  return text_(match ? match[1] || match[2] : displayValue);
}

function findLastMasterRow_(sheet) {
  const maxRows = sheet.getMaxRows();
  if (maxRows < 3) return 2;
  const lastTaskNameCell = sheet
    .getRange(3, 3, maxRows - 2, 1)
    .createTextFinder("\\S")
    .useRegularExpression(true)
    .matchFormulaText(false)
    .findPrevious();
  return lastTaskNameCell ? lastTaskNameCell.getRow() : 2;
}

function normalizePayload_(payload, settingsInput, optionsInput) {
  const settings = normalizeScheduleSettings_(settingsInput);
  const options = optionsInput || {};
  const transferMode = options.transferMode === true;
  const readyRows = payload.ready_rows;
  const masterRows = payload.master_rows;
  if (!Array.isArray(readyRows) || readyRows.length !== 7) {
    throw new Error("READY phải chứa đúng 7 dòng ngày.");
  }
  if (!Array.isArray(masterRows) || masterRows.length === 0) {
    throw new Error("Không tìm thấy dữ liệu trong MASTER.");
  }

  const dates = readyRows.map(function (row, index) {
    if (!row || row.row_number !== index + 16) {
      throw new Error("READY phải ánh xạ đúng các dòng M16:M22.");
    }
    return parseDate_(row.date, "READY M" + row.row_number);
  });
  for (let day = 0; day < 6; day++) {
    if (dates[day + 1].getTime() - dates[day].getTime() !== 86400000) {
      throw new Error("READY M16:M22 phải là 7 ngày liên tiếp.");
    }
  }
  if (dates[0].getDay() !== 1) {
    throw new Error("READY M16 phải là ngày thứ Hai.");
  }
  const secondaryDays = payload.secondary_days === undefined
    ? []
    : payload.secondary_days;
  if (!Array.isArray(secondaryDays) ||
      (secondaryDays.length !== 0 && secondaryDays.length !== 7)) {
    throw new Error("Secondary Tasks phải chứa đủ 7 tab ngày.");
  }
  const secondaryByDate = Object.create(null);
  secondaryDays.forEach(function (day, index) {
    const date = parseDate_(day && day.date, "Secondary " + WEEKDAYS_VI[index]);
    if (
      date.getTime() !== dates[index].getTime() ||
      text_(day.weekday).normalize("NFC").toUpperCase() !== WEEKDAYS_VI[index] ||
      !Array.isArray(day.tasks)
    ) {
      throw new Error(
        "Secondary Tasks không ánh xạ đúng ngày READY cho " +
          WEEKDAYS_VI[index] + "."
      );
    }
    secondaryByDate[formatDate_(date)] = day.tasks;
  });
  const scheduleWarnings = [];

  const masterByName = Object.create(null);
  let inheritedGroup = "";
  masterRows.forEach(function (master) {
    if (!master || !Number.isInteger(master.row_number) || master.row_number < 3) {
      throw new Error("Dòng MASTER không hợp lệ.");
    }
    if (!Array.isArray(master.values) || master.values.length < 9) {
      throw new Error("MASTER dòng " + master.row_number + " phải có đủ A:I.");
    }
    const group = text_(master.values[0]);
    if (group) inheritedGroup = group;
    const name = text_(master.values[2]);
    if (!name) return;
    const key = normalizedName_(name);
    if (Object.prototype.hasOwnProperty.call(masterByName, key)) {
      throw new Error(
        "Tên task MASTER trùng sau chuẩn hóa tại dòng " +
          masterByName[key].row_number +
          " và " +
          master.row_number +
          ": " +
          name
      );
    }
    masterByName[key] = {
      row_number: master.row_number,
      values: master.values,
      group_class: group || inheritedGroup,
    };
  });

  const dayGroups = [];
  const seenCells = {};
  readyRows.forEach(function (readyRow, dayIndex) {
    const tasks = readyRow.tasks;
    if (!Array.isArray(tasks)) {
      throw new Error("Danh sách task READY dòng " + readyRow.row_number + " lỗi.");
    }
    const dayTasks = [];
    tasks.forEach(function (task) {
      const name = text_(task && task.name);
      if (!name) return;
      if (!/^[A-Z]{1,3}\d+$/.test(task.cell || "")) {
        throw new Error("Địa chỉ ô READY không hợp lệ: " + task.cell);
      }
      if (seenCells[task.cell]) {
        throw new Error("Ô READY bị lặp: " + task.cell);
      }
      seenCells[task.cell] = true;
      const master = masterByName[normalizedName_(name)];
      if (!master) {
        throw new Error(
          "Không tìm thấy task '" + name + "' tại " + task.cell + " trong MASTER cột C."
        );
      }
      const values = master.values;
      const taskClass = text_(values[1]);
      const taskName = text_(values[2]);
      const content = text_(values[3]);
      const gi = parseDecimal_(values[5], "MASTER F" + master.row_number + " (GI)");
      const duration = parseDecimal_(
        values[6],
        "MASTER G" + master.row_number + " (DURING)"
      );
      if (duration <= 0) {
        throw new Error("MASTER G" + master.row_number + " (DURING) phải lớn hơn 0.");
      }
      const start = parseStartTime_(
        values[8],
        "MASTER I" + master.row_number + " (Start Time)"
      );
      const dateText = formatDate_(dates[dayIndex]);
      const taskId = internalTaskId_(
        payload.source_spreadsheet_id,
        dateText,
        task.cell
      );
      dayTasks.push({
        date: dateText,
        weekday: WEEKDAYS_VI[
          dates[dayIndex].getDay() === 0 ? 6 : dates[dayIndex].getDay() - 1
        ],
        sourceOrder: dayTasks.length + 1,
        sourceCell: task.cell,
        masterRow: master.row_number,
        taskId: taskId,
        taskName: taskName,
        taskClass: taskClass,
        content: content,
        pr: values[4],
        gi: gi,
        duration: duration,
        fixedStart: start,
        groupClass: master.group_class,
      });
    });

    validateUniqueFixedStarts_(dayTasks, dates[dayIndex], scheduleWarnings);
    dayGroups.push({
      date: dates[dayIndex],
      tasks: dayTasks,
    });
  });

  const sleepAnchors = [];
  for (let offset = -1; offset <= dayGroups.length; offset++) {
    const anchorDate = new Date(dayGroups[0].date.getTime());
    anchorDate.setDate(anchorDate.getDate() + offset);
    sleepAnchors.push(createSleepAnchor_(anchorDate, settings));
  }
  const fixedAnchors = [];
  dayGroups.forEach(function (group) {
    group.tasks.forEach(function (task) {
      if (!task.fixedStart) return;
      const start = dateAtOffset_(group.date, {
        hour: task.fixedStart.hour,
        minute: task.fixedStart.minute,
        second: 0,
      });
      fixedAnchors.push({
        type: "fixed",
        date: group.date,
        task: task,
        taskName: task.taskName,
        sourceCell: task.sourceCell,
        start: start,
        end: new Date(
          start.getTime() +
            Math.floor(task.duration * 3600 + 0.5) * 1000
        ),
      });
    });
  });
  validateHardAnchorConflicts_(
    fixedAnchors.concat(sleepAnchors),
    scheduleWarnings
  );

  const rows = [];
  const secondaryRows = [];
  const taskModes = [];
  const taskOriginalDurations = [];
  const transferTasks = [];
  const transferSecondaryTasks = [];
  let flexibleTaskCount = 0;
  let reducedTaskCount = 0;
  let mainTaskCount = 0;
  dayGroups.forEach(function (group) {
    const dayTasks = group.tasks;
    const secondaryTasks =
      secondaryByDate[formatDate_(group.date)] || [];
    const secondaryAnchors = assignSecondaryDailySchedule_(
      dayTasks,
      secondaryTasks,
      group.date,
      fixedAnchors.concat(sleepAnchors),
      scheduleWarnings
    );
    if (transferMode) {
      dayTasks.forEach(function (task) {
        task.scheduledDuration = task.duration;
        task.reducedBySeconds = 0;
        if (task.fixedStart) {
          const fixedStart = dateAtOffset_(group.date, {
            hour: task.fixedStart.hour,
            minute: task.fixedStart.minute,
            second: 0,
          });
          task.clock = clockFromDateTimes_(
            group.date,
            fixedStart,
            new Date(
              fixedStart.getTime() +
                Math.floor(task.duration * 3600 + 0.5) * 1000
            )
          );
        } else {
          task.clock = "";
        }
      });
    } else {
      assignDailySchedule_(
        dayTasks,
        group.date,
        settings,
        fixedAnchors.concat(sleepAnchors, secondaryAnchors),
        scheduleWarnings
      );
    }
    dayTasks.forEach(function (task) {
      if (!task.fixedStart) flexibleTaskCount++;
      if (task.reducedBySeconds > 0) reducedTaskCount++;
      mainTaskCount++;
      rows.push([
        task.date,
        task.weekday,
        task.sourceOrder,
        icon_(task.groupClass, task.taskClass),
        task.taskName,
        description_(
          task.taskId,
          task.groupClass,
          task.taskClass,
          task.taskName,
          task.content,
          task.pr,
          task.gi,
          task.scheduledDuration,
          task.duration,
          task.clock
        ),
        task.scheduledDuration,
        task.clock,
        calendarColor_(task.taskClass, task.gi),
        task.taskId,
      ]);
      taskModes.push(
        task.fixedStart
          ? "fixed"
          : task.reducedBySeconds > 0
            ? "flexible_adjusted"
            : "flexible"
      );
      taskOriginalDurations.push(task.duration);
      transferTasks.push({
        task_id: task.taskId,
        date: task.date,
        weekday: task.weekday,
        source_order: task.sourceOrder,
        schedule_order: task.sourceOrder,
        task_type: task.fixedStart ? "fixed" : "flexible",
        task_name: task.taskName,
        category: task.groupClass,
        class: task.taskClass,
        gi: task.gi,
        icon: icon_(task.groupClass, task.taskClass),
        description: description_(
          task.taskId,
          task.groupClass,
          task.taskClass,
          task.taskName,
          task.content,
          task.pr,
          task.gi,
          task.duration,
          task.duration,
          ""
        ),
        duration_hours: task.duration,
        original_duration_hours: task.duration,
        fixed_start: task.fixedStart
          ? twoDigits_(task.fixedStart.hour) +
            ":" +
            twoDigits_(task.fixedStart.minute)
          : null,
        clock: task.clock || null,
        color: calendarColor_(task.taskClass, task.gi),
        source: {
          ready_cell: task.sourceCell,
          master_row: task.masterRow,
        },
      });
    });

    const sleepStartSeconds = settings.sleepStartMinutes * 60;
    const sleepEndSeconds =
      sleepStartSeconds + Math.floor(settings.sleepDurationHours * 3600 + 0.5);
    if (sleepEndSeconds > 2 * 86400) {
      throw new Error("Task Ngủ đêm vượt quá ngày kế tiếp.");
    }
    const dateText = formatDate_(group.date);
    const sleepTaskId = internalSleepTaskId_(
      payload.source_spreadsheet_id,
      dateText
    );
    rows.push([
      dateText,
      WEEKDAYS_VI[
        group.date.getDay() === 0 ? 6 : group.date.getDay() - 1
      ],
      dayTasks.length + 1,
      "🌙",
      "Ngủ đêm",
      "Ngủ đêm hôm nay",
      settings.sleepDurationHours,
      formatClock_(sleepStartSeconds, sleepEndSeconds),
      "GRAY",
      sleepTaskId,
    ]);
    taskModes.push("sleep");
    taskOriginalDurations.push(settings.sleepDurationHours);
    transferTasks.push({
      task_id: sleepTaskId,
      date: dateText,
      weekday: WEEKDAYS_VI[
        group.date.getDay() === 0 ? 6 : group.date.getDay() - 1
      ],
      source_order: dayTasks.length + 1,
      schedule_order: dayTasks.length + 1,
      task_type: "sleep",
      task_name: "Ngủ đêm",
      icon: "🌙",
      description: "Ngủ đêm hôm nay",
      duration_hours: settings.sleepDurationHours,
      original_duration_hours: settings.sleepDurationHours,
      fixed_start: settings.sleepStartTime,
      clock: formatClock_(sleepStartSeconds, sleepEndSeconds),
      color: "GRAY",
      source: { generated: true },
    });

    secondaryTasks.forEach(function (task) {
      const clock = transferMode ? "" : task.suggested_clock;
      const id = task.task_id;
      const row = [
        task.date,
        task.weekday,
        task.period,
        task.window_label,
        task.period_order,
        task.group,
        task.icon,
        task.task_name,
        secondaryDescription_(task, clock),
        task.duration_hours,
        clock,
        task.color,
        id,
      ];
      secondaryRows.push(row);
      transferSecondaryTasks.push({
        task_id: id,
        date: task.date,
        weekday: task.weekday,
        source_order: task.source_order,
        period_order: task.period_order,
        task_type: "secondary",
        task_name: task.task_name,
        period: task.period,
        window_start: task.window_start,
        window_end: task.window_end,
        window_label: task.window_label,
        group: task.group,
        category: task.category,
        class: task.class,
        context_type: task.context_type,
        icon: task.icon,
        description: secondaryDescription_(task, clock),
        duration_minutes: task.duration_minutes,
        duration_hours: task.duration_hours,
        original_duration_hours: task.original_duration_hours,
        fixed_start: null,
        clock: transferMode ? null : task.suggested_clock,
        suggested_clock: task.suggested_clock,
        color: task.color,
        source: task.source,
      });
    });
  });

  const startDate = dates[0];
  const endDate = dates[6];
  const previewItems = rows.filter(function (row) {
    return !!row[7];
  }).map(function (row) {
    const clock = splitClock_(row[7], row[0]);
    return {
      date: row[0],
      sourceOrder: row[2],
      title: (row[3] ? row[3] + " " : "") + row[4],
      description: row[5],
      durationHours: row[6],
      clock: row[7],
      colorName: row[8],
      type: row[4] === "Ngủ đêm" ? "sleep" : "main",
      startDate: clock.startDate,
      startTime: clock.startTime,
      endDate: clock.endDate,
      endTime: clock.endTime,
    };
  }).concat(secondaryRows.filter(function (row) {
    return !!row[10];
  }).map(function (row) {
    const clock = splitClock_(row[10], row[0]);
    return {
      date: row[0],
      sourceOrder: row[4],
      title: (row[6] ? row[6] + " " : "") + row[7],
      description: row[8],
      durationHours: row[9],
      clock: row[10],
      colorName: row[11],
      type: "secondary",
      startDate: clock.startDate,
      startTime: clock.startTime,
      endDate: clock.endDate,
      endTime: clock.endTime,
    };
  }));
  previewItems.sort(function (left, right) {
    return left.date.localeCompare(right.date) ||
      left.startDate.localeCompare(right.startDate) ||
      left.startTime.localeCompare(right.startTime);
  });
  return {
    source_spreadsheet_id: payload.source_spreadsheet_id,
    week_start: formatDate_(startDate),
    week_end: formatDate_(endDate),
    destination_tab:
      twoDigits_(startDate.getDate()) +
      "/" +
      twoDigits_(startDate.getMonth() + 1) +
      " - " +
      twoDigits_(endDate.getDate()) +
      "/" +
      twoDigits_(endDate.getMonth() + 1) +
      "/ " +
      endDate.getFullYear(),
    rows: rows,
    secondary_rows: secondaryRows,
    task_modes: taskModes,
    task_original_durations: taskOriginalDurations,
    transfer_tasks: transferTasks,
    transfer_secondary_tasks: transferSecondaryTasks,
    schedule_warnings: scheduleWarnings,
    preview_items: previewItems,
    task_count: rows.length + secondaryRows.length,
    unassigned_clock_count:
      rows.filter(function (row) { return !row[7]; }).length +
      secondaryRows.filter(function (row) { return !row[10]; }).length,
    flexible_task_count: flexibleTaskCount,
    reduced_task_count: reducedTaskCount,
    main_task_count: mainTaskCount,
    sleep_task_count: dayGroups.length,
    secondary_task_count: secondaryRows.length,
  };
}

function transferSourceFingerprint_(transfer) {
  return fingerprint_(JSON.stringify(transferSourceProjection_(transfer)));
}

function transferSourceProjection_(transfer) {
  return {
    source: {
      spreadsheet_id: transfer.source.spreadsheet_id,
      spreadsheet_title: transfer.source.spreadsheet_title,
      source_tab: transfer.source.source_tab,
      destination_tab: transfer.source.destination_tab,
      week_start: transfer.source.week_start,
      week_end: transfer.source.week_end,
    },
    settings: {
      defaultStartTime: transfer.schedule_settings.defaultStartTime,
      breakMinutes: transfer.schedule_settings.breakMinutes,
      sleepStartTime: transfer.schedule_settings.sleepStartTime,
      sleepDurationHours: transfer.schedule_settings.sleepDurationHours,
    },
    tasks: transfer.tasks
      .map(function (task) {
        return {
          task_id: task.task_id,
          date: task.date,
          weekday: task.weekday,
          source_order: task.source_order,
          task_type: task.task_type,
          task_name: task.task_name,
          category: task.category,
          class: task.class,
          gi: task.gi,
          icon: task.icon,
          description: task.description,
          original_duration_hours: task.original_duration_hours,
          fixed_start: task.fixed_start,
          color: task.color,
          source: task.source,
        };
      })
      .sort(function (left, right) {
        return left.task_id.localeCompare(right.task_id);
      }),
    secondary_tasks: transfer.secondary_tasks
      .map(function (task) {
        return {
          task_id: task.task_id,
          date: task.date,
          weekday: task.weekday,
          source_order: task.source_order,
          period_order: task.period_order,
          task_type: task.task_type,
          task_name: task.task_name,
          period: task.period,
          window_start: task.window_start,
          window_end: task.window_end,
          window_label: task.window_label,
          group: task.group,
          category: task.category,
          class: task.class,
          context_type: task.context_type,
          icon: task.icon,
          description: task.description,
          duration_hours: task.duration_hours,
          duration_minutes: task.duration_minutes,
          original_duration_hours: task.original_duration_hours,
          fixed_start: task.fixed_start,
          clock: task.clock,
          suggested_clock: task.suggested_clock,
          color: task.color,
          source: task.source,
        };
      })
      .sort(function (left, right) {
        return left.task_id.localeCompare(right.task_id);
      }),
  };
}

function validateNormalizationTransfer_(transfer) {
  const hasOwn = Object.prototype.hasOwnProperty;
  if (
    transfer.schema_version !== TRANSFER_SCHEMA_VERSION ||
    transfer.kind !== "normalized_input" ||
    !Array.isArray(transfer.tasks) ||
    !transfer.tasks.length ||
    !Array.isArray(transfer.secondary_tasks)
  ) {
    throw new Error("Không thể tạo JSON theo schema transfer hiện tại.");
  }
  transfer.tasks.forEach(function (task, index) {
    if (
      !task ||
      !hasOwn.call(task, "fixed_start") ||
      !hasOwn.call(task, "clock")
    ) {
      throw new Error(
        "Task thứ " + (index + 1) +
          " thiếu fixed_start hoặc clock; không thể tải JSON transfer."
      );
    }
    if (
      task.task_type === "flexible" &&
      (task.fixed_start !== null || task.clock !== null)
    ) {
      throw new Error(
        "Task linh động phải có fixed_start và clock bằng null trong JSON đầu vào."
      );
    }
    if (task.task_type !== "sleep") {
      if (
        typeof task.category !== "string" ||
        typeof task.class !== "string" ||
        typeof task.gi !== "number" ||
        !isFinite(task.gi)
      ) {
        throw new Error(
          "Task chính thứ " + (index + 1) +
            " thiếu category, class hoặc GI dạng số trong JSON transfer."
        );
      }
      if (
        task.icon !== icon_(task.category, task.class) ||
        task.color !== calendarColor_(task.class, task.gi)
      ) {
        throw new Error(
          "ICON hoặc COLOR của task chính thứ " + (index + 1) +
            " không khớp quy tắc MASTER."
        );
      }
    }
  });
  transfer.secondary_tasks.forEach(function (task, index) {
    if (
      !task ||
      task.task_type !== "secondary" ||
      task.fixed_start !== null ||
      task.clock !== null ||
      typeof task.suggested_clock !== "string" ||
      !task.suggested_clock ||
      typeof task.task_name !== "string" ||
      !task.task_name ||
      normalizedName_(task.task_name) === normalizedName_("Ngủ khuya") ||
      typeof task.duration_minutes !== "number" ||
      !isFinite(task.duration_minutes) ||
      task.duration_minutes <= 0 ||
      typeof task.duration_hours !== "number" ||
      task.duration_hours !== task.duration_minutes / 60 ||
      task.original_duration_hours !== task.duration_hours ||
      task.color !== SECONDARY_COLOR ||
      task.icon !== secondaryIcon_(task.group, task.category, task.class)
    ) {
      throw new Error(
        "Secondary Task thứ " + (index + 1) +
          " thiếu trường hoặc vi phạm quy tắc duration/ICON/COLOR."
      );
    }
    const window = parseSecondaryWindow_(task.window_label);
    if (
      window.start !== task.window_start ||
      window.end !== task.window_end
    ) {
      throw new Error(
        "Secondary Task thứ " + (index + 1) +
          " có window_start/window_end không khớp window_label."
      );
    }
    const suggested = parseClock_(task.suggested_clock, task.task_id);
    const windowStart = parseStartTime_(task.window_start, "Secondary window_start");
    const windowEnd = parseStartTime_(task.window_end, "Secondary window_end");
    const startBound = windowStart.hour * 3600 + windowStart.minute * 60;
    const endBound = windowEnd.hour * 3600 + windowEnd.minute * 60;
    if (
      suggested.start.dayOffset !== 0 ||
      suggested.end.dayOffset !== 0 ||
      suggested.start.hour * 3600 + suggested.start.minute * 60 +
        suggested.start.second < startBound ||
      suggested.end.hour * 3600 + suggested.end.minute * 60 +
        suggested.end.second > endBound ||
      suggested.end.hour * 3600 + suggested.end.minute * 60 +
        suggested.end.second -
        (suggested.start.hour * 3600 + suggested.start.minute * 60 +
          suggested.start.second) !==
        Math.floor(task.duration_hours * 3600 + 0.5)
    ) {
      throw new Error(
        "Secondary Task thứ " + (index + 1) +
          " có suggested_clock ngoài khung hoặc không khớp duration."
      );
    }
  });
  if (transfer.source_fingerprint !== transferSourceFingerprint_(transfer)) {
    throw new Error("Fingerprint JSON đầu vào không hợp lệ; không thể tải file.");
  }
}

function normalizeScheduleSettings_(input) {
  const settings = input || {};
  const startText =
    settings.defaultStartTime === undefined
      ? DEFAULT_DAY_START
      : text_(settings.defaultStartTime);
  const parsedStart = parseStartTime_(startText, "Giờ bắt đầu mặc định");
  if (!parsedStart) {
    throw new Error("Giờ bắt đầu mặc định không được để trống.");
  }
  const breakText =
    settings.breakMinutes === undefined
      ? String(DEFAULT_BREAK_MINUTES)
      : String(settings.breakMinutes).trim();
  if (!/^\d+$/.test(breakText)) {
    throw new Error("Khoảng nghỉ phải là số phút nguyên không âm.");
  }
  const breakMinutes = Number(breakText);
  if (breakMinutes > 180) {
    throw new Error("Khoảng nghỉ không được vượt quá 180 phút.");
  }
  const sleepStartText =
    settings.sleepStartTime === undefined
      ? DEFAULT_SLEEP_START
      : text_(settings.sleepStartTime);
  const sleepStart = parseStartTime_(sleepStartText, "Giờ bắt đầu Ngủ đêm");
  if (!sleepStart) {
    throw new Error("Giờ bắt đầu Ngủ đêm không được để trống.");
  }
  const sleepDurationText =
    settings.sleepDurationHours === undefined
      ? String(DEFAULT_SLEEP_DURATION_HOURS)
      : String(settings.sleepDurationHours).trim();
  const sleepDurationHours = parseDecimal_(
    sleepDurationText,
    "Thời lượng Ngủ đêm"
  );
  if (sleepDurationHours <= 0 || sleepDurationHours > 24) {
    throw new Error("Thời lượng Ngủ đêm phải lớn hơn 0 và không quá 24 giờ.");
  }
  return {
    defaultStartTime:
      twoDigits_(parsedStart.hour) + ":" + twoDigits_(parsedStart.minute),
    defaultStartMinutes: parsedStart.hour * 60 + parsedStart.minute,
    breakMinutes: breakMinutes,
    sleepStartTime:
      twoDigits_(sleepStart.hour) + ":" + twoDigits_(sleepStart.minute),
    sleepStartMinutes: sleepStart.hour * 60 + sleepStart.minute,
    sleepDurationHours: sleepDurationHours,
  };
}

function assignDailySchedule_(tasks, date, settings, hardAnchors, warnings) {
  const flexibleTasks = [];
  tasks.forEach(function (task) {
    const durationSeconds = Math.floor(task.duration * 3600 + 0.5);
    task.scheduledDuration = task.duration;
    task.reducedBySeconds = 0;
    if (task.fixedStart) {
      const start = dateAtOffset_(date, {
        hour: task.fixedStart.hour,
        minute: task.fixedStart.minute,
        second: 0,
      });
      const end = new Date(start.getTime() + durationSeconds * 1000);
      task.startDateTime = start;
      task.clock = clockFromDateTimes_(date, start, end);
      return;
    }
    task.durationSeconds = durationSeconds;
    flexibleTasks.push(task);
  });
  if (!flexibleTasks.length) return;

  const windowStart = dateAtOffset_(date, {
    hour: Math.floor(settings.defaultStartMinutes / 60),
    minute: settings.defaultStartMinutes % 60,
    second: 0,
  });
  const nextDate = new Date(date.getTime());
  nextDate.setDate(nextDate.getDate() + 1);
  const windowEnd = dateAtOffset_(nextDate, {
    hour: Math.floor(settings.defaultStartMinutes / 60),
    minute: settings.defaultStartMinutes % 60,
    second: 0,
  });
  const breakMs = settings.breakMinutes * 60000;
  const relevantAnchors = hardAnchors
    .filter(function (anchor) {
      return (
        anchor.start.getTime() < windowEnd.getTime() + breakMs &&
        anchor.end.getTime() > windowStart.getTime() - breakMs
      );
    })
    .sort(function (left, right) {
      return left.start.getTime() - right.start.getTime();
    });
  const slots = [];
  let cursor = windowStart.getTime();
  let previousAnchor = null;
  relevantAnchors.forEach(function (anchor) {
    const gapAfterPrevious = previousAnchor &&
      previousAnchor.type !== "secondary"
      ? breakMs
      : 0;
    const gapBeforeAnchor = anchor.type === "secondary" ? 0 : breakMs;
    const gapStart = previousAnchor
      ? Math.max(cursor, previousAnchor.end.getTime() + gapAfterPrevious)
      : cursor;
    const gapEnd = Math.min(
      anchor.start.getTime() - gapBeforeAnchor,
      windowEnd.getTime()
    );
    if (gapEnd > gapStart) {
      slots.push({
        start: gapStart,
        end: gapEnd,
        capacitySeconds: Math.floor((gapEnd - gapStart) / 1000),
      });
    }
    cursor = Math.max(cursor, anchor.end.getTime());
    previousAnchor = anchor;
  });
  const finalGapStart = previousAnchor
    ? Math.max(
        cursor,
        previousAnchor.end.getTime() +
          (previousAnchor.type === "secondary" ? 0 : breakMs)
      )
    : cursor;
  if (windowEnd.getTime() > finalGapStart) {
    slots.push({
      start: finalGapStart,
      end: windowEnd.getTime(),
      capacitySeconds: Math.floor((windowEnd.getTime() - finalGapStart) / 1000),
    });
  }

  const taskCount = flexibleTasks.length;
  if (taskCount > 12) {
    placeFlexibleTasksForPreview_(
      flexibleTasks,
      date,
      windowStart,
      settings,
      warnings,
      "vượt giới hạn tính toán 12 task linh động"
    );
    return;
  }
  const fixedTasksForDay = tasks.filter(function (task) {
    return !!task.fixedStart;
  });
  const allMask = (1 << taskCount) - 1;
  const maxReductions = flexibleTasks.map(function (task) {
    const limitSeconds = task.duration <= 1 ? 15 * 60 : 30 * 60;
    return Math.min(limitSeconds, Math.max(0, task.durationSeconds - 60));
  });
  const breakSeconds = settings.breakMinutes * 60;
  const memo = Object.create(null);

  function solve(slotIndex, placedMask) {
    if (placedMask === allMask) {
      return { reduction: 0, inversions: 0, sequence: [], choices: [] };
    }
    if (slotIndex >= slots.length) return null;
    const key = slotIndex + "|" + placedMask;
    if (Object.prototype.hasOwnProperty.call(memo, key)) return memo[key];
    const remaining = allMask ^ placedMask;
    let best = null;
    let subset = remaining;
    while (true) {
      const indexes = [];
      let totalSeconds = 0;
      let totalReductionLimit = 0;
      for (let index = 0; index < taskCount; index++) {
        if (!(subset & (1 << index))) continue;
        indexes.push(index);
        totalSeconds += flexibleTasks[index].durationSeconds;
        totalReductionLimit += maxReductions[index];
      }
      const demand =
        totalSeconds + Math.max(0, indexes.length - 1) * breakSeconds;
      const requiredReduction = Math.max(
        0,
        demand - slots[slotIndex].capacitySeconds
      );
      if (requiredReduction <= totalReductionLimit) {
        let inversionCount = 0;
        indexes.forEach(function (index) {
          for (let previous = index + 1; previous < taskCount; previous++) {
            if (placedMask & (1 << previous)) inversionCount++;
          }
          const task = flexibleTasks[index];
          const startsAfterFixed = fixedTasksForDay.filter(function (fixed) {
            return (
              task.sourceOrder < fixed.sourceOrder &&
              slots[slotIndex].start >= fixed.startDateTime.getTime()
            );
          }).length;
          const startsBeforeFixed = fixedTasksForDay.filter(function (fixed) {
            return (
              task.sourceOrder > fixed.sourceOrder &&
              slots[slotIndex].start < fixed.startDateTime.getTime()
            );
          }).length;
          inversionCount += startsAfterFixed + startsBeforeFixed;
        });
        const next = solve(slotIndex + 1, placedMask | subset);
        if (next) {
          const candidate = {
            reduction: requiredReduction + next.reduction,
            inversions: inversionCount + next.inversions,
            sequence: indexes.concat(next.sequence),
            choices: [subset].concat(next.choices),
          };
          if (
            !best ||
            candidate.reduction < best.reduction ||
            (candidate.reduction === best.reduction &&
              (candidate.inversions < best.inversions ||
                (candidate.inversions === best.inversions &&
                  compareIndexSequences_(candidate.sequence, best.sequence) < 0)))
          ) {
            best = candidate;
          }
        }
      }
      if (subset === 0) break;
      subset = (subset - 1) & remaining;
    }
    memo[key] = best;
    return best;
  }

  const solution = solve(0, 0);
  if (!solution) {
    placeFlexibleTasksForPreview_(
      flexibleTasks,
      date,
      windowStart,
      settings,
      warnings,
      "không tìm được lịch không chồng lấn trong giới hạn duration"
    );
    return;
  }

  solution.choices.forEach(function (mask, slotIndex) {
    const indexes = [];
    for (let index = 0; index < taskCount; index++) {
      if (mask & (1 << index)) indexes.push(index);
    }
    let demand = indexes.reduce(function (total, index) {
      return total + flexibleTasks[index].durationSeconds;
    }, 0) + Math.max(0, indexes.length - 1) * breakSeconds;
    let reductionRemaining = Math.max(
      0,
      demand - slots[slotIndex].capacitySeconds
    );
    for (let position = indexes.length - 1; position >= 0; position--) {
      const index = indexes[position];
      const reduction = Math.min(
        maxReductions[index],
        reductionRemaining
      );
      flexibleTasks[index].reducedBySeconds = reduction;
      flexibleTasks[index].scheduledDuration =
        (flexibleTasks[index].durationSeconds - reduction) / 3600;
      reductionRemaining -= reduction;
    }
    if (reductionRemaining > 0) {
      throw new Error("Lỗi nội bộ khi áp dụng giới hạn giảm duration.");
    }

    let taskStart = slots[slotIndex].start;
    indexes.forEach(function (index) {
      const task = flexibleTasks[index];
      const durationSeconds =
        task.durationSeconds - task.reducedBySeconds;
      const taskEnd = taskStart + durationSeconds * 1000;
      task.clock = clockFromDateTimes_(
        date,
        new Date(taskStart),
        new Date(taskEnd)
      );
      taskStart = taskEnd + breakSeconds * 1000;
    });
  });

  if (tasks.some(function (task) { return !task.clock; })) {
    throw new Error("Scheduler không tạo được CLOCK cho tất cả task.");
  }
}

function placeFlexibleTasksForPreview_(
  tasks,
  date,
  windowStart,
  settings,
  warnings,
  reason
) {
  let cursor = windowStart.getTime();
  tasks.forEach(function (task) {
    const durationSeconds = Math.floor(task.duration * 3600 + 0.5);
    const end = cursor + durationSeconds * 1000;
    task.scheduledDuration = task.duration;
    task.reducedBySeconds = 0;
    task.startDateTime = new Date(cursor);
    task.clock = clockFromDateTimes_(
      date,
      task.startDateTime,
      new Date(end)
    );
    cursor = end + settings.breakMinutes * 60000;
  });
  warnings.push(
    "Ngày " + formatDate_(date) + ": " + reason +
      ". Bản xem trước đặt task linh động theo thứ tự nguồn từ " +
      formatTime_(windowStart) +
      ", giữ nguyên duration; các khối có thể chồng lấn với mốc cố định hoặc Ngủ đêm."
  );
}

function assignSecondaryDailySchedule_(
  mainTasks,
  secondaryTasks,
  date,
  hardAnchors,
  warnings
) {
  const dayStart = dateAtOffset_(date, {
    hour: 0,
    minute: 0,
    second: 0,
  }).getTime();
  const dayEnd = dayStart + 86400000;
  const anchors = hardAnchors.filter(function (anchor) {
    return anchor.start.getTime() < dayEnd && anchor.end.getTime() > dayStart;
  }).slice();
  const fixedStarts = mainTasks
    .filter(function (task) { return !!task.fixedStart; })
    .map(function (task) {
      return dateAtOffset_(date, {
        hour: task.fixedStart.hour,
        minute: task.fixedStart.minute,
        second: 0,
      }).getTime();
    });
  const firstFixedStart = fixedStarts.length
    ? Math.min.apply(null, fixedStarts)
    : null;
  const priorities = {
    morning_hygiene: 0,
    breakfast: 1,
    lunch: 1,
    evening_meal: 1,
    rest: 2,
    personal_hygiene: 2,
    movement: 2,
    news: 3,
    routine: 4,
  };
  const ordered = secondaryTasks.slice().sort(function (left, right) {
    const startDifference =
      left.window_start.localeCompare(right.window_start);
    if (startDifference) return startDifference;
    const priorityDifference =
      (Object.prototype.hasOwnProperty.call(priorities, left.context_type)
        ? priorities[left.context_type]
        : 5) -
      (Object.prototype.hasOwnProperty.call(priorities, right.context_type)
        ? priorities[right.context_type]
        : 5);
    return priorityDifference || left.source_order - right.source_order;
  });

  ordered.forEach(function (task) {
    const windowStart = parseStartTime_(
      task.window_start,
      task.task_id + " window_start"
    );
    const windowEnd = parseStartTime_(
      task.window_end,
      task.task_id + " window_end"
    );
    const startMinutes = windowStart.hour * 60 + windowStart.minute;
    const endMinutes = windowEnd.hour * 60 + windowEnd.minute;
    const durationSeconds = Math.floor(task.duration_hours * 3600 + 0.5);
    const windowStartSeconds = startMinutes * 60;
    const windowEndSeconds = endMinutes * 60;
    let latestEndSeconds = windowEndSeconds;
    if (task.context_type === "breakfast") {
      latestEndSeconds = Math.min(latestEndSeconds, 10 * 3600);
    }
    if (
      task.context_type === "morning_hygiene" &&
      firstFixedStart !== null
    ) {
      latestEndSeconds = Math.min(
        latestEndSeconds,
        Math.floor((firstFixedStart - dayStart) / 1000)
      );
    }

    let preferredStartSeconds = windowStartSeconds;
    const windowDuration = windowEndSeconds - windowStartSeconds;
    if (task.context_type === "breakfast") {
      preferredStartSeconds += 60 * 60;
    } else if (task.context_type === "lunch") {
      preferredStartSeconds += 30 * 60;
    } else if (task.context_type === "evening_meal") {
      preferredStartSeconds += 60 * 60;
    } else if (
      task.context_type === "rest" ||
      task.context_type === "personal_hygiene"
    ) {
      preferredStartSeconds += Math.floor(windowDuration / 2);
    } else if (
      task.context_type === "movement" ||
      task.context_type === "news"
    ) {
      preferredStartSeconds += 90 * 60;
    } else if (task.context_type !== "morning_hygiene") {
      preferredStartSeconds += 30 * 60;
    }

    let best = null;
    const firstCandidate = Math.ceil(windowStartSeconds / 300) * 300;
    for (
      let candidate = firstCandidate;
      candidate + durationSeconds <= Math.min(windowEndSeconds, latestEndSeconds);
      candidate += 300
    ) {
      const start = dayStart + candidate * 1000;
      const end = start + durationSeconds * 1000;
      const overlaps = anchors.some(function (anchor) {
        return (
          start < anchor.end.getTime() &&
          end > anchor.start.getTime()
        );
      });
      if (overlaps) continue;

      const distanceCost = Math.abs(candidate - preferredStartSeconds);
      const spacingCost = anchors.reduce(function (cost, anchor) {
        const gapSeconds = end <= anchor.start.getTime()
          ? (anchor.start.getTime() - end) / 1000
          : start >= anchor.end.getTime()
            ? (start - anchor.end.getTime()) / 1000
            : 0;
        return cost + Math.max(0, 10 * 60 - gapSeconds) * 2;
      }, 0);
      const score = distanceCost + spacingCost;
      if (!best || score < best.score || (score === best.score && start < best.start)) {
        best = { start: start, end: end, score: score };
      }
    }
    if (!best) {
      const latestFallbackStart = Math.min(
        windowEndSeconds,
        latestEndSeconds
      ) - durationSeconds;
      const fallbackStart = latestFallbackStart >= windowStartSeconds
        ? Math.max(
            windowStartSeconds,
            Math.min(preferredStartSeconds, latestFallbackStart)
          )
        : windowStartSeconds;
      const fallbackEnd = fallbackStart + durationSeconds;
      best = {
        start: dayStart + fallbackStart * 1000,
        end: dayStart + fallbackEnd * 1000,
        score: Infinity,
      };
      warnings.push(
        "Secondary Task '" + task.task_name + "' ngày " +
          formatDate_(date) + " không có chỗ trống trong khung " +
          task.window_label + ". Bản xem trước đặt tại " +
          formatClock_(fallbackStart, fallbackEnd) +
          " để hiển thị chồng lấn; duration được giữ nguyên."
      );
    }

    task.suggested_clock = clockFromDateTimes_(
      date,
      new Date(best.start),
      new Date(best.end)
    );
    task.clock = task.suggested_clock;
    const anchor = {
      type: "secondary",
      date: date,
      taskName: task.task_name,
      sourceCell: task.source.day_tab + "!" + task.source.task_cell,
      start: new Date(best.start),
      end: new Date(best.end),
    };
    task.startDateTime = anchor.start;
    anchors.push(anchor);
  });

  return anchors.filter(function (anchor) {
    return anchor.type === "secondary";
  });
}

function compareIndexSequences_(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function validateHardAnchorConflicts_(anchors, warnings) {
  const sorted = anchors.slice().sort(function (left, right) {
    return left.start.getTime() - right.start.getTime();
  });
  let active = null;
  sorted.forEach(function (anchor) {
    if (active && anchor.start.getTime() < active.end.getTime()) {
      const anchorLabel =
        "'" + anchor.taskName + "'" +
        (anchor.sourceCell ? " (" + anchor.sourceCell + ")" : "") +
        " ngày " +
        formatDate_(anchor.date) +
        " [" +
        clockFromDateTimes_(anchor.date, anchor.start, anchor.end) +
        "]";
      const activeLabel =
        "'" + active.taskName + "'" +
        (active.sourceCell ? " (" + active.sourceCell + ")" : "") +
        " ngày " +
        formatDate_(active.date) +
        " [" +
        clockFromDateTimes_(active.date, active.start, active.end) +
        "]";
      warnings.push(
        "Mốc cố định " +
          activeLabel +
          " và " +
          anchorLabel +
          " chồng lấn. Bản xem trước giữ nguyên cả hai để hiển thị."
      );
    }
    if (!active || anchor.end.getTime() > active.end.getTime()) active = anchor;
  });
}

function createSleepAnchor_(date, settings) {
  const start = dateAtOffset_(date, {
    hour: Math.floor(settings.sleepStartMinutes / 60),
    minute: settings.sleepStartMinutes % 60,
    second: 0,
    dayOffset: 0,
  });
  const durationSeconds = Math.floor(settings.sleepDurationHours * 3600 + 0.5);
  return {
    type: "sleep",
    date: date,
    taskName: "Ngủ đêm",
    start: start,
    end: new Date(start.getTime() + durationSeconds * 1000),
  };
}

function clockFromDateTimes_(baseDate, start, end) {
  const midnight = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate()
  );
  const startSeconds = Math.round((start.getTime() - midnight.getTime()) / 1000);
  const endSeconds = Math.round((end.getTime() - midnight.getTime()) / 1000);
  return formatClock_(startSeconds, endSeconds);
}

function validateUniqueFixedStarts_(tasks, date, warnings) {
  const taskByStart = {};
  tasks.forEach(function (task) {
    if (!task.fixedStart) return;
    const startMinutes = task.fixedStart.hour * 60 + task.fixedStart.minute;
    const previous = taskByStart[startMinutes];
    if (previous) {
      warnings.push(
        "Start Time bị trùng ngày " +
          formatDate_(date) +
          ": '" +
          previous.taskName +
          "' (" +
          previous.sourceCell +
          ") và '" +
          task.taskName +
          "' (" +
          task.sourceCell +
          ") cùng bắt đầu lúc " +
          twoDigits_(task.fixedStart.hour) +
          ":" +
          twoDigits_(task.fixedStart.minute) +
          ". Bản xem trước giữ cả hai task để hiển thị chồng lấn."
      );
    }
    taskByStart[startMinutes] = task;
  });
}

function formatClock_(startSeconds, endSeconds) {
  function endpoint(totalSeconds) {
    const dayOffset = Math.floor(totalSeconds / 86400);
    const timeOfDay = totalSeconds % 86400;
    const hour = Math.floor(timeOfDay / 3600);
    const minute = Math.floor((timeOfDay % 3600) / 60);
    const second = timeOfDay % 60;
    return (
      twoDigits_(hour) +
      ":" +
      twoDigits_(minute) +
      (second ? ":" + twoDigits_(second) : "") +
      (dayOffset ? " (+" + dayOffset + " day)" : "")
    );
  }
  return endpoint(startSeconds) + " - " + endpoint(endSeconds);
}

function internalSleepTaskId_(sourceId, taskDate) {
  const digest = fingerprint_("SLEEP|" + sourceId + "|" + taskDate)
    .slice(0, 24)
    .toUpperCase();
  return "ADP-" + digest;
}

function normalizationFingerprint_(result, settings) {
  return fingerprint_(
    result.destination_tab + "|" + JSON.stringify(settings) + "|" +
      JSON.stringify(result.rows) + "|" + JSON.stringify(result.secondary_rows)
  );
}

function prepareCalendarPlan_(tabNameInput, selectedDatesInput, options) {
  const tabName = text_(tabNameInput);
  const database = readCalendarDatabase_(tabName);
  const selectedDates = normalizeSelectedDates_(
    selectedDatesInput,
    database.days
  );
  const selectedDateSet = {};
  selectedDates.forEach(function (date) {
    selectedDateSet[date] = true;
  });
  const records = [];
  const seenKeys = {};
  const mainSequenceByDate = {};
  const sleepByDate = {};

  for (let index = 1; index < database.values.length; index++) {
    const row = database.values[index];
    if (!row.some(function (value) { return value !== "" && value !== null; })) {
      continue;
    }
    const dateText = formatDate_(parseDate_(row[0], "Database A" + (index + 1)));
    if (!selectedDateSet[dateText]) continue;
    const taskId = text_(row[9]);
    const name = text_(row[4]);
    if (!taskId || !name) {
      throw new Error(
        "Database dòng " + (index + 1) + " thiếu ID TASK hoặc CÔNG VIỆC."
      );
    }
    const key = taskId + "|" + dateText;
    if (seenKeys[key]) {
      throw new Error("ID TASK bị trùng trong database: " + taskId);
    }
    seenKeys[key] = true;
    if (!text_(row[7])) {
      throw new Error(
        "Task '" +
          name +
          "' ngày " +
          dateText +
          " chưa có CLOCK. Hãy ghi lại snapshot trước khi đồng bộ."
      );
    }
    const taskType = text_(row[10]) || "main";
    const sourceOrder = Number(row[2]);
    if (!Number.isInteger(sourceOrder) || sourceOrder < 1) {
      throw new Error("STT không hợp lệ trong database dòng " + (index + 1) + ".");
    }
    if (taskType !== "secondary") {
      mainSequenceByDate[dateText] = (mainSequenceByDate[dateText] || 0) + 1;
      if (sourceOrder !== mainSequenceByDate[dateText]) {
        throw new Error(
          "STT task chính không liên tục theo thứ tự nguồn trong ngày " +
            dateText + "; từ chối đồng bộ sai thứ tự."
        );
      }
    }
    const clock = parseClock_(row[7], taskId);
    const taskDate = parseDate_(dateText, "Ngày task");
    const start = dateAtOffset_(taskDate, clock.start);
    const end = dateAtOffset_(taskDate, clock.end);
    if (end.getTime() <= start.getTime()) {
      throw new Error("CLOCK không hợp lệ hoặc qua nửa đêm cho task " + taskId + ".");
    }
    const duration = taskType === "secondary"
      ? parseSecondaryDuration_(
        row[6],
        "Database Secondary DURING row " + (index + 1)
      )
      : parseDecimal_(
        row[6],
        "Database G" + (index + 1) + " (DURING)"
      );
    if (duration <= 0 || Math.floor(duration * 3600 + 0.5) * 1000 !== end - start) {
      throw new Error(
        "CLOCK không khớp DURING trong database dòng " + (index + 1) + "."
      );
    }
    const isSleepTask = taskType === "sleep" || name === "Ngủ đêm";
    if (isSleepTask) sleepByDate[dateText] = (sleepByDate[dateText] || 0) + 1;
    records.push({
      date: dateText,
      sourceOrder: sourceOrder,
      taskId: taskId,
      taskName: name,
      title: text_(row[3]) ? text_(row[3]) + " " + name : name,
      description: text_(row[5]),
      isSleepTask: isSleepTask,
      taskType: taskType,
      colorName: isSleepTask ? "GRAY" : text_(row[8]),
      start: start,
      end: end,
      status: "",
      existing: null,
    });
  }

  selectedDates.forEach(function (date) {
    if (!mainSequenceByDate[date]) {
      throw new Error("Database không có task cho ngày đã chọn " + date + ".");
    }
    if (sleepByDate[date] !== 1) {
      throw new Error(
        "Ngày " + date +
          " phải có đúng một task 'Ngủ đêm'."
      );
    }
  });

  const calendar = getTestCalendar_();
  const firstDate = parseDate_(selectedDates[0], "Ngày đồng bộ");
  const lastDate = parseDate_(selectedDates[selectedDates.length - 1], "Ngày đồng bộ");
  const scanStart = new Date(firstDate.getTime());
  const scanEnd = new Date(lastDate.getTime());
  scanEnd.setDate(scanEnd.getDate() + 2);
  const scannedEvents = calendar.getEvents(scanStart, scanEnd);
  const relevantEvents = scannedEvents.filter(function (event) {
    const ownerDate = event.getTag("schedulerTaskDate");
    if (
      event.getTag(EVENT_TAG_SOURCE) === "1" &&
      selectedDateSet[ownerDate]
    ) {
      return true;
    }
    return selectedDates.some(function (date) {
      const dayStart = parseDate_(date, "Ngày đồng bộ");
      const dayEnd = new Date(dayStart.getTime());
      dayEnd.setDate(dayEnd.getDate() + 1);
      return (
        event.getStartTime().getTime() < dayEnd.getTime() &&
        event.getEndTime().getTime() > dayStart.getTime()
      );
    });
  });
  const managedByKey = {};
  const deleteEvents = [];
  relevantEvents.forEach(function (event) {
    if (event.getTag(EVENT_TAG_SOURCE) !== "1") return;
    const taskId = event.getTag("schedulerTaskId");
    const taskDate = event.getTag("schedulerTaskDate");
    if (!taskId || !taskDate) return;
    const key = taskId + "|" + taskDate;
    if (!managedByKey[key]) managedByKey[key] = [];
    managedByKey[key].push(event);
    if (options.deleteManaged && selectedDateSet[taskDate]) {
      deleteEvents.push(event);
    }
  });

  let createCount = 0;
  let updateCount = 0;
  let unchangedCount = 0;
  const items = options.createUpdate ? records : [];
  items.forEach(function (item) {
    const key = item.taskId + "|" + item.date;
    const matches = options.deleteManaged ? [] : (managedByKey[key] || []);
    if (matches.length > 1) {
      throw new Error(
        "Có nhiều Calendar event được quản lý cho task " +
          item.taskId +
          " ngày " +
          item.date +
          "; không thay đổi Calendar."
      );
    }
    item.existing = matches.length ? matches[0] : null;
    if (!item.existing) {
      const unmanagedDuplicate = relevantEvents.find(function (event) {
        const managed = event.getTag(EVENT_TAG_SOURCE) === "1";
        const sameTitle =
          event.getTitle() === item.title ||
          event.getTitle() === item.taskName;
        return (
          !managed &&
          sameTitle &&
          event.getStartTime().getTime() === item.start.getTime() &&
          event.getEndTime().getTime() === item.end.getTime()
        );
      });
      if (unmanagedDuplicate) {
        throw new Error(
          "Calendar có event không do ứng dụng quản lý nhưng trùng tên và giờ: '" +
            item.title +
            "' ngày " +
            item.date +
            ". Hãy kiểm tra event đó trước khi đồng bộ."
        );
      }
    }
    item.color = eventColor_(item.colorName);
    if (!item.existing) {
      item.status = "create";
      createCount++;
    } else if (eventNeedsUpdate_(item.existing, item)) {
      item.status = "update";
      updateCount++;
    } else {
      item.status = "unchanged";
      unchangedCount++;
    }
  });

  const eventSnapshot = relevantEvents.map(function (event) {
    return [
      event.getId(),
      event.getTitle(),
      event.getDescription() || "",
      event.getStartTime().getTime(),
      event.getEndTime().getTime(),
      event.getTag(EVENT_TAG_SOURCE) || "",
      event.getTag("schedulerTaskId") || "",
      event.getTag("schedulerTaskDate") || "",
      event.getLastUpdated().getTime(),
    ];
  });
  const taskSnapshot = records.map(function (item) {
    return [
      item.taskId,
      item.date,
      item.sourceOrder,
      item.title,
      item.description || "",
      item.start.getTime(),
      item.end.getTime(),
      item.colorName || "",
    ];
  });
  const fingerprint = fingerprint_(
    tabName +
      "|" +
      JSON.stringify(selectedDates) +
      "|" +
      JSON.stringify(options) +
      "|" +
      JSON.stringify(taskSnapshot) +
      "|" +
      JSON.stringify(eventSnapshot)
  );
  return {
    calendar: calendar,
    selectedDates: selectedDates,
    items: items,
    deleteEvents: deleteEvents,
    fingerprint: fingerprint,
    summary: {
      destinationTab: tabName,
      calendarTitle: TEST_CALENDAR_TITLE,
      selectedDates: database.days.filter(function (day) {
        return selectedDateSet[day.date];
      }),
      options: options,
      createCount: createCount,
      updateCount: updateCount,
      unchangedCount: unchangedCount,
      deleteCount: deleteEvents.length,
      skippedCount: 0,
      calendarEvents: relevantEvents.map(function (event) {
        const managed = event.getTag(EVENT_TAG_SOURCE) === "1";
        return {
          title: event.getTitle(),
          startDate: formatDate_(event.getStartTime()),
          startTime: formatTime_(event.getStartTime()),
          endDate: formatDate_(event.getEndTime()),
          endTime: formatTime_(event.getEndTime()),
          managed: managed,
          taskDate: event.getTag("schedulerTaskDate") || "",
          deletable: managed && selectedDateSet[event.getTag("schedulerTaskDate")],
        };
      }),
      items: items.map(function (item) {
        return {
          date: item.date,
          weekday: getWeekdayName_(parseDate_(item.date, "Ngày task")),
          sourceOrder: item.sourceOrder,
          title: item.title,
          description: item.description,
          durationHours: (item.end.getTime() - item.start.getTime()) / 3600000,
          startDate: formatDate_(item.start),
          startTime: formatTime_(item.start),
          endDate: formatDate_(item.end),
          endTime: formatTime_(item.end),
          colorName: item.colorName || "",
          status: item.status,
        };
      }),
    },
  };
}

function readCalendarDatabase_(tabNameInput) {
  const tabName = text_(tabNameInput);
  const database = openDatabase_();
  const tabs = database.getSheets().filter(function (sheet) {
    return sheet.getName() === tabName;
  });
  if (tabs.length !== 1) {
    throw new Error("Không tìm thấy duy nhất tab database '" + tabName + "'.");
  }
  const sheet = tabs[0];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("Tab database không có task để đồng bộ.");
  const mainValues = sheet
    .getRange(1, 1, lastRow, DATABASE_HEADERS.length)
    .getValues();
  if (!sameRow_(mainValues[0], DATABASE_HEADERS)) {
    throw new Error("Header database không đúng schema; từ chối đồng bộ.");
  }
  const secondaryHeaders = sheet
    .getRange(1, 13, 1, SECONDARY_DATABASE_HEADERS.length)
    .getDisplayValues()[0];
  if (
    secondaryHeaders.some(function (value) { return text_(value) !== ""; }) &&
    !sameRow_(secondaryHeaders, SECONDARY_DATABASE_HEADERS)
  ) {
    throw new Error("Header Secondary Task không đúng schema; từ chối đồng bộ.");
  }
  const secondaryValues = sheet
    .getRange(2, 13, lastRow - 1, SECONDARY_DATABASE_HEADERS.length)
    .getValues();
  const hasSecondaryData = secondaryValues.some(function (row) {
    return row.some(function (value) {
      return value !== "" && value !== null;
    });
  });
  const hasSecondaryHeaders = sameRow_(
    secondaryHeaders,
    SECONDARY_DATABASE_HEADERS
  );
  if (!hasSecondaryHeaders && hasSecondaryData) {
    throw new Error(
      "Có dữ liệu M:Y nhưng header Secondary Task không hợp lệ; từ chối đồng bộ."
    );
  }
  const values = [mainValues[0]];
  mainValues.slice(1).forEach(function (row) {
    values.push(row.concat(["main"]));
  });
  if (hasSecondaryHeaders) {
    secondaryValues.forEach(function (row) {
      if (!row.some(function (value) { return value !== "" && value !== null; })) {
        return;
      }
      values.push([
        row[0],
        row[1],
        row[4],
        row[6],
        row[7],
        row[8],
        row[9],
        row[10],
        row[11],
        row[12],
        "secondary",
      ]);
    });
  }
  const counts = {};
  for (let index = 1; index < values.length; index++) {
    const row = values[index];
    if (!row.some(function (value) { return value !== "" && value !== null; })) {
      continue;
    }
    const date = formatDate_(parseDate_(row[0], "Database A" + (index + 1)));
    counts[date] = (counts[date] || 0) + 1;
  }
  const days = Object.keys(counts)
    .sort()
    .map(function (date) {
      return {
        date: date,
        weekday: getWeekdayName_(parseDate_(date, "Ngày database")),
        taskCount: counts[date],
      };
    });
  if (!days.length) throw new Error("Tab database không có ngày task.");
  return { values: values, days: days };
}

function normalizeSelectedDates_(input, days) {
  const available = {};
  days.forEach(function (day) {
    available[day.date] = true;
  });
  if (input === undefined || input === null) {
    return days.map(function (day) { return day.date; });
  }
  if (!Array.isArray(input) || !input.length) {
    throw new Error("Hãy chọn ít nhất một ngày để đồng bộ.");
  }
  const selected = {};
  input.forEach(function (value) {
    const date = text_(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !available[date]) {
      throw new Error("Ngày đồng bộ không tồn tại trong database: " + date + ".");
    }
    if (selected[date]) {
      throw new Error("Ngày đồng bộ bị chọn lặp: " + date + ".");
    }
    selected[date] = true;
  });
  return days.filter(function (day) {
    return selected[day.date];
  }).map(function (day) {
    return day.date;
  });
}

function normalizeCalendarSyncOptions_(input) {
  const options = input || {};
  const deleteManaged = options.deleteManaged === true;
  const createUpdate =
    options.createUpdate === undefined ? true : options.createUpdate === true;
  if (!deleteManaged && !createUpdate) {
    throw new Error("Hãy chọn ít nhất một tùy chọn: xóa lịch hoặc tạo/cập nhật.");
  }
  return {
    deleteManaged: deleteManaged,
    createUpdate: createUpdate,
  };
}

function getWeekdayName_(date) {
  return WEEKDAYS_VI[date.getDay() === 0 ? 6 : date.getDay() - 1];
}

function eventNeedsUpdate_(event, item) {
  if (
    event.getTitle() !== item.title ||
    event.getDescription() !== item.description ||
    event.getStartTime().getTime() !== item.start.getTime() ||
    event.getEndTime().getTime() !== item.end.getTime()
  ) {
    return true;
  }
  if (item.color && String(event.getColor()) !== String(item.color)) return true;
  return false;
}

function getTestCalendar_() {
  const matches = CalendarApp.getAllCalendars().filter(function (calendar) {
    return calendar.getName() === TEST_CALENDAR_TITLE;
  });
  if (matches.length !== 1) {
    throw new Error(
      "Cần đúng một Calendar test tên '" +
        TEST_CALENDAR_TITLE +
        "'; tìm thấy " +
        matches.length +
        "."
    );
  }
  return matches[0];
}

function openDatabase_() {
  const database = SpreadsheetApp.openById(DATABASE_SPREADSHEET_ID);
  if (database.getName() !== DATABASE_SPREADSHEET_TITLE) {
    throw new Error(
      "Tên workbook đích không đúng; từ chối ghi vào '" +
        database.getName() +
        "'."
    );
  }
  return database;
}

function getOrCreateDatabaseTab_(database, tabName) {
  const matches = database.getSheets().filter(function (sheet) {
    return sheet.getName() === tabName;
  });
  if (matches.length > 1) {
    throw new Error("Có nhiều tab trùng tên '" + tabName + "'.");
  }
  if (matches.length === 1) {
    const sheet = matches[0];
    const headers = sheet
      .getRange(1, 1, 1, DATABASE_HEADERS.length)
      .getDisplayValues()[0];
    if (!sameRow_(headers, DATABASE_HEADERS)) {
      throw new Error(
        "Header tab '" + tabName + "' không đúng; từ chối ghi đè."
      );
    }
    const secondaryHeaders = sheet
      .getRange(1, 13, 1, SECONDARY_DATABASE_HEADERS.length)
      .getDisplayValues()[0];
    if (secondaryHeaders.every(function (value) { return text_(value) === ""; })) {
      sheet.getRange(1, 13, 1, SECONDARY_DATABASE_HEADERS.length)
        .setValues([SECONDARY_DATABASE_HEADERS]);
    } else if (!sameRow_(secondaryHeaders, SECONDARY_DATABASE_HEADERS)) {
      throw new Error(
        "Header Secondary Task tab '" + tabName +
          "' không đúng; từ chối ghi đè."
      );
    }
    return sheet;
  }
  const sheet = database.insertSheet(tabName);
  sheet
    .getRange(1, 1, 1, DATABASE_HEADERS.length)
    .setValues([DATABASE_HEADERS]);
  sheet
    .getRange(1, 13, 1, SECONDARY_DATABASE_HEADERS.length)
    .setValues([SECONDARY_DATABASE_HEADERS]);
  return sheet;
}

function extractSpreadsheetId_(input) {
  const value = text_(input);
  const linkMatch = value.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  const id = linkMatch ? linkMatch[1] : value;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    throw new Error("Hãy nhập Spreadsheet ID hoặc URL Google Sheets hợp lệ.");
  }
  return id;
}

function parseDate_(value, field) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const text = text_(value);
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return validDate_(+match[1], +match[2], +match[3], field);
  match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return validDate_(+match[3], +match[2], +match[1], field);
  match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) return validDate_(+match[3], +match[2], +match[1], field);
  throw new Error(field + " có ngày không hợp lệ: '" + text + "'.");
}

function validDate_(year, month, day, field) {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(field + " có ngày không hợp lệ.");
  }
  return date;
}

function parseDecimal_(value, field) {
  if (typeof value === "boolean" || value === null || text_(value) === "") {
    throw new Error(field + " đang trống hoặc không phải số.");
  }
  const normalized = String(value).trim().replace(",", ".");
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(field + " có giá trị thập phân không hợp lệ: " + value);
  }
  const result = Number(normalized);
  if (!Number.isFinite(result)) throw new Error(field + " phải là số hữu hạn.");
  return result;
}

function parseSecondaryDuration_(value, field) {
  if (typeof value === "boolean" || value === null || text_(value) === "") {
    throw new Error(field + " đang trống hoặc không phải số.");
  }
  const duration = Number(String(value).trim().replace(",", "."));
  const minutes = duration * 60;
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    Math.abs(minutes - Math.round(minutes)) > 1e-6
  ) {
    throw new Error(
      field + " phải là thời lượng giờ dương, quy đổi chính xác ra phút."
    );
  }
  return duration;
}

function parseStartTime_(value, field) {
  if (value === null || text_(value) === "") return null;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return { hour: value.getHours(), minute: value.getMinutes() };
  }
  if (typeof value === "number") {
    if (value < 0 || value >= 1) {
      throw new Error(field + " dạng số phải là phân số giờ Google Sheets.");
    }
    const totalMinutes = Math.floor(value * 1440 + 0.5) % 1440;
    return {
      hour: Math.floor(totalMinutes / 60),
      minute: totalMinutes % 60,
    };
  }
  const text = text_(value);
  let match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const hour = +match[1];
    const minute = +match[2];
    if (hour < 24 && minute < 60) return { hour: hour, minute: minute };
  }
  match = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let hour = +match[1];
    const minute = +match[2];
    if (hour >= 1 && hour <= 12 && minute < 60) {
      hour = hour % 12 + (/PM/i.test(match[3]) ? 12 : 0);
      return { hour: hour, minute: minute };
    }
  }
  throw new Error(field + " có giờ không hợp lệ: '" + text + "'.");
}

function parseClock_(value, taskId) {
  const match = text_(value).match(
    /^(\d{2}):(\d{2})(?::(\d{2}))?(?: \(\+(\d+) (?:day|ng.y)\))? - (\d{2}):(\d{2})(?::(\d{2}))?(?: \(\+(\d+) (?:day|ng.y)\))?$/
  );
  if (!match) {
    throw new Error("CLOCK không đúng định dạng cho task " + taskId + ".");
  }
  const start = {
    hour: +match[1],
    minute: +match[2],
    second: +(match[3] || 0),
    dayOffset: +(match[4] || 0),
  };
  const end = {
    hour: +match[5],
    minute: +match[6],
    second: +(match[7] || 0),
    dayOffset: +(match[8] || 0),
  };
  [start, end].forEach(function (time) {
    if (
      time.hour > 23 ||
      time.minute > 59 ||
      time.second > 59
    ) {
      throw new Error("CLOCK có giờ không hợp lệ cho task " + taskId + ".");
    }
  });
  if (end.dayOffset < start.dayOffset) {
    throw new Error("CLOCK có thứ tự ngày không hợp lệ cho task " + taskId + ".");
  }
  return { start: start, end: end };
}

function splitClock_(value, baseDate) {
  const parsed = parseClock_(value, "preview");
  const date = parseDate_(baseDate, "preview date");
  const start = dateAtOffset_(date, parsed.start);
  const end = dateAtOffset_(date, parsed.end);
  return {
    startDate: formatDate_(start),
    startTime: formatTime_(start),
    endDate: formatDate_(end),
    endTime: formatTime_(end),
  };
}

function dateAtOffset_(baseDate, time) {
  const date = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    time.hour,
    time.minute,
    time.second
  );
  date.setDate(date.getDate() + (time.dayOffset || 0));
  return date;
}

function normalizedName_(value) {
  return text_(value).normalize("NFC").replace(/\s+/g, " ").toLowerCase();
}

function internalTaskId_(sourceId, date, cell) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    sourceId + "|" + date + "|" + cell,
    Utilities.Charset.UTF_8
  );
  const digest = bytes
    .map(function (byte) {
      return ("0" + ((byte + 256) % 256).toString(16)).slice(-2);
    })
    .join("")
    .slice(0, 24)
    .toUpperCase();
  return "ADP-" + digest;
}

function fingerprint_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  );
  return bytes
    .map(function (byte) {
      return ("0" + ((byte + 256) % 256).toString(16)).slice(-2);
    })
    .join("");
}

function icon_(groupClass, taskClass) {
  const group = text_(groupClass).normalize("NFC").toUpperCase();
  const type = text_(taskClass).normalize("NFC").toUpperCase();
  if (type === "SYSTEM" || group.indexOf("SYSTEM") >= 0) return "⚙️";
  if (group.indexOf("BẢN SẮC") >= 0) return "🎭";
  if (group.indexOf("ĐẠO ĐỒ") >= 0) return "🧘";
  if (group.indexOf("SỰ NGHIỆP") >= 0) return "💼";
  return "";
}

function calendarColor_(taskClass, gi) {
  if (gi !== 0) return "MAUVE";
  const type = text_(taskClass).normalize("NFC").trim().toUpperCase();
  if (type === "SYSTEM") return "RED";
  if (["KNOWLEDGES", "CASUAL SKILLS", "NỘI TẠI"].indexOf(type) >= 0) {
    return "GREEN";
  }
  if (["DƯỠNG SINH", "SIÊU SINH", "TRƯỜNG SINH"].indexOf(type) >= 0) {
    return "YELLOW";
  }
  return "";
}

function eventColor_(colorName) {
  if (!colorName) return "";
  const colors = {
    MAUVE: CalendarApp.EventColor.MAUVE,
    RED: CalendarApp.EventColor.RED,
    GREEN: CalendarApp.EventColor.GREEN,
    YELLOW: CalendarApp.EventColor.YELLOW,
    GRAY: CalendarApp.EventColor.GRAY,
    "MÀU HOA ANH ĐÀO": CalendarApp.EventColor.PALE_RED,
  };
  if (!Object.prototype.hasOwnProperty.call(colors, colorName)) {
    throw new Error("Màu Calendar chưa được ánh xạ: " + colorName);
  }
  return colors[colorName];
}

function description_(
  taskId,
  category,
  taskClass,
  name,
  content,
  pr,
  gi,
  duration,
  originalDuration,
  clock
) {
  let normalizedContent = text_(content);
  if (normalizedContent.startsWith("[") && normalizedContent.endsWith("]")) {
    normalizedContent = normalizedContent.slice(1, -1).trim();
  }
  if (normalizedContent) normalizedContent = "-> " + normalizedContent;
  const lines = [
    "INTERNAL_TASK_ID: " + taskId,
    "CATEGORY: " + text_(category),
    "CLASS: " + text_(taskClass),
    "CÔNG VIỆC: " + name,
    "NỘI DUNG: " + normalizedContent,
    "PR: " + formatSourceValue_(pr),
    "GI: " + String(gi),
    "DURING: " + String(duration),
  ];
  if (clock) lines.push("CLOCK: " + String(clock));
  if (duration !== originalDuration) {
    lines.push("ORIGINAL_DURING: " + String(originalDuration));
    lines.push(
      "SCHEDULE_ADJUSTMENT: -" +
        String(Math.round((originalDuration - duration) * 3600) / 3600) +
        " hours"
    );
  }
  return lines.join("\n");
}

function secondaryDescription_(task, clock) {
  const lines = [
    "INTERNAL_TASK_ID: " + task.task_id,
    "CÔNG VIỆC: " +
      (task.icon ? task.icon + " " : "") + task.task_name,
    "BUỔI: " + task.period,
    "KHUNG GIỜ: " + task.window_label,
    "NHÓM: " + task.group,
    "CATEGORY: " + task.category,
    "CLASS: " + task.class,
    "DURING: " + task.duration_hours + " hours (" +
      task.duration_minutes + " minutes)",
    "MÔ TẢ: " + text_(task.description),
  ];
  if (clock) lines.push("CLOCK: " + String(clock));
  return lines.join("\n");
}

function serializeDate_(value, displayValue, timezone) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, "yyyy-MM-dd");
  }
  return text_(displayValue || value);
}

function serializeMasterValue_(value, displayValue, timezone) {
  if (value === "" || value === null) return text_(displayValue);
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, "yyyy-MM-dd'T'HH:mm:ss");
  }
  return value;
}

function serializeStartTime_(value, displayValue, timezone) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, "HH:mm");
  }
  if (typeof value === "number") return value;
  return text_(displayValue || value);
}

function formatSourceValue_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function formatDate_(date) {
  return (
    date.getFullYear() +
    "-" +
    twoDigits_(date.getMonth() + 1) +
    "-" +
    twoDigits_(date.getDate())
  );
}

function formatTime_(date) {
  const base = twoDigits_(date.getHours()) + ":" + twoDigits_(date.getMinutes());
  return date.getSeconds() ? base + ":" + twoDigits_(date.getSeconds()) : base;
}

function twoDigits_(value) {
  return ("0" + value).slice(-2);
}

function sameRow_(left, right) {
  return (
    left.length === right.length &&
    left.every(function (value, index) {
      return String(value) === String(right[index]);
    })
  );
}

function text_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
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
