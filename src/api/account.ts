import type { AcademicAllYearsData } from '../core/types';
import { apiFetch, setRequestIdentity } from './client';

export interface StudentState {
  departmentId: string;
  entranceYear: number;
  settings: { title: string; days: string[]; periods: { id: number; label: string; time: string }[]; showTime: boolean };
  allYearsData: AcademicAllYearsData;
}
export interface Account {
  onboardingCompleted?: true;
  id: string;
  username: string;
  departmentId: string;
  entranceYear: number;
  csrfToken: string;
  state: StudentState | null;
  revision: number;
  isAdmin: boolean;
}

let csrfToken = '';
let accountId = '';
export function setAccountToken(token: string) { csrfToken = token; }
export function setAccountIdentity(id: string) { accountId = id; setRequestIdentity(id); }

export async function accountRequest(path: string, method: 'POST' | 'PUT', value: unknown, signal?: AbortSignal) {
  return apiFetch(path, { method, credentials: 'same-origin', headers: {
    'Content-Type': 'application/json', 'X-Campus-Request': '1', 'X-CSRF-Token': csrfToken, 'X-Account-ID': accountId,
  }, body: JSON.stringify(value), signal });
}

export async function responseError(response: Response): Promise<string> {
  try { const value = await response.json(); return typeof value.error === 'string' ? value.error : '処理に失敗しました。'; }
  catch { return 'サーバーに接続できません。しばらくして再試行してください。'; }
}

export interface PendingAccount extends Omit<Account, "username" | "departmentId" | "entranceYear" | "onboardingCompleted"> {
  username: null; departmentId: null; entranceYear: null; onboardingCompleted: false;
}
