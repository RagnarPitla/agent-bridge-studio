import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';

import { AgentCliRegistry } from '../src/agent-runners/index';
import type { AgentCliKind, AgentRunRequest } from '../src/agent-runners/types';
import { loadState, saveState, type PersistedState } from './store';
import { ActivityRegistry } from './activity';
import { setActivitySink } from './run-agent';
import { registerFeatureIpc } from './features/index';

const registry = new AgentCliRegistry();
const activities = new ActivityRegistry();

/** Active child processes keyed by taskId so the UI can cancel them. */
const running = new Map<string, ChildProcessWithoutNullStreams>();

interface RunTaskInput {
  taskId: string;
  title?: string;
  kind: AgentCliKind;
  projectPath: string;
  prompt: string;
  mode: 'plan' | 'autopilot';
  model?: string;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  allowAll: boolean;
  allowedTools: string[];
  allowedUrls: string[];
}

const INDEX_HTML = (): string => join(app.getAppPath(), 'renderer', 'index.html');

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

// Push the shared activity list to every window whenever it changes, so all
// agents/windows can see what each other is doing.
activities.onChange = () => broadcast('activity:changed', activities.list());

// Route feature AI runs (insights, ideation, changelog) into the shared registry.
setActivitySink({
  start: (input) => activities.start(input).id,
  finish: (id, status) => activities.finish(id, status),
});

function createWindow(tab?: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 800,
    show: !process.env.SMOKE,
    title: 'Agent Bridge Studio',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const options = tab ? { query: { tab, detached: '1' } } : undefined;
  void win.loadFile(INDEX_HTML(), options);
  return win;
}

function emit(event: IpcMainInvokeEvent, taskId: string, payload: Record<string, unknown>): void {
  if (!event.sender.isDestroyed()) {
    event.sender.send('task:event', { taskId, ...payload, timestamp: new Date().toISOString() });
  }
}

function registerIpc(): void {
  // Detect which agent CLIs are installed and usable on this machine.
  ipcMain.handle('agents:detect', async () => registry.detectAll());

  // Load / save the kanban board (projects + tasks) from disk.
  ipcMain.handle('state:load', async () => loadState());
  ipcMain.handle('state:save', async (_event, state: PersistedState) => {
    saveState(state);
    return true;
  });

  // Shared activity registry (what every agent is doing, across all windows).
  ipcMain.handle('activity:list', async () => activities.list());

  // Open a tab in its own window so agents can be watched side by side.
  ipcMain.handle('window:openTab', async (_event, tab: string) => {
    createWindow(typeof tab === 'string' ? tab : undefined);
    return true;
  });

  // Native directory picker for choosing the project to work in.
  ipcMain.handle('dialog:pickDirectory', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select a project folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? undefined : result.filePaths[0];
  });

  // Initialize a project: create a .agent-bridge marker folder + config.
  ipcMain.handle('project:init', async (_event, projectPath: string) => {
    const dir = join(projectPath, '.agent-bridge');
    mkdirSync(dir, { recursive: true });
    const cfg = join(dir, 'config.json');
    if (!existsSync(cfg)) {
      writeFileSync(cfg, JSON.stringify({ version: 1, createdAt: new Date().toISOString() }, null, 2));
    }
    return { initialized: true, path: dir };
  });

  // Start an agent task and stream its output back to the renderer.
  ipcMain.handle('task:run', async (event, input: RunTaskInput) => {
    const adapter = registry.get(input.kind);
    if (!adapter) throw new Error(`Unknown agent: ${input.kind}`);

    // Resolve the real binary (handles the PATH launcher-shim case) before running.
    const detection = await adapter.detect();
    if (!detection.found) throw new Error(`${adapter.displayName} is not installed.`);

    const taskId = input.taskId ?? randomUUID();
    const request: AgentRunRequest = {
      taskId,
      projectPath: input.projectPath,
      // MVP: run in the project directory itself. Worktree isolation is a
      // planned upgrade (see docs/security-model.md).
      worktreePath: input.projectPath,
      prompt: input.prompt,
      mode: input.mode === 'plan' ? 'plan' : 'code',
      model: input.model || undefined,
      reasoningEffort: input.reasoningEffort,
      permissions: {
        allowedTools: input.allowedTools,
        allowedUrls: input.allowedUrls,
        allowedPaths: [input.projectPath],
        allowAll: input.allowAll,
      },
    };

    const activity = activities.start({
      kind: 'task',
      title: input.title || input.prompt.slice(0, 80) || 'Task',
      projectPath: input.projectPath,
      write: input.mode === 'autopilot',
    });
    const conflicts = activities.conflictsFor(activity.id).map((a) => ({ id: a.id, title: a.title }));

    const command = adapter.buildCommand(request);
    emit(event, taskId, {
      type: 'log',
      message: `$ ${command.command} ${command.args.join(' ')}\n`,
    });

    const child = spawn(command.command, command.args, { cwd: command.cwd, env: command.env });
    running.set(taskId, child);

    child.stdout.on('data', (chunk: Buffer) =>
      emit(event, taskId, { type: 'log', message: chunk.toString() }),
    );
    child.stderr.on('data', (chunk: Buffer) =>
      emit(event, taskId, { type: 'log', message: chunk.toString() }),
    );
    child.on('error', (err) => {
      activities.finish(activity.id, 'error');
      emit(event, taskId, { type: 'error', message: err.message });
    });
    child.on('close', (code) => {
      running.delete(taskId);
      activities.finish(activity.id, code === 0 ? 'done' : 'error');
      emit(event, taskId, { type: 'done', message: `Process exited with code ${code ?? 0}` });
    });

    return { taskId, activityId: activity.id, conflicts };
  });

  // Cancel a running task.
  ipcMain.handle('task:cancel', async (_event, taskId: string) => {
    const child = running.get(taskId);
    if (child) {
      child.kill('SIGTERM');
      running.delete(taskId);
      return true;
    }
    return false;
  });

  // Feature-module IPC (insights, ideation, changelog, context).
  registerFeatureIpc(ipcMain);
}

/** Headless IPC self-test used by the test harness (npm run smoke:ipc). */
async function runIpcSmoke(): Promise<void> {
  const repoPath = app.getAppPath();
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const consoleErrors: string[] = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 3) consoleErrors.push(message);
  });

  await win.loadFile(INDEX_HTML());
  // Give the renderer + feature scripts a moment to register.
  await new Promise((r) => setTimeout(r, 1000));

  const script = `(async () => {
    const results = [];
    const test = async (name, fn) => {
      try { const v = await fn(); results.push({ name, ok: true, info: String(v).slice(0, 80) }); }
      catch (e) { results.push({ name, ok: false, info: String((e && e.message) || e) }); }
    };
    await test('bridge-exists', async () => { if (!window.bridge) throw new Error('no bridge'); return 'ok'; });
    await test('ABS-exists', async () => { if (!window.ABS) throw new Error('no ABS'); return 'ok'; });
    await test('features-registered', async () => {
      const ids = window.ABS.__featureIds ? window.ABS.__featureIds() : [];
      if (!ids.includes('board')) throw new Error('board missing');
      return ids.join(',');
    });
    await test('detect-agents', async () => { const a = await window.bridge.detectAgents(); if (!a.length) throw new Error('none'); return a.length + ' agents'; });
    await test('state-roundtrip', async () => {
      const s = { projects: [{ id: 'p1', name: 'X', path: '/tmp' }], tasks: [] };
      await window.bridge.saveState(s); const l = await window.bridge.loadState();
      if (!l.projects || !l.projects.length) throw new Error('roundtrip failed'); return 'ok';
    });
    await test('context-index', async () => {
      const i = await window.bridge.invoke('feature:context:index', ${JSON.stringify(repoPath)});
      if (!i || !Array.isArray(i.entries)) throw new Error('bad index'); return 'stack=' + i.stack.join('|');
    });
    await test('changelog-commits', async () => {
      const c = await window.bridge.invoke('feature:changelog:commits', ${JSON.stringify(repoPath)});
      if (!Array.isArray(c)) throw new Error('not array'); return c.length + ' commits';
    });
    await test('activity-list', async () => { const a = await window.bridge.listActivities(); if (!Array.isArray(a)) throw new Error('not array'); return a.length + ' active'; });
    return results;
  })()`;

  let results: Array<{ name: string; ok: boolean; info: string }> = [];
  try {
    results = await win.webContents.executeJavaScript(script);
  } catch (err) {
    console.log(`SMOKE_IPC executeJavaScript failed: ${(err as Error).message}`);
  }

  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  — ${r.info}`);
    if (!r.ok) failed++;
  }
  if (consoleErrors.length) {
    console.log(`renderer console errors (${consoleErrors.length}):`);
    for (const e of consoleErrors.slice(0, 10)) console.log('  ! ' + e);
    failed += consoleErrors.length;
  }
  console.log(failed === 0 ? '\nSMOKE_IPC: ALL PASSED' : `\nSMOKE_IPC: ${failed} FAILURE(S)`);
  app.exit(failed === 0 ? 0 : 1);
}

void app.whenReady().then(async () => {
  registerIpc();

  if (process.env.SMOKE === 'ipc') {
    await runIpcSmoke();
    return;
  }

  // Headless verification: boot the app, prove the adapters work, then exit.
  if (process.env.SMOKE) {
    const detections = await registry.detectAll();
    console.log(JSON.stringify(detections, null, 2));
    app.quit();
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
