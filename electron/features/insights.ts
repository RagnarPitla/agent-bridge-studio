import type { IpcMain } from 'electron';

import { runAgentOnce } from '../run-agent';

interface AskPayload {
  projectPath: string;
  prompt: string;
  model?: string;
}

/**
 * Insights: ask a question about the project. Runs the agent in read-only plan
 * mode and returns the buffered answer.
 */
export function registerInsightsIpc(ipcMain: IpcMain): void {
  ipcMain.handle('feature:insights:ask', async (_event, payload: AskPayload) => {
    const prompt =
      `You are a helpful engineering assistant exploring this project. ` +
      `Answer concisely.\n\nQuestion: ${payload.prompt}`;
    const result = await runAgentOnce({
      projectPath: payload.projectPath,
      prompt,
      mode: 'plan',
      model: payload.model || undefined,
    });
    return result.output.trim();
  });
}
