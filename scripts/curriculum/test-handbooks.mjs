import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const output = resolve('node_modules/.tmp/handbooks.test.mjs');
await mkdir(resolve('node_modules/.tmp'), { recursive: true });
await build({ entryPoints: ['scripts/curriculum/handbooks.test.ts'], outfile: output, bundle: true,
  platform: 'node', format: 'esm', target: 'node22', packages: 'external',
  define: { 'import.meta.env': '{"BASE_URL":"/","DEV":false}' } });
const result = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' });
await rm(output);
process.exitCode = result.status ?? 1;
