import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';

import { app } from 'electron';

/**
 * Persisted UI state. The renderer owns the exact shape of projects/tasks; this
 * layer just stores and returns it as JSON so the board survives restarts.
 */
export interface PersistedState {
  projects: unknown[];
  tasks: unknown[];
}

const EMPTY: PersistedState = { projects: [], tasks: [] };

function statePath(): string {
  return join(app.getPath('userData'), 'agent-bridge-state.json');
}

export function loadState(): PersistedState {
  try {
    const file = statePath();
    if (!existsSync(file)) return EMPTY;
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<PersistedState>;
    return { projects: parsed.projects ?? [], tasks: parsed.tasks ?? [] };
  } catch {
    return EMPTY;
  }
}

export function saveState(state: PersistedState): void {
  const file = statePath();
  mkdirSync(app.getPath('userData'), { recursive: true });
  // Atomic write: write to a temp file then rename so a crash mid-write
  // never corrupts the saved board.
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, file);
}
