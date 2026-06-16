import { build } from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  // Electron is provided by the runtime, not bundled.
  external: ['electron'],
  outExtension: { '.js': '.cjs' },
  logLevel: 'info',
};

await Promise.all([
  build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist/main.cjs' }),
  build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist/preload.cjs' }),
]);
