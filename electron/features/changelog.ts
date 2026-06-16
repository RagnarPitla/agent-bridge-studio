import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { IpcMain } from 'electron';

import { runAgentOnce } from '../run-agent';

const exec = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await exec('git', ['-C', cwd, ...args], { maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch {
    return '';
  }
}

interface Commit {
  hash: string;
  subject: string;
}

/**
 * Changelog: list tags, list commits since a ref, and draft release notes from
 * those commits using the agent. (Creating the GitHub release via `gh` is a
 * planned follow-up.)
 */
export function registerChangelogIpc(ipcMain: IpcMain): void {
  ipcMain.handle('feature:changelog:tags', async (_event, cwd: string): Promise<string[]> => {
    const out = await git(cwd, ['tag', '--sort=-creatordate']);
    return out.split('\n').map((t) => t.trim()).filter(Boolean);
  });

  ipcMain.handle(
    'feature:changelog:commits',
    async (_event, cwd: string, sinceRef?: string): Promise<Commit[]> => {
      const range = sinceRef ? [`${sinceRef}..HEAD`] : [];
      const out = await git(cwd, ['log', '--pretty=%h%x09%s', ...range]);
      return out
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [hash, ...rest] = line.split('\t');
          return { hash, subject: rest.join('\t') };
        });
    },
  );

  ipcMain.handle(
    'feature:changelog:draft',
    async (_event, payload: { projectPath: string; commits: Commit[]; version?: string }) => {
      const list = payload.commits.map((c) => `- ${c.subject} (${c.hash})`).join('\n');
      const prompt =
        `Write release notes in markdown for version ${payload.version ?? 'next'}. ` +
        `Group into New features, Improvements, Bug fixes, and Other. Use concise bullets and tasteful emojis.\n\n` +
        `Commits:\n${list}`;
      const result = await runAgentOnce({
        projectPath: payload.projectPath,
        prompt,
        mode: 'plan',
      });
      return result.output.trim();
    },
  );
}
