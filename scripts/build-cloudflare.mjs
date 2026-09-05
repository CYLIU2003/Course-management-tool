import { spawnSync } from 'node:child_process';
import { loadEnv } from 'vite';
import { buildEnvironment, checkAssets, selectEnvironment } from './cloudflare-config.mjs';

const requested = process.argv.find((arg) => arg.startsWith('--target='))?.split('=')[1];
const target = selectEnvironment(process.env, requested);
const env = buildEnvironment({ ...loadEnv(target, process.cwd(), ''), ...process.env }, target);
console.log(`Building ${target} frontend; Python is not used.`);
for (const [command, args] of [
  ['node_modules/typescript/bin/tsc', ['-b']],
  ['node_modules/vite/bin/vite.js', ['build', '--mode', target]],
]) {
  const result = spawnSync(process.execPath, [command, ...args], { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Static assets checked:', await checkAssets('dist'));
