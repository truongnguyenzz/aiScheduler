# IMPLEMENTATION HANDOFF SPECIFICATION
# PROJECT-LOCAL CODEBASE INTELLIGENCE INTEGRATION
## Codebase Memory MCP + VS Code + GitHub Copilot Agent
### Target Project: AI_ADAPTIVE_SCHEDULER

---

# 0. EXECUTION DIRECTIVE

You are the implementation agent responsible for integrating Codebase Memory MCP into the existing AI_ADAPTIVE_SCHEDULER development environment.

The user does not intend to perform the installation, configuration, file creation, integration, or validation manually.

You must perform the implementation work yourself using the available VS Code workspace, terminal, filesystem, Git, and Copilot capabilities.

Do not respond with a tutorial telling the user how to perform the steps manually when you can execute them yourself.

Your responsibilities include:

1. Inspect the existing project and development environment.
2. Research the current Codebase Memory MCP repository and its official documentation.
3. Verify Windows compatibility and GitHub Copilot compatibility.
4. Install the MCP runtime locally on the machine.
5. Configure the MCP server exclusively for the AI_ADAPTIVE_SCHEDULER workspace.
6. Configure indexing, storage, exclusions, permissions, and security boundaries.
7. Integrate Copilot instructions and reusable Agent Skills.
8. Integrate specialized Agents only when technically supported and useful.
9. Index the project and validate the resulting knowledge graph.
10. Test real MCP queries through GitHub Copilot.
11. Benchmark the integrated workflow against the previous development workflow.
12. Produce complete documentation and an implementation report.

You are expected to execute the implementation sequentially and autonomously within the authorized scope.

Do not stop after producing an audit report if the implementation can safely continue.

If a genuine blocker prevents implementation, complete every independent safe task, document the blocker precisely, and request only the specific user decision or permission required to proceed.

Do not ask the user to repeat information that can be discovered from the workspace or machine.

---

# 1. PROJECT CONTEXT

## 1.1. Target project

Project name:

AI_ADAPTIVE_SCHEDULER

The exact workspace root must be discovered from the currently opened VS Code workspace.

Do not assume a hardcoded Windows path.

The project is an existing intelligent scheduling system integrating multiple components, including scheduling logic, task processing, Google Sheets, Google Calendar, synchronization mechanisms, application services, tests, configuration, and documentation.

The project is actively evolving.

Its existing source code, architecture, data formats, interfaces, and business rules must be preserved.

## 1.2. Primary development environment

- Operating system: Windows.
- Editor: Visual Studio Code.
- Main coding agent: GitHub Copilot Agent.
- The user primarily develops and maintains this project through Copilot Agent.
- Available hardware includes a laptop with approximately 8 GB RAM.
- The project must remain usable in the existing environment.

Inspect actual versions and capabilities instead of assuming that every feature documented by a repository is supported by the installed Copilot runtime.

## 1.3. Integration objective

Integrate:

Repository:
https://github.com/DeusData/codebase-memory-mcp

Codebase Memory MCP must become the project's dedicated Code Intelligence layer.

It must help GitHub Copilot understand:

- Repository structure.
- Files and modules.
- Classes, functions, methods, and symbols.
- Import relationships.
- Function call relationships.
- Dependency relationships.
- Architecture and module boundaries.
- Relevant documentation.
- Relevant tests.
- Code changes and their potential impact.
- Index coverage and freshness.

The primary purpose is to reduce repeated repository exploration, unnecessary source-file reading, context reconstruction, and dependency discovery across different Copilot sessions.

The integration must not replace GitHub Copilot Agent.

It must not replace the project's scheduling algorithms.

It must not introduce another AI model or AI provider.

It must not modify the project's runtime scheduling behavior.

---

# 2. STRICT SCOPE BOUNDARY

This is a PROJECT-LOCAL integration.

The integration is exclusively for:

AI_ADAPTIVE_SCHEDULER

The following boundaries are mandatory.

## 2.1. Workspace-only Copilot configuration

Use the native GitHub Copilot workspace-level MCP configuration supported by the installed VS Code version.

Prefer:

<workspace-root>/.mcp.json

with the native Copilot configuration schema.

Verify the actual configuration reference before creating it.

Do not confuse the native Copilot MCP configuration with the deprecated or editor-managed Local harness configuration.

Do not create a global Copilot MCP configuration.

Do not add Codebase Memory to:

- %USERPROFILE%\.copilot\mcp-config.json
- Global VS Code MCP configuration.
- Global Copilot Agent configuration.
- Other projects.
- Other VS Code workspaces.

Do not install global Skills or Agents for this integration.

Project-specific instructions, Skills, Agents, and configuration must reside inside this project's workspace whenever the installed Copilot runtime supports that location.

## 2.2. Runtime installation versus integration scope

A locally installed Windows binary is acceptable.

A project-specific runtime installation is preferred if it is supported and reliable.

However, do not place executables, downloaded installers, temporary archives, or generated runtime files inside the source tree unnecessarily.

A possible runtime location is:

%LOCALAPPDATA%\CodebaseMemoryMCP\

This is only a proposed location. Verify the installer's supported options and Windows filesystem requirements before using it.

The MCP runtime may be installed on the machine, but its Copilot connection and permitted indexing scope must remain restricted to AI_ADAPTIVE_SCHEDULER.

## 2.3. Repository containment

Use the documented Codebase Memory environment variable:

CBM_ALLOWED_ROOT

Set it to the canonical absolute path of AI_ADAPTIVE_SCHEDULER.

The MCP server must reject indexing requests outside the approved project root.

Resolve and validate the canonical project path.

Check symbolic links, parent-directory traversal, and path normalization.

Do not assume that a textual path comparison is sufficient.

If the runtime or installed version does not enforce the intended containment behavior, report the limitation and implement additional safe restrictions before enabling indexing.

## 2.4. No cross-project intelligence

Do not index unrelated repositories.

Do not configure multi-repository intelligence.

Do not create shared graphs containing unrelated projects.

Do not enable cross-repository search.

Do not automatically discover and index other repositories on the machine.

---

# 3. INITIAL AUDIT — DISCOVER BEFORE MODIFYING

Before installation, inspect the actual environment.

This audit must be evidence-based.

Do not guess.

## 3.1. VS Code and Copilot audit

Determine:

- Installed VS Code version.
- Windows architecture.
- Installed GitHub Copilot extensions and versions.
- Current Copilot Agent harness/runtime.
- Whether the active Copilot session supports MCP.
- Whether native workspace-root `.mcp.json` is supported.
- Whether the workspace-root configuration setting is experimental or requires activation.
- Whether project-level Agent Skills are supported.
- Whether project-level Custom Agents are supported.
- Whether Agent hooks are supported by the active runtime.
- Whether MCP tool approval and access controls are available.
- Whether the selected Copilot mode can access the MCP server.

The user may use Copilot Fusion or another model-selection mode.

Do not change the user's model-selection preference merely to enable MCP.

Verify MCP compatibility with the actual active Copilot harness.

## 3.2. Project audit

Inspect:

- Workspace root.
- Git repository root.
- Current Git branch.
- Git working-tree status.
- Existing project instructions.
- Existing Agent Skills.
- Existing Custom Agents.
- Existing MCP configuration.
- Existing `.gitignore`.
- Existing tests.
- Existing documentation.
- Existing project architecture.
- Existing package and dependency configuration.
- Existing generated directories.
- Existing local databases and runtime data.

Preserve all existing configuration.

If files such as `AGENTS.md`, `.github/copilot-instructions.md`, `.mcp.json`, or existing Skills already exist, inspect and extend them carefully instead of overwriting them.

## 3.3. Repository audit

Inspect the official Codebase Memory repository:

https://github.com/DeusData/codebase-memory-mcp

Use its current official documentation and release information.

Inspect at least:

- README.
- Latest stable release.
- Windows installation instructions.
- Installation script.
- Configuration documentation.
- MCP tool reference.
- Indexing behavior.
- Watcher behavior.
- Ignore-file behavior.
- Resource limits.
- Windows security requirements.
- Copilot integration instructions.
- Known issues and compatibility limitations.

Verify every command, environment variable, configuration property, MCP tool name, and installation option before using it.

Do not blindly copy examples from old documentation or previous AI responses.

## 3.4. Audit output

Create:

docs/architecture/CODEBASE_MEMORY_INTEGRATION_AUDIT.md

If the existing documentation structure differs, use its established conventions.

The audit must record:

- Actual environment.
- Actual project root.
- Actual Git status.
- Existing configuration.
- Compatibility findings.
- Supported installation method.
- Verified MCP tools.
- Resource considerations.
- Potential conflicts.
- Recommended implementation decisions.

After completing the audit, continue with safe implementation steps. Do not wait for the user merely to approve a report if no unresolved risk or blocker exists.

---

# 4. INSTALLATION REQUIREMENTS

## 4.1. Installation method

Prefer the official Windows x64 release binary.

Use the official repository and official release assets.

Verify:

- Correct operating system.
- Correct architecture.
- Release version.
- SHA-256 checksum.
- Executable integrity.
- Installation location.
- File permissions.
- Windows execution restrictions.

Inspect the official PowerShell installer before executing it.

Do not pipe an unreviewed remote script directly into PowerShell execution.

Prefer the documented binary-only installation mode:

--skip-config

if the current installer supports it.

The purpose is to install the runtime without allowing the installer to configure global Copilot settings.

If the documented installation option has changed, follow the current official documentation and preserve the project-only configuration requirement.

## 4.2. Installation safety

Do not:

- Disable Windows Defender.
- Disable antivirus.
- Disable Windows security controls.
- Execute unrelated downloaded binaries.
- Run installation commands as Administrator unless strictly required and explicitly justified.
- Modify system PATH globally unless necessary.
- Modify global VS Code configuration.

If Windows SmartScreen or antivirus blocks the executable, investigate the signature, checksum, release provenance, and official documentation.

Do not automatically bypass security warnings.

Report the exact problem and request approval when necessary.

## 4.3. Runtime verification

After installation, verify:

- Executable starts.
- Version can be queried.
- Help output is available.
- MCP transport works.
- Runtime can start and stop correctly.
- Runtime logs are accessible.
- No unnecessary background processes remain after a session ends.
- No unexpected global configuration was created.

Document the actual installed version.

---

# 5. MCP CONFIGURATION

Create a native workspace-level Copilot MCP configuration.

Preferred location:

<workspace-root>/.mcp.json

The actual schema must be verified against the installed Copilot harness and current official VS Code documentation.

Do not invent configuration fields.

## 5.1. Server configuration

Register a uniquely named MCP server:

schedulerCodeMemory

Use the documented stdio transport if supported by the installed Codebase Memory release.

Configure:

- Executable command.
- Required arguments.
- Environment variables.
- Runtime-specific options.
- Tool allowlist, if supported.
- Appropriate working directory, if supported.

## 5.2. Environment variables

Evaluate and configure the following documented settings when supported:

CBM_ALLOWED_ROOT

Canonical absolute path of AI_ADAPTIVE_SCHEDULER.

CBM_CACHE_DIR

A dedicated cache directory for this Codebase Memory installation.

Prefer a project-specific cache location outside the source tree, for example:

%LOCALAPPDATA%\CodebaseMemoryMCP\AI_ADAPTIVE_SCHEDULER\

CBM_LOG_LEVEL

Use an appropriate low-noise operational level such as warn, unless debugging requires more detailed logging.

Do not enable diagnostics or trajectory collection without a clear need.

Do not store credentials or secrets in the MCP configuration.

Do not assume that changing environment variables in a new MCP session changes an already-running shared daemon.

Inspect the current daemon lifecycle and configuration-capture behavior.

## 5.3. MCP tool allowlist

Discover the actual tools exposed by the installed server.

Build an explicit allowlist containing the tools required for project intelligence.

Prioritize tools equivalent to:

- index_repository
- list_projects
- index_status
- check_index_coverage
- search_graph
- trace_path
- query_graph
- get_graph_schema
- get_code_snippet
- get_file_outline
- get_architecture
- search_code
- detect_changes
- compare_graphs

These names are requested capabilities, not permission to assume that every name exists in every release.

Check the real tool list and exact schemas before configuring the allowlist.

Do not expose destructive or unnecessary tools during initial integration.

Initially exclude, where supported:

- delete_project
- Any graph deletion or reset tool.
- Any tool capable of changing approved ADRs.
- Any unnecessary trace ingestion or mutation tool.
- Any tool that can operate on unrelated repositories.

Do not remove useful read-only functionality merely to reduce the tool list excessively.

The goal is a practical, minimal, effective MCP interface.

## 5.4. MCP connection validation

After creating the configuration:

1. Restart or reload the relevant Copilot session.
2. Verify the MCP server appears in the active Copilot session.
3. Verify that the server starts successfully.
4. Inspect available tools.
5. Execute a harmless read-only query.
6. Verify returned data refers to AI_ADAPTIVE_SCHEDULER.
7. Verify an indexing request outside CBM_ALLOWED_ROOT is rejected, using a safe test path and without indexing another repository.

Do not report successful integration merely because `.mcp.json` exists.

A successful actual MCP tool call is required.

---

# 6. INDEXING AND DATA PROTECTION

## 6.1. Initial indexing policy

Use manual initial indexing.

Do not enable automatic indexing before the first indexing process has been validated.

Do not automatically index every project.

Index only the canonical AI_ADAPTIVE_SCHEDULER repository.

## 6.2. Create project-specific ignore rules

Create:

<workspace-root>/.cbmignore

Inspect the real project structure before writing exclusion patterns.

Exclude unnecessary or sensitive material, including where present:

- .venv/
- venv/
- __pycache__/
- *.pyc
- node_modules/
- build/
- dist/
- .cache/
- logs/
- temporary files.
- downloaded binaries.
- generated archives.
- local cache databases.
- private user data.
- exported personal data.
- .env
- .env.*
- credentials.
- private keys.
- tokens.
- secrets.

Do not exclude important project knowledge.

In particular, do not automatically exclude:

- Source code.
- Tests.
- Architecture documentation.
- README files.
- Project instructions.
- Agent Skills.
- Relevant configuration templates.
- Approved scheduling policy documentation.
- Relevant sample fixtures that contain no private information.

Do not index actual secrets or personal user data.

Verify the ignore syntax and actual behavior using the installed Codebase Memory version.

## 6.3. Graph storage

Store graph data in the dedicated CBM cache directory.

Do not place large generated graph databases in the source tree unless the official architecture requires it and the reason is documented.

Do not automatically commit generated graph snapshots.

Do not automatically export graph artifacts to Git.

Do not enable team-shared graph artifacts during initial implementation.

## 6.4. Initial indexing execution

Run the official indexing operation for the current project.

Capture:

- Index status.
- Indexed file count.
- Excluded file count, if available.
- Node count.
- Edge count.
- Index duration.
- Memory usage.
- CPU usage.
- Warnings.
- Errors.
- Index coverage.

Do not claim the graph is complete merely because indexing returned a success message.

Verify actual coverage.

If indexing is degraded, incomplete, or fails resource limits, investigate and report it.

Do not silently publish or rely on a partial graph as if it were complete.

---

# 7. RESOURCE OPTIMIZATION FOR AN 8 GB RAM MACHINE

The user's laptop has approximately 8 GB RAM.

Resource efficiency is important.

Do not assume the default settings are optimal.

## 7.1. Initial resource policy

Initially:

- Disable automatic indexing.
- Disable background watcher.
- Avoid unnecessary parallel indexing workers.
- Avoid unnecessary diagnostics.
- Avoid continuous full-repository rescanning.
- Avoid duplicate indexing processes.
- Avoid unnecessary graph visualization services.
- Avoid running multiple Codebase Memory daemons.
- Avoid expensive overlapping MCP queries.

Inspect the actual supported resource configuration.

Use the official resource-limit settings where appropriate, including settings equivalent to:

- index_max_files
- index_max_source_mb
- index_max_rss_mb
- index_max_duration_seconds
- CBM_WORKERS
- CBM_MEM_BUDGET_MB

Do not invent unsupported configuration options.

## 7.2. Resource benchmarking

Measure:

- RAM before indexing.
- Peak RAM during indexing.
- RAM after indexing.
- CPU during indexing.
- Indexing duration.
- Query latency.
- MCP startup time.
- Background resource consumption.

Do not use arbitrary resource limits that make the index permanently incomplete.

If the project exceeds available resources, identify the largest contributors and recommend a safe strategy.

## 7.3. Watcher policy

Keep automatic watcher disabled during initial implementation.

Only consider enabling it after:

- Initial indexing succeeds.
- Graph coverage is verified.
- MCP queries are accurate.
- Memory usage is acceptable.
- File-change detection is tested.
- Index refresh behavior is understood.

If enabling watcher:

- Monitor only the approved Git repository.
- Avoid monitoring unrelated directories.
- Avoid unnecessary repeated indexing.
- Verify behavior after Git changes.
- Verify behavior after branch changes.
- Verify daemon restart behavior.
- Verify stale-index detection.

The watcher must not modify source code.

---

# 8. COPILOT INTEGRATION LAYER

MCP provides tools.

Copilot needs explicit instructions about when and how to use them.

Create project-specific instructions and Skills.

Do not generate redundant or excessively large instruction files.

## 8.1. Main Copilot instructions

Inspect existing:

.github/copilot-instructions.md

If absent, create it.

If present, preserve existing instructions and integrate the new section.

Add a section:

# Codebase Intelligence Integration

The instructions must establish the following rules.

### Scope

- Codebase Memory is dedicated exclusively to this repository.
- Never index or query unrelated repositories.
- Never use cross-repository intelligence.
- Never change the project's global Copilot configuration.

### Retrieval

- Use Codebase Memory for repository structure discovery.
- Use it for symbol search.
- Use it for dependency tracing.
- Use it for function-call analysis.
- Use it for impact analysis.
- Use it for test discovery.
- Use it for architecture exploration.
- Avoid broad overlapping queries.
- Prefer targeted graph queries.

### Evidence

- Graph data is discovery evidence, not absolute proof.
- Verify important findings against actual source files.
- Check index freshness before relying on graph results.
- Check coverage before concluding that a symbol or relationship does not exist.
- If graph data is stale or incomplete, inspect source directly.
- Do not claim exhaustive dependency analysis without sufficient evidence.

### Change safety

- Exploration tasks must not modify source code.
- Audit-only tasks must not modify source code.
- Do not delete or rebuild the graph without authorization.
- Do not modify approved ADRs without authorization.
- Do not modify .env, credentials, secrets, or private user data.
- Do not modify Google Calendar or Google Sheets user data during MCP integration.
- Run relevant tests after code changes.

### Reporting

Separate:

1. Graph evidence.
2. Source-code evidence.
3. Test evidence.
4. Assumptions.
5. Unverified relationships.
6. Known index limitations.

Always report relevant files, symbols, dependencies, and tests.

## 8.2. Project-specific Agent Skills

Create reusable Skills under the project's supported Agent Skills directory.

Preferred project-local location:

.github/skills/

Verify that the active Copilot runtime recognizes this location and the current SKILL.md format.

Create only the following initial Skills.

### Skill 1: codebase-exploration

Purpose:

Efficiently understand an unfamiliar project area.

Workflow:

1. Check index status.
2. Check relevant coverage.
3. Search graph for the target concept.
4. Identify relevant modules and symbols.
5. Trace important relationships.
6. Inspect actual source files.
7. Produce a concise architecture summary.

Do not modify source code.

### Skill 2: impact-analysis

Purpose:

Analyze the effects of a proposed code modification.

Workflow:

1. Identify target files and symbols.
2. Trace callers and dependencies.
3. Identify data-flow relationships.
4. Identify related modules.
5. Discover related tests.
6. Inspect actual source.
7. Identify possible regressions.
8. Produce an impact report.

Do not claim complete impact coverage when graph coverage is incomplete.

### Skill 3: debugging

Purpose:

Use graph intelligence to accelerate debugging.

Workflow:

1. Identify the failing behavior.
2. Locate relevant symbols.
3. Trace the execution path.
4. Identify dependencies and data flow.
5. Inspect actual source.
6. Inspect related tests.
7. Form hypotheses.
8. Test hypotheses.
9. Implement a minimal justified fix.
10. Run regression tests.

Do not make speculative changes based only on graph relationships.

### Skill 4: validate-changes

Purpose:

Verify changes before considering a task complete.

Workflow:

1. Identify changed files.
2. Use change-impact analysis.
3. Discover affected tests.
4. Run targeted tests.
5. Run broader regression tests when justified.
6. Inspect test results.
7. Verify no protected behavior changed.
8. Report remaining risks.

## 8.3. Skill quality requirements

Each Skill must include:

- Clear description.
- Trigger conditions.
- Step-by-step procedure.
- Appropriate MCP tool usage.
- Fallback behavior.
- Evidence requirements.
- Output format.
- Safety constraints.

Do not create Skills that simply repeat the entire project documentation.

Do not create Skills that invoke every MCP tool on every task.

---

# 9. SPECIALIZED AGENTS

Create specialized project-local Custom Agents only if the installed Copilot runtime supports them.

Preferred roles:

## 9.1. Codebase Scout

Role:

Fast structural exploration.

Responsibilities:

- Search graph.
- Identify relevant files.
- Locate symbols.
- Trace preliminary relationships.
- Identify relevant documentation.
- Identify related tests.

Restrictions:

- Read-only.
- No source modifications.
- No graph deletion.
- No project configuration modifications.

Output:

- Relevant files.
- Relevant symbols.
- Preliminary dependency map.
- Index coverage.
- Unverified assumptions.

## 9.2. Codebase Verifier

Role:

Verify important findings.

Responsibilities:

- Inspect actual source files.
- Confirm graph relationships.
- Validate function signatures.
- Check data flow.
- Confirm test relationships.
- Identify stale or incomplete graph data.

Restrictions:

- Read-only.
- No source modifications.

Output:

- Confirmed findings.
- Contradicted findings.
- Unverified findings.
- Source references.
- Test references.

## 9.3. Architecture Auditor

Role:

Deep architectural and regression analysis.

Responsibilities:

- Analyze module boundaries.
- Analyze dependency impact.
- Analyze architecture changes.
- Identify circular dependencies.
- Identify potential regressions.
- Review changes involving major scheduling components.

Restrictions:

- Read-only by default.
- No automatic architecture redesign.
- No silent ADR modification.
- No source modifications unless explicitly authorized for a separate implementation task.

Output:

- Architecture impact report.
- Dependency analysis.
- Risk assessment.
- Missing tests.
- Recommended implementation sequence.

## 9.4. Agent orchestration

Do not create a complicated multi-agent orchestration system unnecessarily.

The main GitHub Copilot Agent remains responsible for coordinating tasks.

Specialized Agents are optional analytical workers.

If subagents are not supported by the installed runtime, do not simulate them through unnecessary infrastructure.

Use Skills and instructions instead.

Do not create duplicate agents with overlapping responsibilities.

---

# 10. ARCHITECTURE DECISION RECORDS

Establish a lightweight ADR directory only if the project does not already have an equivalent architecture-decision system.

Preferred location:

docs/architecture/decisions/

Create an ADR index.

Record confirmed decisions only.

Do not turn assumptions into approved decisions.

Important existing scheduling principles must be preserved.

In particular:

## Duration philosophy

The project has selected:

C — Balanced optimization with quality consideration.

The system must not reduce task duration solely to fit more tasks into a schedule.

Original duration must remain available.

Adaptation must be bounded, justified, and evaluated.

## Scheduling architecture

The intended direction separates:

- Context Intelligence.
- Task Profiling.
- Constraint Engine.
- Scheduling Optimization.
- Adaptive Scheduling.
- AI Self-Review.
- Learning and Feedback.
- Calendar Execution and Synchronization.

OR-Tools may be used for constraint-based optimization after the existing implementation is audited and benchmarked.

Codebase Memory must not become part of the scheduling runtime.

## Authority

Codebase Memory provides structural knowledge.

It does not define business policy.

Approved project documents and user-confirmed decisions remain authoritative.

Do not automatically rewrite approved policies because graph analysis suggests another architecture.

Do not create duplicate ADRs for decisions already documented.

---

# 11. MCP WORKFLOW POLICY

The main Copilot Agent must use a task-sensitive retrieval strategy.

Do not query the entire graph for every request.

Use the smallest sufficient retrieval scope.

## Tier 1: Lightweight exploration

Use for:

- Finding one function.
- Finding a class.
- Finding a module.
- Understanding one file.
- Locating a relevant test.

Expected workflow:

1. Check index status when necessary.
2. Search relevant symbols.
3. Retrieve a focused file outline or snippet.
4. Inspect source if required.

## Tier 2: Standard implementation preparation

Use for:

- Bug fixes.
- Feature changes.
- Refactoring a module.
- Modifying an interface.
- Changing a data-processing flow.

Expected workflow:

1. Search relevant symbols.
2. Trace callers and dependencies.
3. Identify affected modules.
4. Discover related tests.
5. Inspect source.
6. Produce an impact assessment.
7. Implement only after sufficient understanding.

## Tier 3: Deep architectural audit

Use for:

- Scheduling architecture changes.
- Constraint Engine changes.
- OR-Tools integration.
- Adaptive Scheduling changes.
- Duration optimization changes.
- Self-Review changes.
- Large-scale refactoring.
- Cross-module data-flow changes.

Expected workflow:

1. Check graph status.
2. Check graph coverage.
3. Obtain architecture overview.
4. Identify major modules.
5. Trace dependencies.
6. Inspect relevant source.
7. Identify tests and interfaces.
8. Identify regression risks.
9. Produce an architecture impact report.
10. Recommend a controlled implementation plan.

## Query efficiency

Avoid:

- Repeatedly searching identical terms.
- Calling several tools with overlapping scopes.
- Retrieving huge snippets unnecessarily.
- Re-indexing the entire project for every task.
- Treating graph queries as a substitute for tests.
- Retrieving unrelated documentation.

Cache useful findings within the current task context when possible.

Do not claim that MCP results are automatically shared across separate Copilot conversations unless that behavior has been verified.

The persistent graph is the reusable structural knowledge layer.

---

# 12. AUTOMATION AND PERMISSION POLICY

The user wants high automation in ordinary project development.

However, automation must remain within explicit boundaries.

## 12.1. Safe actions

Allow autonomous execution where supported:

- Read project files.
- Search project files.
- Read graph data.
- Query MCP tools.
- Inspect Git status.
- Inspect Git diff.
- Inspect Git history.
- Create project-local documentation.
- Create project-local Skills.
- Create project-local Agent instructions.
- Run existing tests.
- Run approved project-local scripts.
- Perform harmless indexing.
- Validate generated configuration.
- Run read-only diagnostics.

## 12.2. Actions requiring approval

Request approval before:

- Installing or updating external binaries.
- Installing new packages.
- Downloading external executables.
- Running unreviewed remote scripts.
- Modifying global settings.
- Modifying system PATH.
- Running administrator commands.
- Deleting graph databases.
- Resetting project indexes.
- Deleting project files.
- Rewriting Git history.
- Force pushing.
- Modifying credentials.
- Modifying .env files.
- Accessing or exporting private user data.
- Modifying Google Calendar or Google Sheets data.
- Performing destructive database operations.

## 12.3. Do not weaken security

Do not:

- Enable global Allow All.
- Disable all Copilot approval mechanisms.
- Disable Windows security.
- Grant broad filesystem access.
- Grant unrelated repositories access.
- Automatically approve every terminal command.

Use the narrowest available permissions.

Do not repeatedly ask permission for harmless operations that are already authorized by the environment.

---

# 13. TESTING AND ACCEPTANCE CRITERIA

The integration is not complete merely because installation succeeds.

It must pass practical tests.

## Test 1: MCP connectivity

Verify GitHub Copilot can see and call Codebase Memory MCP tools.

Expected:

- Server is visible.
- Tools are available.
- A read-only query succeeds.
- No global MCP registration was created.

## Test 2: Project containment

Attempt a safe indexing request outside the allowed root.

Expected:

- Request is rejected.
- No unrelated repository is indexed.

## Test 3: Repository indexing

Index AI_ADAPTIVE_SCHEDULER.

Expected:

- Index completes successfully.
- Index status is healthy.
- Relevant source files are represented.
- Tests and documentation are represented where supported.
- Excluded secrets and private data are absent.

## Test 4: Architecture retrieval

Ask Copilot:

"Explain the current architecture of AI_ADAPTIVE_SCHEDULER and identify the main modules responsible for task processing, scheduling, optimization, and calendar synchronization. Use Codebase Memory for discovery and verify the conclusions against source code."

Expected:

- Relevant modules are identified.
- Source evidence is supplied.
- Missing information is explicitly reported.
- No invented module or dependency is presented as fact.

## Test 5: Dependency tracing

Ask Copilot to trace a real function in the current project.

Expected:

- Caller/callee relationships are returned where supported.
- Actual source is inspected.
- Dynamic or unresolved relationships are identified as limitations.

## Test 6: Impact analysis

Choose a real scheduling-related module.

Ask Copilot to identify the files, functions, dependencies, and tests potentially affected by changing it.

Expected:

- Relevant dependencies are identified.
- Related tests are discovered.
- Source code confirms important findings.
- Incomplete graph coverage is disclosed.

## Test 7: Index freshness

Modify a harmless test or documentation file.

Expected:

- Index freshness can be checked.
- Stale graph data is detected where supported.
- Manual re-indexing works.
- No source code is automatically rewritten.

## Test 8: New Copilot session

Restart VS Code or open a new Copilot Agent session.

Expected:

- MCP integration remains available.
- Existing graph data can be queried.
- The system does not require full re-indexing merely because the conversation changed.

## Test 9: Resource usage

Measure RAM, CPU, indexing time, and query latency.

Expected:

- Resource consumption is recorded.
- No unnecessary persistent watcher is running.
- No duplicate daemon processes are created.

## Test 10: Project integrity

Inspect:

- Git status.
- Git diff.
- Existing tests.
- Existing project configuration.

Expected:

- Existing scheduling source code remains unchanged.
- No unrelated project files are modified.
- No private data is exposed.
- No global Copilot configuration is modified.

---

# 14. PERFORMANCE BENCHMARK

Establish a baseline and compare it with the integrated workflow.

Use equivalent tasks before and after integration.

Benchmark tasks:

1. Understand the project architecture.
2. Find all relevant components for Duration adaptation.
3. Trace the flow through Constraint Engine and Scheduler.
4. Identify dependencies of a selected module.
5. Discover tests related to a selected feature.
6. Analyze the impact of a proposed code change.
7. Continue a previous development task in a new Copilot session.

Record where available:

- Total completion time.
- Number of source files opened.
- Number of MCP calls.
- Number of repeated searches.
- Token consumption, if available.
- Accuracy of dependency identification.
- Missed dependencies.
- False-positive relationships.
- RAM usage.
- CPU usage.
- Indexing duration.
- Query latency.

Do not invent benchmark results.

Do not claim performance improvement without a comparable baseline.

If precise token consumption is unavailable, state that it could not be measured.

The objective is not simply to maximize graph queries.

The objective is to reduce total development effort while maintaining or improving accuracy.

---

# 15. FEATURES TO DEFER

Do not implement the following unless a concrete project need is established:

- Cross-repository intelligence.
- Global Copilot integration.
- Global Skills.
- Global Custom Agents.
- Team-shared graph infrastructure.
- Cloud-hosted graph services.
- External AI model integration.
- Additional AI API providers.
- Automatic scheduling through Codebase Memory.
- Runtime Calendar synchronization through MCP.
- Graph-driven automatic source rewriting.
- Automatic ADR approval.
- Unnecessary REST services.
- Unnecessary Docker infrastructure.
- Unnecessary database services.
- Complex multi-agent orchestration.
- Continuous full-repository re-indexing.
- Unnecessary visualization services.
- Automatic graph artifact commits.

CBM Lens or graph visualization may be evaluated as an optional feature after the core integration is working.

Do not install optional features merely because they are available.

---

# 16. REQUIRED DOCUMENTATION OUTPUTS

Create or update the following project documentation, adapting paths to existing project conventions.

## 16.1. Audit

docs/architecture/CODEBASE_MEMORY_INTEGRATION_AUDIT.md

Contains environment, compatibility, architecture, and installation findings.

## 16.2. Integration architecture

docs/architecture/CODEBASE_MEMORY_INTEGRATION.md

Contains:

- Integration architecture.
- MCP configuration.
- Runtime location.
- Cache location.
- Security boundaries.
- Indexing policy.
- Copilot integration.
- Skills and Agents.
- Watcher policy.
- Troubleshooting.

## 16.3. Operational guide

docs/guides/CODEBASE_MEMORY_OPERATIONS.md

Contains:

- How to check server status.
- How to check index status.
- How to run initial indexing.
- How to refresh the index.
- How to inspect graph coverage.
- How to diagnose MCP connection failures.
- How to restart the runtime safely.
- How to recover from a failed index.
- How to disable the integration without damaging the project.

This guide is for future maintenance, not a replacement for the implementation.

## 16.4. Benchmark report

docs/reports/CODEBASE_MEMORY_BENCHMARK.md

Contains:

- Baseline.
- Post-integration results.
- Test scenarios.
- Resource usage.
- Accuracy.
- Performance comparison.
- Limitations.
- Recommendations.

## 16.5. Implementation report

docs/reports/CODEBASE_MEMORY_IMPLEMENTATION_REPORT.md

Contains:

- What was installed.
- What was configured.
- Files created or modified.
- Actual installed version.
- MCP tools available.
- Skills created.
- Agents created.
- Tests passed.
- Tests failed.
- Security verification.
- Resource usage.
- Remaining limitations.
- Recommended next steps.

Do not create duplicate documentation if an equivalent authoritative file already exists. Update existing documentation where appropriate.

---

# 17. IMPLEMENTATION PHASES

Execute the following phases sequentially.

## Phase 0 — Audit

Inspect the environment, project, repository, compatibility, and risks.

Create the audit report.

Do not modify scheduling source code.

## Phase 1 — Runtime Installation

Install the verified Windows runtime.

Use binary-only installation where supported.

Verify integrity and runtime behavior.

Do not configure global Copilot settings.

## Phase 2 — Workspace MCP Configuration

Create project-local native Copilot MCP configuration.

Configure the approved root.

Configure dedicated cache.

Apply tool restrictions.

Validate actual MCP connectivity.

## Phase 3 — Indexing

Create and validate `.cbmignore`.

Run initial indexing.

Inspect graph health and coverage.

Measure resource consumption.

## Phase 4 — Copilot Intelligence

Integrate project-local Copilot instructions.

Create the initial Skills.

Create specialized Agents only if supported and useful.

Validate actual tool usage by the main Copilot Agent.

## Phase 5 — Benchmark

Run practical architecture, dependency, impact, and test-discovery scenarios.

Compare with baseline.

Document results.

## Phase 6 — Optimization

Evaluate watcher and automatic synchronization.

Enable only if benefits justify resource usage.

Evaluate optional visualization only if useful.

Do not add unnecessary features.

---

# 18. FAILURE HANDLING

When an operation fails:

1. Capture the exact error.
2. Identify the responsible component.
3. Inspect official documentation.
4. Determine whether the issue is environmental, configuration-related, or a repository defect.
5. Try a safe, minimal correction.
6. Re-test.
7. Document the result.

Do not:

- Hide errors.
- Claim success after a failed operation.
- Silently skip required validation.
- Repeatedly reinstall without diagnosis.
- Delete the graph database as the first troubleshooting step.
- Change unrelated project files to work around an MCP issue.
- Replace the selected technology without explaining why.

If Codebase Memory MCP is incompatible with the active Copilot runtime, stop the incompatible integration path, preserve the project, and report the exact incompatibility.

Do not silently switch to a different product.

---

# 19. FINAL ACCEPTANCE CONDITIONS

The implementation can be marked COMPLETE only when the following conditions are satisfied:

[ ] Codebase Memory runtime is installed and verified.

[ ] Installation is limited to the intended local environment.

[ ] GitHub Copilot can connect to the MCP server.

[ ] MCP configuration is workspace-specific.

[ ] No global Copilot MCP configuration was added or modified.

[ ] CBM_ALLOWED_ROOT restricts indexing to AI_ADAPTIVE_SCHEDULER.

[ ] Dedicated cache storage is configured.

[ ] Sensitive and unnecessary files are excluded.

[ ] Initial project indexing succeeds.

[ ] Index status and coverage are verified.

[ ] Actual MCP queries work through Copilot.

[ ] Copilot can retrieve architecture and dependency information.

[ ] Source verification is part of the retrieval workflow.

[ ] Project-specific instructions are integrated.

[ ] Reusable Skills are integrated.

[ ] Specialized Agents are integrated only where supported.

[ ] No scheduling source code was modified during integration.

[ ] No Google Calendar or Google Sheets user data was modified.

[ ] No unrelated repository was indexed.

[ ] Resource usage has been measured.

[ ] Performance benchmark is documented.

[ ] Operational documentation is complete.

[ ] Git diff and project integrity have been checked.

If any condition cannot be met, classify it as:

- BLOCKED
- PARTIALLY_IMPLEMENTED
- NOT_SUPPORTED
- DEFERRED_BY_DESIGN

Explain the reason.

Do not mark the implementation COMPLETE with unresolved mandatory conditions.

---

# 20. FINAL EXECUTION INSTRUCTION

Begin now.

First inspect the current workspace and environment.

Then inspect the official Codebase Memory MCP repository and current VS Code Copilot MCP documentation.

Make implementation decisions based on actual verified capabilities, not assumptions.

Execute the phases in order.

You are authorized to create project-local configuration, documentation, Skills, and Agent definitions required by this specification.

You are authorized to install the Codebase Memory runtime after verifying the official release, integrity, and installation procedure.

You are authorized to index the approved AI_ADAPTIVE_SCHEDULER repository.

You are authorized to run safe read-only diagnostics and tests.

You are NOT authorized to modify the existing scheduling business logic, rewrite the project's architecture, modify user Calendar data, expose secrets, or change global Copilot configuration as part of this task.

Do not unnecessarily interrupt the user with questions.

Do not merely explain what should be done.

Perform the work.

At the end, provide a concise but evidence-based report containing:

1. Implementation status.
2. Installed version.
3. Runtime location.
4. Workspace MCP configuration location.
5. Cache location.
6. Number of indexed files, nodes, and relationships where available.
7. Available MCP tools.
8. Skills and Agents created.
9. Actual tests performed and their results.
10. RAM and CPU observations.
11. Security and workspace-scope verification.
12. Files created or modified.
13. Outstanding blockers or deferred features.
14. Exact steps required to start using Codebase Memory through Copilot, if any manual action remains.

The final objective is a working, verified, project-local Code Intelligence integration that makes GitHub Copilot substantially more effective at understanding and maintaining AI_ADAPTIVE_SCHEDULER without compromising the existing project or its business rules.