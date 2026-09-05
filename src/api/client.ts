import { supabaseFetch, usesSupabase } from './supabase';

let identity = '';
export function setRequestIdentity(id: string) { identity = id; }

/** Public build uses Supabase; local development keeps the audited SQLite API. */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (identity && path.startsWith('/api/me')) headers.set('X-Account-ID', identity);
  const options = { ...init, headers };
  return usesSupabase ? supabaseFetch(path, options) : fetch(path, options);
}
