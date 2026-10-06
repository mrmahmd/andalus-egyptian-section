// Isolated PostgreSQL checks using the existing local PGlite test runtime.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/copy-validation/node_modules/@electric-sql/pglite/dist/index.js';

const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const supervisor = id(1), teacher = id(2), owner = id(3), week = id(10), plan = id(20), submission = id(30);
async function database(open) {
  const db = new PGlite();
  await db.exec(`
    create schema auth; create schema private; create role anon; create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function private.is_active_staff(text[]) returns boolean language sql stable as $$select auth.uid()='${owner}'::uuid$$;
    create function private.is_department_supervisor_for(uuid) returns boolean language sql stable as $$select auth.uid()='${supervisor}'::uuid and $1='${teacher}'::uuid$$;
    create table public.academic_weeks(id uuid primary key,teacher_entry_enabled boolean);
    create table public.weekly_plans(id uuid primary key,week_id uuid,status text default 'draft',manual_publication_override boolean default false,publication_override_by uuid,publication_override_at timestamptz,updated_at timestamptz);
    create table public.plan_submissions(id uuid primary key,weekly_plan_id uuid,teacher_id uuid,status text,review_note text,reviewed_by uuid,reviewed_at timestamptz,updated_at timestamptz);
    create table public.profiles(user_id uuid,staff_id uuid,role text,status text);
    create table public.staff_directory(id uuid,is_active boolean,administrative_role text);
    create table public.supervisor_staff_links(teacher_staff_id uuid,supervisor_staff_id uuid);
    create function private.refresh_weekly_plan_publication_state(uuid) returns void language sql as $$update public.weekly_plans set status='published' where id=$1 and manual_publication_override$$;
    insert into public.academic_weeks values('${week}',${open});
    insert into public.weekly_plans(id,week_id) values('${plan}','${week}');
    insert into public.plan_submissions(id,weekly_plan_id,teacher_id,status) values('${submission}','${plan}','${teacher}','submitted');
    insert into public.profiles values('${supervisor}','${supervisor}','admin','active'),('${teacher}','${teacher}','teacher','active');
    insert into public.staff_directory values('${supervisor}',true,'Subject Supervisor');
    insert into public.supervisor_staff_links values('${teacher}','${supervisor}');
    set test.uid='${supervisor}';
  `);
  const read = path => readFile(new URL(path, import.meta.url), 'utf8');
  const individual = await read('../supabase/20260814_fix_premature_weekly_plan_publication.sql');
  await db.exec(individual.slice(individual.indexOf('create or replace function'), individual.indexOf('-- Withdraw only')));
  const bulk = await read('../supabase/migrations/20260920054000_autoapprove_supervisors_and_add_week_bulk_approval.sql');
  await db.exec(bulk.slice(bulk.indexOf('create or replace function'), bulk.lastIndexOf('commit;')));
  const override = await read('../supabase/20260814_add_super_admin_publication_override.sql');
  await db.exec(override.slice(override.indexOf('create or replace function public.set_weekly_plan_publication_override'), override.indexOf('drop policy if exists "Public reads published plan entries"')));
  await db.exec(await read('../supabase/close_week_supervisor_reviews.sql'));
  return db;
}

for (const decision of ['approved', 'changes_requested']) test(`closed week blocks supervisor ${decision} and preserves submission`, async () => {
  const db = await database(false);
  try {
    await assert.rejects(db.query('select public.review_plan_submission($1,$2,$3)', [submission, decision, 'Review note']), /This week is closed\. Contact administration\./);
    assert.deepEqual((await db.query('select status,reviewed_by,review_note from public.plan_submissions')).rows, [{status:'submitted',reviewed_by:null,review_note:null}]);
  } finally { await db.close(); }
});

test('bulk approval is blocked when closed and works after reopening', async () => {
  const db = await database(false);
  try {
    await assert.rejects(db.query('select public.approve_my_week_submissions($1)', [week]), /This week is closed/);
    assert.equal((await db.query('select status from public.plan_submissions')).rows[0].status, 'submitted');
    await db.query('update public.academic_weeks set teacher_entry_enabled=true');
    assert.equal((await db.query('select public.approve_my_week_submissions($1) count', [week])).rows[0].count, 1);
  } finally { await db.close(); }
});

test('open week allows the individual review RPC', async () => {
  const db = await database(true);
  try {
    await db.query('select public.review_plan_submission($1,$2,$3)', [submission, 'approved', null]);
    assert.equal((await db.query('select status from public.plan_submissions')).rows[0].status, 'approved');
  } finally { await db.close(); }
});

test('closed week keeps Super Admin review and exceptional publication available', async () => {
  const db = await database(false);
  try {
    await db.exec(`set test.uid='${owner}'`);
    await db.query('select public.review_plan_submission($1,$2,$3)', [submission, 'approved', null]);
    await db.query('select public.set_weekly_plan_publication_override($1,true)', [plan]);
    assert.equal((await db.query('select status from public.weekly_plans')).rows[0].status, 'published');
    assert.equal((await db.query('select teacher_entry_enabled from public.academic_weeks')).rows[0].teacher_entry_enabled, false);
  } finally { await db.close(); }
});

test('supervisor cannot use the Super Admin publication override', async () => {
  const db = await database(false);
  try {
    await assert.rejects(db.query('select public.set_weekly_plan_publication_override($1,true)', [plan]), /Only the active Super Admin/);
  } finally { await db.close(); }
});
