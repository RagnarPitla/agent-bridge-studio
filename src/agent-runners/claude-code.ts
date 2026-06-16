import type { AgentCliAdapter, AgentCommand, AgentEvent, AgentRunRequest, ToolDetection } from './types';

export class ClaudeCodeAdapter implements AgentCliAdapter {
  kind = 'claude-code' as const;
  displayName = 'Claude Code';

  async detect(): Promise<ToolDetection> {
    return {
      found: true,
      command: 'claude',
      details: 'Runtime detection should execute `claude --version` and parse stdout.',
    };
  }

  buildCommand(request: AgentRunRequest): AgentCommand {
    const args = ['--print', request.prompt];

    return {
      command: 'claude',
      args,
      cwd: request.worktreePath,
      env: { ...process.env, ...request.env } as Record<string, string>,
    };
  }

  parseEvents(chunk: string): AgentEvent[] {
    return [{ type: 'log', message: chunk, timestamp: new Date().toISOString() }];
  }
}
