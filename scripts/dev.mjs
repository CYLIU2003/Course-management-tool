import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

let api;
let web;
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api?.kill(); web?.kill(); process.exit(code);
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

async function health() {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/health', { signal: AbortSignal.timeout(1000) });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

try {
  if (!existsSync(process.env.CURRICULUM_DB_PATH || 'data/curriculum.sqlite3')) throw new Error('npm run db:build を先に実行してください。');
  let status = await health();
  if (!status) {
    api = spawn('python', ['-m', 'backend.server'], { stdio: 'inherit' });
    api.on('error', (error) => { console.error(error); stop(1); });
    api.on('exit', (code) => stop(code ?? 1));
    for (let attempt = 0; attempt < 50 && !status; attempt++) {
      await delay(100);
      status = await health();
    }
  }
  if (status?.schemaVersion !== 4 || status?.counts?.cohort_datasets !== 95) throw new Error('SQLiteの学科・入学年度データが未準備です。npm run db:build 後にAPIを再起動してください。');
  const args = process.argv.slice(2);
  const preview = args.includes('--preview');
  web = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...(preview ? ['preview'] : []), ...args.filter((arg) => arg !== '--preview')], { stdio: 'inherit' });
  web.on('error', (error) => { console.error(error); stop(1); });
  web.on('exit', (code) => stop(code ?? 1));
} catch (error) { console.error(error.message); stop(1); }
