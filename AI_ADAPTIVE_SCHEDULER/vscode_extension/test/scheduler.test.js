"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  buildCalendarSegments,
  buildDatabaseRows,
  buildSecondaryDatabaseRows,
  layoutCalendarSegments,
  parseClock,
  validateSchedule,
  validateScheduleDetailed,
} = require("../scheduler");
const { buildBatchUpdateBody, writeSchedule } = require("../googleSheets");

function createWeek() {
  const weekdays = [
    "THỨ HAI",
    "THỨ BA",
    "THỨ TƯ",
    "THỨ NĂM",
    "THỨ SÁU",
    "THỨ BẢY",
    "CHỦ NHẬT",
  ];
  const tasks = [];
  for (let index = 0; index < 7; index += 1) {
    const date = `2026-11-${String(9 + index).padStart(2, "0")}`;
    tasks.push(
      {
        task_id: `FLEX-${index}`,
        date,
        weekday: weekdays[index],
        source_order: 1,
        schedule_order: 1,
        task_type: "flexible",
        task_name: "Flexible work",
        icon: "",
        description: "INTERNAL_TASK_ID: FLEX\nDURING: 1",
        duration_hours: 1,
        original_duration_hours: 1,
        fixed_start: null,
        clock: "08:15 - 09:15",
        color: "BLUE",
        source: { ready_cell: "O16", master_row: 3 },
      },
      {
        task_id: `FIXED-${index}`,
        date,
        weekday: weekdays[index],
        source_order: 2,
        schedule_order: 2,
        task_type: "fixed",
        task_name: "Fixed work",
        icon: "",
        description: "INTERNAL_TASK_ID: FIXED\nDURING: 1",
        duration_hours: 1,
        original_duration_hours: 1,
        fixed_start: "10:00",
        clock: "10:00 - 11:00",
        color: "RED",
        source: { ready_cell: "Q16", master_row: 4 },
      },
      {
        task_id: `SLEEP-${index}`,
        date,
        weekday: weekdays[index],
        source_order: 3,
        schedule_order: 3,
        task_type: "sleep",
        task_name: "Ngủ đêm",
        icon: "",
        description: "Ngủ đêm hôm nay",
        duration_hours: 5,
        original_duration_hours: 5,
        fixed_start: "03:00",
        clock: "03:00 - 08:00",
        color: "GRAY",
        source: { generated: true },
      },
    );
  }
  const input = {
    format: "AI_ADAPTIVE_SCHEDULER_TRANSFER",
    schema_version: 2,
    kind: "normalized_input",
    source: {
      spreadsheet_id: "source-id",
      spreadsheet_title: "Weekly source",
      source_tab: "TUẦN",
      destination_tab: "09/11 - 15/11/ 2026",
      week_start: "2026-11-09",
      week_end: "2026-11-15",
    },
    schedule_settings: {
      defaultStartTime: "07:30",
      defaultStartMinutes: 450,
      breakMinutes: 15,
      sleepStartTime: "03:00",
      sleepStartMinutes: 180,
      sleepDurationHours: 5,
    },
    source_fingerprint: "unchanged-source-fingerprint",
    tasks,
  };
  const optimized = JSON.parse(JSON.stringify(input));
  optimized.kind = "optimized_schedule";
  return { input, optimized };
}

test("validates a complete week and maps task order to database rows", () => {
  const { input, optimized } = createWeek();
  assert.deepEqual(validateSchedule(input, optimized), []);
  const rows = buildDatabaseRows(optimized);
  assert.equal(rows.length, 21);
  assert.deepEqual(rows.slice(0, 3).map((row) => row[2]), [1, 2, 3]);
  assert.equal(rows[0][9], "FLEX-0");
  assert.equal(rows[2][9], "SLEEP-0");
  assert.equal(rows[2][3], "🌙");
  assert.equal(
    rows[0][5],
    "INTERNAL_TASK_ID: FLEX\nDURING: 1\nCLOCK: 08:15 - 09:15",
  );
  assert.equal(rows[0][3], "");
  assert.equal(
    buildCalendarSegments(optimized).find((segment) => segment.taskId === "SLEEP-0").summary,
    "🌙 Ngủ đêm",
  );
});

test("validates schema v3 classification and writes final CLOCK to DESCRIPTION", () => {
  const { input, optimized } = createWeek();
  input.schema_version = 3;
  for (const task of input.tasks) {
    if (task.task_type === "sleep") continue;
    const isFlexible = task.task_type === "flexible";
    task.category = isFlexible ? "BẢN SẮC" : "SYSTEM";
    task.class = isFlexible ? "KNOWLEDGES" : "SYSTEM";
    task.gi = isFlexible ? 0 : 2;
    task.icon = isFlexible ? "🎭" : "⚙️";
    task.color = isFlexible ? "GREEN" : "MAUVE";
    task.description = [
      `INTERNAL_TASK_ID: ${task.task_id}`,
      `CATEGORY: ${task.category}`,
      `CLASS: ${task.class}`,
      "DURING: 1",
    ].join("\n");
  }
  optimized.schema_version = 3;
  for (const task of optimized.tasks) {
    const source = input.tasks.find((candidate) => candidate.task_id === task.task_id);
    Object.assign(task, source);
  }

  assert.deepEqual(validateSchedule(input, optimized), []);
  const rows = buildDatabaseRows(optimized);
  assert.equal(rows[0][3], "🎭");
  assert.equal(rows[1][3], "⚙️");
  assert.equal(rows[0][8], "GREEN");
  assert.equal(rows[1][8], "MAUVE");
  assert.match(rows[0][5], /CATEGORY: BẢN SẮC/);
  assert.match(rows[0][5], /CLOCK: 08:15 - 09:15/);
  assert.equal(
    buildCalendarSegments(optimized).find((segment) => segment.taskId === "FLEX-0").summary,
    "🎭 Flexible work",
  );
  const previewSegments = buildCalendarSegments(optimized);
  assert.equal(
    previewSegments.find((segment) => segment.taskId === "FLEX-0").color,
    "GREEN",
  );
  assert.equal(
    previewSegments.find((segment) => segment.taskId === "FIXED-0").summary,
    "⚙️ Fixed work",
  );
  assert.equal(
    previewSegments.find((segment) => segment.taskId === "FIXED-0").color,
    "MAUVE",
  );

  optimized.tasks[0].icon = "⚙️";
  assert.ok(validateSchedule(input, optimized).some((error) =>
    error.includes("trường bất biến icon"),
  ));
});

function createWeekWithSecondaryTasks() {
  const { input, optimized } = createWeek();
  input.schema_version = 4;
  optimized.schema_version = 4;
  for (const task of input.tasks) {
    if (task.task_type === "sleep") continue;
    task.category = task.task_type === "fixed" ? "SYSTEM" : "BẢN SẮC";
    task.class = task.task_type === "fixed" ? "SYSTEM" : "KNOWLEDGES";
    task.gi = 0;
    task.icon = task.task_type === "fixed" ? "⚙️" : "🎭";
    task.color = task.task_type === "fixed" ? "RED" : "GREEN";
  }
  input.tasks.find((task) => task.task_type === "flexible").clock =
    "10:30 - 11:30";
  input.tasks.find((task) => task.task_type === "fixed").fixed_start = "12:00";
  input.tasks.find((task) => task.task_type === "fixed").clock =
    "12:00 - 13:00";
  for (const task of optimized.tasks) {
    const source = input.tasks.find((candidate) => candidate.task_id === task.task_id);
    Object.assign(task, source);
  }
  const secondary = [
    {
      task_id: "SEC-HYGIENE",
      date: "2026-11-09",
      weekday: "THỨ HAI",
      source_order: 1,
      period_order: 1,
      task_type: "secondary",
      task_name: "Vệ sinh sáng",
      period: "SÁNG",
      window_start: "06:00",
      window_end: "12:00",
      window_label: "06:00-12:00",
      group: "VỆ SINH",
      category: "BẢN SẮC",
      class: "VỆ SINH",
      context_type: "morning_hygiene",
      icon: "💦",
      description: "INTERNAL_TASK_ID: SEC-HYGIENE\nDURING: 0.25",
      duration_minutes: 15,
      duration_hours: 0.25,
      original_duration_hours: 0.25,
      fixed_start: null,
      clock: null,
      suggested_clock: "08:10 - 08:25",
      color: "MÀU HOA ANH ĐÀO",
      source: {
        day_tab: "THỨ HAI",
        task_cell: "J4",
        duration_cell: "K4",
        catalog_row: 3,
      },
    },
    {
      task_id: "SEC-BREAKFAST",
      date: "2026-11-09",
      weekday: "THỨ HAI",
      source_order: 2,
      period_order: 2,
      task_type: "secondary",
      task_name: "AUS",
      period: "SÁNG",
      window_start: "06:00",
      window_end: "12:00",
      window_label: "06:00-12:00",
      group: "SINH HOẠT",
      category: "",
      class: "SINH HOẠT",
      context_type: "breakfast",
      icon: "⛅️",
      description: "INTERNAL_TASK_ID: SEC-BREAKFAST\nDURING: 0.3333333333333333",
      duration_minutes: 20,
      duration_hours: 20 / 60,
      original_duration_hours: 20 / 60,
      fixed_start: null,
      clock: null,
      suggested_clock: "08:35 - 08:55",
      color: "MÀU HOA ANH ĐÀO",
      source: {
        day_tab: "THỨ HAI",
        task_cell: "L4",
        duration_cell: "M4",
        catalog_row: 4,
      },
    },
  ];
  input.secondary_tasks = secondary;
  optimized.secondary_tasks = JSON.parse(JSON.stringify(secondary));
  optimized.secondary_tasks[0].clock = "08:10 - 08:25";
  optimized.secondary_tasks[1].clock = "08:35 - 08:55";
  return { input, optimized };
}

test("validates and imports Secondary Tasks with immutable duration and no configured breaks", () => {
  const { input, optimized } = createWeekWithSecondaryTasks();
  assert.deepEqual(validateSchedule(input, optimized), []);
  const mainRows = buildDatabaseRows(optimized);
  const secondaryRows = buildSecondaryDatabaseRows(optimized);
  assert.equal(mainRows.length, 21);
  assert.equal(secondaryRows.length, 2);
  assert.deepEqual(secondaryRows[0].slice(2, 8), [
    "SÁNG",
    "06:00-12:00",
    1,
    "VỆ SINH",
    "💦",
    "Vệ sinh sáng",
  ]);
  assert.equal(secondaryRows[0][9], 0.25);
  assert.equal(secondaryRows[0][11], "MÀU HOA ANH ĐÀO");
  const segments = buildCalendarSegments(optimized);
  assert.equal(
    segments.find((segment) => segment.taskId === "SEC-HYGIENE").summary,
    "💦 Vệ sinh sáng",
  );
  assert.equal(
    segments.find((segment) => segment.taskId === "SEC-HYGIENE").color,
    "MÀU HOA ANH ĐÀO",
  );

  const adjacentSecondary = JSON.parse(JSON.stringify(optimized));
  adjacentSecondary.secondary_tasks[0].clock = "10:15 - 10:30";
  assert.deepEqual(validateSchedule(input, adjacentSecondary), []);

  const shortened = JSON.parse(JSON.stringify(optimized));
  shortened.secondary_tasks[0].duration_hours = 0.2;
  assert.ok(validateSchedule(input, shortened).some((error) =>
    error.includes("trường bất biến duration_hours"),
  ));

  const lateBreakfast = JSON.parse(JSON.stringify(optimized));
  lateBreakfast.secondary_tasks[1].clock = "09:45 - 10:05";
  assert.ok(validateSchedule(input, lateBreakfast).some((error) =>
    error.includes("phải kết thúc trước 10:00"),
  ));

  const overlap = JSON.parse(JSON.stringify(optimized));
  overlap.secondary_tasks[0].clock = "10:45 - 11:00";
  const overlapValidation = validateScheduleDetailed(input, overlap);
  assert.equal(overlapValidation.hardErrors.length, 0);
  assert.ok(overlapValidation.timingErrors.some((error) =>
    error.includes("bị chồng lấn"),
  ));
});

test("validates evening placement and reports adjusted Secondary duration", () => {
  const { input, optimized } = createWeekWithSecondaryTasks();
  const sourceTask = input.secondary_tasks[0];
  const task = optimized.secondary_tasks[0];
  sourceTask.task_name = "Giải trí";
  sourceTask.context_type = "rest";
  task.task_name = "Giải trí";
  task.context_type = "rest";
  task.placement_period = "TỐI";
  task.placement_reason = "Moved to evening due to a fixed Main Task.";
  task.scheduled_duration_minutes = 10;
  task.scheduled_duration_hours = 10 / 60;
  task.duration_adjustment_reason =
    "Reduced after the original duration could not fit in the evening.";
  task.clock = "17:00 - 17:10";

  assert.deepEqual(validateScheduleDetailed(input, optimized), {
    hardErrors: [],
    timingErrors: [],
  });
  const row = buildSecondaryDatabaseRows(optimized).find(
    (candidate) => candidate[12] === task.task_id,
  );
  assert.equal(row[2], "TỐI");
  assert.equal(row[3], "17:00-23:00");
  assert.equal(row[9], 10 / 60);
  assert.match(row[8], /SCHEDULE_ADJUSTMENT/);

  const invalidTransfer = JSON.parse(JSON.stringify(optimized));
  invalidTransfer.secondary_tasks[0].placement_period = "CHIỀU";
  assert.ok(validateScheduleDetailed(input, invalidTransfer).hardErrors.some(
    (error) => error.includes("placement/duration"),
  ));

  const excessiveReduction = JSON.parse(JSON.stringify(optimized));
  excessiveReduction.secondary_tasks[0].scheduled_duration_minutes = 7;
  excessiveReduction.secondary_tasks[0].scheduled_duration_hours = 7 / 60;
  assert.ok(validateScheduleDetailed(input, excessiveReduction).hardErrors.some(
    (error) => error.includes("placement/duration"),
  ));
});

test("accepts omitted nullable source fields for normalized Secondary Tasks", () => {
  const { input, optimized } = createWeekWithSecondaryTasks();
  for (const task of input.secondary_tasks) {
    delete task.clock;
    delete task.fixed_start;
  }
  for (const task of optimized.secondary_tasks) {
    task.fixed_start = null;
  }

  assert.deepEqual(validateSchedule(input, optimized), []);

  input.secondary_tasks[0].clock = "08:10 - 08:25";
  assert.ok(validateSchedule(input, optimized).some((error) =>
    error.includes("input phải có task_type=secondary và clock=null"),
  ));
});

test("reports every overlap when one task contains multiple shorter tasks", () => {
  const { input, optimized } = createWeekWithSecondaryTasks();
  for (const task of input.secondary_tasks) {
    task.context_type = "routine";
  }
  for (const task of optimized.secondary_tasks) {
    task.context_type = "routine";
  }
  optimized.secondary_tasks[0].clock = "12:10 - 12:25";
  optimized.secondary_tasks[1].clock = "12:30 - 12:50";

  const overlapErrors = validateSchedule(input, optimized).filter((error) =>
    error.includes("bị chồng lấn"),
  );
  assert.equal(overlapErrors.length, 2);
});

test("accepts any preserved sleep description", () => {
  const { input, optimized } = createWeek();
  const sleepInput = input.tasks.find((task) => task.task_type === "sleep");
  const sleepDraft = optimized.tasks.find((task) => task.task_type === "sleep");
  sleepInput.description = "Sleep details supplied by the user";
  sleepDraft.description = sleepInput.description;
  assert.deepEqual(validateSchedule(input, optimized), []);
});

test("rejects source metadata edits and duration increases", () => {
  const { input, optimized } = createWeek();
  optimized.tasks[0].task_name = "Changed task";
  optimized.tasks[1].duration_hours = 1.25;
  assert.ok(validateSchedule(input, optimized).some((error) =>
    error.includes("trường bất biến task_name"),
  ));
  assert.ok(validateSchedule(input, optimized).some((error) =>
    error.includes("duration"),
  ));
});

test("rejects overlaps and insufficient breaks", () => {
  const { input, optimized } = createWeek();
  optimized.tasks[0].clock = "08:00 - 09:00";
  const errors = validateSchedule(input, optimized);
  assert.ok(errors.some((error) => error.includes("khoảng nghỉ")));
});

test("parses overnight CLOCK and clips the weekly preview at midnight", () => {
  const { optimized } = createWeek();
  const sundayFlex = optimized.tasks.find((task) => task.task_id === "FLEX-6");
  sundayFlex.duration_hours = 1.5;
  sundayFlex.original_duration_hours = 2;
  sundayFlex.clock = "23:00 - 00:30 (+1 day)";
  const clock = parseClock(sundayFlex.clock);
  assert.deepEqual(clock, { start: 23 * 3600, end: 86400 + 30 * 60 });
  assert.deepEqual(
    parseClock("23:00 - 00:30 (+1 ng?y)"),
    { start: 23 * 3600, end: 86400 + 30 * 60 },
  );
  const segments = buildCalendarSegments(optimized).filter(
    (segment) => segment.taskId === "FLEX-6",
  );
  assert.deepEqual(segments.map(({ date, startMinute, endMinute }) => ({
    date,
    startMinute,
    endMinute,
  })), [{
    date: "2026-11-15",
    startMinute: 1380,
    endMinute: 1440,
  }]);
});

test("lays overlapping preview blocks side by side and reuses lanes after gaps", () => {
  const laidOut = layoutCalendarSegments([
    { date: "2026-11-09", taskId: "A", startMinute: 540, endMinute: 660 },
    { date: "2026-11-09", taskId: "B", startMinute: 600, endMinute: 720 },
    { date: "2026-11-09", taskId: "C", startMinute: 660, endMinute: 690 },
    { date: "2026-11-09", taskId: "D", startMinute: 720, endMinute: 750 },
  ]);
  assert.deepEqual(
    laidOut.map(({ taskId, lane, laneCount }) => ({ taskId, lane, laneCount })),
    [
      { taskId: "A", lane: 0, laneCount: 2 },
      { taskId: "B", lane: 1, laneCount: 2 },
      { taskId: "C", lane: 0, laneCount: 2 },
      { taskId: "D", lane: 0, laneCount: 1 },
    ],
  );
});

test("updates only cell values and clears stale rows in one sheet batch", () => {
  const request = buildBatchUpdateBody(42, 4, [
    ["2026-11-09", "THỨ HAI", 1, "", "Task", "DURING: 1", 1, "08:00 - 09:00", "", "TASK-1"],
  ]);
  const update = request.requests[0].updateCells;
  assert.equal(update.fields, "userEnteredValue");
  assert.deepEqual(update.range, {
    sheetId: 42,
    startRowIndex: 1,
    endRowIndex: 5,
    startColumnIndex: 0,
    endColumnIndex: 10,
  });
  assert.equal(update.rows[0].values[0].userEnteredValue.numberValue, 46335);
  const withSecondary = buildBatchUpdateBody(
    42,
    1,
    [["2026-11-09", "THỨ HAI", 1, "", "Task", "", 1, "08:00 - 09:00", "", "TASK-1"]],
    2,
    [["2026-11-09", "THỨ HAI", "SÁNG", "06:00-12:00", 1, "VỆ SINH", "💦", "Vệ sinh sáng", "", 0.25, "08:00 - 08:15", "MÀU HOA ANH ĐÀO", "SEC-1"]],
  );
  assert.equal(withSecondary.requests.length, 2);
  assert.deepEqual(withSecondary.requests[1].updateCells.range, {
    sheetId: 42,
    startRowIndex: 1,
    endRowIndex: 3,
    startColumnIndex: 12,
    endColumnIndex: 25,
  });
  assert.equal(
    withSecondary.requests[1].updateCells.rows[0].values.length,
    13,
  );
});

test("verifies stale Secondary Task rows even when no Main rows are stale", async () => {
    const originalLocalAppData = process.env.LOCALAPPDATA;
    const originalRequest = https.request;
    const temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "scheduler-sheets-test-"),
    );
    const localAppData = path.join(temporaryDirectory, "Local");
    const authDirectory = path.join(
      localAppData,
      "AI_Adaptive_SCHEDULER",
    );
    await fs.mkdir(authDirectory, { recursive: true });
    await Promise.all([
      fs.writeFile(
        path.join(authDirectory, "credentials.json"),
        JSON.stringify({
          installed: {
            client_id: "test-client",
            client_secret: "test-secret",
          },
        }),
      ),
      fs.writeFile(
        path.join(authDirectory, ".google-token.json"),
        JSON.stringify({
          client_id: "test-client",
          token: "test-token",
          refresh_token: "test-refresh-token",
          expiry: new Date(Date.now() + 3600000).toISOString(),
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        }),
      ),
    ]);
    process.env.LOCALAPPDATA = localAppData;

    const mainRow = [
      "2026-01-01",
      "THỨ NĂM",
      1,
      "",
      "Main task",
      "Description",
      1,
      "08:00 - 09:00",
      "",
      "MAIN-1",
    ];
    const secondaryRow = [
      "2026-01-01",
      "THỨ NĂM",
      "SÁNG",
      "06:00-12:00",
      1,
      "SINH HOẠT",
      "⛅️",
      "AUS",
      "Description",
      20 / 60,
      "08:00-08:20",
      "MÀU HOA ANH ĐÀO",
      "SECONDARY-1",
    ];
    const dateSerial =
      (Date.parse("2026-01-01T00:00:00Z") - Date.UTC(1899, 11, 30)) /
      86400000;
    let secondaryVerificationRequested = false;
    let batchUpdateCompleted = false;

    https.request = (url, options, callback) => {
      const request = new EventEmitter();
      request.setTimeout = () => request;
      request.write = () => true;
      request.destroy = (error) => request.emit("error", error);
      request.end = () => {
        const response = new EventEmitter();
        response.statusCode = 200;
        callback(response);
        const parsedUrl = new URL(url);
        const resource = decodeURIComponent(
          parsedUrl.pathname.replace(
            /^\/v4\/spreadsheets\/1xKpFyJ1VccERPuvzAaOzx42uOHD91bkTLbOL4-kuFRM/,
            "",
          ),
        );
        let data = {};
        if (resource === "") {
          data = {
            properties: { title: "Scheduler Database" },
            sheets: [{
              properties: {
                title: "Test week",
                sheetId: 7,
                gridProperties: { rowCount: 100 },
              },
            }],
          };
        } else if (resource === ":batchUpdate") {
          batchUpdateCompleted = true;
          data = {};
        } else if (resource.includes("A1:J1")) {
          data = { values: [[
            "NGÀY", "THỨ", "STT", "ICON", "CÔNG VIỆC", "DESCRIPTION",
            "DURING", "CLOCK", "MÀU NỀN", "ID TASK",
          ]] };
        } else if (resource.includes("M1:Y1")) {
          data = { values: [[
            "NGÀY", "THỨ", "BUỔI", "KHUNG GIỜ", "STT", "NHÓM", "ICON",
            "CÔNG VIỆC", "DESCRIPTION", "DURING", "CLOCK", "MÀU NỀN",
            "ID TASK",
          ]] };
        } else if (resource.includes("A2:J")) {
          if (
            parsedUrl.searchParams.get("valueRenderOption") === "UNFORMATTED_VALUE" &&
            batchUpdateCompleted
          ) {
            data = { values: [[
              dateSerial, ...mainRow.slice(1),
            ]] };
          } else {
            data = { values: [] };
          }
        } else if (resource.includes("M2:Y")) {
          if (
            parsedUrl.searchParams.get("valueRenderOption") === "UNFORMATTED_VALUE" &&
            batchUpdateCompleted
          ) {
            secondaryVerificationRequested = true;
            data = {
              values: [
                [dateSerial, ...secondaryRow.slice(1)],
                [dateSerial, "THỨ NĂM", "SÁNG", "06:00-12:00", 2],
              ],
            };
          } else {
            data = { values: [["old"], ["stale"]] };
          }
        }
        queueMicrotask(() => {
          response.emit("data", Buffer.from(JSON.stringify(data)));
          response.emit("end");
        });
      };
      return request;
    };

    try {
      await assert.rejects(
        writeSchedule("Test week", [mainRow], [secondaryRow]),
        /Old Secondary Task content remains/,
      );
      assert.equal(secondaryVerificationRequested, true);
    } finally {
      https.request = originalRequest;
      if (originalLocalAppData === undefined) {
        delete process.env.LOCALAPPDATA;
      } else {
        process.env.LOCALAPPDATA = originalLocalAppData;
      }
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
});
