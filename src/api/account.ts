import type { AcademicAllYearsData } from '../core/types';

export interface StudentState {
  departmentId: string;
  entranceYear: number;
  settings: { title: string; days: string[]; periods: { id: number; label: string; time: string }[]; showTime: boolean };
  allYearsData: AcademicAllYearsData;
}
export interface Account {
  id: string;
  username: string;
  departmentId: string;
  entranceYear: number;
  csrfToken: string;
  state: StudentState | null;
  revision: number;
}

let csrfToken = '';
export function setAccountToken(token: string) { csrfToken = token; }

export async function accountRequest(path: string, method: 'POST' | 'PUT', value: unknown, signal?: AbortSignal) {
  return fetch(path, { method, credentials: 'same-origin', headers: {
    'Content-Type': 'application/json', 'X-Campus-Request': '1', 'X-CSRF-Token': csrfToken,
  }, body: JSON.stringify(value), signal });
}

export async function responseError(response: Response): Promise<string> {
  try { const value = await response.json(); return typeof value.error === 'string' ? value.error : '処理に失敗しました。'; }
  catch { return 'サーバーに接続できません。しばらくして再試行してください。'; }
}
