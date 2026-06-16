# Agent Instructions

This repository designs a dual-agent CLI execution layer.

## Mission

Design an adapter system where GitHub Copilot CLI and Claude Code can both run as coding agents inside the same local-first developer app.

## Non-negotiables

- Keep GitHub Copilot CLI and Claude Code support separate behind adapters.
- Do not hardcode one provider into task orchestration.
- Prefer GitHub CLI (`gh`) for GitHub authentication and GitHub operations.
- Never print or commit tokens.
- Do not assume GitHub.com only; support host-aware GitHub Enterprise design.
- Keep work local-first: GitHub is an upgrade path, not a hard requirement for plain local repos.

## Design principles

1. Adapter contract first.
2. Worktree isolation for every autonomous coding task.
3. Explicit permissions for shell, file, URL, and MCP access.
4. Stream stdout/stderr into structured events.
5. Keep user approval gates before push/PR/merge.
6. Preserve Claude Code workflows while adding Copilot CLI workflows.

## Verification expectation

When adding executable code, include commands that prove it runs. For design docs, keep claims grounded in observed CLI help/version output or linked source code.
