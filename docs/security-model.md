# Security Model

## Threat model

AI coding agents can:

- read files
- edit files
- run shell commands
- access URLs
- call GitHub APIs/MCP tools
- create branches and PRs

The product must make those powers explicit and scoped.

## Safety boundaries

### Worktree isolation

Run every autonomous task in a dedicated git worktree. Never let an agent directly mutate the user's main branch unless explicitly requested.

### Permission tiers

1. **Plan only**: read files, no edits, no shell writes.
2. **Code local**: edit files in worktree, run project-local commands.
3. **Git local**: commit inside worktree.
4. **GitHub draft PR**: push branch and create draft PR.
5. **Full GitHub automation**: comments/reviews/merge actions. Requires explicit approval.

### Copilot CLI permissions

Prefer explicit flags:

- `--add-dir <worktree>`
- `--allow-tool shell(git)`
- `--allow-tool shell(npm)`
- `--allow-url github.com`

Avoid `--allow-all` except in intentionally trusted local runs.

### Token handling

- Retrieve GitHub tokens through `gh auth token` only when needed.
- Never log tokens.
- Never write tokens into task specs or agent prompts.
- Redact any token-looking output before storing logs.

### Approval gates

Require user approval before:

- pushing branches
- opening PRs
- posting PR reviews/comments
- merging PRs
- deleting branches/worktrees
