-- Preserve legacy state until the student confirms the year mapping.
create or replace function public.campus_validate_state(value jsonb) returns void
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
  perform public.campus_assert(jsonb_typeof(value->'allYearsData')='object' and (select count(*) from jsonb_each(value->'allYearsData')) between 1 and 30 and (((value->'allYearsData') ?& array['1年次','2年次','3年次','4年次','M1','M2'] and (value->'allYearsData')-array['1年次','2年次','3年次','4年次','M1','M2']='{}') or not exists(select 1 from jsonb_object_keys(value->'allYearsData') k where k !~ '^(20[0-9]{2}|2100)$')),'Invalid years');
  for y in select v from jsonb_each(value->'allYearsData') x(k,v) loop
    perform public.campus_assert(jsonb_typeof(y)='object' and y ?& array['timetable','quarterRanges'] and y-array['timetable','quarterRanges','departmentId','entranceYear']='{}','Invalid year');
    if y ? 'departmentId' or y ? 'entranceYear' then
      perform public.campus_assert(jsonb_typeof(y->'departmentId')='string' and jsonb_typeof(y->'entranceYear')='number' and exists(select 1 from public.reference_payloads where path='/api/curricula/'||(y->>'departmentId')||'/'||(y->>'entranceYear')), 'Unknown year cohort');
    end if;
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
-- Prevent a stale pre-migration client from replacing explicitly dated records.
create or replace function public.campus_guard_year_format() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.payload is not null and not exists(select 1 from jsonb_object_keys(old.payload->'allYearsData') k where k !~ '^(20[0-9]{2}|2100)$')
    and exists(select 1 from jsonb_object_keys(new.payload->'allYearsData') k where k !~ '^(20[0-9]{2}|2100)$') then
    raise exception using errcode='40001',message='Reload the app: academic year format has changed';
  end if;
  return new;
end $$;
revoke all on function public.campus_guard_year_format() from public,anon,authenticated;
create trigger campus_guard_year_format before update on public.student_states for each row execute function public.campus_guard_year_format();
