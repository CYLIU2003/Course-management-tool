import { spawn } from 'node:child_process';
import { loadEnv } from 'vite';
import { buildEnvironment } from './cloudflare-config.mjs';

const env = buildEnvironment({ ...loadEnv('staging', process.cwd(), ''), ...process.env }, 'staging');
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--mode', 'staging', ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
