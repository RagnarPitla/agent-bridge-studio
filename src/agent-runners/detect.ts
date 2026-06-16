import { execFile } from 'node:child_process';
import { accessSync, constants, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';

import type { ToolDetection } from './types';

const execFileAsync = promisify(execFile);

const VERSION_RE = /v?(\d+\.\d+\.\d+)/;
const COPILOT_VERSION_RE = /GitHub Copilot CLI\s+v?(\d+\.\d+\.\d+)/i;
const SHIM_RE = /cannot find github copilot cli|install github copilot cli/i;

export interface VersionResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/**
 * Resolve every match for an executable on PATH without shelling out to
 * `which`/`where`. Portable across macOS, Linux, and Windows (honors PATHEXT).
 */
export function whichAll(name: string): string[] {
  const pathValue = process.env.PATH ?? '';
  const exts =
    process.platform === 'win32'
      ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
      : [''];
  const results: string[] = [];
  for (const dir of pathValue.split(delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = join(dir, name + ext);
      try {
        accessSync(candidate, constants.X_OK);
        results.push(candidate);
      } catch {
        // not executable / not present
      }
    }
  }
  return results;
}

export function which(name: string): string | undefined {
  return whichAll(name)[0];
}

/**
 * Run `<bin> --version` non-interactively. execFile gives the child a closed,
 * non-TTY stdin, so launcher shims that prompt ("Install GitHub Copilot CLI?
 * [y/N]") receive EOF and exit instead of hanging the caller. A timeout guards
 * against any binary that ignores EOF.
 */
export async function runVersion(
  bin: string,
  args: string[] = ['--version'],
): Promise<VersionResult> {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout: 8000,
      windowsHide: true,
    });
    return { ok: true, stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (err) {
    const e = err as { stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      ok: false,
      stdout: e.stdout ? e.stdout.toString() : '',
      stderr: e.stderr ? e.stderr.toString() : '',
    };
  }
}

function parseVersion(text: string, re: RegExp = VERSION_RE): string | undefined {
  const m = re.exec(text);
  return m ? m[1] : undefined;
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10));
  const pb = b.split('.').map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Discover standalone Copilot CLI binaries installed under
 * `~/.copilot-cli/<version>/copilot`, highest version first.
 */
export function copilotCliInstallDirs(): string[] {
  const root = join(homedir(), '.copilot-cli');
  if (!existsSync(root)) return [];
  const exe = process.platform === 'win32' ? 'copilot.exe' : 'copilot';
  const found: { version: string; bin: string }[] = [];
  for (const entry of readdirSync(root)) {
    const bin = join(root, entry, exe);
    if (existsSync(bin)) found.push({ version: entry, bin });
  }
  return found.sort((a, b) => compareSemver(b.version, a.version)).map((d) => d.bin);
}

/**
 * Resolve the *real* GitHub Copilot CLI binary.
 *
 * The `copilot` on PATH is frequently a launcher shim (for example the VS Code
 * Copilot Chat bundle) that cannot report a version and may prompt to install
 * the real CLI. We verify the PATH binary actually returns a version string and
 * otherwise fall back to the standalone install under `~/.copilot-cli/<ver>`.
 */
export async function resolveCopilotBinary(): Promise<ToolDetection> {
  const pathBin = which('copilot');
  const candidates: string[] = [];
  if (pathBin) candidates.push(pathBin);
  candidates.push(...copilotCliInstallDirs());

  let sawShim = false;
  for (const bin of candidates) {
    const res = await runVersion(bin);
    const combined = `${res.stdout}\n${res.stderr}`;
    if (SHIM_RE.test(combined)) {
      sawShim = true;
      continue;
    }
    const version = parseVersion(combined, COPILOT_VERSION_RE) ?? parseVersion(combined);
    if (version) {
      const details =
        bin === pathBin
          ? 'Resolved from PATH.'
          : 'PATH copilot is a launcher shim; resolved standalone install under ~/.copilot-cli instead.';
      return { found: true, command: bin, version, details };
    }
  }

  return {
    found: false,
    command: pathBin ?? 'copilot',
    details: sawShim
      ? 'PATH copilot is a launcher shim and no standalone ~/.copilot-cli install responded to --version.'
      : 'GitHub Copilot CLI not found on PATH or under ~/.copilot-cli.',
  };
}

/** Resolve the Claude Code binary from PATH (or the common ~/.local/bin path). */
export async function resolveClaudeBinary(): Promise<ToolDetection> {
  const localBin = join(homedir(), '.local', 'bin', 'claude');
  const candidates = [which('claude'), existsSync(localBin) ? localBin : undefined].filter(
    (c): c is string => Boolean(c),
  );
  for (const bin of candidates) {
    const res = await runVersion(bin);
    const version = parseVersion(`${res.stdout}\n${res.stderr}`);
    if (version) return { found: true, command: bin, version, details: 'Resolved Claude Code.' };
  }
  return { found: false, command: 'claude', details: 'Claude Code not found on PATH.' };
}
