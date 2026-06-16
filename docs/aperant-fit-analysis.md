# Aperant Fit Analysis

## What Aperant already has

From local inspection of `AndyMik90/Aperant`:

- Electron + TypeScript desktop app.
- Autonomous coding task pipeline.
- Worktree isolation model.
- GitHub/GitLab integrations.
- GitHub CLI OAuth/login/token handling.
- PR creation through `gh pr create`.
- PR review through a hybrid GitHub API + `gh pr diff` approach.

## What needs changing

Aperant is currently Claude-centric at the product/agent layer. To add Copilot CLI without breaking Claude Code:

1. Introduce an `AgentCliAdapter` interface.
2. Move Claude Code execution behind a `ClaudeCodeAdapter`.
3. Add `CopilotCliAdapter`.
4. Add UI selection for default/project/task agent.
5. Normalize process output into a shared event model.
6. Make GitHub integration host-aware and CLI-first.

## AGPL note

Aperant is AGPL-3.0. If we modify and distribute Aperant-derived code, the derivative must comply with AGPL unless a separate commercial license is obtained. This design repo contains original planning material and does not copy Aperant source code.
