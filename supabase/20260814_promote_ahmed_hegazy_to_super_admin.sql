-- The platform owner explicitly granted Ahmed Hegazy the same platform role
-- and permissions as the existing Super Admin.

do $$
declare
  target_user_id uuid;
begin
  select profile.user_id
  into target_user_id
  from public.profiles profile
  join public.staff_directory staff on staff.id = profile.staff_id
  where staff.id = '40807991-2b26-4aec-8219-9789beac417a'::uuid
    and profile.user_id = 'fcd5ff64-ee92-4ebc-85fd-82c526e19ad5'::uuid
    and staff.full_name = 'أحمد حجازي'
    and profile.username = 'ahmed.hegazi';

  if target_user_id is null then
    raise exception 'Ahmed Hegazy active profile was not found; no role was changed';
  end if;

  update public.profiles
  set role = 'super_admin',
      status = 'active',
      updated_at = now()
  where user_id = target_user_id;
end;
$$;
