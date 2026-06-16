# Agent Bridge Studio Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add GitHub Copilot CLI as a first-class agent while preserving Claude Code support.

**Architecture:** Introduce a provider-neutral CLI adapter layer. The task orchestrator handles worktrees, state, logs, verification, and GitHub approval gates; each adapter only handles CLI-specific detection, command construction, permissions, and event parsing.

**Tech Stack:** TypeScript, Electron main process, Node child_process, Git worktrees, GitHub CLI, Copilot CLI, Claude Code.

---

## Phase 1: Design contracts

### Task 1: Add adapter types

**Objective:** Define the neutral contract used by all CLI agents.

**Files:**

- Create: `src/agent-runners/types.ts`

**Verification:** Compile with TypeScript in the real app.

### Task 2: Add Copilot CLI adapter

**Objective:** Translate neutral `AgentRunRequest` into a `copilot` command.

**Files:**

- Create: `src/agent-runners/copilot-cli.ts`

**Acceptance criteria:**

- Uses `copilot` or configured path.
- Supports `-C`, `--add-dir`, `-p`.
- Maps permissions to `--allow-tool` and `--allow-url`.
- Does not default to `--allow-all`.

### Task 3: Add Claude Code adapter

**Objective:** Translate neutral `AgentRunRequest` into a `claude` command.

**Files:**

- Create: `src/agent-runners/claude-code.ts`

**Acceptance criteria:**

- Uses `claude` or configured path.
- Runs in the worktree cwd.
- Injects generated prompt/spec path.
- Does not change orchestration behavior.

## Phase 2: Orchestration integration

### Task 4: Add adapter registry

**Objective:** Allow the app to detect and select available agents.

**Files:**

- Create: `src/agent-runners/index.ts`

**Acceptance criteria:**

- `detectAll()` reports Copilot CLI and Claude Code availability.
- UI/API receives display name, version, and capability info.

### Task 5: Add task-level agent selection

**Objective:** Let a task choose `copilot-cli` or `claude-code`.

**Acceptance criteria:**

- Project default agent can be set.
- Task override can be set.
- Existing Claude Code behavior remains default until user changes it.

### Task 6: Add event stream normalizer

**Objective:** Convert stdout/stderr into a shared task timeline.

**Acceptance criteria:**

- Raw logs preserved.
- Errors surfaced.
- Final summary captured.

## Phase 3: GitHub CLI-native flow

### Task 7: Add host-aware GitHub context

**Objective:** Support GitHub.com and GitHub Enterprise.

**Acceptance criteria:**

- Config supports `GITHUB_HOST`.
- `gh api --hostname` used for API operations.
- No hardcoded `api.github.com` in new code.

### Task 8: Add PR approval gate

**Objective:** Prevent agents from pushing/opening PRs without user approval.

**Acceptance criteria:**

- Agent can prepare branch and summary.
- User approves before push/PR.
- `gh pr create` output is captured and verified.

## Phase 4: Verification

### Task 9: Add smoke tests

**Objective:** Verify both adapters build expected commands.

**Acceptance criteria:**

- Copilot command includes scoped worktree flags.
- Claude command uses worktree cwd.
- No tokens appear in command args/logs.

### Task 10: Manual Windows verification

**Objective:** Prove the feature works on Ragnar's Windows setup.

**Commands:**

```bash
gh --version
copilot --version
claude --version
bash scripts/check-tools.sh
```

Then run a no-op task in a disposable test repo with each adapter.
