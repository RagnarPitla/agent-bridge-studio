# Source Inspiration Analysis

## Purpose

This document captures patterns observed in existing local AI coding tools and translates them into a unique design for Agent Bridge Studio.

## Useful patterns from the ecosystem

Local AI coding products commonly benefit from:

- Electron or desktop shell for local developer workflows.
- Isolated git worktrees for autonomous changes.
- Terminal-based agent sessions.
- GitHub issue and PR integration.
- Review and QA loops before merge.
- User-visible logs and approval gates.

## Agent Bridge Studio's unique angle

Agent Bridge Studio is not centered on one model or one coding agent. Its core abstraction is the **CLI Agent Bridge**:

```text
Task → Worktree → Adapter Registry → Selected CLI Agent → Verification → Human Approval → GitHub CLI
```

The app should be useful even when agent preferences change. Copilot CLI, Claude Code, and future CLIs become swappable execution backends.

## Design implications

1. Introduce an `AgentCliAdapter` interface before implementing UI-heavy features.
2. Keep Copilot CLI and Claude Code execution behind separate adapters.
3. Normalize stdout/stderr into one event timeline.
4. Make GitHub integration host-aware and CLI-first.
5. Use approval gates for push, PR creation, comments, reviews, and merges.

## Licensing note

This repo contains original design and scaffold material. It does not copy source code from any third-party project.
