import { GoogleSignIn, Onboarding } from './GoogleAccount';
import { usesSupabase } from '../api/supabase';
import { clearAccountCache, readPendingDraft, saveAccountCache, serializeState } from '../api/accountCache';
import { apiFetch } from '../api/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import TimetableApp from '../TimetableApp';
import AdminDashboard from './AdminDashboard';
import SupportDesk from './SupportDesk';
import { accountRequest, responseError, setAccountToken, setAccountIdentity, type Account, type PendingAccount, type StudentState } from '../api/account';

interface RegistrationOption { id: string; name: string; faculty: string; entranceYear: number; status: string }

export default function AccountGate() {
  const [account, setAccount] = useState<Account | PendingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadAccount = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiFetch('/api/me', { cache: 'no-store' });
      if (response.status === 401) { setAccount(null); setAccountToken(''); setAccountIdentity(''); return; }
      if (!response.ok) throw new Error(await responseError(response));
      const value: Account | PendingAccount = await response.json();
      setAccountToken(value.csrfToken); setAccountIdentity(value.id); setAccount(value);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '接続できません。'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadAccount(); }, [loadAccount]);
  if (loading) return <main className="account-page"><p role="status">アカウントを確認しています…</p></main>;
  if (error) return <main className="account-page"><section className="account-card"><h1>接続を確認してください</h1><p role="alert">{error}</p><button onClick={loadAccount}>再試行</button></section></main>;
  if (account?.onboardingCompleted === false) return <Onboarding onCompleted={loadAccount} onLogout={() => { setAccountToken(''); setAccountIdentity(''); setAccount(null); }} />;
  return account ? <AccountSession key={account.id} account={account} onLogout={() => { setAccountToken(''); setAccountIdentity(''); setAccount(null); }} /> : usesSupabase ? <GoogleSignIn /> : <SignIn onAuthenticated={loadAccount} />;
}

function SignIn({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [registering, setRegistering] = useState(false);
  const [options, setOptions] = useState<RegistrationOption[]>([]);
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const loadOptions = useCallback(async () => {
    setOptionsError('');
    try {
      const response = await apiFetch('/api/registration-options');
      if (!response.ok) throw new Error(await responseError(response));
      setOptions(await response.json());
    } catch { setOptionsError('学科一覧を読み込めませんでした。'); }
  }, []);
  useEffect(() => { void loadOptions(); }, [loadOptions]);
  const departments = [...new Map(options.map((option) => [option.id, option])).values()];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (registering && password !== form.get('confirm')) { setMessage('確認用パスワードが一致しません。'); setBusy(false); return; }
    try {
      const response = await accountRequest(`/api/auth/${registering ? 'register' : 'login'}`, 'POST', {
        username: form.get('username'), email: form.get('email'), password, ...(registering ? { departmentId: department, entranceYear: Number(year) } : {}),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result: { confirmationRequired?: boolean } = await response.json();
      if (result.confirmationRequired) { setMessage('確認メールを送信しました。メール内のリンクを開いてからログインしてください。'); return; }
      await onAuthenticated();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '接続できません。'); }
    finally { setBusy(false); }
  }
  return <main className="account-page"><div className="account-intro"><span className="app-brand__mark" aria-hidden="true">c.</span><p className="eyebrow">CAMPUS NOTE · 仮公開版</p><h1>大学生活の履修を、<br />ひとつのノートに。</h1><p>時間割も、成績も、あなたのアカウントに保存。<br />学科・入学年度に合った科目から始められます。</p><p className="account-note">東京都市大学の学生向け非公式ツールです。</p></div>
    <section className="account-card"><div className="account-tabs"><button type="button" aria-pressed={!registering} disabled={busy} onClick={() => { setRegistering(false); setMessage(''); }}>ログイン</button><button type="button" aria-pressed={registering} disabled={busy} onClick={() => { setRegistering(true); setMessage(''); }}>新規登録</button></div>
      <h2>{registering ? 'あなたの履修ノートを作成' : 'おかえりなさい'}</h2>
      <form onSubmit={submit}><fieldset disabled={busy}>
        {(!usesSupabase || registering) && <><label>ユーザー名<input name="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_\-]+" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-describedby="username-hint" /></label><small id="username-hint">半角英数字・_・- の3〜32文字（大文字・小文字は区別しません）</small></>}
        {usesSupabase && <label>メールアドレス<input name="email" type="email" required autoComplete="email" /></label>}
        <label>パスワード<input key={registering ? 'new' : 'current'} name="password" type="password" required minLength={12} maxLength={128} autoComplete={registering ? 'new-password' : 'current-password'} /></label>
        {registering && <><small>12文字以上。大学のアカウントとは別のパスワードを設定してください。</small><label>パスワード（確認）<input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
          <label>入学した学科<select value={department} required onChange={(event) => { setDepartment(event.target.value); setYear(''); }}><option value="">学科を選択</option>{departments.map((option) => <option key={option.id} value={option.id}>{option.faculty} · {option.name}</option>)}</select></label>
          <label>入学年度<select value={year} required disabled={!department} onChange={(event) => setYear(event.target.value)}><option value="">入学年度を選択</option>{options.filter((option) => option.id === department).map((option) => <option key={option.entranceYear} value={option.entranceYear}>{option.entranceYear}年度{option.status === 'unavailable' ? '（科目資料未公開）' : ''}</option>)}</select></label>
          <p className="account-note">登録情報と入力した時間割・成績をサーバーに保存します。利用画面名と日時を改善のため90日間記録します。パスワードは大切に保管してください。</p></>}
        <p role="alert">{message}</p><button className="account-submit" type="submit" disabled={registering && !options.length}>{busy ? '処理中…' : registering ? '登録してはじめる' : 'ログイン'}</button>
      </fieldset></form>{registering && optionsError && <p role="alert">{optionsError} <button onClick={loadOptions}>再試行</button></p>}
    </section></main>;
}

function AccountSession({ account, onLogout }: { account: Account; onLogout: () => void }) {
  const [draft] = useState(() => readPendingDraft(account));
  const [initialAccount] = useState(() => draft ? { ...account, state: draft.state } : account);
  const [panel, setPanel] = useState<'student' | 'support' | 'admin'>('student');
  const revision = useRef(draft?.revision ?? account.revision);
  const latest = useRef<string | null>(account.state ? serializeState(account.state) : null);
  const saved = useRef(latest.current);
  const running = useRef(false);
  const blocked = useRef(Boolean(draft && draft.revision !== account.revision));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(blocked.current ? '未同期の入力とサーバーの更新が競合しています。入力を退避してから、サーバーの内容を読み込んでください。' : '時間割・成績：保存済み');
  const [error, setError] = useState(blocked.current);
  const [loggingOut, setLoggingOut] = useState(false);
  const [conflict, setConflict] = useState(blocked.current);
  const persist = useCallback(async () => {
    if (running.current || blocked.current) return;
    running.current = true;
    try {
      while (latest.current !== saved.current && latest.current !== null) {
        const payload = latest.current;
        setMessage('保存中…');
        const response = await accountRequest('/api/me/state', 'PUT', { state: JSON.parse(payload), revision: revision.current });
        if (!response.ok) {
          setConflict([401, 403, 409].includes(response.status));
          throw new Error(await responseError(response));
        }
        const result: { revision: number } = await response.json();
        revision.current = result.revision; saved.current = payload;
        saveAccountCache(account.id, JSON.parse(latest.current ?? payload), revision.current, latest.current !== payload);
      }
      setPending(false); setError(false); setMessage('時間割・成績：保存済み');
    } catch (reason) {
      blocked.current = true; setError(true);
      setMessage(reason instanceof Error ? reason.message : '保存できませんでした。接続を確認して再試行してください。');
    } finally { running.current = false; }
  }, [account.id]);
  const onStateChange = useCallback((state: StudentState) => {
    const next = serializeState(state);
    if (next === latest.current) return;
    latest.current = next; setPending(true);
    saveAccountCache(account.id, state, revision.current, true);
    void persist();
  }, [persist, account.id]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (latest.current !== saved.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);
  async function logout() {
    if (latest.current !== saved.current || running.current) return;
    setLoggingOut(true);
    try {
      const response = await accountRequest('/api/me/logout', 'POST', {});
      if (!response.ok) throw new Error(await responseError(response));
      clearAccountCache(account.id); onLogout();
    } catch (reason) { setError(true); setMessage(reason instanceof Error ? reason.message : 'ログアウトできませんでした。'); }
    finally { setLoggingOut(false); }
  }
  function exportUnsaved() {
    const url = URL.createObjectURL(new Blob([latest.current ?? '{}'], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'campus-note-unsaved.json'; anchor.click(); URL.revokeObjectURL(url);
  }
  return <><aside className="account-bar print:hidden"><strong>{account.username}</strong><span role={error ? 'alert' : 'status'}>{message}</span>{error && <>{!conflict && <button onClick={() => { blocked.current = false; void persist(); }}>保存を再試行</button>}<button onClick={exportUnsaved}>入力内容をダウンロード</button><button onClick={() => { if (window.confirm("未同期の入力を破棄して、サーバーの保存内容を読み込みますか？")) { clearAccountCache(account.id); window.location.reload(); } }}>サーバーの内容を読み込む</button></>}<button onClick={() => setPanel('student')}>履修ノート</button><button onClick={() => setPanel('support')}>お問い合わせ</button>{account.isAdmin && <button onClick={() => setPanel('admin')}>管理画面</button>}<button disabled={pending || loggingOut} onClick={logout}>{loggingOut ? 'ログアウト中…' : 'ログアウト'}</button></aside><div hidden={panel !== 'student'}><TimetableApp account={initialAccount} onStateChange={onStateChange} /></div>{panel === 'support' && <main className="admin-workspace"><SupportDesk /></main>}{panel === 'admin' && account.isAdmin && <AdminDashboard />}</>;
}
