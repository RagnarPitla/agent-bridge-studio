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

- `gh` is installed and authenticated.
- `copilot` is installed: GitHub Copilot CLI `1.0.62-1`.
- `gh copilot` is available and delegates to the Copilot CLI in `PATH`.
- `claude` is installed: Claude Code `2.1.145`.

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
└── scripts/check-tools.sh
```

## Quick validation

```bash
npm run check:docs
npm run check:tools
```

## Status

Initial public design scaffold. No production implementation has shipped from this repo yet.
