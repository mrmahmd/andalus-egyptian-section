insert into public.academic_weeks (academic_year, week_number, starts_on, ends_on, label, is_current)
values ('2026-2027', 1, date '2026-09-06', date '2026-09-10', 'Week 1 · 6–10 September 2026', true)
on conflict (academic_year, week_number) do update
set starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    label = excluded.label,
    is_current = true;
