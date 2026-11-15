"use strict";

const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const vscode = require("vscode");
const { writeSchedule } = require("./googleSheets");
const {
  buildCalendarSegments,
  buildDatabaseRows,
  buildSecondaryDatabaseRows,
  validateScheduleDetailed,
} = require("./scheduler");

const MAX_TRANSFER_BYTES = 2 * 1024 * 1024;
const OPTIMIZED_DIRECTORY = path.join("transfers", "optimized");
const OPTIMIZER_TIMEOUT_MS = 45000;

let activeSession;

function digest(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function workspaceRoot() {
  const folder = vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders[0];
  if (!folder) {
    throw new Error("Open the AI_ADAPTIVE_SCHEDULER project folder in VS Code first.");
  }
  return folder.uri.fsPath;
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative);
}

async function readJsonFile(filePath) {
  const info = await fs.stat(filePath);
  if (info.size > MAX_TRANSFER_BYTES) {
    throw new Error(`Transfer file exceeds the ${MAX_TRANSFER_BYTES / 1024 / 1024} MB limit.`);
  }
  const content = await fs.readFile(filePath, "utf8");
  let value;
  try {
    value = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path.basename(filePath)}: ${error.message}`);
  }
  return { content, value };
}

async function writeJsonAtomically(filePath, value) {
  const temporaryPath =
    `${filePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    try {
      await fs.unlink(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    }
    throw error;
  }
}

async function optimizerPythonPath(root) {
  const configured = vscode.workspace
    .getConfiguration("scheduler")
    .get("optimizerPythonPath", "");
  if (typeof configured === "string" && configured.trim()) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(root, configured);
  }
  const candidate = process.platform === "win32"
    ? path.join(root, ".venv", "Scripts", "python.exe")
    : path.join(root, ".venv", "bin", "python");
  try {
    await fs.access(candidate);
    return candidate;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return process.platform === "win32" ? "python" : "python3";
  }
}

async function runOptimizerProcess(root, extensionPath, input) {
  const pythonPath = await optimizerPythonPath(root);
  return new Promise((resolve, reject) => {
    const optimizerPath = path.join(extensionPath, "optimizer.py");
    const child = spawn(
      pythonPath,
      [optimizerPath, "--time-limit", "5"],
      { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      if (!settled) {
        settled = true;
        reject(new Error("Local optimization exceeded the 45-second limit."));
      }
    }, OPTIMIZER_TIMEOUT_MS);
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill();
      reject(error);
    };

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_TRANSFER_BYTES) {
        fail(new Error("Local optimizer output exceeded the transfer-size limit."));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      if (stderrBytes < 8192) {
        const remaining = 8192 - stderrBytes;
        const part = chunk.subarray(0, remaining);
        stderr.push(part);
        stderrBytes += part.length;
      }
    });
    child.on("error", (error) => {
      fail(new Error(`Could not start the local optimizer: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (settled) return;
      if (code !== 0) {
        const details = Buffer.concat(stderr).toString("utf8").trim();
        fail(new Error(
          details || `Local optimizer exited with status ${code}.`,
        ));
        return;
      }
      try {
        const result = JSON.parse(Buffer.concat(stdout).toString("utf8"));
        if (
          !result ||
          !result.optimized_schedule ||
          !result.report ||
          typeof result.report.solver_status !== "string"
        ) {
          throw new Error("Local optimizer returned an incomplete result.");
        }
        settled = true;
        resolve(result);
      } catch (error) {
        fail(new Error(`Could not read local optimizer result: ${error.message}`));
      }
    });
    child.stdin.on("error", (error) => {
      fail(new Error(`Could not send input to the local optimizer: ${error.message}`));
    });
    child.stdin.end(JSON.stringify(input));
  });
}

async function listInputFiles(root) {
  const incomingDirectory = path.join(root, "transfers", "incoming");
  await fs.mkdir(incomingDirectory, { recursive: true });
  const entries = await fs.readdir(incomingDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(incomingDirectory, entry.name));
}

async function chooseInput(root) {
  const incomingDirectory = path.join(root, "transfers", "incoming");
  const activePath = vscode.window.activeTextEditor &&
    vscode.window.activeTextEditor.document.uri.fsPath;
  if (activePath && isWithin(incomingDirectory, activePath)) return activePath;

  const inputFiles = await listInputFiles(root);
  if (!inputFiles.length) {
    throw new Error("Place the downloaded normalized JSON in transfers/incoming first.");
  }
  const selected = await vscode.window.showQuickPick(
    inputFiles.map((filePath) => ({
      label: path.basename(filePath),
      description: path.relative(root, filePath),
      filePath,
    })),
    { placeHolder: "Choose the normalized JSON to optimize" },
  );
  return selected && selected.filePath;
}

async function createSession(context) {
  const root = workspaceRoot();
  const inputPath = await chooseInput(root);
  if (!inputPath) return null;
  const incomingDirectory = path.join(root, "transfers", "incoming");
  if (!isWithin(incomingDirectory, inputPath)) {
    throw new Error("Input JSON must be inside transfers/incoming.");
  }
  const outputDirectory = path.join(root, OPTIMIZED_DIRECTORY);
  await fs.mkdir(outputDirectory, { recursive: true });
  const input = await readJsonFile(inputPath);
  if (
    input.value.format !== "AI_ADAPTIVE_SCHEDULER_TRANSFER" ||
    ![2, 3, 4].includes(input.value.schema_version) ||
    input.value.kind !== "normalized_input"
  ) {
    throw new Error("Input must be a normalized_input Scheduler transfer, schema v2, v3 or v4.");
  }

  const inputBaseName = path.basename(inputPath, path.extname(inputPath));
  let outputPath = path.join(outputDirectory, `${inputBaseName}.optimized.json`);
  try {
    const existingDraft = await readJsonFile(outputPath);
    if (existingDraft.value.schema_version !== input.value.schema_version) {
      outputPath = path.join(
        outputDirectory,
        `${inputBaseName}.v${input.value.schema_version}.optimized.json`,
      );
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await fs.access(outputPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const draft = { ...input.value, kind: "optimized_schedule" };
    await fs.writeFile(outputPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  }

  const session = {
    context,
    root,
    inputPath,
    inputHash: digest(input.content),
    outputPath,
    reportPath: outputPath.replace(/\.optimized\.json$/i, ".optimizer-report.json"),
    lastCommittedHash: null,
    optimizing: false,
    panel: vscode.window.createWebviewPanel(
      "schedulerWeeklyPreview",
      `Scheduler Preview: ${path.basename(inputPath)}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, "media"))],
      },
    ),
    watchers: [],
  };
  session.panel.webview.html = renderWebview(session);
  session.panel.onDidDispose(() => {
    session.watchers.forEach((watcher) => watcher.dispose());
    if (activeSession === session) activeSession = undefined;
  });
  session.panel.webview.onDidReceiveMessage(async (message) => {
    if (!message || typeof message.type !== "string") return;
    if (message.type === "refresh") await refreshSession(session);
    if (message.type === "openInput") await openFile(session.inputPath);
    if (message.type === "openDraft") await openFile(session.outputPath);
    if (message.type === "optimize") await optimizeCurrentDraft(session);
    if (message.type === "import") await importCurrentDraft(session);
  });

  const incomingPattern = new vscode.RelativePattern(
    vscode.Uri.file(root),
    "transfers/incoming/*.json",
  );
  const outputPattern = new vscode.RelativePattern(
    vscode.Uri.file(root),
    `${OPTIMIZED_DIRECTORY}/*.optimized.json`,
  );
  for (const pattern of [incomingPattern, outputPattern]) {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const onChanged = (uri) => {
      if (path.resolve(uri.fsPath).toLowerCase() === path.resolve(inputPath).toLowerCase() ||
          path.resolve(uri.fsPath).toLowerCase() === path.resolve(outputPath).toLowerCase()) {
        void refreshSession(session);
      }
    };
    session.watchers.push(
      watcher,
      watcher.onDidChange(onChanged),
      watcher.onDidCreate(onChanged),
      watcher.onDidDelete(onChanged),
    );
  }
  activeSession = session;
  context.subscriptions.push(session.panel);
  await refreshSession(session);
  return session;
}

async function refreshSession(session, notification) {
  if (session.panel.visible === false) return;
  let state;
  try {
    const [inputFile, draftFile] = await Promise.all([
      readJsonFile(session.inputPath),
      readJsonFile(session.outputPath),
    ]);
    const inputChanged = digest(inputFile.content) !== session.inputHash;
    const validation = inputChanged
      ? {
        hardErrors: [
          "Input JSON changed after preview opened. Reopen the preview to establish the original source again.",
        ],
        timingErrors: [],
      }
      : validateScheduleDetailed(inputFile.value, draftFile.value);
    const segments = Array.isArray(draftFile.value.tasks)
      ? buildCalendarSegments(draftFile.value)
      : [];
    const taskCount = (Array.isArray(draftFile.value.tasks)
      ? draftFile.value.tasks.length
      : 0) + (Array.isArray(draftFile.value.secondary_tasks)
      ? draftFile.value.secondary_tasks.length
      : 0);
    const visibleTaskIds = new Set(segments.map((segment) => segment.taskId));
    const allTasks = [
      ...(Array.isArray(draftFile.value.tasks) ? draftFile.value.tasks : []),
      ...(Array.isArray(draftFile.value.secondary_tasks)
        ? draftFile.value.secondary_tasks
        : []),
    ];
    const unplacedTaskCount = allTasks.filter(
      (task) => !visibleTaskIds.has(task.task_id),
    ).length;
    let optimizerReport;
    try {
      const reportFile = await readJsonFile(session.reportPath);
      if (reportFile.value.input_sha256 === session.inputHash) {
        optimizerReport = reportFile.value;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    state = {
      inputPath: path.relative(session.root, session.inputPath),
      draftPath: path.relative(session.root, session.outputPath),
      weekStart: draftFile.value.source && draftFile.value.source.week_start,
      weekEnd: draftFile.value.source && draftFile.value.source.week_end,
      taskCount,
      placedTaskCount: visibleTaskIds.size,
      unplacedTaskCount,
      valid: validation.hardErrors.length === 0,
      hardErrorCount: validation.hardErrors.length,
      timingErrorCount: validation.timingErrors.length,
      segments,
      days: draftFile.value.source &&
        draftFile.value.source.week_start &&
        draftFile.value.source.week_end
        ? buildDays(draftFile.value.source.week_start, draftFile.value.source.week_end)
        : [],
      imported: session.lastCommittedHash === digest(draftFile.content),
      optimizing: session.optimizing,
      optimizerReport,
      notification: notification || "",
      updatedAt: new Date().toLocaleTimeString(),
    };
  } catch (error) {
    state = {
      inputPath: path.relative(session.root, session.inputPath),
      draftPath: path.relative(session.root, session.outputPath),
      valid: false,
      hardErrorCount: 1,
      timingErrorCount: 0,
      notification: notification || error.message,
      segments: [],
      days: [],
      taskCount: 0,
      placedTaskCount: 0,
      unplacedTaskCount: 0,
      optimizing: session.optimizing,
      updatedAt: new Date().toLocaleTimeString(),
    };
  }
  await session.panel.webview.postMessage({ type: "state", state });
}

async function optimizeCurrentDraft(session) {
  if (session.optimizing) return;
  session.optimizing = true;
  await refreshSession(session, "Running local CP-SAT optimization…");
  try {
    const inputFile = await readJsonFile(session.inputPath);
    if (digest(inputFile.content) !== session.inputHash) {
      throw new Error(
        "Input JSON changed after preview opened. Reopen the preview before optimizing.",
      );
    }
    const result = await runOptimizerProcess(
      session.root,
      session.context.extensionPath,
      inputFile.value,
    );
    const validation = validateScheduleDetailed(
      inputFile.value,
      result.optimized_schedule,
    );
    const validationErrors = [
      ...validation.hardErrors,
      ...validation.timingErrors,
    ];
    const report = {
      ...result.report,
      generated_at: new Date().toISOString(),
      input_file: path.relative(session.root, session.inputPath),
      output_file: path.relative(session.root, session.outputPath),
      input_sha256: session.inputHash,
      validation_passed: validationErrors.length === 0,
      validation_errors: validationErrors,
      validation_hard_errors: validation.hardErrors,
      validation_timing_errors: validation.timingErrors,
    };
    await writeJsonAtomically(session.reportPath, report);
    await writeJsonAtomically(session.outputPath, result.optimized_schedule);
    const status = report.validation_passed
      ? `${report.solver_status}: ${report.main_task_count} Main + ${report.secondary_task_count} Secondary tasks optimized in ${report.solve_seconds}s.`
      : `${report.solver_status}: preview candidate created with ${validationErrors.length} validation issue(s); no Google data was written.`;
    await refreshSession(session, status);
  } catch (error) {
    await refreshSession(session, `Local optimization failed: ${error.message}`);
  } finally {
    session.optimizing = false;
    await refreshSession(session);
  }
}

function buildDays(startText, endText) {
  const start = Date.parse(`${startText}T00:00:00Z`);
  const end = Date.parse(`${endText}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const days = [];
  for (let timestamp = start; timestamp <= end; timestamp += 86400000) {
    const date = new Date(timestamp);
    days.push({
      date: date.toISOString().slice(0, 10),
      weekday: [
        "CHỦ NHẬT",
        "THỨ HAI",
        "THỨ BA",
        "THỨ TƯ",
        "THỨ NĂM",
        "THỨ SÁU",
        "THỨ BẢY",
      ][date.getUTCDay()],
    });
  }
  return days;
}

async function importCurrentDraft(session) {
  try {
    const [inputFile, draftFile] = await Promise.all([
      readJsonFile(session.inputPath),
      readJsonFile(session.outputPath),
    ]);
    if (digest(inputFile.content) !== session.inputHash) {
      throw new Error("Input JSON changed after preview opened. Reopen the preview before importing.");
    }
    const validation = validateScheduleDetailed(
      inputFile.value,
      draftFile.value,
    );
    if (validation.hardErrors.length) {
      await refreshSession(
        session,
        "Write blocked: structural/source-integrity checks failed. The calendar preview is still available.",
      );
      return;
    }
    if (validation.timingErrors.length) {
      const confirmation = await vscode.window.showWarningMessage(
        `This draft has ${validation.timingErrors.length} timing issue(s), such as overlaps or window/break violations. Structural and source-integrity checks passed. Write it anyway?`,
        { modal: true },
        "Write despite timing issues",
      );
      if (confirmation !== "Write despite timing issues") return;
    }
    const rows = buildDatabaseRows(draftFile.value);
    const secondaryRows = buildSecondaryDatabaseRows(draftFile.value);
    const result = await writeSchedule(
      draftFile.value.source.destination_tab,
      rows,
      secondaryRows,
    );
    session.lastCommittedHash = digest(draftFile.content);
    await refreshSession(
      session,
      `Imported and verified ${result.taskCount} task rows in ${result.destinationTab}.`,
    );
  } catch (error) {
    await refreshSession(session, `Import failed: ${error.message}`);
  }
}

async function openFile(filePath) {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
}

async function importFromCommand() {
  if (!activeSession) {
    vscode.window.showErrorMessage("Open the Scheduler weekly preview first.");
    return;
  }
  const confirm = await vscode.window.showWarningMessage(
    "Replace the task rows in the selected Scheduler Database week tab?",
    { modal: true },
    "Write approved schedule",
  );
  if (confirm === "Write approved schedule") {
    await importCurrentDraft(activeSession);
  }
}

function renderWebview(session) {
  const webview = session.panel.webview;
  const nonce = crypto.randomBytes(16).toString("base64");
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(session.context.extensionPath, "media", "preview.js")),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(session.context.extensionPath, "media", "preview.css")),
  );
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Scheduler Weekly Preview</title>
</head>
<body>
  <header>
    <h1>Weekly schedule preview</h1>
    <p id="fileInfo"></p>
    <div class="toolbar">
      <button id="openInput">Open input JSON</button>
      <button id="openDraft">Open editable schedule draft</button>
      <button id="refresh">Refresh preview</button>
        <button id="optimize" class="primary">Optimize locally</button>
      <button id="import" class="primary" disabled>Write approved schedule to Scheduler Database</button>
    </div>
    <p id="status" role="status">Loading schedule…</p>
  </header>
  <main>
    <div id="grid" class="calendar-scroll"></div>
    <p class="hint">The preview follows the editable JSON draft. Save your changes to refresh it; nothing is written to Google Sheets until you select the write button.</p>
  </main>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("scheduler.openWeeklyPreview", async () => {
      try {
        await createSession(context);
      } catch (error) {
        vscode.window.showErrorMessage(error.message);
      }
    }),
    vscode.commands.registerCommand(
      "scheduler.importApprovedSchedule",
      importFromCommand,
    ),
  );
}

function deactivate() {
  if (activeSession) {
    activeSession.watchers.forEach((watcher) => watcher.dispose());
    activeSession.panel.dispose();
    activeSession = undefined;
  }
}

module.exports = { activate, deactivate };
