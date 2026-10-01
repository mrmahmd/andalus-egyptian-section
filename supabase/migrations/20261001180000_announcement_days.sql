begin;

alter table public.weekly_plan_announcements
  add column if not exists day_of_week smallint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.weekly_plan_announcements'::regclass
      and conname = 'weekly_plan_announcements_day_of_week_check'
  ) then
    alter table public.weekly_plan_announcements
      add constraint weekly_plan_announcements_day_of_week_check
      check (day_of_week between 0 and 4);
  end if;
end;
$$;

alter table public.weekly_plan_announcements
  drop constraint if exists weekly_plan_announcements_week_id_class_id_key;

create unique index if not exists weekly_plan_announcements_week_class_day_key
  on public.weekly_plan_announcements (week_id, class_id, day_of_week);

commit;
