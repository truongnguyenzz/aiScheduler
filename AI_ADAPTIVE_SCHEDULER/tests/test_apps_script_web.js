const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("apps_script_web\\Code.gs", "utf8");
const html = fs.readFileSync("apps_script_web\\Index.html", "utf8");
const clientScript = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(clientScript, "Web UI script must be present.");
assert.match(source, /const APP_VERSION = "2026\.11\.14\.8";/);
assert.match(html, /Scheduler Control <span class="version-badge">v<\?= appVersion \?><\/span>/);
assert.match(html, /id="sourceViewSwitch"/);
assert.doesNotMatch(html, /Upload lịch đã tối ưu|previewOptimizedFile|writeOptimizedFile/);
new vm.Script(clientScript[1]);
const context = {
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    Charset: { UTF_8: "UTF-8" },
    computeDigest(_algorithm, value) {
      return Array.from(crypto.createHash("sha256").update(value, "utf8").digest())
        .map((byte) => (byte > 127 ? byte - 256 : byte));
    },
  },
};
vm.createContext(context);
vm.runInContext(source, context);
context.CalendarApp = {
  EventColor: {
    MAUVE: "3",
    RED: "11",
    GREEN: "10",
    YELLOW: "5",
    GRAY: "8",
    PALE_RED: "4",
  },
};
let renderedVersion = "";
let renderedTitle = "";
context.HtmlService = {
  createTemplateFromFile(name) {
    assert.equal(name, "Index");
    return {
      evaluate() {
        renderedVersion = this.appVersion;
        return {
          setTitle(title) {
            renderedTitle = title;
            return this;
          },
        };
      },
    };
  },
};
context.doGet();
assert.equal(renderedVersion, "2026.11.14.8");
assert.equal(renderedTitle, "Scheduler Control");
assert.equal(typeof context.previewOptimizedSchedule, "undefined");
assert.equal(typeof context.writeOptimizedSchedule, "undefined");

function makePayload(startTime = "08:00", duration = 1.5) {
  const readyRows = [];
  for (let day = 0; day < 7; day++) {
    readyRows.push({
      row_number: day + 16,
      date: new Date(Date.UTC(2026, 10, 9 + day)).toISOString().slice(0, 10),
      tasks:
        day === 0
          ? [{ cell: "O16", name: "Task cố định" }]
          : [],
    });
  }
  return {
    source_spreadsheet_id: "test-source-id",
    ready_rows: readyRows,
    master_rows: [
      {
        row_number: 3,
        values: [
          "SỰ NGHIỆP",
          "SYSTEM",
          "Task cố định",
          "[Nội dung mẫu]",
          1,
          0,
          duration,
          "",
          startTime,
        ],
      },
    ],
  };
}

const result = context.normalizePayload_(makePayload());
assert.equal(result.destination_tab, "09/11 - 15/11/ 2026");
assert.equal(result.task_count, 8);
assert.equal(result.main_task_count, 1);
assert.equal(result.sleep_task_count, 7);
assert.equal(result.rows[0][4], "Task cố định");
assert.equal(result.rows[1][2], 2);
assert.equal(result.rows[1][4], "Ngủ đêm");
assert.equal(result.rows[1][3], "🌙");
assert.equal(result.rows[1][5], "Ngủ đêm hôm nay");
assert.equal(result.rows[1][6], 5);
assert.equal(result.rows[1][7], "03:00 - 08:00");
assert.equal(result.rows[1][8], "GRAY");
assert.match(result.rows[1][9], /^ADP-[0-9A-F]{24}$/);
assert.equal(result.rows[2][4], "Ngủ đêm");
for (let day = 0; day < 7; day++) {
  const dayRows = result.rows.filter((row) => row[0] === `2026-11-${String(9 + day).padStart(2, "0")}`);
  assert.equal(dayRows.filter((row) => row[4] === "Ngủ đêm").length, 1);
}
assert.equal(result.unassigned_clock_count, 0);
assert.equal(result.rows[0][3], "⚙️");
assert.equal(result.rows[0][7], "08:00 - 09:30");
assert.equal(result.rows[0][8], "RED");
assert.equal(result.transfer_tasks[0].category, "SỰ NGHIỆP");
assert.equal(result.transfer_tasks[0].class, "SYSTEM");
assert.equal(result.transfer_tasks[0].gi, 0);
assert.equal(result.transfer_tasks[1].icon, "🌙");
assert.match(result.rows[0][5], /CATEGORY: SỰ NGHIỆP/);
assert.match(result.rows[0][5], /CLOCK: 08:00 - 09:30/);
assert.doesNotMatch(result.transfer_tasks[0].description, /^CLOCK:/m);
assert.equal(result.rows[0][9], "ADP-" + crypto
  .createHash("sha256")
  .update("test-source-id|2026-11-09|O16", "utf8")
  .digest("hex")
  .slice(0, 24)
  .toUpperCase());
assert.match(result.rows[0][5], /-> Nội dung mẫu/);

let finderOptions = {};
const lastMasterCell = {
  getRow: () => 55,
};
const mockSourceSheet = {
  getMaxRows: () => 20000,
  getRange(row, column, rowCount, columnCount) {
    assert.deepEqual([row, column, rowCount, columnCount], [3, 3, 19998, 1]);
    return {
      createTextFinder(pattern) {
        assert.equal(pattern, "\\S");
        return {
          useRegularExpression(value) {
            finderOptions.regexp = value;
            return this;
          },
          matchFormulaText(value) {
            finderOptions.matchFormulaText = value;
            return this;
          },
          findPrevious() {
            return lastMasterCell;
          },
        };
      },
    };
  },
};
assert.equal(context.findLastMasterRow_(mockSourceSheet), 55);
assert.deepEqual(finderOptions, { regexp: true, matchFormulaText: false });

assert.equal(
  context.normalizePayload_(makePayload("08:00", 1.67)).rows[0][7],
  "08:00 - 09:40:12"
);

const formulaGroupTasks = makePayload("", 1);
formulaGroupTasks.ready_rows[0].tasks = [
  { cell: "O16", name: "Task bản sắc" },
  { cell: "Q16", name: "Task kế thừa nhóm gộp" },
];
formulaGroupTasks.master_rows = [
  {
    row_number: 3,
    values: [
      "SCHOOL CALENDAR",
      "KNOWLEDGES",
      "Task bản sắc",
      "Nội dung",
      0,
      0,
      1,
      "",
      "",
    ],
  },
  {
    row_number: 4,
    values: [
      "",
      "KNOWLEDGES",
      "Task kế thừa nhóm gộp",
      "Nội dung",
      0,
      0,
      1,
      "",
      "",
    ],
  },
];
const mergedGroupFormula =
  '="LANGUAGES" & IF(1=0; "là phân loại các công việc cụ thể nhằm HỌC TẬP, ' +
  'nâng cao chát lượng môn học ngoại ngữ mà tôi cần hoặc sẽ thiết kế đẻ mình ' +
  'phải có trong tương lai, có thể đó là các ngôn ngữ Trung, Anh, Nhật, Hàn, ' +
  'Ả Rập, etv,...các ngôn ngữ mà tôi thấy tiềm năng và có thể sắp xếp dược ' +
  'thời gian hàng tuần để nắm giữu chúng"& CHAR(10) & ' +
  '"+ [Phân loại : BẢN SẮC]"; "")';
const mockSourceDateValues = Array.from({ length: 7 }, (_, index) =>
  new Date(Date.UTC(2026, 10, 9 + index))
);
const mockReadyDisplays = Array.from({ length: 7 }, (_, index) => {
  const row = Array(23).fill("");
  if (index === 0) {
    row[0] = "Task bản sắc";
    row[2] = "Task kế thừa nhóm gộp";
  }
  return row;
});
const mockMasterValues = formulaGroupTasks.master_rows.map((master) =>
  master.values.slice()
);
const mockMasterDisplays = mockMasterValues.map((row) =>
  row.map((value) => String(value == null ? "" : value))
);
const mockMasterFormulas = [
  [mergedGroupFormula, "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", ""],
];
const mockFormulaSheet = {
  getMaxRows: () => 200,
  getRange(rangeOrRow, _column, rowCount, columnCount) {
    if (typeof rangeOrRow === "string") {
      if (rangeOrRow === "M16:M22") {
        return {
          getValues: () => mockSourceDateValues.map((value) => [value]),
          getDisplayValues: () => mockSourceDateValues.map((value) => [
            value.toISOString().slice(0, 10),
          ]),
        };
      }
      if (rangeOrRow === "O16:AK22") {
        return { getDisplayValues: () => mockReadyDisplays };
      }
      throw new Error("Unexpected A1 range " + rangeOrRow);
    }
    if (rangeOrRow === 3 && _column === 3) {
      assert.equal(rowCount, 198);
      assert.equal(columnCount, 1);
      return {
        createTextFinder: () => ({
          useRegularExpression() { return this; },
          matchFormulaText() { return this; },
          findPrevious: () => ({ getRow: () => 4 }),
        }),
      };
    }
    if (rangeOrRow === 3 && _column === 1) {
      assert.equal(rowCount, 2);
      assert.equal(columnCount, 9);
      return {
        getValues: () => mockMasterValues,
        getDisplayValues: () => mockMasterDisplays,
        getFormulas: () => mockMasterFormulas,
      };
    }
    throw new Error("Unexpected numeric range " + [rangeOrRow, _column]);
  },
};
function makeMockSecondarySheet(weekday) {
  const catalogValues = Array.from({ length: 25 }, () => Array(6).fill(""));
  const catalogFormulas = Array.from({ length: 25 }, () => Array(6).fill(""));
  catalogValues[1] = ["GROUP", "CLASS", "TASK", "DESCRIPTION", "HOURS", "MINUTES"];
  const distribution = Array.from({ length: 17 }, () => Array(13).fill(""));
  distribution[0][2] = weekday;
  return {
    catalogValues,
    catalogFormulas,
    distribution,
    getRange(range) {
      if (range === "A1:F25") {
        return {
          getValues: () => catalogValues,
          getDisplayValues: () => catalogValues,
          getFormulas: () => catalogFormulas,
        };
      }
      if (range === "H1:T17") {
        return { getDisplayValues: () => distribution };
      }
      throw new Error("Unexpected Secondary Task range " + range);
    },
  };
}
const mockSecondarySheets = Object.fromEntries(
  [
    "THỨ HAI",
    "THỨ BA",
    "THỨ TƯ",
    "THỨ NĂM",
    "THỨ SÁU",
    "THỨ BẢY",
    "CHỦ NHẬT",
  ].map((weekday) => [weekday, makeMockSecondarySheet(weekday)]),
);
context.SpreadsheetApp = {
  openById: () => ({
    getSpreadsheetTimeZone: () => "Asia/Ho_Chi_Minh",
    getId: () => "test-source-id-0123456789012345",
    getSheetByName: (name) =>
      name === "TUẦN" ? mockFormulaSheet : mockSecondarySheets[name] || null,
    getName: () => "Formula category test",
  }),
};
const formulaDerived = context.normalizeSourceSpreadsheet_(
  "test-source-id-0123456789012345",
  context.normalizeScheduleSettings_(),
  { transferMode: true }
);
assert.equal(
  JSON.stringify(
    formulaDerived.transfer_tasks.slice(0, 2).map((task) => [
    task.category,
    task.icon,
    ])
  ),
  JSON.stringify([
    ["BẢN SẮC", "🎭"],
    ["BẢN SẮC", "🎭"],
  ])
);
assert.equal(
  context.categoryFromGroupFormula_(
    '="School Calendar" & CHAR(10) & "[Phân loại : SỰ NGHIỆP]"',
    "LANGUAGES"
  ),
  "SỰ NGHIỆP"
);
assert.equal(
  context.categoryFromGroupFormula_(
    '="SIÊU SINH" & IF(1=0; "nội dung" & CHAR(10) & "+ [Phân loại : ĐẠO ĐỒ]"; "")',
    "SIÊU SINH"
  ),
  "ĐẠO ĐỒ"
);
assert.equal(
  context.categoryFromGroupFormula_(
    '="School Calendar" & CHAR(10) & "[Phân loại: [SỰ NGHIỆP]]"',
    "LANGUAGES"
  ),
  "SỰ NGHIỆP"
);
assert.equal(
  context.categoryFromGroupFormula_("", "BẢN SẮC"),
  "BẢN SẮC"
);

const mondaySecondarySheet = mockSecondarySheets["THỨ HAI"];
mondaySecondarySheet.catalogValues[2] = [
  "VỆ SINH",
  "VỆ SINH",
  "Vệ sinh sáng",
  "Đánh răng + Rửa mặt",
  0.25,
  15,
];
mondaySecondarySheet.catalogFormulas[2][0] =
  '="VỆ SINH" & CHAR(10) & "[Phân loại : BẢN SẮC]"';
mondaySecondarySheet.distribution[3][0] = "SÁNG (6-12:00 am)";
mondaySecondarySheet.distribution[3][1] = "VỆ SINH";
mondaySecondarySheet.distribution[3][2] = "Vệ sinh sáng";
mondaySecondarySheet.distribution[3][3] = 15;
const secondaryReadyRows = Array.from({ length: 7 }, (_, index) => ({
  row_number: index + 16,
  date: `2026-11-${String(9 + index).padStart(2, "0")}`,
}));
const secondarySource = {
  getId: () => "test-source-id-0123456789012345",
  getSheetByName: (weekday) => mockSecondarySheets[weekday] || null,
};
const extractedSecondaryDays = context.readSecondaryTasks_(
  secondarySource,
  secondaryReadyRows,
);
assert.equal(extractedSecondaryDays[0].tasks.length, 1);
assert.equal(extractedSecondaryDays[0].tasks[0].category, "BẢN SẮC");
assert.equal(extractedSecondaryDays[0].tasks[0].icon, "💦");
assert.equal(extractedSecondaryDays[0].tasks[0].window_label, "06:00-12:00");
assert.equal(extractedSecondaryDays[0].tasks[0].duration_minutes, 15);

function makeSecondaryTask(name, contextType, order, durationMinutes, group, icon) {
  return {
    task_id: context.internalTaskId_(
      "test-source-id",
      "2026-11-09",
      `SECONDARY:THỨ HAI!${name}`,
    ),
    date: "2026-11-09",
    weekday: "THỨ HAI",
    source_order: order,
    period_order: order,
    task_type: "secondary",
    task_name: name,
    period: "SÁNG",
    window_start: "06:00",
    window_end: "12:00",
    window_label: "06:00-12:00",
    group,
    category: "",
    class: "",
    context_type: contextType,
    icon,
    description: "Nguồn mẫu",
    duration_minutes: durationMinutes,
    duration_hours: durationMinutes / 60,
    original_duration_hours: durationMinutes / 60,
    fixed_start: null,
    clock: null,
    suggested_clock: null,
    color: "MÀU HOA ANH ĐÀO",
    source: {
      day_tab: "THỨ HAI",
      task_cell: `J${order + 3}`,
      duration_cell: `K${order + 3}`,
      catalog_row: order + 2,
    },
  };
}
const secondarySchedulePayload = makePayload("10:30", 1);
secondarySchedulePayload.secondary_days = Array.from(
  { length: 7 },
  (_, index) => ({
    date: `2026-11-${String(9 + index).padStart(2, "0")}`,
    weekday: [
      "THỨ HAI",
      "THỨ BA",
      "THỨ TƯ",
      "THỨ NĂM",
      "THỨ SÁU",
      "THỨ BẢY",
      "CHỦ NHẬT",
    ][index],
    tasks: index === 0
      ? [
          makeSecondaryTask("Vệ sinh sáng", "morning_hygiene", 1, 15, "VỆ SINH", "💦"),
          makeSecondaryTask("AUS", "breakfast", 2, 20, "SINH HOẠT", "⛅️"),
        ]
      : [],
  }),
);
const scheduledSecondary = context.normalizePayload_(secondarySchedulePayload);
assert.equal(scheduledSecondary.task_count, 10);
assert.equal(scheduledSecondary.secondary_task_count, 2);
assert.equal(
  JSON.stringify(scheduledSecondary.secondary_rows.map((row) => row[3])),
  JSON.stringify(["06:00-12:00", "06:00-12:00"]),
);
assert.equal(scheduledSecondary.secondary_rows[0][9], 0.25);
assert.equal(scheduledSecondary.secondary_rows[0][10], "08:10 - 08:25");
assert.equal(scheduledSecondary.secondary_rows[1][10], "08:35 - 08:55");
assert.equal(scheduledSecondary.secondary_rows[0][11], "MÀU HOA ANH ĐÀO");
assert.equal(
  scheduledSecondary.preview_items.filter((item) => item.type === "secondary").length,
  2,
);

const blockedSecondaryPayload = makePayload("17:00", 6);
blockedSecondaryPayload.secondary_days = Array.from(
  { length: 7 },
  (_, index) => ({
    date: `2026-11-${String(9 + index).padStart(2, "0")}`,
    weekday: [
      "THỨ HAI",
      "THỨ BA",
      "THỨ TƯ",
      "THỨ NĂM",
      "THỨ SÁU",
      "THỨ BẢY",
      "CHỦ NHẬT",
    ][index],
    tasks: index === 0
      ? [makeSecondaryTask("Giải trí-2", "routine", 1, 30, "SINH HOẠT", "⛅️")]
      : [],
  }),
);
Object.assign(blockedSecondaryPayload.secondary_days[0].tasks[0], {
  period: "TỐI",
  window_start: "17:00",
  window_end: "23:00",
  window_label: "17:00-23:00",
});
const blockedSecondaryPreview = context.normalizePayload_(blockedSecondaryPayload);
const fallbackSecondaryRow = blockedSecondaryPreview.secondary_rows[0];
assert.equal(fallbackSecondaryRow[10], "17:30 - 18:00");
assert.ok(blockedSecondaryPreview.schedule_warnings.some((warning) =>
  warning.includes("không có chỗ trống")
));
assert.ok(blockedSecondaryPreview.preview_items.some((item) =>
  item.type === "secondary" &&
  item.startTime === "17:30" &&
  item.endTime === "18:00"
));

const blockedSecondaryTransfer = context.normalizePayload_(
  blockedSecondaryPayload,
  undefined,
  { transferMode: true },
);
assert.equal(blockedSecondaryTransfer.transfer_secondary_tasks[0].clock, null);
assert.equal(
  blockedSecondaryTransfer.transfer_secondary_tasks[0].suggested_clock,
  "17:30 - 18:00",
);
const blockedSecondaryTransferPackage = {
  format: "AI_ADAPTIVE_SCHEDULER_TRANSFER",
  schema_version: 4,
  kind: "normalized_input",
  source: {
    spreadsheet_id: "test-source-id",
    spreadsheet_title: "Test workbook",
    source_tab: "TUẦN",
    destination_tab: blockedSecondaryTransfer.destination_tab,
    week_start: blockedSecondaryTransfer.week_start,
    week_end: blockedSecondaryTransfer.week_end,
  },
  schedule_settings: context.normalizeScheduleSettings_(),
  tasks: blockedSecondaryTransfer.transfer_tasks,
  secondary_tasks: blockedSecondaryTransfer.transfer_secondary_tasks,
  scheduling_warnings: blockedSecondaryTransfer.schedule_warnings,
};
blockedSecondaryTransferPackage.source_fingerprint =
  context.transferSourceFingerprint_(blockedSecondaryTransferPackage);
assert.doesNotThrow(
  () => context.validateNormalizationTransfer_(blockedSecondaryTransferPackage),
);

const impossibleFlexiblePreview = context.normalizePayload_(makePayload("", 25));
assert.ok(impossibleFlexiblePreview.rows[0][7]);
assert.ok(impossibleFlexiblePreview.schedule_warnings.some((warning) =>
  warning.includes("không tìm được lịch không chồng lấn")
));
assert.ok(impossibleFlexiblePreview.preview_items.some((item) =>
  item.title.includes("Task cố định")
));

const secondaryTransfer = context.normalizePayload_(
  secondarySchedulePayload,
  undefined,
  { transferMode: true },
);
assert.equal(secondaryTransfer.secondary_rows[0][10], "");
assert.equal(secondaryTransfer.transfer_secondary_tasks[0].clock, null);
assert.equal(
  secondaryTransfer.transfer_secondary_tasks[0].suggested_clock,
  "08:10 - 08:25",
);
const secondaryTransferPackage = {
  format: "AI_ADAPTIVE_SCHEDULER_TRANSFER",
  schema_version: 4,
  kind: "normalized_input",
  source: {
    spreadsheet_id: "test-source-id",
    spreadsheet_title: "Test workbook",
    source_tab: "TUẦN",
    destination_tab: secondaryTransfer.destination_tab,
    week_start: secondaryTransfer.week_start,
    week_end: secondaryTransfer.week_end,
  },
  schedule_settings: context.normalizeScheduleSettings_(),
  tasks: secondaryTransfer.transfer_tasks,
  secondary_tasks: secondaryTransfer.transfer_secondary_tasks,
};
secondaryTransferPackage.source_fingerprint =
  context.transferSourceFingerprint_(secondaryTransferPackage);
assert.doesNotThrow(
  () => context.validateNormalizationTransfer_(secondaryTransferPackage),
);
const changedSecondaryDuration = JSON.parse(
  JSON.stringify(secondaryTransferPackage),
);
changedSecondaryDuration.secondary_tasks[0].duration_minutes = 16;
assert.throws(
  () => context.validateNormalizationTransfer_(changedSecondaryDuration),
  /duration\/ICON\/COLOR/,
);

const flexibleOnly = context.normalizePayload_(makePayload("", 1.5));
assert.equal(flexibleOnly.rows[0][7], "08:15 - 09:45");
assert.equal(flexibleOnly.rows[1][7], "03:00 - 08:00");
assert.equal(flexibleOnly.unassigned_clock_count, 0);
assert.equal(flexibleOnly.flexible_task_count, 1);
const transferSource = context.normalizePayload_(
  makePayload("", 1.5),
  undefined,
  { transferMode: true }
);
assert.equal(transferSource.rows[0][7], "");
assert.equal(transferSource.rows[1][7], "03:00 - 08:00");
const normalizedTransfer = {
  format: "AI_ADAPTIVE_SCHEDULER_TRANSFER",
  schema_version: 4,
  kind: "normalized_input",
  source: {
    spreadsheet_id: "test-source-id",
    spreadsheet_title: "Test workbook",
    source_tab: "TUẦN",
    destination_tab: transferSource.destination_tab,
    week_start: transferSource.week_start,
    week_end: transferSource.week_end,
  },
  schedule_settings: context.normalizeScheduleSettings_(),
  tasks: transferSource.transfer_tasks,
  secondary_tasks: transferSource.transfer_secondary_tasks,
};
normalizedTransfer.source_fingerprint =
  context.transferSourceFingerprint_(normalizedTransfer);
assert.doesNotThrow(
  () => context.validateNormalizationTransfer_(normalizedTransfer)
);
const invalidMappingTransfer = JSON.parse(JSON.stringify(normalizedTransfer));
invalidMappingTransfer.tasks[0].icon = "🎭";
assert.throws(
  () => context.validateNormalizationTransfer_(invalidMappingTransfer),
  /ICON hoặc COLOR/
);
const incompleteExportTransfer = JSON.parse(JSON.stringify(normalizedTransfer));
delete incompleteExportTransfer.tasks[0].clock;
assert.throws(
  () => context.validateNormalizationTransfer_(incompleteExportTransfer),
  /thiếu fixed_start hoặc clock/
);
assert.equal(
  Object.prototype.hasOwnProperty.call(normalizedTransfer.tasks[0], "fixed_start"),
  true
);
assert.equal(normalizedTransfer.tasks[0].fixed_start, null);
assert.equal(
  Object.prototype.hasOwnProperty.call(normalizedTransfer.tasks[0], "clock"),
  true
);
assert.equal(normalizedTransfer.tasks[0].clock, null);

const duplicate = makePayload();
duplicate.master_rows.push({
  row_number: 4,
  values: ["", "SYSTEM", "task   cố định", "", 1, 0, 1, "", "09:00"],
});
assert.throws(
  () => context.normalizePayload_(duplicate),
  /Tên task MASTER trùng/
);

const unmatched = makePayload();
unmatched.ready_rows[0].tasks[0].name = "Không có trong MASTER";
assert.throws(
  () => context.normalizePayload_(unmatched),
  /Không tìm thấy task/
);

[
  ["BẢN SẮC", "KNOWLEDGES", 0, "🎭", "GREEN"],
  ["ĐẠO ĐỒ", "DƯỠNG SINH", 0, "🧘", "YELLOW"],
  ["SỰ NGHIỆP", "CASUAL SKILLS", 0, "💼", "GREEN"],
  ["BẢN SẮC", "SYSTEM", 0, "⚙️", "RED"],
  ["BẢN SẮC", "KNOWLEDGES", 2, "🎭", "MAUVE"],
].forEach(([category, taskClass, gi, icon, color]) => {
  const mappedPayload = makePayload();
  mappedPayload.master_rows[0].values[0] = category;
  mappedPayload.master_rows[0].values[1] = taskClass;
  mappedPayload.master_rows[0].values[5] = gi;
  const mappedTask = context.normalizePayload_(mappedPayload).transfer_tasks[0];
  assert.equal(mappedTask.icon, icon);
  assert.equal(mappedTask.color, color);
});
const missingGi = makePayload();
missingGi.master_rows[0].values[5] = "";
assert.throws(() => context.normalizePayload_(missingGi), /MASTER F3 \(GI\) đang trống/);
const invalidGi = makePayload();
invalidGi.master_rows[0].values[5] = "not-a-number";
assert.throws(() => context.normalizePayload_(invalidGi), /MASTER F3 \(GI\) có giá trị thập phân không hợp lệ/);

assert.equal(
  context.normalizePayload_(makePayload("23:00", 1.5)).rows[0][7],
  "23:00 - 00:30 (+1 day)"
);
[
  "23:00 - 00:30 (+1 day)",
  "23:00 - 00:30 (+1 ngày)",
  "23:00 - 00:30 (+1 ng?y)",
].forEach((clock) => {
  assert.equal(context.parseClock_(clock, "legacy-clock").end.dayOffset, 1);
});
const customSleep = context.normalizePayload_(makePayload(), {
  defaultStartTime: "07:30",
  breakMinutes: 15,
  sleepStartTime: "22:30",
  sleepDurationHours: 7.5,
});
assert.equal(customSleep.rows[1][7], "22:30 - 06:00 (+1 day)");
const earlyFlexible = context.normalizePayload_(makePayload("", 1.5), {
  defaultStartTime: "06:00",
  breakMinutes: 15,
  sleepStartTime: "22:30",
  sleepDurationHours: 8,
});
assert.equal(earlyFlexible.rows[0][7], "06:45 - 08:15");

function makeOrderedPayload(fixedStart = "13:00", firstDuration = 1, secondDuration = 1) {
  const payload = makePayload();
  payload.ready_rows[0].tasks = [
    { cell: "O16", name: "Task A" },
    { cell: "Q16", name: "Task B" },
    { cell: "S16", name: "Task C" },
    { cell: "U16", name: "Task D" },
  ];
  payload.master_rows = [
    ["Task A", firstDuration, ""],
    ["Task B", secondDuration, ""],
    ["Task C", 1, fixedStart],
    ["Task D", 1, ""],
  ].map(([name, duration, start], index) => ({
    row_number: index + 3,
    values: [
      "SỰ NGHIỆP",
      "SYSTEM",
      name,
      "",
      "",
      0,
      duration,
      "",
      start,
    ],
  }));
  return payload;
}

function makeFlexiblePayload(firstDuration, secondDuration) {
  const payload = makePayload();
  payload.ready_rows[0].tasks = [
    { cell: "O16", name: "Task A" },
    { cell: "Q16", name: "Task B" },
  ];
  payload.master_rows = [
    ["Task A", firstDuration],
    ["Task B", secondDuration],
  ].map(([name, duration], index) => ({
    row_number: index + 3,
    values: ["SỰ NGHIỆP", "SYSTEM", name, "", "", 0, duration, "", ""],
  }));
  return payload;
}

const duplicateFixedStarts = makeOrderedPayload("13:00", 1, 1);
duplicateFixedStarts.ready_rows[0].tasks = [
  { cell: "O16", name: "Task A" },
  { cell: "Q16", name: "Task B" },
  { cell: "S16", name: "Task C" },
  { cell: "U16", name: "Task D" },
];
duplicateFixedStarts.master_rows[0].values[8] = "13:00";
duplicateFixedStarts.master_rows[1].values[8] = "13:00";
const duplicateFixedPreview = context.normalizePayload_(duplicateFixedStarts);
assert.ok(duplicateFixedPreview.schedule_warnings.some((warning) =>
  warning.includes("Start Time bị trùng ngày 2026-11-09")
));
assert.equal(duplicateFixedPreview.preview_items.length, 11);

const overlappingFixedStarts = makeOrderedPayload("13:00", 2, 1);
overlappingFixedStarts.master_rows[0].values[8] = "09:00";
overlappingFixedStarts.master_rows[1].values[8] = "10:30";
const overlappingFixedPreview = context.normalizePayload_(overlappingFixedStarts);
assert.ok(overlappingFixedPreview.schedule_warnings.some((warning) =>
  warning.includes("chồng lấn")
));
assert.ok(overlappingFixedPreview.preview_items.some((item) =>
  item.title.includes("Task A")
));
assert.ok(overlappingFixedPreview.preview_items.some((item) =>
  item.title.includes("Task B")
));
const overlappingSleepPreview = context.normalizePayload_(makePayload("05:00", 1));
assert.ok(overlappingSleepPreview.schedule_warnings.some((warning) =>
  warning.includes("Ngủ đêm")
));
assert.ok(overlappingSleepPreview.preview_items.some((item) =>
  item.title.includes("Ngủ đêm")
));

const ordered = context.normalizePayload_(makeOrderedPayload());
assert.deepEqual(
  Array.from(ordered.rows.slice(0, 4), (row) => row[4]),
  ["Task A", "Task B", "Task C", "Task D"]
);
assert.deepEqual(
  Array.from(ordered.rows.slice(0, 4), (row) => row[2]),
  [1, 2, 3, 4]
);
assert.deepEqual(
  Array.from(ordered.rows.slice(0, 4), (row) => row[7]),
  ["08:15 - 09:15", "09:30 - 10:30", "13:00 - 14:00", "14:15 - 15:15"]
);
assert.deepEqual(
  Array.from(ordered.task_modes.slice(0, 4)),
  ["flexible", "flexible", "fixed", "flexible"]
);

const customSchedule = context.normalizePayload_(makeOrderedPayload(), {
  defaultStartTime: "06:00",
  breakMinutes: 0,
});
assert.deepEqual(
  Array.from(customSchedule.rows.slice(0, 4), (row) => row[7]),
  ["08:00 - 09:00", "09:00 - 10:00", "13:00 - 14:00", "14:00 - 15:00"]
);
assert.throws(
  () => context.normalizeScheduleSettings_({ defaultStartTime: "", breakMinutes: 15 }),
  /không được để trống/
);
const reorderedSchedule = context.normalizePayload_(
  makeOrderedPayload("13:00", 11, 1)
);
assert.deepEqual(
  Array.from(reorderedSchedule.rows.slice(0, 4), (row) => row[7]),
  [
    "14:15 - 01:15 (+1 day)",
    "08:15 - 09:15",
    "13:00 - 14:00",
    "01:30 (+1 day) - 02:30 (+1 day)",
  ]
);
assert.equal(reorderedSchedule.reduced_task_count, 0);

const reducedSchedule = context.normalizePayload_(
  makeFlexiblePayload(9.5, 9.5)
);
assert.deepEqual(
  Array.from(reducedSchedule.rows.slice(0, 2), (row) => [row[6], row[7]]),
  [
    [9.25, "08:15 - 17:30"],
    [9, "17:45 - 02:45 (+1 day)"],
  ]
);
assert.equal(reducedSchedule.reduced_task_count, 2);
assert.equal(reducedSchedule.task_modes[0], "flexible_adjusted");
assert.match(reducedSchedule.rows[0][5], /ORIGINAL_DURING: 9.5/);
assert.match(reducedSchedule.rows[0][5], /SCHEDULE_ADJUSTMENT: -0.25 hours/);
const shortTaskReduction = context.normalizePayload_(
  makeFlexiblePayload(0.5, 0.5),
  {
    defaultStartTime: "07:30",
    breakMinutes: 0,
    sleepStartTime: "00:00",
    sleepDurationHours: 23.5,
  }
);
assert.deepEqual(
  Array.from(shortTaskReduction.rows.slice(0, 2), (row) => [row[6], row[7]]),
  [
    [0.25, "23:30 - 23:45"],
    [0.25, "23:45 - 00:00 (+1 day)"],
  ]
);
const sundayTask = makePayload("", 1);
sundayTask.ready_rows[0].tasks = [];
sundayTask.ready_rows[6].tasks = [{ cell: "O22", name: "Task Chủ nhật" }];
sundayTask.master_rows[0].values[2] = "Task Chủ nhật";
sundayTask.master_rows[0].values[6] = 19;
sundayTask.master_rows[0].values[8] = "";
const sundaySchedule = context.normalizePayload_(sundayTask);
const sundayTaskRow = sundaySchedule.rows.find(
  (row) => row[4] === "Task Chủ nhật"
);
assert.deepEqual(
  [sundayTaskRow[6], sundayTaskRow[7]],
  [18.5, "08:15 - 02:45 (+1 day)"]
);
const noSlotFlexiblePreview = context.normalizePayload_(
  makeFlexiblePayload(12, 12)
);
assert.deepEqual(
  Array.from(noSlotFlexiblePreview.rows.slice(0, 2), (row) => [row[6], row[7]]),
  [
    [12, "07:30 - 19:30"],
    [12, "19:45 - 07:45 (+1 day)"],
  ]
);
assert.ok(noSlotFlexiblePreview.schedule_warnings.some((warning) =>
  warning.includes("không tìm được lịch không chồng lấn")
));

const databaseTabName = "09/11 - 15/11/ 2026";
const secondaryDatabaseRows = [];
const secondaryDatabaseHeader = Array(13).fill("");
const databaseRows = [
  [
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
  ],
  [
    "2026-11-09",
    "THỨ HAI",
    1,
    "⚙️",
    "Task cố định",
    "Description",
    1.5,
    "08:00 - 09:30",
    "RED",
    "ADP-TEST-1",
  ],
  [
    "2026-11-09",
    "THỨ HAI",
    2,
    "",
    "Task tràn ngày",
    "Cross-midnight task",
    1,
    "00:30 (+1 ng?y) - 01:30 (+1 ng?y)",
    "",
    "ADP-TEST-2",
  ],
  [
    "2026-11-09",
    "THỨ HAI",
    3,
    "",
    "Ngủ đêm",
    "Ngủ đêm hôm nay",
    5,
    "03:00 - 08:00",
    "",
    "ADP-SLEEP-1",
  ],
  [
    "2026-11-10",
    "THỨ BA",
    1,
    "",
    "Task linh động",
    "Flexible clock",
    1,
    "07:30 - 08:30",
    "",
    "ADP-TEST-3",
  ],
  [
    "2026-11-10",
    "THỨ BA",
    2,
    "",
    "Ngủ đêm",
    "Ngủ đêm hôm nay",
    5,
    "03:00 - 08:00",
    "",
    "ADP-SLEEP-2",
  ],
  ...Array.from({ length: 5 }, (_, index) => [
    `2026-11-${String(11 + index).padStart(2, "0")}`,
    ["THỨ TƯ", "THỨ NĂM", "THỨ SÁU", "THỨ BẢY", "CHỦ NHẬT"][index],
    1,
    "",
    "Ngủ đêm",
    "Ngủ đêm hôm nay",
    5,
    "03:00 - 08:00",
    "",
    `ADP-SLEEP-${index + 3}`,
  ]),
];
databaseRows.push([
  "2026-11-09",
  "THỨ HAI",
  4,
  "",
  "Task chồng giờ",
  "Overlap test",
  1,
  "08:30 - 09:30",
  "",
  "ADP-TEST-OVERLAP",
]);

const mockSheet = {
  getName: () => databaseTabName,
  getLastRow: () => Math.max(
    databaseRows.length,
    secondaryDatabaseRows.length + 1,
  ),
  getRange(row, column, rowCount) {
    if (column === 13) {
      const values = row === 1
        ? [secondaryDatabaseHeader]
        : secondaryDatabaseRows.slice(row - 2, row - 2 + rowCount);
      return {
        getValues: () => values,
        getDisplayValues: () => values.map((valueRow) =>
          valueRow.map((value) => String(value == null ? "" : value))
        ),
      };
    }
    const values = row === 1
      ? databaseRows.slice(0, rowCount || databaseRows.length)
      : databaseRows.slice(row - 1, row - 1 + rowCount);
    return {
      getValues: () => values,
      getDisplayValues: () => values.map((valueRow) =>
        valueRow.map((value) => String(value == null ? "" : value))
      ),
    };
  },
};
const mockEventList = [];
let nextEventId = 1;
let lastWrittenTab = databaseTabName;

class MockCalendarEvent {
  constructor(title, start, end, description) {
    this.id = "event-" + nextEventId++;
    this.title = title;
    this.start = start;
    this.end = end;
    this.description = description;
    this.tags = {};
    this.color = "";
    this.updated = new Date(1);
  }
  getId() { return this.id; }
  getTitle() { return this.title; }
  getDescription() { return this.description; }
  getStartTime() { return this.start; }
  getEndTime() { return this.end; }
  getLastUpdated() { return this.updated; }
  getTag(key) { return this.tags[key] || ""; }
  getColor() { return this.color; }
  deleteEvent() {
    const index = mockEventList.indexOf(this);
    if (index >= 0) mockEventList.splice(index, 1);
  }
  setTag(key, value) { this.tags[key] = value; return this; }
  setTitle(value) { this.title = value; this.updated = new Date(); return this; }
  setDescription(value) {
    this.description = value;
    this.updated = new Date();
    return this;
  }
  setTime(start, end) {
    this.start = start;
    this.end = end;
    this.updated = new Date();
    return this;
  }
  setColor(value) { this.color = value; return this; }
}

const mockCalendar = {
  getName: () => "AI Scheduler API TEST",
  getEvents: () => mockEventList,
  createEvent(title, start, end, options) {
    const event = new MockCalendarEvent(title, start, end, options.description);
    mockEventList.push(event);
    return event;
  },
};
context.SpreadsheetApp = {
  openById: () => ({
    getName: () => "Scheduler Database",
    getSheets: () => [mockSheet],
  }),
};
context.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: () => lastWrittenTab,
  }),
};
context.LockService = {
  getScriptLock: () => ({
    waitLock: () => {},
    releaseLock: () => {},
  }),
};
context.CalendarApp = {
  EventColor: {
    MAUVE: "3",
    RED: "11",
    GREEN: "10",
    YELLOW: "5",
    GRAY: "8",
    PALE_RED: "4",
  },
  getAllCalendars: () => [mockCalendar],
};

databaseRows[6][5] = "Invalid sleep description";
assert.doesNotThrow(() => context.previewCalendarImport(databaseTabName));
const arbitrarySleepDescriptionPreview =
  context.previewCalendarImport(databaseTabName);
assert.equal(
  arbitrarySleepDescriptionPreview.items.find(
    (item) => item.date === "2026-11-11" && item.title === "Ngủ đêm"
  ).description,
  "Invalid sleep description"
);
databaseRows[6][5] = "Ngủ đêm hôm nay";

databaseRows[2][0] = "2026-11-09";
databaseRows[2][2] = 4;
assert.throws(
  () => context.previewCalendarImport(databaseTabName),
  /STT task chính không liên tục theo thứ tự nguồn/
);
databaseRows[2][2] = 2;
databaseRows[5][7] = "";
assert.throws(
  () => context.previewCalendarImport(databaseTabName),
  /chưa có CLOCK/
);
databaseRows[5][7] = "03:00 - 08:00";

assert.deepEqual(
  Array.from(context.getCalendarDatabaseTabs(), (tab) => tab.tabName),
  [databaseTabName]
);
lastWrittenTab = "";
assert.doesNotThrow(() => context.previewCalendarImport(databaseTabName));
lastWrittenTab = databaseTabName;

const firstPreview = context.previewCalendarImport(databaseTabName);
assert.equal(firstPreview.createCount, 11);
assert.equal(firstPreview.skippedCount, 0);
assert.equal(
  firstPreview.items.find((item) => item.title === "Ngủ đêm").colorName,
  "GRAY"
);
assert.equal(firstPreview.items[0].title, "⚙️ Task cố định");
assert.deepEqual(
  Array.from(context.getCalendarSyncDays(databaseTabName), (day) => [
    day.date,
    day.weekday,
  ]),
  [
    ["2026-11-09", "THỨ HAI"],
    ["2026-11-10", "THỨ BA"],
    ["2026-11-11", "THỨ TƯ"],
    ["2026-11-12", "THỨ NĂM"],
    ["2026-11-13", "THỨ SÁU"],
    ["2026-11-14", "THỨ BẢY"],
    ["2026-11-15", "CHỦ NHẬT"],
  ]
);
databaseRows[6][1] = "THỨ HAI";
assert.equal(
  context.getCalendarSyncDays(databaseTabName).find(
    (day) => day.date === "2026-11-11"
  ).weekday,
  "THỨ TƯ"
);
databaseRows[6][1] = "THỨ TƯ";
assert.throws(
  () => context.previewCalendarImport(databaseTabName, ["2026-11-16"]),
  /Ngày đồng bộ không tồn tại trong database/
);
assert.throws(
  () => context.previewCalendarImport(databaseTabName, []),
  /ít nhất một ngày/
);
assert.throws(
  () => context.previewCalendarImport(databaseTabName, ["2026-11-10"], {
    deleteManaged: false,
    createUpdate: false,
  }),
  /ít nhất một tùy chọn/
);
const tuesdayPreview = context.previewCalendarImport(
  databaseTabName,
  ["2026-11-10"],
  { deleteManaged: false, createUpdate: true }
);
assert.equal(tuesdayPreview.selectedDates[0].weekday, "THỨ BA");
assert.ok(tuesdayPreview.items.every((item) => item.date === "2026-11-10"));
assert.equal(firstPreview.items[1].startDate, "2026-11-10");
assert.equal(firstPreview.items[1].startTime, "00:30");
assert.equal(firstPreview.items[1].endDate, "2026-11-10");
assert.equal(firstPreview.items[1].endTime, "01:30");
const firstImport = context.importCalendarEvents(
  databaseTabName,
  firstPreview.fingerprint
);
assert.equal(firstImport.counts.created, 11);
assert.equal(firstImport.counts.skipped, 0);
assert.equal(mockEventList.length, 11);
assert.equal(mockEventList[0].getTitle(), "⚙️ Task cố định");
assert.equal(mockEventList.find((event) => event.getTitle() === "Ngủ đêm").getColor(), "8");
assert.equal(mockEventList[1].getStartTime().getDate(), 10);
assert.equal(mockEventList[1].getStartTime().getHours(), 0);
assert.equal(mockEventList[1].getTitle(), "Task tràn ngày");
assert.equal(mockEventList[10].getTitle(), "Task chồng giờ");
assert.equal(mockEventList[10].getStartTime().getHours(), 8);
assert.equal(mockEventList[10].getStartTime().getMinutes(), 30);

const personalEvent = mockCalendar.createEvent(
  "Personal event",
  new Date(2026, 10, 9, 12, 0),
  new Date(2026, 10, 9, 13, 0),
  { description: "Not managed" }
);
const staleCalendarPreview = context.previewCalendarImport(
  databaseTabName,
  ["2026-11-09"],
  { deleteManaged: false, createUpdate: true }
);
personalEvent.setDescription("Changed after scan");
assert.throws(
  () => context.importCalendarEvents(
    databaseTabName,
    staleCalendarPreview.fingerprint,
    ["2026-11-09"],
    { deleteManaged: false, createUpdate: true }
  ),
  /đã thay đổi sau khi quét/
);
personalEvent.setDescription("Not managed");

const replaceSelectedDayPreview = context.previewCalendarImport(
  databaseTabName,
  ["2026-11-09"],
  { deleteManaged: true, createUpdate: true }
);
assert.equal(replaceSelectedDayPreview.deleteCount, 4);
assert.equal(replaceSelectedDayPreview.createCount, 4);
const replaceSelectedDayResult = context.importCalendarEvents(
  databaseTabName,
  replaceSelectedDayPreview.fingerprint,
  ["2026-11-09"],
  { deleteManaged: true, createUpdate: true }
);
assert.equal(replaceSelectedDayResult.counts.deleted, 4);
assert.equal(replaceSelectedDayResult.counts.created, 4);
assert.equal(mockEventList.length, 12);
assert.ok(mockEventList.includes(personalEvent));

const deleteOnlyPreview = context.previewCalendarImport(
  databaseTabName,
  ["2026-11-09"],
  { deleteManaged: true, createUpdate: false }
);
assert.equal(deleteOnlyPreview.selectedDates.length, 1);
assert.equal(deleteOnlyPreview.deleteCount, 4);
assert.equal(deleteOnlyPreview.items.length, 0);
assert.ok(deleteOnlyPreview.calendarEvents.some((event) =>
  event.title === "Personal event" && !event.deletable
));
const deleteOnlyResult = context.importCalendarEvents(
  databaseTabName,
  deleteOnlyPreview.fingerprint,
  ["2026-11-09"],
  { deleteManaged: true, createUpdate: false }
);
assert.equal(deleteOnlyResult.counts.deleted, 4);
assert.equal(deleteOnlyResult.counts.created, 0);
assert.equal(mockEventList.length, 8);
assert.ok(mockEventList.includes(personalEvent));

const selectedDayRefresh = context.previewCalendarImport(
  databaseTabName,
  ["2026-11-09"],
  { deleteManaged: false, createUpdate: true }
);
assert.equal(selectedDayRefresh.deleteCount, 0);
assert.equal(selectedDayRefresh.createCount, 4);
const selectedDayRefreshResult = context.importCalendarEvents(
  databaseTabName,
  selectedDayRefresh.fingerprint,
  ["2026-11-09"],
  { deleteManaged: false, createUpdate: true }
);
assert.equal(selectedDayRefreshResult.counts.created, 4);
assert.equal(selectedDayRefreshResult.counts.deleted, 0);
assert.equal(mockEventList.length, 12);

const uiElements = {};
const uiContext = {
  document: {
    getElementById(id) {
      if (!uiElements[id]) {
        const classes = new Set();
        uiElements[id] = {
          value: "",
          innerHTML: "",
          disabled: false,
          classList: {
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); },
            contains(name) { return classes.has(name); },
            toggle(name, force) {
              const add = force === undefined ? !classes.has(name) : force;
              if (add) classes.add(name);
              else classes.delete(name);
              return add;
            },
          },
          addEventListener() {},
        };
      }
      return uiElements[id];
    },
  },
  google: {
    script: {
      run: {
        withSuccessHandler() { return this; },
        withFailureHandler() { return this; },
        getUiConfig() {},
      },
    },
  },
};
vm.createContext(uiContext);
vm.runInContext(clientScript[1], uiContext);
uiContext.renderCalendarRows([
  {
    date: "2026-11-09",
    sourceOrder: 1,
    title: "Overlap A",
    description: "A",
    durationHours: 2,
    startDate: "2026-11-09",
    startTime: "08:00",
    endDate: "2026-11-09",
    endTime: "10:00",
    colorName: "RED",
    status: "create",
  },
  {
    date: "2026-11-09",
    sourceOrder: 2,
    title: "Overlap B",
    description: "B",
    durationHours: 2,
    startDate: "2026-11-09",
    startTime: "09:00",
    endDate: "2026-11-09",
    endTime: "11:00",
    colorName: "",
    status: "create",
  },
  {
    date: "2026-11-09",
    sourceOrder: 3,
    title: "Overnight",
    description: "C",
    durationHours: 2,
    startDate: "2026-11-09",
    startTime: "23:00",
    endDate: "2026-11-10",
    endTime: "01:00",
    colorName: "",
    status: "create",
  },
]);
const calendarMarkup = uiElements.calendarTable.innerHTML;
assert.match(calendarMarkup, /T2 · 9\/11/);
assert.match(calendarMarkup, /T3 · 10\/11/);
assert.match(calendarMarkup, /Overlap A/);
assert.match(calendarMarkup, /Overlap B/);
assert.match(calendarMarkup, /Overnight/);
assert.equal((calendarMarkup.match(/class="calendar-event"/g) || []).length, 4);
assert.match(calendarMarkup, /left:calc\(0% \+ 2px\)/);
assert.match(calendarMarkup, /left:calc\(50% \+ 2px\)/);

uiContext.renderSourceRows(
  [
    ["2026-11-09", "THỨ HAI", 1, "", "Source overlap A", "A", 2, "08:00 - 10:00", "RED", "A"],
    ["2026-11-09", "THỨ HAI", 2, "", "Source overlap B", "B", 2, "09:00 - 11:00", "", "B"],
  ],
  ["fixed", "flexible"],
  [2, 2],
  [],
  [
    {
      date: "2026-11-09",
      sourceOrder: 1,
      title: "Source overlap A",
      description: "A",
      durationHours: 2,
      startDate: "2026-11-09",
      startTime: "08:00",
      endDate: "2026-11-09",
      endTime: "10:00",
      colorName: "RED",
    },
    {
      date: "2026-11-09",
      sourceOrder: 2,
      title: "Source overlap B",
      description: "B",
      durationHours: 2,
      startDate: "2026-11-09",
      startTime: "09:00",
      endDate: "2026-11-09",
      endTime: "11:00",
      colorName: "",
    },
  ]
);
const sourceCalendarMarkup = uiElements.sourceCalendar.innerHTML;
assert.match(sourceCalendarMarkup, /Source overlap A/);
assert.match(sourceCalendarMarkup, /Source overlap B/);
assert.match(sourceCalendarMarkup, /left:calc\(0% \+ 2px\)/);
assert.match(sourceCalendarMarkup, /left:calc\(50% \+ 2px\)/);
assert.equal(uiElements.sourceTable.classList.contains("hidden"), true);
assert.equal(uiElements.sourceCalendar.classList.contains("hidden"), false);
uiContext.toggleSourceView();
assert.equal(uiElements.sourceTable.classList.contains("hidden"), false);
assert.equal(uiElements.sourceCalendar.classList.contains("hidden"), true);
assert.equal(uiElements.sourceViewLabel.textContent, "Chế độ hiện tại: Bảng dữ liệu");
uiContext.toggleSourceView();
assert.equal(uiElements.sourceTable.classList.contains("hidden"), true);
assert.equal(uiElements.sourceCalendar.classList.contains("hidden"), false);
assert.equal(uiElements.sourceViewLabel.textContent, "Chế độ hiện tại: Lịch tuần");

const unchangedPreview = context.previewCalendarImport(databaseTabName);
assert.equal(unchangedPreview.unchangedCount, 11);
context.importCalendarEvents(databaseTabName, unchangedPreview.fingerprint);
assert.equal(mockEventList.length, 12);

databaseRows[1][5] = "Updated description";
assert.throws(
  () => context.importCalendarEvents(databaseTabName, unchangedPreview.fingerprint),
  /đã thay đổi sau khi quét/
);
const updatePreview = context.previewCalendarImport(databaseTabName);
assert.equal(updatePreview.updateCount, 1);
const updateResult = context.importCalendarEvents(
  databaseTabName,
  updatePreview.fingerprint
);
assert.equal(updateResult.counts.updated, 1);
assert.equal(mockEventList.length, 12);
assert.equal(
  mockEventList.find((event) => event.getTag("schedulerTaskId") === "ADP-TEST-1")
    .getDescription(),
  "Updated description"
);

const savedSpreadsheetApp = context.SpreadsheetApp;
const databaseHeaders = vm.runInContext("DATABASE_HEADERS", context);
context.SpreadsheetApp = {
  openById() {
    return {
      getName: () => "Scheduler Database",
      getSheets: () => [{
        getName: () => "Test week",
        getLastRow: () => 2,
        getRange(row, column) {
          if (row === 1 && column === 1) {
            return {
              getValues: () => [
                databaseHeaders,
                [
                  new Date(2026, 10, 9),
                  "THỨ HAI",
                  1,
                  "",
                  "Main task",
                  "Description",
                  1,
                  "08:00 - 09:00",
                  "",
                  "MAIN-1",
                ],
              ],
            };
          }
          if (row === 1 && column === 13) {
            return { getDisplayValues: () => [Array(13).fill("")] };
          }
          if (row === 2 && column === 13) {
            return {
              getValues: () => [["orphaned secondary data", ...Array(12).fill("")]],
            };
          }
          throw new Error(`Unexpected database range ${row},${column}`);
        },
      }],
    };
  },
};
assert.throws(
  () => context.readCalendarDatabase_("Test week"),
  /Có dữ liệu M:Y nhưng header Secondary Task không hợp lệ/,
);
context.SpreadsheetApp = savedSpreadsheetApp;

[
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
].forEach((value, index) => {
  secondaryDatabaseHeader[index] = value;
});
secondaryDatabaseRows.push([
  "2026-11-09",
  "THỨ HAI",
  "SÁNG",
  "06:00-12:00",
  1,
  "VỆ SINH",
  "💦",
  "Vệ sinh sáng",
  "INTERNAL_TASK_ID: ADP-SEC-1",
  1 / 3,
  "08:00 - 08:20",
  "MÀU HOA ANH ĐÀO",
  "ADP-SEC-1",
]);
const secondaryCalendarPreview =
  context.previewCalendarImport(databaseTabName);
const secondaryCalendarItem = secondaryCalendarPreview.items.find(
  (item) => item.title === "💦 Vệ sinh sáng",
);
assert.ok(secondaryCalendarItem);
assert.equal(secondaryCalendarItem.colorName, "MÀU HOA ANH ĐÀO");
assert.equal(secondaryCalendarItem.durationHours, 1 / 3);
secondaryDatabaseRows.pop();
secondaryDatabaseHeader.fill("");

console.log("Apps Script normalization checks passed.");
