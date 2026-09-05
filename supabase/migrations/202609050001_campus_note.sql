-- Public reference data is imported from audited SQLite; private writes use guarded RPCs.
create table public.reference_payloads(path text primary key, payload jsonb not null);
create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check(username ~ '^[a-z0-9_-]{3,32}$'),
  department_id text not null, entrance_year integer not null,
  created_at bigint not null default extract(epoch from now())::bigint
);
create table public.student_states(account_id uuid primary key references public.profiles(id) on delete cascade,
  payload jsonb, revision integer not null default 0, updated_at bigint not null default extract(epoch from now())::bigint);
create table public.study_profiles(account_id uuid primary key references public.profiles(id) on delete cascade,
  payload jsonb not null, revision integer not null);
create table public.admin_members(account_id uuid primary key references public.profiles(id) on delete cascade);
create table public.usage_events(id uuid primary key default gen_random_uuid(), account_id uuid not null references public.profiles(id) on delete cascade,
  event_name text not null check(event_name in ('home','timetable','grades','handbooks','settings','requirements')),
  created_at bigint not null default extract(epoch from now())::bigint);
create index usage_date_idx on public.usage_events(created_at,account_id);
create table public.support_tickets(id uuid primary key default gen_random_uuid(), account_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check(length(subject) between 1 and 120), status text not null check(status in ('open','answered','closed')),
  created_at bigint not null, updated_at bigint not null);
create index support_owner_idx on public.support_tickets(account_id,updated_at);
create table public.support_messages(sequence bigint generated always as identity unique, id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id), is_admin boolean not null, body text not null check(length(body) between 1 and 5000), created_at bigint not null);
create index support_thread_idx on public.support_messages(ticket_id,created_at);

alter table public.reference_payloads enable row level security;
alter table public.profiles enable row level security;
alter table public.student_states enable row level security;
alter table public.study_profiles enable row level security;
alter table public.admin_members enable row level security;
alter table public.usage_events enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.reference_payloads,public.profiles,public.student_states,public.study_profiles,public.admin_members,public.usage_events,public.support_tickets,public.support_messages from anon,authenticated;
grant select on public.reference_payloads to anon,authenticated;
create policy reference_read on public.reference_payloads for select to anon,authenticated using(true);
grant select on public.profiles,public.student_states,public.study_profiles to authenticated;
create policy profile_owner on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy state_owner on public.student_states for select to authenticated using(account_id=(select auth.uid()));
create policy study_owner on public.study_profiles for select to authenticated using(account_id=(select auth.uid()));

create function public.campus_assert(ok boolean, message text) returns void
language plpgsql set search_path='' as $$ begin
  if ok is not true then raise exception using message=message,errcode='22023'; end if;
end $$;

create function public.campus_validate_state(value jsonb) returns void
language plpgsql set search_path='' as $$
declare settings jsonb; y jsonb; q jsonb; cells jsonb; cell jsonb; dates jsonb; period jsonb; pair record;
begin
  perform public.campus_assert(jsonb_typeof(value)='object' and octet_length(value::text)<=1048576,'Invalid state');
  perform public.campus_assert(value ?& array['departmentId','entranceYear','settings','allYearsData'] and value - array['departmentId','entranceYear','settings','allYearsData']='{}','Invalid state fields');
  perform public.campus_assert(jsonb_typeof(value->'departmentId')='string' and jsonb_typeof(value->'entranceYear')='number','Invalid cohort');
  perform public.campus_assert(exists(select 1 from public.reference_payloads where path='/api/curricula/'||(value->>'departmentId')||'/'||(value->>'entranceYear')),'Unknown cohort');
  settings:=value->'settings';
  perform public.campus_assert(jsonb_typeof(settings)='object' and settings ?& array['title','days','periods','showTime'] and settings-array['title','days','periods','showTime']='{}','Invalid settings');
  perform public.campus_assert(jsonb_typeof(settings->'title')='string' and length(settings->>'title')<=200 and jsonb_typeof(settings->'showTime')='boolean','Invalid settings');
  perform public.campus_assert(jsonb_typeof(settings->'days')='array' and jsonb_typeof(settings->'periods')='array','Invalid schedule');
  perform public.campus_assert(jsonb_array_length(settings->'days') between 1 and 7 and jsonb_array_length(settings->'periods') between 1 and 20,'Invalid schedule');
  for q in select * from jsonb_array_elements(settings->'days') loop
    perform public.campus_assert(jsonb_typeof(q)='string' and length(q#>>'{}') between 1 and 10,'Invalid day');
  end loop;
  perform public.campus_assert((select count(distinct x) from jsonb_array_elements(settings->'days') x)=jsonb_array_length(settings->'days'),'Duplicate day');
  for period in select * from jsonb_array_elements(settings->'periods') loop
    perform public.campus_assert(jsonb_typeof(period)='object' and period ?& array['id','label','time'] and period-array['id','label','time']='{}','Invalid period');
    perform public.campus_assert((period->>'id') ~ '^[0-9]+$' and (period->>'id')::int between 1 and 99 and jsonb_typeof(period->'label')='string' and jsonb_typeof(period->'time')='string' and length(period->>'label')<=100 and length(period->>'time')<=100,'Invalid period');
  end loop;
  perform public.campus_assert((select count(distinct x->>'id') from jsonb_array_elements(settings->'periods') x)=jsonb_array_length(settings->'periods'),'Duplicate period');
  perform public.campus_assert(jsonb_typeof(value->'allYearsData')='object' and (value->'allYearsData') ?& array['1年次','2年次','3年次','4年次','M1','M2'] and (value->'allYearsData')-array['1年次','2年次','3年次','4年次','M1','M2']='{}','Invalid years');
  for y in select v from jsonb_each(value->'allYearsData') x(k,v) loop
    perform public.campus_assert(jsonb_typeof(y)='object' and y ?& array['timetable','quarterRanges'] and y-array['timetable','quarterRanges']='{}','Invalid year');
    perform public.campus_assert(jsonb_typeof(y->'quarterRanges')='object' and (y->'quarterRanges') ?& array['1Q','2Q','3Q','4Q'] and (y->'quarterRanges')-array['1Q','2Q','3Q','4Q']='{}','Invalid dates');
    for dates in select v from jsonb_each(y->'quarterRanges') x(k,v) loop
      perform public.campus_assert(jsonb_typeof(dates)='object' and dates ?& array['start','end'] and dates-array['start','end']='{}' and jsonb_typeof(dates->'start')='string' and jsonb_typeof(dates->'end')='string' and length(dates->>'start')<=10 and length(dates->>'end')<=10,'Invalid dates');
    end loop;
    perform public.campus_assert(jsonb_typeof(y->'timetable')='object' and (y->'timetable')-array['1Q','2Q','3Q','4Q']='{}','Invalid timetable');
    for q in select v from jsonb_each(y->'timetable') x(k,v) loop
      perform public.campus_assert(jsonb_typeof(q)='object','Invalid quarter');
      perform public.campus_assert((select count(*) from jsonb_each(q))<=7,'Too many days');
      for pair in select * from jsonb_each(q) loop
        cells:=pair.value;
        perform public.campus_assert(length(pair.key)<=10 and jsonb_typeof(cells)='object','Invalid cells');
        perform public.campus_assert((select count(*) from jsonb_each(cells))<=20,'Too many periods');
        for pair in select * from jsonb_each(cells) loop
          cell:=pair.value;
          perform public.campus_assert(pair.key ~ '^[0-9]+$' and pair.key::int between 1 and 99,'Invalid period');
          if cell='null'::jsonb then continue; end if;
          perform public.campus_assert(jsonb_typeof(cell)='object' and jsonb_typeof(cell->'title')='string' and length(cell->>'title')<=300,'Invalid course');
          if cell ? 'credits' then perform public.campus_assert(jsonb_typeof(cell->'credits')='number' and (cell->>'credits')::numeric>0 and (cell->>'credits')::numeric<=20,'Invalid credits'); end if;
          perform public.campus_assert(not(cell ? 'grade') or cell->>'grade' in ('秀','優','良','可','不可','未履修'),'Invalid grade');
          for pair in select * from jsonb_each(cell-array['credits','sourceOffering']) loop
            perform public.campus_assert(jsonb_typeof(pair.value)='string' and length(pair.value#>>'{}')<=5000,'Invalid course property');
          end loop;
          if cell ? 'sourceOffering' then
            perform public.campus_assert(jsonb_typeof(cell->'sourceOffering')='object','Invalid offering');
            for pair in select * from jsonb_each(cell->'sourceOffering') loop
              perform public.campus_assert(jsonb_typeof(pair.value) in ('string','number'),'Invalid offering property');
            end loop;
          end if;
        end loop;
      end loop;
    end loop;
  end loop;
end $$;

create function public.campus_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare meta jsonb:=new.raw_user_meta_data;
begin
  perform public.campus_assert(jsonb_typeof(meta->'username')='string' and lower(meta->>'username') ~ '^[a-z0-9_-]{3,32}$','Invalid username');
  perform public.campus_assert(exists(select 1 from public.reference_payloads where path='/api/curricula/'||(meta->>'departmentId')||'/'||(meta->>'entranceYear')),'Unknown cohort');
  insert into public.profiles(id,username,department_id,entrance_year) values(new.id,lower(meta->>'username'),meta->>'departmentId',(meta->>'entranceYear')::int);
  return new;
end $$;
create trigger campus_signup after insert on auth.users for each row execute function public.campus_signup();

create function public.campus_request(route text, verb text default 'GET', payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); admin boolean; profile public.profiles; stored public.student_states; ticket public.support_tickets;
  now_s bigint:=extract(epoch from now())::bigint; ticket_id uuid; result jsonb; expected int; days int; cutoff bigint; message text; subject text; status text;
begin
  if uid is null then raise exception using errcode='42501',message='Login required'; end if;
  select * into profile from public.profiles where id=uid;
  if not found then raise exception using errcode='42501',message='Profile missing'; end if;
  admin:=exists(select 1 from public.admin_members where account_id=uid);
  if route like '/api/me/admin/%' and not admin then raise exception using errcode='42501',message='Admin required'; end if;
  if route='/api/me' and verb='GET' then
    select * into stored from public.student_states where account_id=uid;
    return jsonb_build_object('id',uid,'username',profile.username,'departmentId',profile.department_id,'entranceYear',profile.entrance_year,'isAdmin',admin,'state',stored.payload,'revision',coalesce(stored.revision,0),'csrfToken','supabase-jwt');
  elsif route='/api/me/validate-state' and verb='POST' then
    perform public.campus_validate_state(payload); return '{"ok":true}';
  elsif route='/api/me/state' and verb='PUT' then
    perform public.campus_validate_state(payload->'state');
    perform public.campus_assert(jsonb_typeof(payload->'revision')='number' and (payload->>'revision') ~ '^[0-9]+$','Invalid revision');
    expected:=(payload->>'revision')::int;
    insert into public.student_states(account_id) values(uid) on conflict do nothing;
    select * into stored from public.student_states where account_id=uid for update;
    if stored.revision<>expected then raise exception using errcode='40001',message='Save conflict'; end if;
    update public.student_states set payload=campus_request.payload->'state',revision=expected+1,updated_at=now_s where account_id=uid;
    update public.profiles set department_id=payload->'state'->>'departmentId',entrance_year=(payload->'state'->>'entranceYear')::int where id=uid;
    return jsonb_build_object('revision',expected+1);
  elsif route='/api/me/profile' then
    if verb='GET' then select p.payload into result from public.study_profiles p where account_id=uid; return result; end if;
    perform public.campus_assert(verb='PUT' and jsonb_typeof(payload)='object' and payload->'isGeneral'='true'::jsonb and jsonb_typeof(payload->'takesTeacher')='boolean' and jsonb_typeof(payload->'takesHirameki')='boolean' and jsonb_typeof(payload->'takesTap')='boolean' and jsonb_typeof(payload->'individualNote')='string' and length(payload->>'individualNote')<=1000 and (payload->>'revision') ~ '^[0-9]+$','Invalid profile');
    perform public.campus_assert(exists(select 1 from public.reference_payloads where path='/api/curricula/'||(campus_request.payload->>'departmentId')||'/'||(campus_request.payload->>'entranceYear')),'Unknown cohort');
    perform 1 from public.profiles where id=uid for update;
    select revision into expected from public.study_profiles where account_id=uid;
    if coalesce(expected,0)<>(payload->>'revision')::int then raise exception using errcode='40001',message='Save conflict'; end if;
    result:=payload||jsonb_build_object('revision',coalesce(expected,0)+1);
    insert into public.study_profiles values(uid,result,coalesce(expected,0)+1) on conflict(account_id) do update set payload=excluded.payload,revision=excluded.revision;
    return result;
  elsif route='/api/me/events' and verb='POST' then
    perform public.campus_assert(payload->>'page' in ('home','timetable','grades','handbooks','settings','requirements'),'Invalid event');
    perform 1 from public.profiles where id=uid for update;
    delete from public.usage_events where created_at<now_s-90*86400;
    if not exists(select 1 from public.usage_events where account_id=uid and event_name=payload->>'page' and created_at>now_s-10) then
      insert into public.usage_events(account_id,event_name,created_at) values(uid,payload->>'page',now_s);
    end if;
    return '{"ok":true}';
  elsif route='/api/me/admin/analytics' and verb='GET' then
    days:=coalesce((payload->>'days')::int,30); perform public.campus_assert(days in (7,30,90),'Invalid period'); cutoff:=now_s-days*86400;
    return jsonb_build_object('days',days,'registeredUsers',(select count(*) from public.profiles),'activeUsers',(select count(distinct account_id) from public.usage_events where created_at>=cutoff),
      'pages',coalesce((select jsonb_agg(x) from (select event_name as page,count(*) as views,count(distinct account_id) as users from public.usage_events where created_at>=cutoff group by event_name order by views desc) x),'[]'),
      'daily',coalesce((select jsonb_agg(x) from (select to_char(to_timestamp(created_at) at time zone 'Asia/Tokyo','YYYY-MM-DD') as day,count(*) as views,count(distinct account_id) as users from public.usage_events where created_at>=cutoff group by day order by day) x),'[]'),
      'cohorts',coalesce((select jsonb_agg(x) from (select department_id as department,entrance_year as year,count(*) as users from public.profiles group by department_id,entrance_year order by users desc) x),'[]'),
      'support',coalesce((select jsonb_agg(x) from (select t.status,count(*) as count from public.support_tickets t group by t.status) x),'[]'));
  elsif route in ('/api/me/support','/api/me/admin/support') and verb='GET' then
    return coalesce((select jsonb_agg(x) from (select t.id,t.subject,t.status,t.created_at,t.updated_at,p.username from public.support_tickets t join public.profiles p on p.id=t.account_id where route='/api/me/admin/support' or t.account_id=uid order by t.updated_at desc limit 200) x),'[]');
  elsif route='/api/me/support' and verb='POST' then
    subject:=trim(payload->>'subject'); message:=trim(payload->>'body');
    perform public.campus_assert(jsonb_typeof(payload->'subject')='string' and length(subject) between 1 and 120 and jsonb_typeof(payload->'body')='string' and length(message) between 1 and 5000,'Invalid message');
    perform 1 from public.profiles where id=uid for update;
    perform public.campus_assert((select count(*) from public.support_tickets where account_id=uid and created_at>now_s-3600)<10,'Too many tickets');
    insert into public.support_tickets(account_id,subject,status,created_at,updated_at) values(uid,subject,'open',now_s,now_s) returning id into ticket_id;
    insert into public.support_messages(ticket_id,author_id,is_admin,body,created_at) values(ticket_id,uid,false,message,now_s);
  elsif route like '/api/me/support/%' then
    ticket_id:=split_part(route,'/',5)::uuid;
    select * into ticket from public.support_tickets where id=ticket_id for update;
    if not found or (ticket.account_id<>uid and not admin) then raise exception using errcode='P0002',message='Ticket not found'; end if;
    if verb='POST' then
      message:=trim(payload->>'body'); perform public.campus_assert(jsonb_typeof(payload->'body')='string' and length(message) between 1 and 5000,'Invalid message');
      perform 1 from public.profiles where id=uid for update;
      perform public.campus_assert((select count(*) from public.support_messages where author_id=uid and created_at>now_s-3600)<60,'Too many messages');
      insert into public.support_messages(ticket_id,author_id,is_admin,body,created_at) values(ticket_id,uid,admin,message,now_s);
      update public.support_tickets set status=case when admin then 'answered' else 'open' end,updated_at=now_s where id=ticket_id;
    elsif verb='PUT' then
      if not admin then raise exception using errcode='42501',message='Admin required'; end if;
      perform public.campus_assert(payload->>'status' in ('open','answered','closed'),'Invalid status');
      update public.support_tickets set status=payload->>'status',updated_at=now_s where id=ticket_id;
    else perform public.campus_assert(verb='GET','Invalid method'); end if;
  else raise exception using errcode='P0002',message='Route not found';
  end if;
  select to_jsonb(t)||jsonb_build_object('messages',coalesce((select jsonb_agg(m order by m.sequence) from (select id,is_admin,body,created_at,sequence from public.support_messages where support_messages.ticket_id=t.id) m),'[]')) into result from public.support_tickets t where t.id=ticket_id;
  return result;
end $$;
revoke all on function public.campus_assert(boolean,text),public.campus_validate_state(jsonb),public.campus_signup(),public.campus_request(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.campus_request(text,text,jsonb) to authenticated;
