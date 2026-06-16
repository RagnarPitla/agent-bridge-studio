import type { IpcMain } from 'electron';

import { registerInsightsIpc } from './insights';
import { registerIdeationIpc } from './ideation';
import { registerChangelogIpc } from './changelog';
import { registerContextIpc } from './context';

/**
 * Aggregates feature IPC registration. Each feature module owns its own file and
 * registers handlers on `feature:`-prefixed channels. main.ts calls this once.
 */
export function registerFeatureIpc(ipcMain: IpcMain): void {
  registerInsightsIpc(ipcMain);
  registerIdeationIpc(ipcMain);
  registerChangelogIpc(ipcMain);
  registerContextIpc(ipcMain);
}
