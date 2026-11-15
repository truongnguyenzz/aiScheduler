# Codebase Memory MCP audit

## Result

Codebase Memory MCP 0.12.1 is installed and the workspace server appears as
Running in VS Code's MCP Servers view. This Copilot SDK session successfully
called read-only Codebase Memory tools. The refreshed workspace graph contains
879 nodes and 1,828 edges.

## Environment and installation

- Windows 11 x64; VS Code 1.146.0.
- Codebase Memory executable:
  `%LOCALAPPDATA%\CodebaseMemoryMCP\bin\codebase-memory-mcp.exe`
- Installed release: 0.12.1, Windows AMD64 archive SHA-256:
  `4e4e0f16b45233af5c757a1fcbe3c3b16e9056375b1fbe2ce020b6de75dedcc0`.
- Installation used the vendor installer with `--skip-config`; the release
  checksum was verified. The installer added its `bin` directory to the
  current-user PATH. No system PATH or persistent PowerShell execution policy
  was changed.
- Project cache:
  `%LOCALAPPDATA%\CodebaseMemoryMCP\AI_ADAPTIVE_SCHEDULER`
- The dedicated cache is configured with automatic indexing, watching, and UI
  disabled, one worker, a 192 MB memory budget, a 1,000-file limit, and a
  100 MB source limit.

## Scope and data protection

- `.mcp.json` allows the server to index only this workspace through
  `CBM_ALLOWED_ROOT`; an attempted request for `C:\CBM-CONTAINMENT-TEST-OUTSIDE`
  was rejected as outside that root.
- `.cbmignore` excludes `transfers/` (incoming and optimized personal
  schedules), credentials, local environments, caches, logs, and generated
  VSIX files.
- `.mcp.json` configures the supported portable `tools` allowlist with 13
  read/index tools, excluding `delete_project`, `manage_adr`, and
  `ingest_traces`. However, the current SDK tool catalog also contains wrappers
  for those excluded server tools. Confirm the Copilot harness's effective
  Tools selection before treating the project allowlist as an enforced
  capability boundary; do not call the excluded tools.
- An index request outside the configured root was rejected. The transfer-data
  directory was confirmed excluded; no files were skipped unexpectedly.
- One Apps Script HTML template line is reported as a best-effort partial parse;
  see the benchmark record. This is not treated as a runtime syntax failure.
- No Google Sheets or Calendar access or writes were performed.
- The workspace is under OneDrive and has the Windows `ReparsePoint`
  attribute. Index coverage must be checked before relying on graph results;
  OneDrive/reparse behavior is not assumed.
- This directory is not a Git repository, and Git was not found on PATH during
  the audit.

## Verification limits

The MCP server initialized, indexed the workspace, and returned status and
coverage. VS Code's MCP Servers view showed `schedulerCodeMemory` as Running,
and read-only tool calls succeeded in this Copilot SDK session. The standalone
extension list displayed a DeepSeek-for-Copilot-Chat extension; the session's
Copilot Chat/agent surface is available. The project allowlist is configured
and its schema is supported, but effective tool-selection enforcement still
needs confirmation because the SDK tool catalog lists excluded tools too.

The latest full index was completed before the final audit/report edits in this
directory. Automatic watching is disabled. Free physical memory was about
302 MB at the latest check, so a further full indexing pass was deferred.
