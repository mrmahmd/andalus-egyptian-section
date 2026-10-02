// Isolated PostgreSQL tests. No network connection or production credentials.
// Install PGlite in tmp/copy-validation, then: node --test tests/copy-weekly-plan.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/copy-validation/node_modules/@electric-sql/pglite/dist/index.js';

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
  await db.exec(await readFile(new URL('../supabase/migrations/20261002161652_copy_teacher_weekly_plan.sql', import.meta.url),'utf8'));
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

test('Arabic and Religion copy together to their own timetable, including another day; draft and repetition protected', async () => {
  const db=await database();
  try {
    await seedSubject(db,arabic,[{day:0,period:1,text:'Arabic lesson',homework:'page 3',notes:'note'}],[{day:0,period:5}]);
    await seedSubject(db,religion,[{day:0,period:3,text:'Religion lesson'}],[{day:1,period:2},{day:3,period:1}]);
    const result=await copy(db);
    assert.equal(result.status,'copied'); assert.equal(result.copied_lessons,2); assert.equal(result.empty_slots,1);
    const rows=await targetRows(db);
    assert.deepEqual(rows.map(r=>[r.subject_id,r.day_of_week,r.period_number,r.classwork]),[[arabic,0,5,'Arabic lesson'],[religion,1,2,'Religion lesson']]);
    assert.equal(rows[0].homework,'page 3'); assert.equal(rows[0].classera_notes,'note');
    assert.deepEqual((await db.query('select status,submitted_at,reviewed_by from public.plan_submissions')).rows,[{status:'draft',submitted_at:null,reviewed_by:null},{status:'draft',submitted_at:null,reviewed_by:null}]);
    assert.equal((await copy(db)).status,'conflict'); assert.equal((await targetRows(db)).length,2);
  } finally { await db.close(); }
});

test('English keeps AL/OL content, moves Sunday to Monday, and does not mix Discover', async () => {
  const db=await database();
  try {
    await seedSubject(db,english,[{day:0,period:1,text:'AL - lesson one'},{day:2,period:4,text:'OL - lesson two'}],[{day:1,period:2},{day:2,period:1},{day:4,period:6}],plus);
    await seedSubject(db,discover,[{day:1,period:3,text:'Discover lesson'}],[{day:3,period:1}]);
    await copy(db);
    const rows=await targetRows(db);
    assert.deepEqual(rows.map(r=>[r.subject_id,r.day_of_week,r.classwork]),[[plus,1,'AL - lesson one'],[plus,2,'OL - lesson two'],[discover,3,'Discover lesson']]);
  } finally { await db.close(); }
});

test('a missing subject blocks the entire copy before any destination shell or Arabic row exists', async () => {
  const db=await database();
  try {
    await seedSubject(db,arabic,[{day:0,period:1,text:'Arabic'}],[{day:0,period:5}]);
    await seedSubject(db,religion,[{day:0,period:3,text:'Religion'}],[]);
    await assert.rejects(copy(db),/COPY_SUBJECT_UNAVAILABLE/);
    assert.equal((await targetRows(db)).length,0);
    assert.equal((await db.query('select count(*)::int count from public.weekly_plans')).rows[0].count,1);
  } finally { await db.close(); }
});

test('insufficient slots or holidays never truncate source content', async () => {
  const db=await database();
  try {
    await seedSubject(db,arabic,[{day:0,period:1,text:'one'},{day:1,period:1,text:'two'}],[{day:0,period:5},{day:1,period:5}]);
    await db.query('insert into public.weekly_plan_holidays values($1,1)',[week]);
    await assert.rejects(copy(db),/COPY_INSUFFICIENT_SLOTS/);
    assert.equal((await targetRows(db)).length,0);
  } finally { await db.close(); }
});

for (const status of ['submitted','approved','changes_requested']) test(`existing ${status} plan blocks even if its lesson is empty`, async()=>{
  const db=await database();
  try {
    await seedSubject(db,arabic,[{day:0,period:1,text:'one'}],[{day:0,period:5}]);
    await db.query('insert into public.weekly_plans(id,class_id,week_id) values($1,$2,$3)',[id(31),target,week]);
    await db.query('insert into public.plan_submissions(weekly_plan_id,teacher_id,subject_id,status) values($1,$2,$3,$4)',[id(31),teacher,arabic,status]);
    assert.equal((await copy(db)).status,'conflict');
    assert.equal((await targetRows(db)).length,0);
    assert.equal((await db.query('select status from public.plan_submissions')).rows[0].status,status);
  } finally { await db.close(); }
});

test('a submission error rolls back inserted lessons and restores deleted empty draft rows',async()=>{
  const db=await database();
  try {
    await seedSubject(db,arabic,[{day:0,period:1,text:'one'}],[{day:0,period:5}]);
    await db.query('insert into public.weekly_plans(id,class_id,week_id) values($1,$2,$3)',[id(31),target,week]);
    await db.query('insert into public.plan_entries(id,weekly_plan_id,teacher_id,subject_id,day_of_week,period_number) values($1,$2,$3,$4,0,5)',[id(99),id(31),teacher,arabic]);
    await db.exec(`create function public.fail_submission() returns trigger language plpgsql as $$begin raise exception 'test submission failure'; end$$; create trigger fail before insert on public.plan_submissions for each row execute function public.fail_submission();`);
    await assert.rejects(copy(db),/test submission failure/);
    const rows=await targetRows(db); assert.equal(rows.length,1); assert.equal(rows[0].id,id(99)); assert.equal(rows[0].classwork,'');
  } finally { await db.close(); }
});

test('closed weeks and denied teacher access cannot be bypassed by RPC',async()=>{
  const db=await database();
  try {
    await seedSubject(db,arabic,[{day:0,period:1,text:'one'}],[{day:0,period:5}]);
    await db.exec('update public.academic_weeks set teacher_entry_enabled=false');
    await assert.rejects(copy(db),/COPY_CLOSED_WEEK/);
    await db.exec('update public.academic_weeks set teacher_entry_enabled=true');
    await db.query('insert into public.weekly_plan_teacher_access values($1,false)',[teacher]);
    await assert.rejects(copy(db),/COPY_ACCESS_DENIED/);
    assert.equal((await targetRows(db)).length,0);
  } finally { await db.close(); }
});

test('another teacher invisible through RLS is not replaced; collision rolls back all work',async()=>{
  const db=await database();
  try {
    await seedSubject(db,arabic,[{day:0,period:1,text:'one'}],[{day:0,period:5}]);
    await db.query('insert into public.weekly_plans(id,class_id,week_id) values($1,$2,$3)',[id(31),target,week]);
    await db.query('insert into public.plan_entries(weekly_plan_id,teacher_id,subject_id,day_of_week,period_number,classwork) values($1,$2,$3,0,5,$4)',[id(31),other,arabic,'Other teacher']);
    await assert.rejects(copy(db),/duplicate key/);
    const rows=await targetRows(db); assert.equal(rows.length,1); assert.equal(rows[0].teacher_id,other); assert.equal(rows[0].classwork,'Other teacher');
  } finally { await db.close(); }
});

test('Grade 5B week 4 keeps the old Sunday/Tuesday ownership without changing its timetable',async()=>{
  const db=await database();
  try {
    await seedSubject(db,arabic,[{day:0,period:1,text:'Arabic'}],[{day:0,period:6}]);
    await db.query('insert into public.timetable_slots(id,class_id,teacher_id,subject_id,day_of_week,period_number) values($1,$2,$3,$4,2,1)',[id(5000),target,other,english]);
    await db.exec('update public.academic_weeks set week_number=4');
    await copy(db);
    const rows=await targetRows(db); assert.equal(rows[0].day_of_week,2); assert.equal(rows[0].period_number,1); assert.equal(rows[0].subject_id,arabic);
    assert.equal((await db.query('select subject_id from public.timetable_slots where id=$1',[id(5000)])).rows[0].subject_id,english);
  } finally { await db.close(); }
});

test('English never loses a later lesson when same-day preference could skip too many slots',async()=>{
  const db=await database();
  try {
    await seedSubject(db,english,[{day:2,period:1,text:'AL - first'},{day:3,period:1,text:'OL - second'}],[{day:0,period:1},{day:2,period:1}],plus);
    const result=await copy(db); assert.equal(result.copied_lessons,2);
    assert.deepEqual((await targetRows(db)).map(r=>[r.day_of_week,r.classwork]),[[0,'AL - first'],[2,'OL - second']]);
  } finally { await db.close(); }
});
