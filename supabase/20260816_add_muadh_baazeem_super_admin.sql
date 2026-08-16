-- Add Muadh Baazeem to the approved staff directory and route his approved
-- account to the protected Super Admin workspace.
-- Idempotent: safe to run more than once in Supabase SQL Editor.

insert into public.staff_directory (full_name, account_kind, administrative_role, is_active)
values ('معاذ باعظيم', 'admin', 'Super Admin', true)
on conflict (full_name, account_kind) do update
set administrative_role = excluded.administrative_role,
    is_active = true;

create or replace function public.activate_approved_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff_record public.staff_directory%rowtype;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select * into staff_record
    from public.staff_directory
    where id = new.staff_id and is_active = true;

    if not found then
      raise exception 'Staff directory entry is not active';
    end if;

    insert into public.profiles (
      user_id, staff_id, username, display_name, role, department_id,
      approved_by, approved_at
    ) values (
      new.user_id,
      new.staff_id,
      new.username,
      staff_record.full_name,
      case
        when staff_record.account_kind = 'admin' and staff_record.administrative_role = 'Super Admin' then 'super_admin'
        when staff_record.account_kind = 'admin' then 'admin'
        else 'teacher'
      end,
      staff_record.department_id,
      new.reviewed_by,
      coalesce(new.reviewed_at, now())
    )
    on conflict (user_id) do update set
      staff_id = excluded.staff_id,
      username = excluded.username,
      display_name = excluded.display_name,
      role = excluded.role,
      department_id = excluded.department_id,
      status = 'active',
      approved_by = excluded.approved_by,
      approved_at = excluded.approved_at,
      updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function public.activate_approved_registration() from public;

