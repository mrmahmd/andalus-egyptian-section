-- Official Term 1 calendar for the 2026–2027 academic year.
-- Safe to re-run: existing week numbers are updated, new ones are inserted.
-- It does not delete plans, submissions, teachers, classes, or timetable data.

update public.academic_weeks
set is_current = false
where academic_year = '2026-2027';

insert into public.academic_weeks (academic_year, week_number, starts_on, ends_on, label, is_current)
values
  ('2026-2027', 1,  '2026-09-06', '2026-09-12', 'Week 1 · 6–12 September 2026', false),
  ('2026-2027', 2,  '2026-09-13', '2026-09-19', 'Week 2 · 13–19 September 2026', false),
  ('2026-2027', 3,  '2026-09-20', '2026-09-26', 'Week 3 · 20–26 September 2026', false),
  ('2026-2027', 4,  '2026-09-27', '2026-10-03', 'Week 4 · 27 September–3 October 2026', false),
  ('2026-2027', 5,  '2026-10-04', '2026-10-10', 'Week 5 · 4–10 October 2026', false),
  ('2026-2027', 6,  '2026-10-11', '2026-10-17', 'Week 6 · 11–17 October 2026', false),
  ('2026-2027', 7,  '2026-10-18', '2026-10-24', 'Week 7 · 18–24 October 2026', false),
  ('2026-2027', 8,  '2026-10-25', '2026-10-31', 'Week 8 · 25–31 October 2026', false),
  ('2026-2027', 9,  '2026-11-01', '2026-11-07', 'Week 9 · 1–7 November 2026', false),
  ('2026-2027', 10, '2026-11-08', '2026-11-14', 'Week 10 · 8–14 November 2026', false),
  ('2026-2027', 11, '2026-11-15', '2026-11-21', 'Week 11 · 15–21 November 2026', false),
  ('2026-2027', 12, '2026-11-22', '2026-11-28', 'Week 12 · 22–28 November 2026', false),
  ('2026-2027', 13, '2026-11-29', '2026-12-05', 'Week 13 · 29 November–5 December 2026', false),
  ('2026-2027', 14, '2026-12-06', '2026-12-12', 'Week 14 · 6–12 December 2026', false),
  ('2026-2027', 15, '2026-12-13', '2026-12-19', 'Week 15 · 13–19 December 2026', false),
  ('2026-2027', 16, '2026-12-20', '2026-12-26', 'Week 16 · 20–26 December 2026', false),
  ('2026-2027', 17, '2026-12-27', '2027-01-02', 'Week 17 · 27 December 2026–2 January 2027', false)
on conflict (academic_year, week_number) do update
set starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    label = excluded.label,
    is_current = excluded.is_current;

select week_number, label, starts_on, ends_on, is_current
from public.academic_weeks
where academic_year = '2026-2027'
order by week_number;
