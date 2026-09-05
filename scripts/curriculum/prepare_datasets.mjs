import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const output = 'node_modules/.tmp/prepare-datasets.mjs';
await mkdir('node_modules/.tmp', { recursive: true });
await build({ entryPoints: ['scripts/curriculum/prepare_datasets.ts'], outfile: output, bundle: true,
  platform: 'node', format: 'esm', target: 'node22', packages: 'external', define: { 'import.meta.env': '{"BASE_URL":"/","DEV":false}' } });
const result = spawnSync(process.execPath, [output], { stdio: 'inherit' });
await rm(output);
process.exitCode = result.status ?? 1;
