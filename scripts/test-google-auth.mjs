import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

globalThis.window = { location: { origin: 'https://campus.example', search: '?error=access_denied', hash: '' } };
const result = await build({
  stdin: { contents: "export * from './src/api/supabase'; export * from './src/components/GoogleAccount';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }) },
  plugins: [{ name: 'auth-transport', setup(bundler) {
    bundler.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'auth', namespace: 'test' }));
    bundler.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export const createClient=()=>({auth:{signInWithOAuth:async(value)=>{globalThis.oauthRequest=value;return {error:null}}}});`, loader: 'js' }));
  } }],
});
// Resolve React from this repository while keeping the compiled artifact in memory.
let code = result.outputFiles[0].text;
for (const name of ['react/jsx-runtime', 'react']) code = code.replaceAll(`from "${name}"`, `from "${import.meta.resolve(name)}"`);
const module = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const login = renderToStaticMarkup(createElement(module.GoogleSignIn));
assert.match(login, /Googleでログイン/);
assert.match(login, /Googleログインが完了しませんでした/);
assert.doesNotMatch(login, /type="password"|type="email"/);
const onboarding = renderToStaticMarkup(createElement(module.Onboarding, { onCompleted: async () => {}, onLogout: () => {} }));
for (const field of ['ユーザー名', '入学した学科', '入学年度', 'Campus Noteを始める']) assert.ok(onboarding.includes(field));
assert.equal((await module.supabaseFetch('/api/auth/google', { method: 'POST' })).status, 200);
assert.deepEqual(globalThis.oauthRequest, { provider: 'google', options: { redirectTo: 'https://campus.example', scopes: 'openid email profile' } });
assert.equal((await module.supabaseFetch('/api/auth/register', { method: 'POST' })).status, 404);
assert.equal((await module.supabaseFetch('/api/auth/login', { method: 'POST' })).status, 404);
console.log('PASS: Google-only UI, OAuth cancellation, onboarding form, minimal scopes, fixed return origin, removed password routes.');
