import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildEnvironment, checkAssets, selectEnvironment } from './cloudflare-config.mjs';

const settings = {
  CAMPUS_PRODUCTION_SUPABASE_URL: 'https://prod-test.supabase.co',
  CAMPUS_PRODUCTION_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_prod_test',
  CAMPUS_STAGING_SUPABASE_URL: 'https://staging-test.supabase.co',
  CAMPUS_STAGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_staging_test',
};
test('main and feature builds select isolated projects despite generic VITE variables', () => {
  for (const [branch, target] of [['main', 'production'], ['feature/example', 'staging']]) {
    const env = { ...settings, WORKERS_CI: '1', WORKERS_CI_BRANCH: branch, VITE_SUPABASE_URL: settings.CAMPUS_PRODUCTION_SUPABASE_URL };
    assert.equal(selectEnvironment(env), target);
    assert.equal(buildEnvironment(env, target).VITE_SUPABASE_URL, target === 'production' ? settings.CAMPUS_PRODUCTION_SUPABASE_URL : settings.CAMPUS_STAGING_SUPABASE_URL);
  }
  assert.throws(() => selectEnvironment({ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'release/unknown' }));
  assert.throws(() => selectEnvironment({ WORKERS_CI_BRANCH: 'feature/x' }, 'production'));
});
test('missing, shared, malformed and secret-key connections stop builds', () => {
  assert.throws(() => buildEnvironment({}, 'production'));
  assert.throws(() => buildEnvironment({ ...settings, CAMPUS_STAGING_SUPABASE_URL: settings.CAMPUS_PRODUCTION_SUPABASE_URL }, 'staging'));
  assert.throws(() => buildEnvironment({ ...settings, CAMPUS_STAGING_SUPABASE_URL: '' }, 'staging'));
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com/path']) {
    assert.throws(() => buildEnvironment({ ...settings, CAMPUS_PRODUCTION_SUPABASE_URL: url }, 'production'));
  }
  const serviceJwt = `x.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.x`;
  for (const key of ['sb_secret_example', serviceJwt]) {
    assert.throws(() => buildEnvironment({ ...settings, CAMPUS_PRODUCTION_SUPABASE_PUBLISHABLE_KEY: key }, 'production'));
  }
});
test('asset count and per-file size enforce inclusive limits', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'campus-assets-'));
  try {
    await writeFile(join(directory, 'one.txt'), '1234');
    assert.equal((await checkAssets(directory, { files: 1, bytes: 4 })).files, 1);
    await assert.rejects(checkAssets(directory, { files: 1, bytes: 3 }));
    await writeFile(join(directory, 'two.txt'), '1');
    await assert.rejects(checkAssets(directory, { files: 1, bytes: 4 }));
  } finally { for (const name of ['one.txt', 'two.txt']) await unlink(join(directory, name)).catch((error) => { if (error.code !== 'ENOENT') throw error; }); await rmdir(directory); }
});
