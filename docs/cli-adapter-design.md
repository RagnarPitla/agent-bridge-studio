# CLI Adapter Design

## Adapter interface

```ts
export type AgentCliKind = 'copilot-cli' | 'claude-code';

export interface ToolDetection {
  found: boolean;
  command: string;
  version?: string;
  details?: string;
}

export interface AgentRunRequest {
  taskId: string;
  projectPath: string;
  worktreePath: string;
  prompt: string;
  mode: 'plan' | 'code' | 'qa' | 'review';
  permissions: AgentPermissionPolicy;
  env?: Record<string, string>;
}

export interface AgentPermissionPolicy {
  allowedTools: string[];
  allowedUrls: string[];
  allowedPaths: string[];
  allowAll?: boolean;
}

export interface AgentCommand {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

export interface AgentCliAdapter {
  kind: AgentCliKind;
  displayName: string;
  detect(): Promise<ToolDetection>;
  buildCommand(request: AgentRunRequest): AgentCommand;
  parseEvents?(chunk: string): AgentEvent[];
}

export interface AgentEvent {
  type: 'log' | 'tool-call' | 'file-change' | 'error' | 'done';
  message: string;
  timestamp: string;
}
```

## Why this interface

- Detection is separate from execution.
- The orchestrator does not need to know CLI-specific flags.
- Permissions are provider-neutral at the UI layer.
- Event parsing can improve over time without changing the task model.

## Adapter responsibilities

Each adapter owns:

- command discovery
- flag translation
- prompt wrapping
- permission mapping
- process environment
- stdout/stderr parsing

The orchestrator owns:

- worktree lifecycle
- task state
- user approvals
- verification
- PR creation
