# Agent Bridge Studio

**Agent Bridge Studio** is a unique, local-first design for a desktop development environment that can route coding work to multiple CLI agents without locking the product to one vendor.

The first two supported adapters are:

- **GitHub Copilot CLI** via `copilot` or `gh copilot`
- **Claude Code** via `claude`

This repo is design-first. It contains architecture, adapter contracts, command patterns, safety gates, host-aware GitHub CLI design, and an implementation plan for building a multi-agent CLI bridge.

## Product idea

Agent Bridge Studio is a **CLI-agent control plane**:

1. Open a local project.
2. Detect available agent CLIs.
3. Create a task.
4. Choose Copilot CLI, Claude Code, or a future adapter.
5. Run the agent in an isolated git worktree.
6. Verify changes.
7. Let the user approve push/PR actions through GitHub CLI.

## What makes this different

- It is not a clone of any one existing project.
- It treats agent CLIs as interchangeable execution backends.
- It is GitHub CLI-native and GitHub Enterprise-aware.
- It keeps Claude Code and Copilot CLI side-by-side instead of replacing one with the other.
- It starts from a security model: scoped paths, explicit tools, worktrees, and approval gates.

## Local tool assumptions verified

- `gh` is installed and authenticated (`gh 2.87.3`).
- GitHub Copilot CLI is installed: `copilot --version` reports `1.0.63`.
- The `copilot` on `PATH` may be a launcher shim (e.g. the VS Code Copilot Chat
  bundle) that cannot report a version; the real CLI is resolved from
  `~/.copilot-cli/<version>/copilot`. See `docs/copilot-cli-integration.md`.
- `gh copilot` is available and delegates to the Copilot CLI in `PATH`.
- `claude` is installed: Claude Code `2.1.178`.

## Core design decision

Do not bake Claude Code or Copilot CLI directly into task logic. Use an adapter contract:

```ts
type AgentCliKind = 'copilot-cli' | 'claude-code';

interface AgentCliAdapter {
  kind: AgentCliKind;
  detect(): Promise<ToolDetection>;
  buildCommand(request: AgentRunRequest): AgentCommand;
  parseEvents?(chunk: string): AgentEvent[];
}
```

A task runner chooses an adapter, creates a safe worktree, builds a command, streams output, records events, and hands changes to QA/review.

## Repo layout

```text
.
├── AGENTS.md
├── CLAUDE.md
├── .github/copilot-instructions.md
├── docs/
│   ├── product-brief.md
│   ├── architecture.md
│   ├── cli-adapter-design.md
│   ├── copilot-cli-integration.md
│   ├── claude-code-integration.md
│   ├── github-gh-host-aware-design.md
│   ├── source-inspiration-analysis.md
│   ├── security-model.md
│   ├── implementation-plan.md
│   └── roadmap.md
├── src/agent-runners/
│   ├── types.ts
│   ├── detect.ts            # binary discovery + version probing
│   ├── copilot-cli.ts
│   ├── claude-code.ts
│   └── index.ts             # registry + detectAll()
├── electron/                # desktop app main process
│   ├── main.ts              # window(s), IPC, task spawning, activity broadcast
│   ├── preload.ts           # contextBridge API (incl. feature: invoke seam)
│   ├── store.ts             # persisted board state (projects + tasks)
│   ├── activity.ts          # shared session registry + conflict detection
│   ├── run-agent.ts         # shared one-shot agent runner (feature tabs)
│   └── features/            # per-tab backend IPC (insights, ideation, …)
├── renderer/                # app UI (no framework, CSP-safe)
│   ├── index.html
│   ├── renderer.js          # core: window.ABS API + built-in Board
│   ├── boot.js              # starts the app (reads ?tab= for pop-out windows)
│   ├── styles.css
│   └── features/            # per-tab UIs (context, insights, ideation, changelog)
├── test/                    # activity unit tests
├── esbuild.config.mjs       # bundles main + preload to dist/*.cjs
└── scripts/
    ├── check-tools.sh
    ├── check-docs.mjs
    ├── detect-agents.ts     # runnable detection probe
    └── test.sh              # full test harness
```

## Quick validation

```bash
npm run check:docs    # required files exist and are non-trivial
npm run check:tools   # gh / Copilot CLI / Claude detected (non-interactive)

npm install           # one-time: installs electron, esbuild, tsx, typescript
npm run typecheck     # all TypeScript compiles
npm run detect        # resolve the real agent CLIs and print versions
npm test              # full harness: lint + typecheck + build + unit + IPC smoke
```

`npm run detect` runs the neutral adapter registry against the machine and
reports each agent CLI it can actually execute — proving the adapters work with
the installed GitHub Copilot CLI and Claude Code.

## Run the desktop app

A local Electron app wraps the adapter layer into a project + kanban workflow. It
launches your **real** GitHub Copilot CLI (resolving past the PATH launcher shim)
using your existing `gh`/Copilot authentication.

```bash
npm install        # one-time (installs electron, esbuild, tsx, typescript)
npm start          # build and launch the app
npm run smoke      # headless boot: prints detected agents as JSON, then exits
npm run smoke:ipc  # headless IPC integration test (used by npm test)
```

What's in the app:

- **Projects** sidebar — add a folder (creates a `.agent-bridge/` marker), select,
  remove. The active project drives every tab.
- **Board** — a Kanban board (Backlog → In Progress → Review → Done) of agent
  tasks. Drag cards between columns. Each task has its own agent, model,
  **thinking level** (`--effort`), approach (Plan/Autopilot), a **require human
  review before coding** toggle, tool permissions, and a live streamed log.
- **Context** — programmatic project index (detected stack + top-level tree).
- **Insights** — chat about the project via the agent.
- **Roadmap** — generate prioritized tasks / roadmap / security / performance /
  improvement ideas, and add any suggestion straight to the board.
- **Changelog** — build release notes from git history (tags → commits → AI draft).
- **Shared session state** — a main-process activity registry tracks what every
  agent (task runs *and* feature AI calls) is doing, broadcast live to all
  windows, with conflict detection that warns when two write-capable agents
  target the same project. Click **◐ Agents** in the top bar to see them all.
- **Pop-out tabs** — the **⧉** on any tab opens it in its own window so you can
  watch multiple agents working side by side, all sharing the same session state.

> Tasks run directly in the chosen project folder. Per-task git worktree
> isolation and PR approval gates (`docs/security-model.md`) are the next step.

## Status

Working Electron app: projects + kanban board, multi-agent task execution
against the GitHub Copilot CLI and Claude Code, AI-powered Context/Insights/
Roadmap/Changelog tabs, a shared cross-window activity/conflict registry, and
pop-out windows. Verified by `npm test` (static checks, typecheck, esbuild
bundle, unit tests, and a headless Electron IPC integration test). Deeper
isolation (worktrees, merge-conflict handling) and a graph/RAG memory layer
remain on the roadmap.
