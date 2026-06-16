import { resolveClaudeBinary } from './detect';
import type { AgentCliAdapter, AgentCommand, AgentEvent, AgentRunRequest, ToolDetection } from './types';

export class ClaudeCodeAdapter implements AgentCliAdapter {
  kind = 'claude-code' as const;
  displayName = 'Claude Code';

  /** Cached absolute path to the real CLI, set by detect(). */
  private resolvedCommand?: string;

  async detect(): Promise<ToolDetection> {
    const detection = await resolveClaudeBinary();
    if (detection.found) this.resolvedCommand = detection.command;
    return detection;
  }

  buildCommand(request: AgentRunRequest): AgentCommand {
    const command = this.resolvedCommand ?? 'claude';
    const args = ['--print', request.prompt];

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
