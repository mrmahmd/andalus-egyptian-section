-- One-time, guarded production data repair for Grade 5 B / Week 5.
-- The timetable now assigns Tuesday period 1 to Mohamed Farid (English AL),
-- but an approved Arabic entry by Ahmed Hassan still occupies that position.
-- Preserve the original row in a private backup table before freeing the slot.
-- This script does not change Week 4 or Ahmed Hassan's approval.
begin;

create table if not exists private.plan_entry_repair_backups (
  entry_id uuid primary key,
  entry_snapshot jsonb not null,
  repair_reason text not null,
  archived_at timestamptz not null default now()
);
alter table private.plan_entry_repair_backups enable row level security;
revoke all on private.plan_entry_repair_backups from public, anon, authenticated, service_role;

do $$
declare
  displaced public.plan_entries%rowtype;
  removed_count integer;
begin
  select * into displaced
  from public.plan_entries
  where id = '03de8aa9-5d10-4162-857d-05e7dae37a3c'::uuid
  for update;

  if not found then
    raise exception 'Expected approved Grade 5 B Week 5 legacy entry is absent; no repair was made.';
  end if;

  if displaced.weekly_plan_id <> '0751ad22-67e0-4fee-a62e-f01655c9b523'::uuid
    or displaced.timetable_slot_id <> '9ef350b1-88ef-4663-a048-3d6ce35cc722'::uuid
    or displaced.teacher_id <> 'bcbf1bc8-a4b3-4509-a9a0-466f3d7b954b'::uuid
    or displaced.subject_id <> 'b663397d-5492-4952-aa6a-0c124a2e8824'::uuid
    or displaced.day_of_week <> 2 or displaced.period_number <> 1
    or not exists (
      select 1
      from public.weekly_plans plan_record
      join public.school_classes class_record on class_record.id = plan_record.class_id
      join public.academic_weeks week_record on week_record.id = plan_record.week_id
      join public.timetable_slots slot on slot.id = displaced.timetable_slot_id
      join public.subjects timetable_subject on timetable_subject.id = slot.subject_id
      where plan_record.id = displaced.weekly_plan_id
        and class_record.grade = 5 and class_record.section = 'B'
        and week_record.week_number = 5
        and slot.day_of_week = 2 and slot.period_number = 1
        and slot.teacher_id = 'f81f4543-3cdf-4131-91b4-f4a17204f139'::uuid
        and timetable_subject.name_en = 'English AL'
    )
    or not exists (
      select 1 from public.plan_submissions submission
      where submission.weekly_plan_id = displaced.weekly_plan_id
        and submission.teacher_id = displaced.teacher_id
        and submission.subject_id = displaced.subject_id
        and submission.status = 'approved'
    )
    or not exists (
      select 1 from public.plan_entries retained
      where retained.weekly_plan_id = displaced.weekly_plan_id
        and retained.teacher_id = displaced.teacher_id
        and retained.subject_id = displaced.subject_id
        and retained.day_of_week = 2 and retained.period_number = 8
        and retained.classwork = displaced.classwork
        and retained.homework = displaced.homework
        and retained.classera_notes = displaced.classera_notes
    ) then
    raise exception 'The Grade 5 B Week 5 entry or its identical approved copy changed; inspect before repair.';
  end if;

  insert into private.plan_entry_repair_backups (entry_id, entry_snapshot, repair_reason)
  values (displaced.id, to_jsonb(displaced), 'Grade 5 B Week 5 Tuesday period 1: old Arabic entry displaced by verified timetable change')
  on conflict (entry_id) do nothing;

  if not exists (
    select 1 from private.plan_entry_repair_backups backup
    where backup.entry_id = displaced.id
      and backup.entry_snapshot = to_jsonb(displaced)
  ) then
    raise exception 'Backup mismatch; the active entry was not removed.';
  end if;

  delete from public.plan_entries
  where id = displaced.id
    and weekly_plan_id = displaced.weekly_plan_id
    and teacher_id = displaced.teacher_id
    and subject_id = displaced.subject_id
    and day_of_week = 2 and period_number = 1;
  get diagnostics removed_count = row_count;
  if removed_count <> 1 then
    raise exception 'Expected to remove exactly one displaced entry; removed %.', removed_count;
  end if;
end;
$$;

commit;

-- The snapshot retains every original plan_entries column. Restore only after
-- reconciling the timetable and ensuring the position has not been reused.
