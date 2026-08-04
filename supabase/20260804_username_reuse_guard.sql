-- Keep usernames that were explicitly retired from being registered again.
create table if not exists public.retired_usernames (
  username text primary key check (username = lower(username)),
  retired_at timestamptz not null default now(),
  reason text not null default 'previously used'
);

alter table public.retired_usernames enable row level security;

create or replace function public.reject_reused_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.retired_usernames
    where username = lower(new.username)
  ) then
    raise exception 'This username has already been used and cannot be registered again.'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_reused_username() from public;

drop trigger if exists reject_retired_username on public.registration_requests;
create trigger reject_retired_username
before insert or update of username on public.registration_requests
for each row execute function public.reject_reused_username();
