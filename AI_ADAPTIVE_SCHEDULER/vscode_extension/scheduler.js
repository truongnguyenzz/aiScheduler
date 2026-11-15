"use strict";

const WEEKDAYS = [
  "CHỦ NHẬT",
  "THỨ HAI",
  "THỨ BA",
  "THỨ TƯ",
  "THỨ NĂM",
  "THỨ SÁU",
  "THỨ BẢY",
];

const IMMUTABLE_TASK_FIELDS = [
  "task_id",
  "date",
  "weekday",
  "source_order",
  "task_type",
  "task_name",
  "category",
  "class",
  "gi",
  "icon",
  "description",
  "original_duration_hours",
  "fixed_start",
  "color",
  "source",
];
const IMMUTABLE_SECONDARY_FIELDS = [
  "task_id",
  "date",
  "weekday",
  "source_order",
  "period_order",
  "task_type",
  "task_name",
  "period",
  "window_start",
  "window_end",
  "window_label",
  "group",
  "category",
  "class",
  "context_type",
  "icon",
  "description",
  "duration_minutes",
  "duration_hours",
  "original_duration_hours",
  "fixed_start",
  "suggested_clock",
  "color",
  "source",
];

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameValue(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function parseIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function dayNumber(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
    86400000;
}

function weekdayFor(dateText) {
  const date = parseIsoDate(dateText);
  return date ? WEEKDAYS[date.getUTCDay()] : null;
}

function parseClockPart(part) {
  const match = part.match(/^(\d{2}):(\d{2})(?::(\d{2}))?(?: \(\+(\d+) (?:day|ng.y)\))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const offset = Number(match[4] || 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return offset * 86400 + hour * 3600 + minute * 60 + second;
}

function parseClock(clock) {
  if (typeof clock !== "string") return null;
  const halves = clock.split(" - ");
  if (halves.length !== 2) return null;
  const start = parseClockPart(halves[0]);
  const end = parseClockPart(halves[1]);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

function parseStartMinutes(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function expectedTaskIcon(category, taskClass) {
  const group = String(category || "").normalize("NFC").trim().toUpperCase();
  const type = String(taskClass || "").normalize("NFC").trim().toUpperCase();
  if (type === "SYSTEM" || group.includes("SYSTEM")) return "⚙️";
  if (group.includes("BẢN SẮC")) return "🎭";
  if (group.includes("ĐẠO ĐỒ")) return "🧘";
  if (group.includes("SỰ NGHIỆP")) return "💼";
  return "";
}

function expectedTaskColor(taskClass, gi) {
  if (gi !== 0) return "MAUVE";
  const type = String(taskClass || "").normalize("NFC").trim().toUpperCase();
  if (type === "SYSTEM") return "RED";
  if (["KNOWLEDGES", "CASUAL SKILLS", "NỘI TẠI"].includes(type)) {
    return "GREEN";
  }
  if (["DƯỠNG SINH", "SIÊU SINH", "TRƯỜNG SINH"].includes(type)) {
    return "YELLOW";
  }
  return "";
}

function expectedSecondaryIcon(group, category, taskClass) {
  const normalized = String(group || "").normalize("NFC").trim().toUpperCase();
  const groupIcons = {
    "VỆ SINH": "💦",
    "VẬN ĐỘNG": "💪",
    "TIN TỨC": "🌏",
    "SINH HOẠT": "⛅️",
  };
  if (Object.prototype.hasOwnProperty.call(groupIcons, normalized)) {
    return groupIcons[normalized];
  }
  return expectedTaskIcon(category, taskClass);
}

function validateScheduleDetailed(input, optimized) {
  const hardErrors = [];
  const timingErrors = [];
  const addError = (message) => hardErrors.push(message);
  const addTimingError = (message) => timingErrors.push(message);
  const requiredFormat = "AI_ADAPTIVE_SCHEDULER_TRANSFER";
  const supportedSchemaVersion =
    input && [2, 3, 4].includes(input.schema_version);

  if (!input || input.kind !== "normalized_input" || !supportedSchemaVersion) {
    addError("File nguồn phải có kind=\"normalized_input\".");
  }
  if (
    !optimized ||
    optimized.format !== requiredFormat ||
    !supportedSchemaVersion ||
    optimized.schema_version !== input.schema_version ||
    optimized.kind !== "optimized_schedule"
  ) {
    addError("Bản nháp phải đúng format, cùng schema_version 2, 3 hoặc 4 với input và kind=\"optimized_schedule\".");
  }
  if (hardErrors.length) {
    return { hardErrors, timingErrors };
  }

  if (input.format !== requiredFormat || !supportedSchemaVersion) {
    addError("File đầu vào không dùng Scheduler transfer schema v2, v3 hoặc v4.");
  }
  if (!sameValue(optimized.source, input.source)) {
    addError("Metadata source của bản nháp khác file đầu vào.");
  }
  if (!sameValue(optimized.schedule_settings, input.schedule_settings)) {
    addError("schedule_settings của bản nháp khác file đầu vào.");
  }
  if (optimized.source_fingerprint !== input.source_fingerprint) {
    addError("Bản nháp đã thay đổi source_fingerprint; hãy khôi phục từ file đầu vào.");
  }
  if (!Array.isArray(input.tasks) || !Array.isArray(optimized.tasks)) {
    addError("Danh sách tasks không hợp lệ.");
    return { hardErrors, timingErrors };
  }

  const originalById = new Map();
  for (const task of input.tasks) {
    if (!task || typeof task.task_id !== "string" || !task.task_id) {
      addError("File đầu vào có task thiếu task_id.");
      continue;
    }
    if (originalById.has(task.task_id)) {
      addError(`task_id bị trùng trong file đầu vào: ${task.task_id}.`);
    }
    if ([3, 4].includes(input.schema_version) && task.task_type !== "sleep") {
      if (
        typeof task.category !== "string" ||
        typeof task.class !== "string" ||
        typeof task.gi !== "number" ||
        !Number.isFinite(task.gi)
      ) {
        addError(`Task ${task.task_id} thiếu category, class hoặc GI dạng số.`);
      } else {
        if (task.icon !== expectedTaskIcon(task.category, task.class)) {
          addError(`Task ${task.task_id} có ICON không khớp category/class.`);
        }
        if (task.color !== expectedTaskColor(task.class, task.gi)) {
          addError(`Task ${task.task_id} có COLOR không khớp class/GI.`);
        }
      }
    }
    originalById.set(task.task_id, task);
  }

  const inputSecondaryTasks = input.secondary_tasks === undefined
    ? []
    : input.secondary_tasks;
  const optimizedSecondaryTasks = optimized.secondary_tasks === undefined
    ? []
    : optimized.secondary_tasks;
  if (
    !Array.isArray(inputSecondaryTasks) ||
    !Array.isArray(optimizedSecondaryTasks) ||
    (input.schema_version === 4 &&
      (!Array.isArray(input.secondary_tasks) ||
        !Array.isArray(optimized.secondary_tasks)))
  ) {
    addError("Danh sách secondary_tasks không hợp lệ hoặc bị thiếu trong schema v4.");
    return { hardErrors, timingErrors };
  }
  const originalSecondaryById = new Map();
  for (const task of inputSecondaryTasks) {
    if (!task || typeof task.task_id !== "string" || !task.task_id) {
      addError("File đầu vào có Secondary Task thiếu task_id.");
      continue;
    }
    if (originalById.has(task.task_id) || originalSecondaryById.has(task.task_id)) {
      addError(`task_id bị trùng trong file đầu vào: ${task.task_id}.`);
    }
    if (
      task.task_type !== "secondary" ||
      (task.clock !== null && task.clock !== undefined)
    ) {
      addError(`Secondary Task ${task.task_id} trong input phải có task_type=secondary và clock=null.`);
    }
    originalSecondaryById.set(task.task_id, task);
  }

  const seenIds = new Set();
  for (const task of optimized.tasks) {
    if (!task || typeof task.task_id !== "string" || !task.task_id) {
      addError("Bản nháp có task thiếu task_id.");
      continue;
    }
    if (seenIds.has(task.task_id)) {
      addError(`task_id bị trùng trong bản nháp: ${task.task_id}.`);
    }
    seenIds.add(task.task_id);
    const original = originalById.get(task.task_id);
    if (!original) {
      addError(`Task không có trong file đầu vào: ${task.task_id}.`);
      continue;
    }
    for (const field of IMMUTABLE_TASK_FIELDS) {
      if (
        field === "fixed_start" &&
        task.task_type === "flexible" &&
        (task[field] === null || task[field] === undefined) &&
        (original[field] === null || original[field] === undefined)
      ) {
        continue;
      }
      if (!sameValue(task[field], original[field])) {
        addError(`Task ${task.task_id} đã thay đổi trường bất biến ${field}.`);
      }
    }
  }
  for (const taskId of originalById.keys()) {
    if (!seenIds.has(taskId)) addError(`Bản nháp thiếu task ${taskId}.`);
  }
  const seenSecondaryIds = new Set();
  for (const task of optimizedSecondaryTasks) {
    if (!task || typeof task.task_id !== "string" || !task.task_id) {
      addError("Bản nháp có Secondary Task thiếu task_id.");
      continue;
    }
    if (seenSecondaryIds.has(task.task_id) || seenIds.has(task.task_id)) {
      addError(`task_id bị trùng trong bản nháp: ${task.task_id}.`);
    }
    seenSecondaryIds.add(task.task_id);
    const original = originalSecondaryById.get(task.task_id);
    if (!original) {
      addError(`Secondary Task không có trong file đầu vào: ${task.task_id}.`);
      continue;
    }
    for (const field of IMMUTABLE_SECONDARY_FIELDS) {
      const omittedNullableFixedStart =
        field === "fixed_start" &&
        (task[field] === null || task[field] === undefined) &&
        (original[field] === null || original[field] === undefined);
      if (!omittedNullableFixedStart && !sameValue(task[field], original[field])) {
        addError(`Secondary Task ${task.task_id} đã thay đổi trường bất biến ${field}.`);
      }
    }
  }
  for (const taskId of originalSecondaryById.keys()) {
    if (!seenSecondaryIds.has(taskId)) {
      addError(`Bản nháp thiếu Secondary Task ${taskId}.`);
    }
  }

  const source = input.source || {};
  const weekStart = parseIsoDate(source.week_start);
  const weekEnd = parseIsoDate(source.week_end);
  const settings = input.schedule_settings || {};
  const defaultStartMinutes = parseStartMinutes(settings.defaultStartTime);
  const sleepStartMinutes = parseStartMinutes(settings.sleepStartTime);
  if (!weekStart || !weekEnd || dayNumber(weekEnd) - dayNumber(weekStart) !== 6) {
    addError("source.week_start/week_end phải mô tả đủ một tuần từ thứ Hai đến Chủ nhật.");
  }
  if (
    defaultStartMinutes === null ||
    settings.defaultStartMinutes !== defaultStartMinutes ||
    sleepStartMinutes === null ||
    settings.sleepStartMinutes !== sleepStartMinutes ||
    !Number.isInteger(settings.breakMinutes) ||
    settings.breakMinutes < 0 ||
    !Number.isFinite(settings.sleepDurationHours) ||
    settings.sleepDurationHours <= 0
  ) {
    addError("schedule_settings chứa giờ hoặc giá trị cấu hình không hợp lệ.");
  }

  const orderByDate = new Map();
  const sleepByDate = new Map();
  const intervals = [];
  const firstFixedStartByDate = new Map();
  const secondarySourceOrders = new Map();
  const secondaryPeriodOrders = new Map();
  const validWeekStart = weekStart ? dayNumber(weekStart) : null;
  const validWeekEnd = weekEnd ? dayNumber(weekEnd) : null;

  for (const task of optimized.tasks) {
    if (!task || typeof task.task_id !== "string") continue;
    const label = task.task_id;
    const date = parseIsoDate(task.date);
    if (!date) {
      addError(`Task ${label} có date không hợp lệ.`);
      continue;
    }
    const day = dayNumber(date);
    if (
      validWeekStart !== null &&
      validWeekEnd !== null &&
      (day < validWeekStart || day > validWeekEnd)
    ) {
      addError(`Task ${label} nằm ngoài tuần nguồn.`);
    }
    if (task.weekday !== weekdayFor(task.date)) {
      addError(`Task ${label} có weekday không khớp date.`);
    }
    if (!Number.isInteger(task.schedule_order) || task.schedule_order < 1) {
      addError(`Task ${label} thiếu schedule_order nguyên dương.`);
    } else {
      const orders = orderByDate.get(task.date) || new Set();
      if (orders.has(task.schedule_order)) {
        addError(`schedule_order bị trùng ngày ${task.date}: ${task.schedule_order}.`);
      }
      orders.add(task.schedule_order);
      orderByDate.set(task.date, orders);
    }

    const originalDuration = Number(task.original_duration_hours);
    const duration = Number(task.duration_hours);
    if (
      !Number.isFinite(originalDuration) ||
      !Number.isFinite(duration) ||
      originalDuration <= 0 ||
      duration <= 0 ||
      Math.abs(duration * 100 - Math.round(duration * 100)) > 1e-7
    ) {
      addError(`Task ${label} có duration không hợp lệ (cần tối đa 2 chữ số thập phân).`);
      continue;
    }

    if (task.task_type === "flexible") {
      const maxReduction = originalDuration <= 1 ? 0.25 : 0.5;
      if (
        task.fixed_start !== null ||
        duration > originalDuration ||
        originalDuration - duration > maxReduction + 1e-7 ||
        Math.floor(duration * 3600 + 0.5) < 60
      ) {
        addError(`Task linh động ${label} vượt giới hạn duration hoặc fixed_start.`);
      }
    } else if (task.task_type === "fixed" || task.task_type === "sleep") {
      if (duration !== originalDuration) {
        addError(`Task cố định ${label} đã bị đổi duration.`);
      }
    } else {
      addError(`Task ${label} có task_type không được hỗ trợ.`);
    }

    const clock = parseClock(task.clock);
    if (!clock) {
      addError(`Task ${label} có CLOCK không hợp lệ.`);
      continue;
    }
    const durationSeconds = Math.floor(duration * 3600 + 0.5);
    if (clock.end - clock.start !== durationSeconds) {
      addError(`CLOCK của task ${label} không khớp duration_hours.`);
    }

    if (task.task_type === "fixed" || task.task_type === "sleep") {
      const fixedMinutes = parseStartMinutes(task.fixed_start);
      if (
        fixedMinutes === null ||
        clock.start !== fixedMinutes * 60
      ) {
        addError(`Task cố định ${label} đã lệch fixed_start.`);
      }
      if (task.task_type === "fixed") {
        const current = firstFixedStartByDate.get(task.date);
        if (current === undefined || clock.start < current) {
          firstFixedStartByDate.set(task.date, clock.start);
        }
      }
    }
    if (task.task_type === "sleep") {
      if (
        task.task_name !== "Ngủ đêm" ||
        task.fixed_start !== settings.sleepStartTime ||
        task.color !== "GRAY" ||
        duration !== settings.sleepDurationHours
      ) {
        addError(`Task ngủ ${label} không khớp cấu hình Ngủ đêm.`);
      }
      sleepByDate.set(task.date, (sleepByDate.get(task.date) || 0) + 1);
    } else if (
      !task.source ||
      typeof task.source.ready_cell !== "string" ||
      !Number.isInteger(task.source.master_row)
    ) {
      addError(`Task ${label} thiếu truy xuất nguồn READY/MASTER.`);
    }

    if (task.task_type === "flexible" && defaultStartMinutes !== null) {
      const rangeStart = defaultStartMinutes * 60;
      const rangeEnd = 86400 + rangeStart;
      if (clock.start < rangeStart || clock.end > rangeEnd) {
        addTimingError(`Task linh động ${label} nằm ngoài scheduling window.`);
      }
    }
    intervals.push({
      start: day * 86400 + clock.start,
      end: day * 86400 + clock.end,
      task,
    });
  }

  for (const task of optimizedSecondaryTasks) {
    if (!task || typeof task.task_id !== "string") continue;
    const label = task.task_id;
    const date = parseIsoDate(task.date);
    if (!date) {
      addError(`Secondary Task ${label} có date không hợp lệ.`);
      continue;
    }
    const day = dayNumber(date);
    if (
      validWeekStart !== null &&
      validWeekEnd !== null &&
      (day < validWeekStart || day > validWeekEnd)
    ) {
      addError(`Secondary Task ${label} nằm ngoài tuần nguồn.`);
    }
    if (task.weekday !== weekdayFor(task.date)) {
      addError(`Secondary Task ${label} có weekday không khớp date.`);
    }
    if (
      task.task_type !== "secondary" ||
      typeof task.task_name !== "string" ||
      !task.task_name ||
      task.task_name.normalize("NFC").trim().toLowerCase() === "ngủ khuya"
    ) {
      addError(`Secondary Task ${label} có loại hoặc tên không hợp lệ.`);
    }
    if (
      !Number.isInteger(task.source_order) ||
      task.source_order < 1 ||
      !Number.isInteger(task.period_order) ||
      task.period_order < 1
    ) {
      addError(`Secondary Task ${label} có source_order/period_order không hợp lệ.`);
    } else {
      const sourceKey = `${task.date}|${task.source_order}`;
      const periodKey =
        `${task.date}|${task.period}|${task.period_order}`;
      if (secondarySourceOrders.has(sourceKey)) {
        addError(`Secondary source_order bị trùng ngày ${task.date}.`);
      }
      if (secondaryPeriodOrders.has(periodKey)) {
        addError(`Secondary period_order bị trùng trong ${task.period} ngày ${task.date}.`);
      }
      secondarySourceOrders.set(sourceKey, true);
      secondaryPeriodOrders.set(periodKey, true);
    }
    const movableToEvening =
      task.context_type === "personal_hygiene" ||
      String(task.task_name || "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .includes("giai tri");
    const placementPeriod = task.placement_period || task.period;
    const eveningDurationEligible =
      ["routine", "rest", "news"].includes(task.context_type);
    const scheduledDurationMinutes =
      task.scheduled_duration_minutes === undefined
        ? Number(task.duration_minutes)
        : Number(task.scheduled_duration_minutes);
    const scheduledDurationHours =
      task.scheduled_duration_hours === undefined
        ? Number(task.duration_hours)
        : Number(task.scheduled_duration_hours);
    if (
      !["SÁNG", "TRƯA", "CHIỀU", "TỐI"].includes(task.period) ||
      typeof task.group !== "string" ||
      !task.group ||
      typeof task.category !== "string" ||
      typeof task.class !== "string" ||
      typeof task.description !== "string" ||
      task.fixed_start !== null ||
      task.icon !== expectedSecondaryIcon(task.group, task.category, task.class) ||
      task.color !== "MÀU HOA ANH ĐÀO"
    ) {
      addError(`Secondary Task ${label} có metadata, ICON hoặc COLOR không hợp lệ.`);
    }
    const startMinutes = parseStartMinutes(task.window_start);
    const endMinutes = parseStartMinutes(task.window_end);
    if (
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes ||
      task.window_label !==
        `${String(Math.floor(startMinutes / 60)).padStart(2, "0")}:${String(startMinutes % 60).padStart(2, "0")}-${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`
    ) {
      addError(`Secondary Task ${label} có KHUNG GIỜ không hợp lệ.`);
    }
    const durationMinutes = Number(task.duration_minutes);
    const durationHours = Number(task.duration_hours);
    if (
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0 ||
      !Number.isFinite(durationHours) ||
      Math.abs(durationHours - durationMinutes / 60) > 1e-10 ||
      Number(task.original_duration_hours) !== durationHours
    ) {
      addError(`Secondary Task ${label} đã đổi hoặc có duration không hợp lệ.`);
    }
    if (
      (task.placement_period !== undefined &&
        (task.placement_period !== "TỐI" ||
          task.period === "TỐI" ||
          !movableToEvening)) ||
      ((task.placement_period === undefined) !==
        (task.placement_reason === undefined)) ||
      (task.placement_reason !== undefined &&
        (typeof task.placement_reason !== "string" ||
          task.placement_period === undefined)) ||
      (task.duration_adjustment_reason !== undefined &&
        typeof task.duration_adjustment_reason !== "string") ||
      !Number.isInteger(scheduledDurationMinutes) ||
      scheduledDurationMinutes <= 0 ||
      !Number.isFinite(scheduledDurationHours) ||
      Math.abs(scheduledDurationHours - scheduledDurationMinutes / 60) > 1e-10 ||
      (scheduledDurationMinutes !== durationMinutes &&
        (placementPeriod !== "TỐI" ||
          !eveningDurationEligible ||
          (task.period !== "TỐI" && !movableToEvening) ||
          scheduledDurationMinutes >= durationMinutes ||
          scheduledDurationMinutes < Math.ceil(durationMinutes / 2) ||
          typeof task.duration_adjustment_reason !== "string")) ||
      (scheduledDurationMinutes === durationMinutes &&
        task.duration_adjustment_reason !== undefined)
    ) {
      addError(`Secondary Task ${label} có điều chỉnh placement/duration không hợp lệ.`);
    }
    if (
      !task.source ||
      typeof task.source.day_tab !== "string" ||
      typeof task.source.task_cell !== "string" ||
      typeof task.source.duration_cell !== "string" ||
      !Number.isInteger(task.source.catalog_row)
    ) {
      addError(`Secondary Task ${label} thiếu truy xuất nguồn tab/ngày.`);
    }
    if (input.schema_version === 4 && task.clock === null) {
      addError(`Secondary Task ${label} chưa có CLOCK.`);
    }
    const suggestedClock = parseClock(task.suggested_clock);
    if (!suggestedClock) {
      addError(`Secondary Task ${label} có suggested_clock không hợp lệ.`);
    } else if (
      startMinutes !== null &&
      endMinutes !== null &&
      (suggestedClock.start < startMinutes * 60 ||
        suggestedClock.end > endMinutes * 60 ||
        suggestedClock.end - suggestedClock.start !==
          Math.floor(durationHours * 3600 + 0.5))
    ) {
      addError(`Secondary Task ${label} có suggested_clock ngoài window hoặc sai duration.`);
    }
    const clock = parseClock(task.clock);
    if (!clock) {
      addError(`Secondary Task ${label} có CLOCK không hợp lệ.`);
      continue;
    }
    if (startMinutes !== null && endMinutes !== null) {
      const startBound = placementPeriod === "TỐI" && placementPeriod !== task.period
        ? 17 * 60
        : startMinutes;
      const endBound = placementPeriod === "TỐI" && placementPeriod !== task.period
        ? 23 * 60
        : endMinutes;
      if (
        clock.start < startBound * 60 ||
        clock.end > endBound * 60
      ) {
        addTimingError(
          `Secondary Task ${label} nằm ngoài KHUNG GIỜ ${placementPeriod === task.period ? task.window_label : "17:00-23:00"}.`,
        );
      }
    }
    if (
      Number.isFinite(scheduledDurationHours) &&
      clock.end - clock.start !== Math.floor(scheduledDurationHours * 3600 + 0.5)
    ) {
      addError(`CLOCK của Secondary Task ${label} không khớp duration.`);
    }
    if (
      task.context_type === "breakfast" &&
      clock.end > 10 * 3600
    ) {
      addTimingError(`Secondary Task ăn sáng ${label} phải kết thúc trước 10:00.`);
    }
    const firstFixedStart = firstFixedStartByDate.get(task.date);
    if (
      task.context_type === "morning_hygiene" &&
      placementPeriod === task.period &&
      firstFixedStart !== undefined &&
      clock.end > firstFixedStart
    ) {
      addTimingError(
        `Secondary Task vệ sinh sáng ${label} phải kết thúc trước Main Task cố định đầu tiên.`,
      );
    }
    intervals.push({
      start: day * 86400 + clock.start,
      end: day * 86400 + clock.end,
      task,
    });
  }

  if (seenIds.size !== originalById.size) {
    addError("Số task trong bản nháp không khớp file đầu vào.");
  }

  if (validWeekStart !== null && validWeekEnd !== null) {
    for (let day = validWeekStart; day <= validWeekEnd; day += 1) {
      const dateText = new Date(day * 86400000).toISOString().slice(0, 10);
      const orders = orderByDate.get(dateText) || new Set();
      if (orders.size === 0) addError(`Ngày ${dateText} không có task.`);
      for (let order = 1; order <= orders.size; order += 1) {
        if (!orders.has(order)) {
          addError(`schedule_order ngày ${dateText} không liên tục.`);
          break;
        }
      }
      if (sleepByDate.get(dateText) !== 1) {
        addError(`Ngày ${dateText} phải có đúng một task Ngủ đêm.`);
      }
      const dayTasks = optimized.tasks.filter(
        (task) => task && task.date === dateText,
      );
      const sleepTask = dayTasks.find((task) => task.task_type === "sleep");
      if (
        sleepTask &&
        sleepTask.schedule_order !== Math.max(...dayTasks.map((task) => task.schedule_order))
      ) {
        addError(`Task Ngủ đêm ngày ${dateText} phải đứng cuối schedule_order.`);
      }
    }
  }

  intervals.sort((left, right) => left.start - right.start);
  const activeIntervals = [];
  for (const current of intervals) {
    for (const previous of activeIntervals) {
      if (previous.end > current.start) {
        addTimingError(
          `Task ${previous.task.task_id} và ${current.task.task_id} bị chồng lấn.`,
        );
      }
    }
    for (let index = activeIntervals.length - 1; index >= 0; index -= 1) {
      if (activeIntervals[index].end <= current.start) {
        activeIntervals.splice(index, 1);
      }
    }
    activeIntervals.push(current);
  }
  for (let index = 1; index < intervals.length; index += 1) {
    const previous = intervals[index - 1];
    const current = intervals[index];
    const gap = current.start - previous.end;
    if (
      gap >= 0 &&
      Number.isInteger(settings.breakMinutes) &&
      gap < settings.breakMinutes * 60 &&
      previous.task.task_type !== "secondary" &&
      current.task.task_type !== "secondary" &&
      (previous.task.task_type === "flexible" ||
        current.task.task_type === "flexible")
    ) {
      addTimingError(
        `Thiếu khoảng nghỉ giữa ${previous.task.task_id} và ${current.task.task_id}.`,
      );
    }
  }
  return {
    hardErrors: [...new Set(hardErrors)],
    timingErrors: [...new Set(timingErrors)],
  };
}

function validateSchedule(input, optimized) {
  const validation = validateScheduleDetailed(input, optimized);
  return [...validation.hardErrors, ...validation.timingErrors];
}

function taskIcon(task) {
  return task.task_type === "sleep" ? "🌙" : task.icon || "";
}

function taskDescription(task) {
  const duration = task.task_type === "secondary"
    ? Number(task.scheduled_duration_hours ?? task.duration_hours)
    : Math.round(Number(task.duration_hours) * 100) / 100;
  let description = String(task.description || "");
  const duringLine = `DURING: ${duration}`;
  if (/^DURING:.*$/m.test(description)) {
    description = description.replace(/^DURING:.*$/m, duringLine);
  } else {
    description += `${description ? "\n" : ""}${duringLine}`;
  }
  const clockLine = `CLOCK: ${task.clock}`;
  if (/^CLOCK:.*$/m.test(description)) {
    description = description.replace(/^CLOCK:.*$/m, clockLine);
  } else {
    description += `\n${clockLine}`;
  }
  if (duration !== Number(task.original_duration_hours)) {
    const reduction =
      Math.round((Number(task.original_duration_hours) - duration) * 100) / 100;
    description +=
      `\nORIGINAL_DURING: ${task.original_duration_hours}` +
      `\nSCHEDULE_ADJUSTMENT: -${reduction} hours`;
  }
  return description;
}

function layoutCalendarSegments(segments) {
  const byDate = new Map();
  for (const segment of segments) {
    const datedSegments = byDate.get(segment.date) || [];
    datedSegments.push(segment);
    byDate.set(segment.date, datedSegments);
  }

  const laidOut = [];
  for (const datedSegments of byDate.values()) {
    datedSegments.sort(
      (left, right) =>
        left.startMinute - right.startMinute ||
        right.endMinute - left.endMinute,
    );
    const clusters = [];
    for (const segment of datedSegments) {
      let cluster = clusters[clusters.length - 1];
      if (!cluster || segment.startMinute >= cluster.endMinute) {
        cluster = { endMinute: segment.endMinute, segments: [] };
        clusters.push(cluster);
      } else {
        cluster.endMinute = Math.max(cluster.endMinute, segment.endMinute);
      }
      cluster.segments.push(segment);
    }

    for (const cluster of clusters) {
      const laneEnds = [];
      const clusterLayout = [];
      for (const segment of cluster.segments) {
        let lane = laneEnds.findIndex((endMinute) =>
          endMinute <= segment.startMinute,
        );
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = segment.endMinute;
        clusterLayout.push({
          ...segment,
          lane,
        });
      }
      for (const segment of clusterLayout) {
        segment.laneCount = laneEnds.length;
        laidOut.push(segment);
      }
    }
  }
  return laidOut;
}

function buildDatabaseRows(optimized) {
  return optimized.tasks
    .slice()
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.schedule_order - right.schedule_order,
    )
    .map((task, index, tasks) => {
      const previous = index > 0 && tasks[index - 1].date === task.date
        ? tasks[index - 1]
        : null;
      const order = previous ? previous.schedule_order + 1 : 1;
      const duration = Math.round(Number(task.duration_hours) * 100) / 100;
      return [
        task.date,
        task.weekday,
        order,
        taskIcon(task),
        task.task_name,
        taskDescription(task),
        duration,
        task.clock,
        task.color || "",
        task.task_id,
      ];
    });
}

function buildSecondaryDatabaseRows(optimized) {
  const periodOrders = new Map();
  return (optimized.secondary_tasks || [])
    .slice()
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        ((parseClock(left.clock) || { start: 0 }).start -
          (parseClock(right.clock) || { start: 0 }).start) ||
        left.source_order - right.source_order,
    )
    .map((task) => {
      const period = task.placement_period || task.period;
      const periodKey = `${task.date}|${period}`;
      const periodOrder = (periodOrders.get(periodKey) || 0) + 1;
      periodOrders.set(periodKey, periodOrder);
      const windowLabel = period !== task.period
        ? "17:00-23:00"
        : task.window_label;
      return [
        task.date,
        task.weekday,
        period,
        windowLabel,
        periodOrder,
        task.group,
        taskIcon(task),
        task.task_name,
        taskDescription(task),
        Number(task.scheduled_duration_hours ?? task.duration_hours),
        task.clock,
        task.color || "",
        task.task_id,
      ];
    });
}

function buildCalendarSegments(optimized) {
  const segments = [];
  const weekStart = parseIsoDate(optimized.source.week_start);
  const weekEnd = parseIsoDate(optimized.source.week_end);
  if (!weekStart || !weekEnd) return segments;
  const firstDay = dayNumber(weekStart);
  const lastDay = dayNumber(weekEnd);
  for (const task of [
    ...(optimized.tasks || []),
    ...(optimized.secondary_tasks || []),
  ]) {
    const date = parseIsoDate(task.date);
    const clock = parseClock(task.clock);
    if (!date || !clock) continue;
    let absoluteStart = dayNumber(date) * 86400 + clock.start;
    const absoluteEnd = dayNumber(date) * 86400 + clock.end;
    while (absoluteStart < absoluteEnd) {
      const segmentDay = Math.floor(absoluteStart / 86400);
      const segmentEnd = Math.min(absoluteEnd, (segmentDay + 1) * 86400);
      if (segmentDay >= firstDay && segmentDay <= lastDay) {
        segments.push({
          date: new Date(segmentDay * 86400000).toISOString().slice(0, 10),
          startMinute: Math.floor((absoluteStart % 86400) / 60),
          endMinute: Math.ceil((segmentEnd - segmentDay * 86400) / 60),
          name: task.task_name,
          taskId: task.task_id,
          taskType: task.task_type,
          summary: taskIcon(task)
            ? `${taskIcon(task)} ${task.task_name}`
            : task.task_name,
          clock: task.clock,
          durationHours: task.task_type === "secondary"
            ? Number(task.scheduled_duration_hours ?? task.duration_hours)
            : task.duration_hours,
          originalDurationHours: task.original_duration_hours,
          color: task.color || "",
        });
      }
      absoluteStart = segmentEnd;
    }
  }
  return layoutCalendarSegments(segments);
}

module.exports = {
  buildCalendarSegments,
  buildDatabaseRows,
  buildSecondaryDatabaseRows,
  layoutCalendarSegments,
  parseClock,
  parseIsoDate,
  sameValue,
  validateSchedule,
  validateScheduleDetailed,
  weekdayFor,
};
