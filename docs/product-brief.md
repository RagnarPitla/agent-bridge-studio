# Product Brief: Dual CLI Agent Runner

## One-liner

A local-first agent runner that lets developers choose GitHub Copilot CLI or Claude Code for each autonomous coding workflow while preserving the same task, worktree, QA, and GitHub PR flow.

## Target users

- Developers who already use GitHub CLI and GitHub Copilot CLI.
- Developers who also keep Claude Code for complex coding/review workflows.
- Builders of local desktop AI developer tools such as Dev Crew AI.

## Core jobs to be done

1. Start a task from a project or GitHub issue.
2. Pick the agent: Copilot CLI or Claude Code.
3. Run the agent in an isolated worktree.
4. Watch logs and progress.
5. Run verification.
6. Review changes.
7. Create a PR using `gh`, or keep changes local.

## Product stance

- Local-first.
- GitHub CLI-native.
- Multi-agent, not multi-provider spaghetti.
- Human approval before remote side effects.

## MVP journey

1. User opens a local repo.
2. App detects `gh`, `copilot`, and `claude`.
3. User creates a task.
4. App creates an isolated worktree.
5. User selects Copilot CLI or Claude Code.
6. App runs the selected adapter with scoped permissions.
7. App shows logs, changed files, and verification result.
8. User approves PR creation through `gh pr create`.
