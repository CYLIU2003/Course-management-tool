-- Preserve existing completed profiles; new OAuth users start without academic metadata.
alter table public.profiles alter column username drop not null;
alter table public.profiles alter column department_id drop not null;
alter table public.profiles alter column entrance_year drop not null;
alter table public.profiles add column onboarding_completed boolean not null default false;
update public.profiles set onboarding_completed=true
where username is not null and department_id is not null and entrance_year is not null;
alter table public.profiles add constraint completed_profile_fields
check(not onboarding_completed or (username is not null and department_id is not null and entrance_year is not null));

create or replace function public.campus_signup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Provider metadata is not an authority for department, username, or privileges.
  insert into public.profiles(id) values(new.id);
  return new;
end $$;

-- Keep the existing implementation private, behind the onboarding guard.
alter function public.campus_request(text,text,jsonb) rename to campus_request_completed;
create or replace function public.campus_request_completed(route text, verb text default 'GET', payload jsonb default '{}') returns jsonb
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
    update public.student_states set payload=campus_request_completed.payload->'state',revision=expected+1,updated_at=now_s where account_id=uid;
    update public.profiles set department_id=payload->'state'->>'departmentId',entrance_year=(payload->'state'->>'entranceYear')::int where id=uid;
    return jsonb_build_object('revision',expected+1);
  elsif route='/api/me/profile' then
    if verb='GET' then select p.payload into result from public.study_profiles p where account_id=uid; return result; end if;
    perform public.campus_assert(verb='PUT' and jsonb_typeof(payload)='object' and payload->'isGeneral'='true'::jsonb and jsonb_typeof(payload->'takesTeacher')='boolean' and jsonb_typeof(payload->'takesHirameki')='boolean' and jsonb_typeof(payload->'takesTap')='boolean' and jsonb_typeof(payload->'individualNote')='string' and length(payload->>'individualNote')<=1000 and (payload->>'revision') ~ '^[0-9]+$','Invalid profile');
    perform public.campus_assert(exists(select 1 from public.reference_payloads where path='/api/curricula/'||(campus_request_completed.payload->>'departmentId')||'/'||(campus_request_completed.payload->>'entranceYear')),'Unknown cohort');
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
revoke all on function public.campus_request_completed(text,text,jsonb) from public,anon,authenticated;

create function public.campus_request(route text, verb text default 'GET', payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); profile public.profiles; requested_name text; result jsonb;
begin
  if uid is null then raise exception using errcode='42501',message='Login required'; end if;
  select * into profile from public.profiles where id=uid for update;
  if not found then raise exception using errcode='42501',message='Profile missing'; end if;
  if route='/api/me/onboarding' and verb='POST' then
    if profile.onboarding_completed then raise exception using errcode='40001',message='Onboarding already completed'; end if;
    perform public.campus_assert(jsonb_typeof(payload)='object' and payload ?& array['username','departmentId','entranceYear'] and payload-array['username','departmentId','entranceYear']='{}','Invalid onboarding fields');
    perform public.campus_assert(jsonb_typeof(payload->'username')='string' and lower(payload->>'username') ~ '^[a-z0-9_-]{3,32}$','Invalid username');
    perform public.campus_assert(jsonb_typeof(payload->'departmentId')='string' and jsonb_typeof(payload->'entranceYear')='number' and (payload->>'entranceYear') ~ '^[0-9]{4}$','Invalid cohort');
    perform public.campus_assert(exists(select 1 from public.reference_payloads where path='/api/curricula/'||(campus_request.payload->>'departmentId')||'/'||(campus_request.payload->>'entranceYear')),'Unknown cohort');
    requested_name:=lower(payload->>'username');
    begin
      update public.profiles set username=requested_name,department_id=payload->>'departmentId',entrance_year=(payload->>'entranceYear')::int,onboarding_completed=true where id=uid;
    exception when unique_violation then
      raise exception using errcode='22023',message='Username unavailable';
    end;
    return jsonb_build_object('ok',true);
  end if;
  if not profile.onboarding_completed then
    if route='/api/me' and verb='GET' then
      return jsonb_build_object('id',uid,'username',null,'departmentId',null,'entranceYear',null,'onboardingCompleted',false,'isAdmin',false,'state',null,'revision',0,'csrfToken','supabase-jwt');
    end if;
    raise exception using errcode='42501',message='Onboarding required';
  end if;
  result:=public.campus_request_completed(route,verb,payload);
  if route='/api/me' and verb='GET' then result:=result||'{"onboardingCompleted":true}'::jsonb; end if;
  return result;
end $$;
revoke all on function public.campus_request(text,text,jsonb) from public,anon;
grant execute on function public.campus_request(text,text,jsonb) to authenticated;
