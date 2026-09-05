import { apiFetch } from '../../api/client';
import { accountRequest } from '../../api/account';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_OPTIONS, type StudyOptions } from '../../core/handbooks/profile';
interface Profile extends StudyOptions { departmentId: string; entranceYear: number; individualNote: string; revision: number }

export default function StudentProfile({ departmentId, entranceYear, onChange }: {
  departmentId: string; entranceYear: number; onChange: (options: StudyOptions) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const saveController = useRef<AbortController | null>(null);
  useEffect(() => () => saveController.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    onChange(DEFAULT_OPTIONS);
    apiFetch(`/api/me/profile`, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error('履修区分を読み込めませんでした。');
      const value: Profile = await response.json() ?? { ...DEFAULT_OPTIONS, departmentId, entranceYear, individualNote: '', revision: 0 };
      if (!controller.signal.aborted) { setProfile(value); onChange(value); setMessage(value.revision ? '保存済み' : '履修区分を選択して保存してください。'); }
    }).catch((error: unknown) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '読み込みに失敗しました。'); });
    return () => controller.abort();
  }, [departmentId, entranceYear, onChange, attempt]);

  async function save() {
    const controller = new AbortController();
    saveController.current = controller;
    setSaving(true);
    try {
      const response = await accountRequest('/api/me/profile', 'PUT', { ...profile, departmentId, entranceYear }, controller.signal);
      if (!response.ok) throw new Error(response.status === 409 ? '別画面で変更されています。再読み込みしてください。' : '保存できませんでした。再度お試しください。');
      const saved: Profile = await response.json();
      if (controller.signal.aborted) return;
      setProfile(saved); onChange(saved); setMessage('保存済み');
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : '読み込みに失敗しました。'); }
    finally { if (!controller.signal.aborted) setSaving(false); }
  }
  return <fieldset className="handbook-notice study-profile"><legend>履修するプログラム（複数選択可）</legend>
    {profile && <><div className="handbook-tabs">{([
      ['takesHirameki', 'ひらめきを履修する'], ['takesTap', 'TAP／ATAPに参加する'], ['takesTeacher', '教職課程を履修する'],
    ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={profile[key]} disabled={saving}
      onChange={(event) => { setProfile({ ...profile, [key]: event.target.checked }); setMessage('未保存'); }} />{label}</label>)}</div>
      <button type="button" disabled={saving} onClick={save}>履修区分を保存</button></>}
    <span role="status"> {message} </span><button type="button" disabled={saving} onClick={() => setAttempt((value) => value + 1)}>保存内容を再読み込み</button>
  </fieldset>;
}
