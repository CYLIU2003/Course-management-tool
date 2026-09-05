import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { accountRequest, responseError } from '../api/account';

interface Option { id: string; name: string; faculty: string; entranceYear: number }

export function GoogleSignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return query.has('error') || hash.has('error') ? 'Googleログインが完了しませんでした。もう一度お試しください。' : '';
  });
  async function login() {
    setBusy(true); setError('');
    try {
      const response = await accountRequest('/api/auth/google', 'POST', {});
      if (!response.ok) throw new Error(await responseError(response));
    } catch (reason) { setError(reason instanceof Error ? reason.message : '接続できませんでした。'); }
    finally { setBusy(false); }
  }
  return <main className="account-page"><div className="account-intro"><span className="app-brand__mark" aria-hidden="true">c.</span><p className="eyebrow">CAMPUS NOTE</p><h1>履修を、<br />ひとつのノートに。</h1><p>時間割も成績も、Googleログインであなたのアカウントに保存。</p></div><section className="account-card"><h2>Campus Noteをはじめる</h2><button className="account-submit" disabled={busy} onClick={login}>{busy ? 'Googleへ接続中…' : 'Googleでログイン'}</button><p>初回だけ、ユーザー名・学科・入学年度を設定します。</p><p className="account-note">東京都市大学の学生向け非公式ツールです。</p><p role="alert">{error}</p></section></main>;
}

export function Onboarding({ onCompleted, onLogout }: { onCompleted: () => Promise<void>; onLogout: () => void }) {
  const [options, setOptions] = useState<Option[]>([]);
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    apiFetch('/api/registration-options', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(await responseError(response));
      const data: Option[] = await response.json(); if (!controller.signal.aborted) setOptions(data);
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '学科一覧を読み込めませんでした。'); });
    return () => controller.abort();
  }, [attempt]);
  const departments = [...new Map(options.map((option) => [option.id, option])).values()];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('');
    try {
      const response = await accountRequest('/api/me/onboarding', 'POST', { username: form.get('username'), departmentId: department, entranceYear: Number(year) });
      if (response.status === 409) { await onCompleted(); return; }
      if (!response.ok) throw new Error(await responseError(response));
      await onCompleted();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存できませんでした。'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try {
      const response = await accountRequest('/api/me/logout', 'POST', {});
      if (!response.ok) throw new Error(await responseError(response));
      onLogout();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ログアウトできませんでした。'); }
    finally { setBusy(false); }
  }
  return <main className="account-page"><div className="account-intro"><p className="eyebrow">WELCOME TO CAMPUS NOTE</p><h1>あなたの履修ノートを<br />準備しましょう。</h1><p>入学した学科と年度に合った資料を表示します。</p></div><section className="account-card"><h2>初期設定</h2><form onSubmit={submit}><fieldset disabled={busy}><label>ユーザー名<input name="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_\-]+" autoComplete="username" autoCapitalize="none" /><small>半角英数字・_・- の3〜32文字</small></label><label>入学した学科<select required value={department} onChange={(event) => { setDepartment(event.target.value); setYear(''); }}><option value="">学科を選択</option>{departments.map((option) => <option key={option.id} value={option.id}>{option.faculty} · {option.name}</option>)}</select></label><label>入学年度<select required disabled={!department} value={year} onChange={(event) => setYear(event.target.value)}><option value="">入学年度を選択</option>{options.filter((option) => option.id === department).map((option) => <option key={option.entranceYear} value={option.entranceYear}>{option.entranceYear}年度</option>)}</select></label><p className="account-note">時間割・成績・設定をアカウントに保存します。改善のため利用画面名と日時を記録します。</p><button className="account-submit" disabled={!options.length} type="submit">{busy ? '保存中…' : 'Campus Noteを始める'}</button></fieldset></form><p role="alert">{error}</p>{!options.length && <button onClick={() => setAttempt((n) => n + 1)}>学科一覧を再読込</button>}<button disabled={busy} onClick={logout}>別のGoogleアカウントを使う</button></section></main>;
}
