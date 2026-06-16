# Claude Code Guidance

This repo keeps Claude Code as a first-class agent option alongside GitHub Copilot CLI.

## Claude Code adapter goals

- Detect `claude` from PATH or user-configured path.
- Support non-interactive execution where practical.
- Support interactive terminal sessions for exploratory work.
- Inject project context through `CLAUDE.md`, task specs, and worktree paths.
- Preserve existing Claude Code strengths: planning, coding, verification, and review.

## Important design constraint

Claude Code must not own the orchestration layer. It is one adapter under a neutral `AgentCliAdapter` interface.

## Example command shape

```bash
claude --print "Implement the task from .devcrew/specs/TASK.md. Run tests and summarize results."
```

The final implementation must verify exact supported flags against the installed Claude Code version before relying on them.
