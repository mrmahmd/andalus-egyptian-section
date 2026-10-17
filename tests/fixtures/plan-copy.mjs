// Shared, isolated PostgreSQL fixture. No production connection.
import { readFile } from 'node:fs/promises';
import { PGlite } from '../../tmp/copy-validation/node_modules/@electric-sql/pglite/dist/index.js';
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const teacher = id(1), other = id(2), source = id(10), target = id(11), week = id(20), plan = id(30);
const arabic = id(40), religion = id(41), english = id(42), plus = id(43), discover = id(44);
const fixture = `
create schema auth; create schema private;
create role anon; create role authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function private.is_active_staff(text[]) returns boolean language sql stable as $$select auth.uid() = '${teacher}'::uuid$$;
create table public.school_classes(id uuid primary key,grade integer,section text);
create table public.subjects(id uuid primary key,name_en text);
create table public.teacher_assignments(teacher_id uuid,class_id uuid,subject_id uuid);
create table public.academic_weeks(id uuid primary key,teacher_entry_enabled boolean,week_number integer default 5);
create table public.weekly_plan_teacher_access(teacher_id uuid,is_open boolean);
create table public.weekly_plan_access_control(id integer,is_open boolean);
create table public.weekly_plan_holidays(week_id uuid,day_of_week integer);
create table public.weekly_plans(id uuid primary key default gen_random_uuid(),class_id uuid,week_id uuid,status text default 'draft',unique(class_id,week_id));
create table public.timetable_slots(id uuid primary key,class_id uuid,subject_id uuid,teacher_id uuid,day_of_week integer,period_number integer,requires_weekly_plan_submission boolean default true);
create table public.plan_entries(id uuid primary key default gen_random_uuid(),weekly_plan_id uuid,timetable_slot_id uuid,teacher_id uuid,subject_id uuid,day_of_week integer,period_number integer,classwork text default '',homework text default '',classera_notes text default '',unique(weekly_plan_id,day_of_week,period_number));
create table public.plan_submissions(id uuid primary key default gen_random_uuid(),weekly_plan_id uuid,teacher_id uuid,subject_id uuid,status text,submitted_at timestamptz,reviewed_by uuid,reviewed_at timestamptz,review_note text,updated_at timestamptz,unique(weekly_plan_id,teacher_id,subject_id));
grant usage on schema public,auth,private to authenticated;
grant select on all tables in schema public to authenticated;
grant insert on public.weekly_plans to authenticated;
grant insert,update,delete on public.plan_entries to authenticated;
grant insert,update on public.plan_submissions to authenticated;
alter table public.plan_entries enable row level security;
create policy own_entries on public.plan_entries to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
alter table public.plan_submissions enable row level security;
create policy own_submissions on public.plan_submissions to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid() and status='draft');
insert into public.school_classes values('${source}',5,'A'),('${target}',5,'B');
insert into public.subjects values('${arabic}','Arabic'),('${religion}','Islamic Studies'),('${english}','English OL'),('${plus}','Connect Plus'),('${discover}','Discover');
insert into public.academic_weeks(id,teacher_entry_enabled) values('${week}',true);
insert into public.weekly_plans(id,class_id,week_id,status) values('${plan}','${source}','${week}','published');
`;
async function database() {
  const db = new PGlite();
  await db.exec(fixture);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261002161652_copy_teacher_weekly_plan.sql', import.meta.url),'utf8'));
  return db;
}
async function seedSubject(db, subject, rows, slots, targetSubject = subject) {
  await db.query('insert into public.teacher_assignments values ($1,$2,$3),($1,$4,$5)', [teacher,source,subject,target,targetSubject]);
  for (const [i,row] of rows.entries()) {
    await db.query('insert into public.plan_entries(id,weekly_plan_id,teacher_id,subject_id,day_of_week,period_number,classwork,homework,classera_notes) values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id(Number(subject.slice(-3))*100+i),plan,teacher,subject,row.day,row.period,row.text,row.homework??'',row.notes??'']);
  }
  for (const [i,slot] of slots.entries()) {
    await db.query('insert into public.timetable_slots(id,class_id,teacher_id,subject_id,day_of_week,period_number) values($1,$2,$3,$4,$5,$6)', [id(Number(targetSubject.slice(-3))*100+50+i),target,teacher,targetSubject,slot.day,slot.period]);
  }
}
async function copy(db) {
  await db.exec(`set test.uid='${teacher}'; set role authenticated;`);
  try { return (await db.query('select public.copy_my_weekly_plan($1,$2) result',[plan,target])).rows[0].result; }
  finally { await db.exec('reset role;'); }
}
async function targetRows(db) { return (await db.query('select e.* from public.plan_entries e join public.weekly_plans p on p.id=e.weekly_plan_id where p.class_id=$1 order by day_of_week,period_number',[target])).rows; }


export { database, seedSubject, targetRows, id, teacher, other, source, target, week, plan, arabic, religion, english };
