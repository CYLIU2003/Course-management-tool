import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key,raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
for (const migration of (await readdir('supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()) {
  await db.exec(await readFile(`supabase/migrations/${migration}`, 'utf8'));
  if (migration === '202609050001_campus_note.sql') {
    await db.query('insert into public.reference_payloads values ($1,$2)', ['/api/curricula/kikai/2022', {}]);
    await db.query('insert into auth.users values ($1,$2)', ['00000000-0000-4000-a000-000000000099', {username:'legacy_student',departmentId:'kikai',entranceYear:2022}]);
    await db.query('insert into public.student_states(account_id,payload,revision) values ($1,$2,7)', ['00000000-0000-4000-a000-000000000099', {keep:'existing record'}]);
  }

}
const legacy = (await db.query("select p.onboarding_completed,s.payload,s.revision from public.profiles p join public.student_states s on s.account_id=p.id where p.username='legacy_student'")).rows[0];
assert.equal(legacy.onboarding_completed,true);
assert.equal(legacy.payload.keep,'existing record');
assert.equal(legacy.revision,7);
await db.query('delete from auth.users where id=$1',['00000000-0000-4000-a000-000000000099']);
const first = '00000000-0000-4000-a000-000000000001';
const second = '00000000-0000-4000-a000-000000000002';
for (const [id, username] of [[first, 'student_one'], [second, 'student_two']]) {
  await db.query('insert into auth.users values ($1,$2)', [id, id === first ? {username,departmentId:'kikai',entranceYear:2022,isAdmin:true} : {email:'test@example.com',name:'Google User',provider:'google'}]);
}
async function login(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}
async function rpc(route, verb='GET', payload={}) {
  return (await db.query('select public.campus_request($1,$2,$3) as value', [route,verb,payload])).rows[0].value;
}
function studentState() {
  return { departmentId:'kikai',entranceYear:2022,settings:{title:'時間割',days:['月'],periods:[{id:1,label:'1限',time:'09:20'}],showTime:true},
    allYearsData:Object.fromEntries(['1年次','2年次','3年次','4年次','M1','M2'].map(y=>[y,{timetable:{},quarterRanges:Object.fromEntries(['1Q','2Q','3Q','4Q'].map(q=>[q,{start:'',end:''}]))}])) };
}
await login(first);
assert.equal((await rpc('/api/me')).onboardingCompleted,false);
assert.equal((await rpc('/api/me')).username,null,'provider metadata does not complete onboarding');
await assert.rejects(rpc('/api/me/state','PUT',{state:studentState(),revision:0}), /Onboarding required/);
await assert.rejects(db.query("select public.campus_request_completed('/api/me')"), /permission denied/);
await assert.rejects(rpc('/api/me/onboarding','POST',{username:'student_one',departmentId:'missing',entranceYear:2022}), /Unknown cohort/);
await assert.rejects(rpc('/api/me/onboarding','POST',{username:'student_one',departmentId:'kikai',entranceYear:2022,isAdmin:true}), /Invalid onboarding fields/);
await rpc('/api/me/onboarding','POST',{username:'Student_One',departmentId:'kikai',entranceYear:2022});
assert.equal((await rpc('/api/me')).onboardingCompleted,true);
await assert.rejects(rpc('/api/me/onboarding','POST',{username:'overwrite',departmentId:'kikai',entranceYear:2022}), /already completed/);
assert.equal((await rpc('/api/me')).isAdmin,false,'signup metadata must never grant administrator rights');
await assert.rejects(rpc('/api/me/admin/analytics'), /Admin required/);
await assert.rejects(db.query('insert into public.admin_members values ($1)',[first]), /permission denied/);
assert.equal((await rpc('/api/me/state','PUT',{state:studentState(),revision:0})).revision,1);
await assert.rejects(rpc('/api/me/state','PUT',{state:studentState(),revision:0}), /Save conflict/);
await assert.rejects(rpc('/api/me/state','PUT',{state:{...studentState(),allYearsData:[]},revision:1}), /Invalid years/);
const ticket = await rpc('/api/me/support','POST',{subject:'動作確認',body:'科目を追加できません'});
assert.equal(ticket.messages.length,1);
await rpc('/api/me/events','POST',{page:'timetable'});
await rpc('/api/me/events','POST',{page:'timetable'});
await login(second);
await assert.rejects(rpc('/api/me/onboarding','POST',{username:'STUDENT_ONE',departmentId:'kikai',entranceYear:2022}), /Username unavailable/);
assert.equal((await rpc('/api/me')).onboardingCompleted,false);
await rpc('/api/me/onboarding','POST',{username:'student_two',departmentId:'kikai',entranceYear:2022});
assert.equal((await rpc('/api/me')).state,null);
assert.equal((await db.query('select * from public.student_states')).rows.length,0,'RLS must hide the first user state');
await assert.rejects(rpc('/api/me/support/'+ticket.id), /Ticket not found/);
await assert.rejects(rpc('/api/me/support/'+ticket.id,'POST',{body:'forged'}), /Ticket not found/);
await db.exec('reset role');
await db.query('insert into public.admin_members(account_id) select id from public.profiles where username=$1 on conflict (account_id) do nothing',['student_two']);
await login(second);
assert.equal((await rpc('/api/me')).isAdmin,true);
const answer = await rpc('/api/me/support/'+ticket.id,'POST',{body:'科目一覧から選択してください。'});
assert.equal(answer.status,'answered');
assert.equal(answer.messages.at(-1).is_admin,true,'same-second messages retain insertion order');
assert.equal(answer.messages.filter(m=>m.is_admin).length,1);
assert.equal((await rpc('/api/me/admin/analytics','GET',{days:7})).activeUsers,1);
assert.equal((await rpc('/api/me/admin/analytics','GET',{days:7})).pages[0].views,1);
await login(first);
assert.equal((await rpc('/api/me/support/'+ticket.id)).messages.length,2);
for (let i=0;i<8;i++) {
  const value={departmentId:'kikai',entranceYear:2022,isGeneral:true,takesTeacher:!!(i&1),takesHirameki:!!(i&2),takesTap:!!(i&4),individualNote:'',revision:i};
  assert.equal((await rpc('/api/me/profile','PUT',value)).revision,i+1);
}
await db.exec('reset role; set role anon');
assert.equal((await db.query('select * from public.reference_payloads')).rows.length,1);
await assert.rejects(rpc('/api/me'), /permission denied/);
await db.close();
console.log('PASS: PostgreSQL migration, RLS isolation, signup privilege injection, guarded writes, conflicts, support replies, analytics, 8 program combinations.');
