export * from './types';
export * from './detect';
export * from './copilot-cli';
export * from './claude-code';

import type { AgentCliAdapter, AgentCliKind, ToolDetection } from './types';
import { CopilotCliAdapter } from './copilot-cli';
import { ClaudeCodeAdapter } from './claude-code';

export interface AgentDetection {
  kind: AgentCliKind;
  displayName: string;
  detection: ToolDetection;
}

export class AgentCliRegistry {
  private adapters: AgentCliAdapter[];

  constructor(adapters: AgentCliAdapter[] = [new CopilotCliAdapter(), new ClaudeCodeAdapter()]) {
    this.adapters = adapters;
  }

  get(kind: AgentCliKind): AgentCliAdapter | undefined {
    return this.adapters.find((adapter) => adapter.kind === kind);
  }

  list(): AgentCliAdapter[] {
    return [...this.adapters];
  }

  /** Detect availability and version of every registered agent CLI. */
  async detectAll(): Promise<AgentDetection[]> {
    return Promise.all(
      this.adapters.map(async (adapter) => ({
        kind: adapter.kind,
        displayName: adapter.displayName,
        detection: await adapter.detect(),
      })),
    );
  }
}
