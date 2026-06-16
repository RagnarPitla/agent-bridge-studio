# Aperant Dual CLI Agent Design

Design repo for adding **GitHub Copilot CLI** as a first-class coding agent while keeping **Claude Code** support intact.

This repo is design-first: it captures the architecture, adapter contracts, command patterns, security rules, and implementation plan before modifying Aperant or Dev Crew AI source code.

## Goal

Create a provider-neutral agent execution layer that can run:

- **GitHub Copilot CLI** via `copilot` or `gh copilot`
- **Claude Code** via `claude`
- Future CLIs through the same adapter interface

The product should let a user choose the agent per task, terminal, project, or workflow stage without hardcoding one AI coding tool everywhere.

## Local tool assumptions verified

- `gh` is installed and authenticated.
- `copilot` is installed: GitHub Copilot CLI `1.0.62-1`.
- `gh copilot` is available and delegates to the Copilot CLI in `PATH`.
- `claude` is installed: Claude Code `2.1.145`.

## Core design decision

Do **not** bake Claude Code or Copilot CLI directly into task logic. Instead use an adapter contract:

```ts
type AgentCliKind = 'copilot-cli' | 'claude-code';

interface AgentCliAdapter {
  kind: AgentCliKind;
  detect(): Promise<ToolDetection>;
  buildCommand(request: AgentRunRequest): AgentCommand;
  parseEvents?(chunk: string): AgentEvent[];
}
```

A task runner chooses an adapter, creates a safe worktree, builds a non-interactive command, streams output, records events, and hands changes to QA/review.

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
│   ├── aperant-fit-analysis.md
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

## Recommended implementation target

- New clean open-source product: **Dev Crew AI**
- Prototype/fork: Aperant-derived branch/worktree, with AGPL implications considered
