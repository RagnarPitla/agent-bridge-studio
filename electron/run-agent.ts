import { spawn } from 'node:child_process';

import { AgentCliRegistry } from '../src/agent-runners/index';
import type { AgentCliKind } from '../src/agent-runners/types';
import type { ActivityKind } from './activity';

const registry = new AgentCliRegistry();

/** Hook so main can route feature runs into the shared ActivityRegistry. */
export interface ActivitySink {
  start(input: { kind: ActivityKind; title: string; projectPath: string; write: boolean }): string;
  finish(id: string, status: 'done' | 'error'): void;
}

let sink: ActivitySink | null = null;
export function setActivitySink(s: ActivitySink): void {
  sink = s;
}

export interface RunOnceOptions {
  kind?: AgentCliKind;
  projectPath: string;
  prompt: string;
  mode?: 'plan' | 'autopilot';
  model?: string;
  effort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  allowAll?: boolean;
  timeoutMs?: number;
  activityKind?: ActivityKind;
  activityTitle?: string;
  onChunk?: (text: string) => void;
}

/**
 * Run an agent CLI once, non-interactively, and resolve with the buffered
 * output. Shared by feature modules (insights, ideation, …) that want a single
 * answer rather than a long-lived streamed task. Registers a shared activity so
 * other agents/windows can see the work in progress.
 */
export async function runAgentOnce(
  opts: RunOnceOptions,
): Promise<{ code: number; output: string }> {
  const adapter = registry.get(opts.kind ?? 'copilot-cli');
  if (!adapter) throw new Error(`Unknown agent: ${opts.kind}`);

  const detection = await adapter.detect();
  if (!detection.found) throw new Error(`${adapter.displayName} is not installed.`);

  const command = adapter.buildCommand({
    taskId: 'once',
    projectPath: opts.projectPath,
    worktreePath: opts.projectPath,
    prompt: opts.prompt,
    mode: opts.mode === 'autopilot' ? 'code' : 'plan',
    model: opts.model,
    reasoningEffort: opts.effort,
    permissions: {
      allowedTools: [],
      allowedUrls: ['github.com'],
      allowedPaths: [opts.projectPath],
      allowAll: opts.allowAll ?? true,
    },
  });

  const activityId = sink?.start({
    kind: opts.activityKind ?? 'other',
    title: opts.activityTitle ?? 'Agent run',
    projectPath: opts.projectPath,
    write: opts.mode === 'autopilot',
  });

  return new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, { cwd: command.cwd, env: command.env });
    let output = '';
    const killer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs ?? 180000);
    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      opts.onChunk?.(text);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      opts.onChunk?.(text);
    });
    child.on('error', (err) => {
      clearTimeout(killer);
      if (activityId) sink?.finish(activityId, 'error');
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(killer);
      if (activityId) sink?.finish(activityId, code === 0 ? 'done' : 'error');
      resolve({ code: code ?? 0, output });
    });
  });
}

