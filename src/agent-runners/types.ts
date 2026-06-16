export type AgentCliKind = 'copilot-cli' | 'claude-code';

export interface ToolDetection {
  found: boolean;
  command: string;
  version?: string;
  details?: string;
}

export interface AgentPermissionPolicy {
  allowedTools: string[];
  allowedUrls: string[];
  allowedPaths: string[];
  allowAll?: boolean;
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

export interface AgentCommand {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

export interface AgentEvent {
  type: 'log' | 'tool-call' | 'file-change' | 'error' | 'done';
  message: string;
  timestamp: string;
}

export interface AgentCliAdapter {
  kind: AgentCliKind;
  displayName: string;
  detect(): Promise<ToolDetection>;
  buildCommand(request: AgentRunRequest): AgentCommand;
  parseEvents?(chunk: string): AgentEvent[];
}
