import { AVAILABLE_DEPARTMENTS } from '../core/departments';
import { apiFetch } from '../api/client';
import { useEffect, useState } from 'react';
import { responseError } from '../api/account';
import SupportDesk from './SupportDesk';
import OfferingBrowser from './OfferingBrowser';

interface Analytics { days: number; registeredUsers: number; activeUsers: number; pages: { page: string; views: number; users: number }[]; daily: { day: string; views: number; users: number }[]; cohorts: { department: string; year: number; users: number }[]; support: { status: string; count: number }[] }
const PAGES: Record<string, string> = { home: 'ホーム', timetable: '時間割', grades: '成績・単位', handbooks: '履修ガイド', settings: '設定', requirements: '履修条件' };

export default function AdminDashboard() {
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setAnalytics(null); setError('');
    apiFetch(`/api/me/admin/analytics?days=${days}`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(await responseError(response));
      const value: Analytics = await response.json(); if (!controller.signal.aborted) setAnalytics(value);
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '取得できませんでした。'); });
    return () => controller.abort();
  }, [days, attempt]);
  const maxUsers = Math.max(1, ...analytics?.daily.map((day) => day.users) ?? []);
  return <div className="admin-workspace"><section className="service-panel"><div className="section-title"><div><p className="eyebrow">CAMPUS NOTE / ADMIN</p><h1>利用状況</h1><p>学生の利用傾向と問い合わせを確認できます。</p></div><div><label>集計期間 <select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>直近7日</option><option value={30}>直近30日</option><option value={90}>直近90日</option></select></label><button onClick={() => setAttempt((n) => n + 1)}>更新</button></div></div>
      {error && <p role="alert">{error}</p>}{!analytics && !error && <p role="status">集計中…</p>}
      {analytics && <><div className="admin-metrics"><article><span>登録ユーザー</span><strong>{analytics.registeredUsers}</strong><small>全期間</small></article><article><span>利用したユーザー</span><strong>{analytics.activeUsers}</strong><small>期間内に画面を開いた人数</small></article><article><span>対応待ち</span><strong>{analytics.support.find((item) => item.status === 'open')?.count ?? 0}</strong><small>全期間の未回答問い合わせ</small></article></div>
        <div className="analytics-grid"><section><h2>日別の利用人数</h2><p className="small">日本時間。棒のない日は記録なし。画面を開いた重複しないアカウント数。</p>{!analytics.daily.length && <p>まだ利用履歴がありません。</p>}<div className="daily-bars">{analytics.daily.map((day) => <div key={day.day}><time>{day.day.slice(5)}</time><div className="bar-track"><span style={{ width: `${day.users / maxUsers * 100}%` }} /></div><strong>{day.users}人</strong></div>)}</div></section>
          <section><h2>利用された画面</h2><table><thead><tr><th>画面</th><th>表示回数</th><th>人数</th></tr></thead><tbody>{analytics.pages.map((page) => <tr key={page.page}><th>{PAGES[page.page] ?? page.page}</th><td>{page.views}</td><td>{page.users}</td></tr>)}</tbody></table><p className="small">同じ画面の10秒以内の再表示は1回として集計します。</p></section></div>
        <h2>登録者の学科・入学年度</h2><div className="table-scroll"><table><thead><tr><th>学科</th><th>入学年度</th><th>登録人数</th></tr></thead><tbody>{analytics.cohorts.map((cohort) => <tr key={`${cohort.department}:${cohort.year}`}><th>{AVAILABLE_DEPARTMENTS.find((d) => d.id === cohort.department)?.name ?? cohort.department}</th><td>{cohort.year}</td><td>{cohort.users}</td></tr>)}</tbody></table></div><p className="small">履歴は画面名と日時のみを90日間保存します。成績・時間割の内容やパスワードはこの分析に収集しません。</p></>}
    </section><SupportDesk admin /><OfferingBrowser admin /></div>;
}
