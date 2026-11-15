# Codebase Memory operations

## Manual indexing

Automatic indexing and file watching are disabled. After a meaningful source
change, run the workspace `index_repository` MCP tool with:

```json
{
  "repo_path": "<this workspace root>",
  "name": "AI_ADAPTIVE_SCHEDULER",
  "mode": "full",
  "persistence": false,
  "async": false
}
```

The server is restricted to this workspace by `CBM_ALLOWED_ROOT`. Keep the
dedicated cache and the limits in its runtime configuration. Do not enable
cross-repository indexing, automatic indexing, watching, or the graph UI.

Before using graph results, call `index_status` and
`check_index_coverage` for the relevant files. If the index is missing, stale,
or incomplete, use workspace search and inspect the source directly.

## CLI fallback

From the workspace root in PowerShell:

```powershell
$env:CBM_ALLOWED_ROOT = (Get-Location).Path
$env:CBM_CACHE_DIR = Join-Path $env:LOCALAPPDATA 'CodebaseMemoryMCP\AI_ADAPTIVE_SCHEDULER'
$env:CBM_WORKERS = '1'
$env:CBM_MEM_BUDGET_MB = '192'
$exe = Join-Path $env:LOCALAPPDATA 'CodebaseMemoryMCP\bin\codebase-memory-mcp.exe'
$argsJson = @{ repo_path = (Get-Location).Path; name = 'AI_ADAPTIVE_SCHEDULER'; mode = 'full'; persistence = $false } | ConvertTo-Json -Compress
& $exe cli --progress index_repository $argsJson
```

Do not pass a path outside the workspace. The CLI writes its graph to the
dedicated local cache; it does not write to Google services.

## Data exclusions

Review `.cbmignore` before changing the indexed scope. In particular, keep
`transfers/` excluded because it contains personal schedule inputs and
optimization outputs. Never index credentials or token files.

## Troubleshooting

- If VS Code does not show the MCP server, confirm the workspace is trusted,
  `.mcp.json` is at the workspace root, and the executable path exists. Then
  reload the VS Code window and inspect the MCP server status.
- If Copilot Chat is absent, install/enable the official extension and sign in
  through the normal VS Code flow before attempting live verification. Do not
  claim Copilot-host integration based only on the direct MCP smoke test.
- If memory is constrained, stop before indexing, close unrelated workloads,
  and re-check available RAM. Do not raise the 192 MB budget as a workaround.
