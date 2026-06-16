import { contextBridge, ipcRenderer } from 'electron';

import type { AgentCliKind } from '../src/agent-runners/types';

export interface RunTaskInput {
  taskId: string;
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

export interface PersistedState {
  projects: unknown[];
  tasks: unknown[];
}

export interface TaskEvent {
  taskId: string;
  type: 'log' | 'error' | 'done';
  message: string;
  timestamp: string;
}

const FEATURE_PREFIX = 'feature:';

const bridge = {
  detectAgents: () => ipcRenderer.invoke('agents:detect'),
  loadState: () => ipcRenderer.invoke('state:load') as Promise<PersistedState>,
  saveState: (state: PersistedState) => ipcRenderer.invoke('state:save', state) as Promise<boolean>,
  listActivities: () => ipcRenderer.invoke('activity:list') as Promise<unknown[]>,
  openTab: (tab: string) => ipcRenderer.invoke('window:openTab', tab) as Promise<boolean>,
  pickDirectory: () => ipcRenderer.invoke('dialog:pickDirectory') as Promise<string | undefined>,
  initProject: (projectPath: string) =>
    ipcRenderer.invoke('project:init', projectPath) as Promise<{ initialized: boolean; path: string }>,
  runTask: (input: RunTaskInput) =>
    ipcRenderer.invoke('task:run', input) as Promise<{
      taskId: string;
      activityId: string;
      conflicts: Array<{ id: string; title: string }>;
    }>,
  cancelTask: (taskId: string) => ipcRenderer.invoke('task:cancel', taskId) as Promise<boolean>,
  onTaskEvent: (callback: (event: TaskEvent) => void) => {
    const listener = (_e: unknown, payload: TaskEvent) => callback(payload);
    ipcRenderer.on('task:event', listener);
    return () => ipcRenderer.removeListener('task:event', listener);
  },
  onActivityChange: (callback: (activities: unknown[]) => void) => {
    const listener = (_e: unknown, payload: unknown[]) => callback(payload);
    ipcRenderer.on('activity:changed', listener);
    return () => ipcRenderer.removeListener('activity:changed', listener);
  },
  // Generic seam so feature modules can call their own IPC handlers without
  // editing this preload. Restricted to `feature:`-prefixed channels.
  invoke: (channel: string, ...args: unknown[]) => {
    if (!channel.startsWith(FEATURE_PREFIX)) {
      return Promise.reject(new Error(`Channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
};

contextBridge.exposeInMainWorld('bridge', bridge);

export type Bridge = typeof bridge;
