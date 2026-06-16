# Product Brief: Agent Bridge Studio

## One-liner

Agent Bridge Studio is a local-first CLI-agent control plane that lets developers run GitHub Copilot CLI, Claude Code, and future coding agents through one worktree-safe task system.

## Target users

- Developers who already use GitHub CLI and GitHub Copilot CLI.
- Developers who also keep Claude Code for complex coding/review workflows.
- Builders who want local-running AI coding workflows without depending on one AI vendor.
- Teams that need GitHub.com and GitHub Enterprise support.

## Core jobs to be done

1. Start a task from a local project or GitHub issue.
2. Pick the agent: Copilot CLI, Claude Code, or future adapter.
3. Run the agent in an isolated worktree.
4. Watch logs and progress in one timeline.
5. Run verification commands.
6. Review changed files.
7. Create a PR using `gh`, or keep changes local.

## Product stance

- Local-first.
- GitHub CLI-native.
- Agent-CLI neutral.
- Human approval before remote side effects.
- Safe by default, with explicit permission escalation.

## MVP journey

1. User opens a local repo.
2. App detects `gh`, `copilot`, and `claude`.
3. User creates a task.
4. App creates an isolated worktree.
5. User selects Copilot CLI or Claude Code.
6. App runs the selected adapter with scoped permissions.
7. App shows logs, changed files, and verification result.
8. User approves PR creation through `gh pr create`.

## Name rationale

**Agent Bridge Studio** emphasizes bridging existing CLI agents into one studio rather than building another monolithic agent.
