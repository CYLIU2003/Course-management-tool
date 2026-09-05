import { createClient } from '@supabase/supabase-js';

const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const usesSupabase = Boolean(url && key);
const supabase = usesSupabase ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function supabaseFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!supabase) throw new Error('Supabaseが未設定です。');
  const route = new URL(path, window.location.origin);
  const method = init.method ?? 'GET';
  const payload = typeof init.body === 'string' ? JSON.parse(init.body) : {};
  if (route.pathname === '/api/auth/register') {
    const { data, error } = await supabase.auth.signUp({ email: payload.email, password: payload.password,
      options: { emailRedirectTo: window.location.origin, data: { username: payload.username.toLowerCase(), departmentId: payload.departmentId, entranceYear: payload.entranceYear } } });
    return error ? json({ error: '登録できませんでした。入力内容・ユーザー名の重複を確認してください。' }, 400) : json({ ok: true, confirmationRequired: !data.session });
  }
  if (route.pathname === '/api/auth/login') {
    const { error } = await supabase.auth.signInWithPassword({ email: payload.email, password: payload.password });
    return error ? json({ error: 'メールアドレス・パスワード、またはメール認証を確認してください。' }, 401) : json({ ok: true });
  }
  if (route.pathname === '/api/me/logout') {
    const { data: { session } } = await supabase.auth.getSession();
    const owner = new Headers(init.headers).get('X-Account-ID');
    if (session && owner && owner !== session.user.id) return json({ error: '別アカウントに切り替わっています。再読み込みしてください。' }, 403);
    const { error } = await supabase.auth.signOut();
    return error ? json({ error: 'ログアウトできませんでした。' }, 503) : json({ ok: true });
  }
  if (route.pathname.startsWith('/api/me')) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return json({ error: 'ログインしてください。' }, 401);
    // A stale tab must not save one student's draft into another student's session.
    const owner = new Headers(init.headers).get('X-Account-ID');
    if (owner && owner !== session.user.id) return json({ error: '別アカウントに切り替わっています。再読み込みしてください。' }, 403);
    const query = Object.fromEntries(route.searchParams);
    const { data, error } = await supabase.rpc('campus_request', { route: route.pathname, verb: method, payload: { ...query, ...payload } });
    if (error) {
      const status = error.code === '40001' ? 409 : error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code.startsWith('22') ? 400 : 503;
      return json({ error: status === 409 ? '別の画面で更新されています。入力内容を保存して再読み込みしてください。' : status === 403 ? 'この操作の権限がありません。再ログインしてください。' : '処理できませんでした。入力内容と接続状態を確認してください。' }, status);
    }
    return json(data);
  }
  const { data, error } = await supabase.from('reference_payloads').select('payload').eq('path', route.pathname).maybeSingle();
  if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (error) return json({ error: '公式データに接続できません。' }, 503);
  return data ? json(data.payload) : json({ error: '該当する公式データがありません。' }, 404);
}
