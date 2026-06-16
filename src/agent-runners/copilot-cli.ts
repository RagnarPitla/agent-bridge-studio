import { resolveCopilotBinary } from './detect';
import type { AgentCliAdapter, AgentCommand, AgentEvent, AgentRunRequest, ToolDetection } from './types';

export class CopilotCliAdapter implements AgentCliAdapter {
  kind = 'copilot-cli' as const;
  displayName = 'GitHub Copilot CLI';

  /** Cached absolute path to the real CLI, set by detect(). */
  private resolvedCommand?: string;

  async detect(): Promise<ToolDetection> {
    const detection = await resolveCopilotBinary();
    if (detection.found) this.resolvedCommand = detection.command;
    return detection;
  }

  buildCommand(request: AgentRunRequest): AgentCommand {
    const command = this.resolvedCommand ?? 'copilot';
    const args = ['-C', request.worktreePath, '--add-dir', request.worktreePath];

    if (request.mode === 'plan') {
      args.push('--mode', 'plan');
    } else {
      args.push('--mode', 'autopilot', '--no-ask-user');
    }

    if (request.model) {
      args.push('--model', request.model);
    }

    if (request.reasoningEffort) {
      args.push('--effort', request.reasoningEffort);
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
      command,
      args,
      cwd: request.worktreePath,
      env: { ...process.env, ...request.env } as Record<string, string>,
    };
  }

  parseEvents(chunk: string): AgentEvent[] {
    return [{ type: 'log', message: chunk, timestamp: new Date().toISOString() }];
  }
}
