import { spawnSync } from 'node:child_process';
import { loadEnv } from 'vite';
const env={...loadEnv('production',process.cwd(),''),...process.env};
const url=env.VITE_SUPABASE_URL;
const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || !url.startsWith('https://')) throw new Error('Public build requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
let isPublic=key.startsWith('sb_publishable_');
if (key.split('.').length===3) {
  try { isPublic=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon'; } catch { isPublic=false; }
}
if (!isPublic) throw new Error('Only a publishable or anon key may be included in frontend assets.');
for (const [command,args] of [['node_modules/typescript/bin/tsc',['-b']],['node_modules/vite/bin/vite.js',['build']]]) {
  const result=spawnSync(process.execPath,[command,...args],{stdio:'inherit',env});
  if (result.status!==0) process.exit(result.status??1);
}
