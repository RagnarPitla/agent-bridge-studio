import type { IpcMain } from 'electron';

import { runAgentOnce } from '../run-agent';

type IdeationKind = 'tasks' | 'roadmap' | 'security' | 'performance' | 'improvements';

interface GeneratePayload {
  projectPath: string;
  kind: IdeationKind;
  model?: string;
}

function promptFor(kind: IdeationKind): string {
  const base =
    'Investigate this project and respond with a markdown list. ' +
    'Each item: a short bold title, one sentence of why it matters, and the key files involved.';
  switch (kind) {
    case 'roadmap':
      return `Identify the likely target audience, then propose a prioritized product roadmap. ${base}`;
    case 'security':
      return `Find concrete security issues or risky patterns. ${base}`;
    case 'performance':
      return `Find concrete performance improvements. ${base}`;
    case 'improvements':
      return `Find low-hanging-fruit code quality and DX improvements. ${base}`;
    case 'tasks':
    default:
      return `Suggest 5 high-value, quick-win tasks a developer could pick up next. ${base}`;
  }
}

/**
 * Ideation + roadmap: ask the agent to investigate the project and propose
 * tasks/roadmap/security/performance/improvement items.
 */
export function registerIdeationIpc(ipcMain: IpcMain): void {
  ipcMain.handle('feature:ideate:generate', async (_event, payload: GeneratePayload) => {
    const result = await runAgentOnce({
      projectPath: payload.projectPath,
      prompt: promptFor(payload.kind),
      mode: 'plan',
      model: payload.model || undefined,
    });
    return result.output.trim();
  });
}
