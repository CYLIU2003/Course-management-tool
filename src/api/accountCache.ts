import type { Account, StudentState } from './account';

interface Cache { accountId: string; revision: number; pending: boolean; state: StudentState }
const key = (id: string) => `campus-note:account:${id}:v1`;

export function serializeState(value: unknown): string {
  function sort(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sort(v)]));
    return item;
  }
  return JSON.stringify(sort(value));
}

export function readPendingDraft(account: Account): Cache | null {
  try {
    const raw = localStorage.getItem(key(account.id));
    if (!raw) return null;
    const value: Cache = JSON.parse(raw);
    if (value.accountId !== account.id || !value.pending || !Number.isInteger(value.revision)
      || !value.state?.allYearsData || !Array.isArray(value.state.settings?.days) || !Array.isArray(value.state.settings?.periods)) return null;
    return value;
  } catch { return null; }
}
export function saveAccountCache(accountId: string, state: StudentState, revision: number, pending: boolean) {
  try { localStorage.setItem(key(accountId), JSON.stringify({ accountId, revision, state, pending })); return true; }
  catch { return false; }
}
export function clearAccountCache(accountId: string) {
  try { localStorage.removeItem(key(accountId)); } catch { /* Browser storage can be disabled; the server copy remains. */ }
}
