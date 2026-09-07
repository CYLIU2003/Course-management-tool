-- An optional course variant is bound to the profile's admission cohort.
-- Existing profiles and callers without this field remain compatible.
create or replace function public.campus_validate_degree_variant()
returns trigger language plpgsql security definer set search_path=public as $$
declare chosen text;
begin
  if not (new.payload ? 'degreeVariant') or new.payload->'degreeVariant' = 'null'::jsonb then
    return new;
  end if;
  perform public.campus_assert(jsonb_typeof(new.payload->'degreeVariant')='string', 'Invalid degree variant');
  chosen := new.payload->>'degreeVariant';
  if chosen = '' then return new; end if;
  perform public.campus_assert(exists (
    select 1 from public.reference_payloads r,
      lateral jsonb_array_elements(coalesce(r.payload->'degreeRequirementSets', '[]'::jsonb)) rule
    where r.path='/api/curricula/'||(new.payload->>'departmentId')||'/'||(new.payload->>'entranceYear')
      and rule->>'variant'=chosen
  ), 'Unknown degree variant for admission cohort');
  return new;
end;
$$;
revoke all on function public.campus_validate_degree_variant() from public, anon, authenticated;
drop trigger if exists campus_degree_variant on public.study_profiles;
create trigger campus_degree_variant before insert or update on public.study_profiles
for each row execute function public.campus_validate_degree_variant();
