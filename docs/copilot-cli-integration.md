# GitHub Copilot CLI Integration

## Verified local command surface

Observed command:

```bash
copilot --help
```

Useful flags include:

- `-p, --prompt` for non-interactive scripting
- `-C <directory>` to change working directory
- `--add-dir <directory>` to add allowed file access
- `--allow-tool` to grant specific tools
- `--allow-url` to grant URL access
- `--allow-all-tools` for non-interactive automation when needed
- `--available-tools` to limit tool surface
- `--mode plan|interactive|autopilot`
- `--no-ask-user` for autonomous sessions
- `--additional-mcp-config` for extra MCP servers
- `--add-github-mcp-tool` / `--add-github-mcp-toolset`

`gh copilot` is also available and delegates to Copilot CLI from PATH.

## Resolving the real binary (PATH shim caveat)

The `copilot` found on `PATH` is frequently a **launcher shim** rather than the
CLI itself. For example, the VS Code Copilot Chat extension ships a launcher at
`…/github.copilot-chat/copilotCli/copilot` that cannot report a version and may
print an interactive prompt:

```text
Cannot find GitHub Copilot CLI (https://docs.github.com/.../install-copilot-cli)
Install GitHub Copilot CLI? ['y/N']
```

Detection must therefore not trust `command -v copilot` alone:

1. Run `copilot --version` **non-interactively** (close stdin) and accept it only
   if it matches `GitHub Copilot CLI <version>`.
2. Otherwise fall back to the standalone install at
   `~/.copilot-cli/<version>/copilot`, choosing the highest version.

The adapter implements this in `src/agent-runners/detect.ts`
(`resolveCopilotBinary`), and `scripts/check-tools.sh` performs the same
resolution for shell-based validation. `buildCommand` should invoke the
resolved absolute path, not the bare `copilot` name, so tasks never launch the
shim.

## Recommended MVP command

```bash
copilot \
  -C "$WORKTREE" \
  --add-dir "$WORKTREE" \
  --mode autopilot \
  --no-ask-user \
  --allow-tool 'shell(git)' \
  --allow-tool 'shell(npm)' \
  --allow-tool 'shell(node)' \
  --allow-url github.com \
  -p "$TASK_PROMPT"
```

## Safer default

Start with a narrower command and only add permissions by project type:

```bash
copilot -C "$WORKTREE" --add-dir "$WORKTREE" --mode plan -p "$TASK_PROMPT"
```

Then let the user approve escalation to code/autopilot mode.

## GitHub MCP design

Copilot CLI includes built-in GitHub MCP support. For MVP, do not enable all GitHub MCP tools by default. Instead use explicit scope.

If the product later needs full GitHub automation, expose it as a user-visible permission tier.

## Output handling

Copilot output should be treated as a stream:

- raw logs to terminal view
- parsed progress hints to task timeline
- final summary saved with task result

Do not assume stable machine-readable output until Copilot CLI exposes a documented JSON/event mode.
