import { existsSync, readFileSync } from 'node:fs';

const required = [
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  'docs/product-brief.md',
  'docs/architecture.md',
  'docs/cli-adapter-design.md',
  'docs/copilot-cli-integration.md',
  'docs/claude-code-integration.md',
  'docs/github-gh-host-aware-design.md',
  'docs/source-inspiration-analysis.md',
  'docs/security-model.md',
  'docs/implementation-plan.md',
  'docs/roadmap.md',
  'src/agent-runners/types.ts',
  'src/agent-runners/copilot-cli.ts',
  'src/agent-runners/claude-code.ts',
  'src/agent-runners/index.ts',
];

let ok = true;
for (const file of required) {
  if (!existsSync(file)) {
    console.error(`missing: ${file}`);
    ok = false;
    continue;
  }
  const text = readFileSync(file, 'utf8');
  if (text.trim().length < 20) {
    console.error(`too small: ${file}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log(`docs check passed (${required.length} files)`);
