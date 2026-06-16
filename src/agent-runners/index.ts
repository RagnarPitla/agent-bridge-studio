export * from './types';
export * from './copilot-cli';
export * from './claude-code';

import type { AgentCliAdapter, AgentCliKind } from './types';
import { CopilotCliAdapter } from './copilot-cli';
import { ClaudeCodeAdapter } from './claude-code';

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
}
