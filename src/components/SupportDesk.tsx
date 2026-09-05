import { apiFetch } from '../api/client';
import { useCallback, useEffect, useState } from 'react';
import { accountRequest, responseError } from '../api/account';

interface Ticket { id: string; subject: string; status: 'open' | 'answered' | 'closed'; updated_at: number; username?: string }
interface Thread extends Ticket { messages: { id: string; body: string; is_admin: boolean | number; created_at: number }[] }
const STATUS = { open: '対応待ち', answered: '回答済み', closed: '解決済み' };

export default function SupportDesk({ admin = false }: { admin?: boolean }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState('');
  const [thread, setThread] = useState<Thread | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const load = useCallback(async () => {
    try {
      const response = await apiFetch(admin ? '/api/me/admin/support' : '/api/me/support');
      if (!response.ok) throw new Error(await responseError(response));
      setTickets(await response.json());
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '読み込めませんでした。'); }
  }, [admin]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setThread(null);
    if (!selected) return;
    const controller = new AbortController();
    apiFetch(`/api/me/support/${selected}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(await responseError(response));
      const value: Thread = await response.json();
      if (!controller.signal.aborted) setThread(value);
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setMessage(reason instanceof Error ? reason.message : '読み込めませんでした。'); });
    return () => controller.abort();
  }, [selected]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await accountRequest(selected ? `/api/me/support/${selected}` : '/api/me/support', 'POST', selected ? { body } : { subject, body });
      if (!response.ok) throw new Error(await responseError(response));
      const value: Thread = await response.json(); setSelected(value.id); setThread(value); setBody(''); setSubject('');
      await load(); setMessage('送信しました。');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '送信できませんでした。'); }
    finally { setBusy(false); }
  }
  async function resolve() {
    setBusy(true);
    try {
      const response = await accountRequest(`/api/me/support/${selected}`, 'PUT', { status: 'closed' });
      if (!response.ok) throw new Error(await responseError(response));
      setThread(await response.json()); await load();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '更新できませんでした。'); }
    finally { setBusy(false); }
  }
  return <section className="service-panel"><div className="section-title"><div><p className="eyebrow">{admin ? 'SUPPORT INBOX' : 'HELP & SUPPORT'}</p><h2>{admin ? '問い合わせ対応' : 'お問い合わせ'}</h2></div><button onClick={load}>一覧を更新</button></div>
    <p>このアプリの操作・不具合について運営に相談できます。大学への履修申請・教学課への問い合わせには送信されません。</p>
    <div className="support-layout"><aside><h3>{admin ? '届いた問い合わせ（最新200件）' : 'あなたの問い合わせ（最新100件）'}</h3>{!admin && <button disabled={busy} onClick={() => { if (body && !window.confirm('入力中のメッセージを破棄しますか？')) return; setSelected(''); setThread(null); setBody(''); }}>新しい問い合わせ</button>}{!tickets.length && <p>問い合わせはまだありません。</p>}
      {tickets.map((ticket) => <button className="ticket-row" key={ticket.id} disabled={busy} aria-pressed={selected === ticket.id} onClick={() => { if (body && !window.confirm('入力中のメッセージを破棄しますか？')) return; setSelected(ticket.id); setBody(''); }}><strong>{ticket.subject}</strong><span>{ticket.username} · {STATUS[ticket.status]}</span></button>)}</aside>
      <div>{thread && <><h3>{thread.subject}</h3><p>{STATUS[thread.status]}</p><ol className="support-thread">{thread.messages.map((item) => <li key={item.id} className={item.is_admin ? 'from-admin' : ''}><strong>{item.is_admin ? '運営からの回答' : 'お問い合わせ内容'}</strong><time>{new Date(item.created_at * 1000).toLocaleString('ja-JP')}</time><p>{item.body}</p></li>)}</ol>{admin && thread.status !== 'closed' && <button disabled={busy} onClick={resolve}>解決済みにする</button>}</>}
        {(!admin || thread) && <form onSubmit={submit}><fieldset disabled={busy || (!!selected && !thread)}>{!selected && <label>件名<input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={120} /></label>}<label>{selected ? admin ? '回答内容' : '追加のメッセージ' : 'お問い合わせ内容'}<textarea value={body} onChange={(e) => setBody(e.target.value)} required maxLength={5000} rows={6} /></label><p className="small">パスワードや大学ポータルのログイン情報は入力しないでください。</p><button className="btn-primary" type="submit">{busy ? '送信中…' : admin ? '回答を送信' : '送信する'}</button></fieldset></form>}
      </div></div><p role="status">{message}</p></section>;
}
