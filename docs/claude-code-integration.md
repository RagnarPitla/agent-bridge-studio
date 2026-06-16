# Claude Code Integration

## Goal

Keep Claude Code as a supported first-class agent while adding Copilot CLI.

## Adapter behavior

The Claude adapter should:

1. Detect `claude` and version.
2. Build a command for interactive or non-interactive execution.
3. Run inside the task worktree.
4. Inject task instructions from a generated spec file.
5. Stream logs back to the same terminal/timeline model as Copilot CLI.

## Prompt strategy

Generate a task prompt that includes:

- objective
- files allowed to modify
- verification commands
- branch/worktree context
- user approval requirements

## Existing Claude Code strengths to preserve

- strong planning and code reasoning
- deep codebase edits
- review/QA loops
- `CLAUDE.md` project instructions

## Adapter boundary

Claude-specific settings must live in the Claude adapter or Claude profile settings. The orchestrator should only request:

```ts
adapter.buildCommand({ mode: 'code', prompt, worktreePath, permissions })
```
