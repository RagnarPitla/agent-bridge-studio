# Architecture

## High-level architecture

```text
User Task
   │
   ▼
Task Orchestrator
   │
   ├── Worktree Manager
   │     └── isolated branch/worktree per task
   │
   ├── Agent CLI Adapter Registry
   │     ├── Copilot CLI Adapter
   │     └── Claude Code Adapter
   │
   ├── Event Stream Normalizer
   │     └── stdout/stderr/tool events → task timeline
   │
   ├── Verification Runner
   │     └── tests/lint/build/smoke checks
   │
   └── GitHub Operations
         └── gh auth/status/api/pr/issue/release
```

## Key modules

### Tool detection

Detect installed CLIs and capabilities:

- `gh --version`
- `gh auth status`
- `copilot --version`
- `copilot --help`
- `gh copilot --help`
- `claude --version`
- `claude --help`

### Adapter registry

A registry returns the best adapter for a requested kind:

```ts
const registry = new AgentCliRegistry([
  new CopilotCliAdapter(),
  new ClaudeCodeAdapter(),
]);
```

### Worktree manager

Every task gets a clean isolated workspace:

```bash
git worktree add ../project-task-123 -b task/123
```

The agent process runs inside that worktree only.

### Permission policy

Each adapter receives a permission policy and translates it into CLI flags.

Copilot examples:

- `-C <worktree>`
- `--add-dir <worktree>`
- `--allow-tool shell(git)`
- `--allow-tool shell(npm)`
- `--allow-url github.com`

Claude examples:

- working directory scope
- prompt/context injection
- project `CLAUDE.md` instructions

### GitHub integration

Use `gh` as source of truth where possible:

- `gh auth status`
- `gh auth token --hostname <host>`
- `gh api --hostname <host> ...`
- `gh issue view/list/create`
- `gh pr create/view/diff/checks/merge`

Direct REST calls should be wrapped in a host-aware GitHub client and should use tokens retrieved from `gh`, not stored PATs.
