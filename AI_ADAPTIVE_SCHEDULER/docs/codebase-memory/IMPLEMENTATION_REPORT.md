# Codebase Memory implementation report

## Completed

- Installed and checksum-verified Codebase Memory MCP 0.12.1 for Windows x64.
- Added workspace-only `.mcp.json`, `.cbmignore`, Copilot instructions, and four
  focused project Skills.
- Configured a dedicated local cache with manual indexing, no file watcher or
  graph UI, one worker, and bounded indexing/memory settings.
- Verified JSON configuration, executable path, stdio initialization, tool
  listing, and rejection of an index request outside the allowed root.
- Omitted the Git-diff-based change detector from the workspace allowlist
  because this directory is not a Git repository.
- Verified VS Code shows `schedulerCodeMemory` as Running and confirmed
  successful read-only tool calls from this Copilot SDK session.
- Built/refreshed a full-mode local index (879 nodes, 1,828 edges; 5,767,168-byte
  graph database). Confirmed the personal transfer-data directory and generated
  packages were excluded, with no unexpected skipped files.
- Ran a representative graph query and confirmed its optimizer source and
  test references directly.
- Added an audit, integration overview, operations guide, and benchmark record.

## Pending acceptance checks

- Verify the effective Copilot harness Tools selection: `.mcp.json` specifies
  13 tools, while the current SDK tool catalog also lists tools excluded from
  that array. The relevant VS Code harness tool-selection preference is
  persistent beyond this workspace, so it was not changed during verification.
- Refresh the index after the latest status-document edits. The last full
  refresh preceded these edits; free memory was about 302 MB, so another full
  indexing pass was deferred.
- Coverage is best-effort and does not prove complete OneDrive traversal.
- The Apps Script HTML template expression at line 68 has a best-effort parser
  partial; use direct source inspection for that line.

## Scope boundary

No scheduler source code or scheduling policy was changed. No Google Sheets or
Calendar data was read or modified. VS Code showed the MCP server as Running,
and read-only Codebase Memory calls succeeded in this Copilot SDK session.
The remaining host-side check is whether the Copilot Tools selection actually
restricts the excluded MCP tools.
