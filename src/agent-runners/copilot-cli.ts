import type { AgentCliAdapter, AgentCommand, AgentEvent, AgentRunRequest, ToolDetection } from './types';

export class CopilotCliAdapter implements AgentCliAdapter {
  kind = 'copilot-cli' as const;
  displayName = 'GitHub Copilot CLI';

  async detect(): Promise<ToolDetection> {
    return {
      found: true,
      command: 'copilot',
      details: 'Runtime detection should execute `copilot --version` and parse stdout.',
    };
  }

  buildCommand(request: AgentRunRequest): AgentCommand {
    const args = ['-C', request.worktreePath, '--add-dir', request.worktreePath];

    if (request.mode === 'plan') {
      args.push('--mode', 'plan');
    } else {
      args.push('--mode', 'autopilot', '--no-ask-user');
    }

    for (const tool of request.permissions.allowedTools) {
      args.push('--allow-tool', tool);
    }

    for (const url of request.permissions.allowedUrls) {
      args.push('--allow-url', url);
    }

    if (request.permissions.allowAll) {
      args.push('--allow-all-tools');
    }

    args.push('-p', request.prompt);

    return {
      command: 'copilot',
      args,
      cwd: request.worktreePath,
      env: { ...process.env, ...request.env } as Record<string, string>,
    };
  }

  parseEvents(chunk: string): AgentEvent[] {
    return [{ type: 'log', message: chunk, timestamp: new Date().toISOString() }];
  }
}
