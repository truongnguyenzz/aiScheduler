# Codebase Memory integration

## Data flow

```text
VS Code workspace
  .mcp.json ──stdio──> Codebase Memory MCP 0.12.1
                         ├─ allowed root: this workspace only
                         ├─ cache: %LOCALAPPDATA%\CodebaseMemoryMCP\AI_ADAPTIVE_SCHEDULER
                         └─ automatic index/watch/UI: disabled
  .cbmignore ───────────> excludes personal, secret, and generated data
  .github/copilot-instructions.md and .github/skills/
                       └─ guides bounded, source-verified use
```

The graph is a development aid for repository navigation and impact analysis.
It is not a scheduler, optimizer, or Google Sheets/Calendar connector.

## Exposed tools

The workspace allowlist exposes `index_repository`, `search_graph`,
`query_graph`, `trace_path`, `get_code_snippet`, `get_file_outline`,
`get_graph_schema`, `compare_graphs`, `get_architecture`, `search_code`,
`list_projects`, `index_status`, and `check_index_coverage`. The Git-diff-based
`detect_changes` tool is not exposed because this workspace is not a Git
repository. Graph deletion, ADR mutation, and trace ingestion are not exposed.

## Host status

VS Code's MCP Servers view showed `schedulerCodeMemory` as Running, and
read-only Codebase Memory calls succeeded in this Copilot SDK session. The
latest full-mode index has 879 nodes and 1,828 edges; coverage confirms that
the transfer-data directory and generated VSIX packages remain excluded. One
Apps Script HTML template line has a parser partial.

The `.mcp.json` file specifies 13 allowed tools, but the SDK tool catalog also
lists server tools omitted from that array. The portable configuration schema
supports a `tools` selection, but verify the effective Copilot harness Tools
selection before treating this as an enforced capability boundary. Do not
invoke the excluded tools.

The graph refresh preceded the latest edits to these status documents. The
watcher remains disabled, and another full pass was deferred when free memory
was about 302 MB. Refresh after memory headroom recovers.
