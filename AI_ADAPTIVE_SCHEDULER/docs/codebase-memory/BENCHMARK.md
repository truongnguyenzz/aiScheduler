# Codebase Memory benchmark

## Baseline

No before/after coding-time benchmark has been run. No speedup or quality gain
is claimed.

## Index measurements

Observed in the full-mode index:

| Measure | Result |
|---|---:|
| Graph nodes | 879 |
| Graph edges | 1,828 |
| Graph database | 5,767,168 bytes |
| Unexpected skipped files | 0 |
| Excluded directories | 8, including the personal transfer-data directory and Python caches |
| Excluded generated packages | 2 VSIX files |
| Unusable parses | 0 |
| Partial parses | 1 file, `apps_script_web/Index.html`, line 68 |
| Watcher | Disabled |
| Free physical RAM before/after indexing | 649 MB / 323 MB |

The partial parse is at the Apps Script HTML template expression
`<?= appVersion ?>`; this is expected templating syntax, not evidence of a
runtime error. The parser's graph coverage at that line is incomplete, so use
direct source/text search there.

The MCP tool's elapsed time and peak process memory were not captured. The
free-memory readings are system-wide before/after snapshots, not a measurement
of Codebase Memory's memory use. Coverage is explicitly best-effort: no
unexpectedly skipped files and no recorded issues in the other checked source
scopes do not prove complete semantic coverage. The workspace's OneDrive
reparse-point behavior is therefore not assumed to be exhaustive.

No before/after coding-time benchmark has been run. No speedup or quality gain
is claimed. A full-mode refresh completed after the MCP configuration and
Skills were in place. At that check, coverage reported `metadata_match` for the
MCP configuration, Copilot instructions, and Skills. The final status-document
edits in this directory were made after that refresh; automatic watching is
disabled, so refresh after system memory headroom recovers. The latest free
physical memory reading was about 302 MB, so another full pass was deferred.

## Task comparison

For a reproducible future comparison, choose the same bounded repository task
with and without graph assistance. Record elapsed time, number of source files
opened, relevant callers/tests found, missed dependencies, and test outcome.
Do not include Google Sheets/Calendar operations or personal schedule data.

## Representative source check

The `secondary_tasks` search located the optimizer's secondary scheduler and
fallback placement functions plus tests in
`vscode_extension/test/test_optimizer.py`. Direct source inspection confirmed
that the optimizer builds secondary intervals and enforces period-specific
windows; fallback placement checks conflicts with Main intervals and already
placed Secondary tasks. The focused test
`test_secondary_overlaps_are_soft_and_duration_is_preserved` checks that an
overlap can remain visible in the preview without shortening the source
duration. Graph evidence was corroborated against source and test text; no
behavioral test was run as part of this integration check.

The project `.mcp.json` specifies a 13-tool allowlist. The current SDK tool
catalog also lists excluded server tools, so verify effective Copilot harness
tool selection separately. No excluded or mutating tool was called.
