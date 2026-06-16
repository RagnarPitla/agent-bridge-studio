import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { IpcMain } from 'electron';

const STACK_MARKERS: Array<{ file: string; label: string }> = [
  { file: 'package.json', label: 'Node.js' },
  { file: 'tsconfig.json', label: 'TypeScript' },
  { file: 'requirements.txt', label: 'Python' },
  { file: 'pyproject.toml', label: 'Python' },
  { file: 'go.mod', label: 'Go' },
  { file: 'Cargo.toml', label: 'Rust' },
  { file: 'pom.xml', label: 'Java/Maven' },
  { file: 'build.gradle', label: 'Gradle' },
  { file: 'Gemfile', label: 'Ruby' },
  { file: 'composer.json', label: 'PHP' },
  { file: 'Dockerfile', label: 'Docker' },
  { file: 'docker-compose.yml', label: 'Docker Compose' },
];

const IGNORE = new Set(['.git', 'node_modules', 'dist', 'out', '.next', '.venv', '__pycache__']);

interface Entry {
  name: string;
  type: 'dir' | 'file';
}

/**
 * Context: a quick, programmatic project index — detected stack and top-level
 * tree — so the user gets project infrastructure at a glance.
 */
export function registerContextIpc(ipcMain: IpcMain): void {
  ipcMain.handle('feature:context:index', async (_event, projectPath: string) => {
    const stack = new Set<string>();
    for (const marker of STACK_MARKERS) {
      if (existsSync(join(projectPath, marker.file))) stack.add(marker.label);
    }

    let entries: Entry[] = [];
    try {
      entries = readdirSync(projectPath)
        .filter((name) => !IGNORE.has(name))
        .map((name) => {
          const isDir = statSync(join(projectPath, name)).isDirectory();
          return { name, type: isDir ? ('dir' as const) : ('file' as const) };
        })
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    } catch {
      entries = [];
    }

    return {
      name: basename(projectPath),
      root: projectPath,
      stack: [...stack],
      readme: existsSync(join(projectPath, 'README.md')),
      entries,
    };
  });
}
