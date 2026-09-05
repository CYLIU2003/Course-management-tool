import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export function selectEnvironment(env, requested) {
  const branch = env.WORKERS_CI_BRANCH;
  const inferred = branch === 'main' ? 'production' : branch?.startsWith('feature/') ? 'staging' : null;
  if (env.WORKERS_CI && !inferred) throw new Error('Workers Builds requires main or feature/* branch.');
  if (requested && inferred && requested !== inferred) throw new Error('Build target conflicts with branch.');
  const target = requested ?? inferred ?? 'production';
  if (!['production', 'staging'].includes(target)) throw new Error('Unknown build target.');
  return target;
}

function validatePublicConnection(url, key) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('A valid Supabase HTTPS origin is required.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Supabase URL must be an HTTPS origin without credentials or a path.');
  }
  let isPublic = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key ?? '');
  if (key?.split('.').length === 3) {
    try { isPublic = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; }
    catch { isPublic = false; }
  }
  if (!isPublic) throw new Error('Only a publishable or anon key may be included in frontend assets.');
  return parsed.origin;
}

export function buildEnvironment(env, target) {
  const prefix = target === 'staging' ? 'CAMPUS_STAGING' : 'CAMPUS_PRODUCTION';
  // CI and staging never fall back to a generic, possibly production VITE value.
  const localProduction = target === 'production' && !env.WORKERS_CI;
  const url = env[`${prefix}_SUPABASE_URL`] || (localProduction ? env.VITE_SUPABASE_URL : undefined);
  const key = env[`${prefix}_SUPABASE_PUBLISHABLE_KEY`] || (localProduction ? env.VITE_SUPABASE_PUBLISHABLE_KEY : undefined);
  const origin = validatePublicConnection(url, key);
  if (target === 'staging' || env.WORKERS_CI) {
    const production = validatePublicConnection(env.CAMPUS_PRODUCTION_SUPABASE_URL, env.CAMPUS_PRODUCTION_SUPABASE_PUBLISHABLE_KEY);
    const staging = validatePublicConnection(env.CAMPUS_STAGING_SUPABASE_URL, env.CAMPUS_STAGING_SUPABASE_PUBLISHABLE_KEY);
    if (production === staging) throw new Error('Production and staging must use different Supabase projects.');
  }
  return { ...env, VITE_SUPABASE_URL: origin, VITE_SUPABASE_PUBLISHABLE_KEY: key };
}

export async function checkAssets(directory, limits = { files: 20000, bytes: 25 * 1024 * 1024 }) {
  let count = 0;
  let largest = { path: '', bytes: 0 };
  async function visit(path) {
    for (const item of await readdir(path, { withFileTypes: true })) {
      const file = join(path, item.name);
      if (item.isSymbolicLink()) throw new Error(`Unexpected asset symlink: ${file}`);
      if (item.isDirectory()) { await visit(file); continue; }
      const { size } = await stat(file);
      count++;
      if (size > largest.bytes) largest = { path: file, bytes: size };
      if (count > limits.files || size > limits.bytes) throw new Error(`Static asset limit exceeded: ${file}`);
    }
  }
  await visit(directory);
  return { files: count, largest };
}
