"use strict";

const vscode = acquireVsCodeApi();
const hourHeight = 56;
const grid = document.getElementById("grid");
const status = document.getElementById("status");
const fileInfo = document.getElementById("fileInfo");
const importButton = document.getElementById("import");
const optimizeButton = document.getElementById("optimize");

document.getElementById("openInput").addEventListener("click", () => {
  vscode.postMessage({ type: "openInput" });
});
document.getElementById("openDraft").addEventListener("click", () => {
  vscode.postMessage({ type: "openDraft" });
});
document.getElementById("refresh").addEventListener("click", () => {
  vscode.postMessage({ type: "refresh" });
});
importButton.addEventListener("click", () => {
  if (!importButton.disabled) vscode.postMessage({ type: "import" });
});
optimizeButton.addEventListener("click", () => {
  if (!optimizeButton.disabled) vscode.postMessage({ type: "optimize" });
});

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function colorFor(color, taskType) {
  if (taskType === "sleep" || color === "GRAY") return "#c3c7cc";
  const colors = {
    RED: "#f7c7c7",
    BLUE: "#c9daf8",
    GREEN: "#d9ead3",
    YELLOW: "#fff2cc",
    MAUVE: "#d9d2e9",
    PURPLE: "#d9d2e9",
    ORANGE: "#fce5cd",
    PINK: "#ead1dc",
    CYAN: "#d0e0e3",
    "MÀU HOA ANH ĐÀO": "#f6c5d5",
  };
  return colors[color] || "#d2e3fc";
}

function renderGrid(days, segments) {
  grid.replaceChildren();
  if (!days || !days.length) {
    grid.append(makeElement("p", "empty", "No week dates are available in this draft."));
    return;
  }
  const header = makeElement("div", "day-header");
  header.style.setProperty("--day-count", String(days.length));
  header.append(makeElement("div", "corner", "Time"));
  for (const day of days) {
    const label = makeElement("div", "day-label");
    label.append(
      makeElement("strong", "", day.weekday || ""),
      makeElement("span", "", day.date),
    );
    header.append(label);
  }
  grid.append(header);

  const body = makeElement("div", "week-grid");
  body.style.setProperty("--day-count", String(days.length));
  body.style.setProperty("--hour-height", `${hourHeight}px`);
  const hourColumn = makeElement("div", "hour-column");
  for (let hour = 0; hour < 24; hour += 1) {
    hourColumn.append(makeElement("div", "hour-label", `${String(hour).padStart(2, "0")}:00`));
  }
  body.append(hourColumn);
  for (const day of days) {
    const dayColumn = makeElement("div", "day-column");
    for (const segment of segments.filter((item) => item.date === day.date)) {
      const startMinute = Math.max(0, Math.min(1440, segment.startMinute));
      const endMinute = Math.max(startMinute + 1, Math.min(1440, segment.endMinute));
      const block = makeElement("article", `task ${segment.taskType}`);
      block.style.top = `${(startMinute / 60) * hourHeight}px`;
      block.style.height = `${Math.max(24, ((endMinute - startMinute) / 60) * hourHeight)}px`;
      const laneCount = Math.max(1, segment.laneCount || 1);
      block.style.left = `calc(${(segment.lane || 0) * 100 / laneCount}% + 2px)`;
      block.style.width = `calc(${100 / laneCount}% - 4px)`;
      block.style.right = "auto";
      block.style.backgroundColor = colorFor(segment.color, segment.taskType);
      const adjusted =
        Number(segment.durationHours) !== Number(segment.originalDurationHours);
      const title = segment.summary || segment.name;
      block.title = `${title}\n${segment.clock}\n${segment.taskId}`;
      block.append(
        makeElement("strong", "", title || "Unnamed task"),
        makeElement(
          "span",
          "",
          adjusted
            ? `${segment.clock} · ${segment.durationHours}h (adjusted)`
            : `${segment.clock} · ${segment.durationHours}h`,
        ),
      );
      dayColumn.append(block);
    }
    body.append(dayColumn);
  }
  grid.append(body);
}

function renderState(state) {
  fileInfo.textContent =
    `Input: ${state.inputPath || "—"}  |  Editable draft: ${state.draftPath || "—"}`;
  renderGrid(state.days, state.segments);
  importButton.disabled = !state.valid;
  importButton.textContent = state.timingErrorCount
    ? `Review ${state.timingErrorCount} timing issue(s) before writing`
    : `Write ${state.taskCount || 0} tasks to Scheduler Database`;
  importButton.title = !state.valid
    ? "Structural and source-integrity checks must pass before writing."
    : state.timingErrorCount
      ? "Click to review and explicitly confirm writing despite timing issues."
      : "";
  const preview =
    `Preview · ${state.placedTaskCount || 0} tasks shown` +
    (state.unplacedTaskCount
      ? ` · ${state.unplacedTaskCount} tasks not shown on the grid`
      : "") +
    (state.weekStart && state.weekEnd
      ? ` · ${state.weekStart} to ${state.weekEnd}`
      : "");
  const imported = state.imported ? " · Current draft is already imported" : "";
  const notification = state.notification ? `\n${state.notification}` : "";
  const report = state.optimizerReport;
  const validationErrorCount =
    report && Array.isArray(report.validation_errors)
      ? report.validation_errors.length
      : null;
  const optimizerStatus = report
    ? `\nOptimizer · ${report.solver_status} · ${report.candidate_quality}` +
      ` · ${report.solve_seconds}s · reduced ${report.reduced_hours || 0}h` +
      (report.validation_passed === true
        ? " · validator passed"
        : validationErrorCount === null
          ? " · validation pending"
          : ` · ${validationErrorCount} validation issue(s)`)
    : "";
  const validationStatus = state.hardErrorCount
    ? `\nBlocked · ${state.hardErrorCount} structural/source issue(s)`
    : state.timingErrorCount
      ? `\nTiming review · ${state.timingErrorCount} overridable issue(s)`
      : "";
  status.textContent =
    `${preview}${imported} · Updated ${state.updatedAt || ""}` +
    optimizerStatus + validationStatus + notification;
  status.className = "status";
  optimizeButton.disabled = Boolean(state.optimizing);
  optimizeButton.textContent = state.optimizing
    ? "Optimizing…"
    : "Optimize locally";
}

window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "state") renderState(event.data.state);
});
vscode.postMessage({ type: "refresh" });
