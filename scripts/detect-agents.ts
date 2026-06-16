import { AgentCliRegistry } from '../src/agent-runners/index';

/**
 * Runnable detection probe. Uses the same neutral adapter registry the app
 * would use to discover which agent CLIs are installed and usable, and prints a
 * human-readable report. This is the proof that the adapters work against the
 * real GitHub Copilot CLI / Claude Code on this machine.
 *
 *   npm run detect
 */
const registry = new AgentCliRegistry();
const results = await registry.detectAll();

for (const result of results) {
  const { detection } = result;
  const status = detection.found ? 'OK     ' : 'MISSING';
  const version = detection.version ? ` v${detection.version}` : '';
  console.log(`[${status}] ${result.displayName}${version}`);
  console.log(`          command: ${detection.command}`);
  if (detection.details) console.log(`          ${detection.details}`);
}

const copilot = results.find((r) => r.kind === 'copilot-cli');
console.log(
  copilot?.detection.found
    ? '\nGitHub Copilot CLI is detected and ready.'
    : '\nGitHub Copilot CLI was not detected.',
);
