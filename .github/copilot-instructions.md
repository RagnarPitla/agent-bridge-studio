# GitHub Copilot Instructions

This repository designs a dual-agent runner for GitHub Copilot CLI and Claude Code.

## Copilot CLI expectations

- Treat `copilot` as a first-class agent CLI.
- Prefer non-interactive prompt mode for automation:

```bash
copilot -C <worktree> -p "<task prompt>" --allow-tool shell(git) --allow-tool shell(npm) --allow-tool shell(node)
```

- Use `gh copilot` as a compatible launch path when appropriate:

```bash
gh copilot -p "Summarize this week's commits" --allow-tool 'shell(git)'
```

- For broad autonomous work, permissions must be explicit and scoped. Avoid defaulting to `--allow-all` in production.
- Use `--add-dir <directory>` or `-C <directory>` to scope file access to the task worktree.
- Do not rely on global credentials other than GitHub CLI-managed auth.

## Design requirement

Copilot CLI support must live behind the same adapter interface as Claude Code. Do not duplicate orchestration logic.
