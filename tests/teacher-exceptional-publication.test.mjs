import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '../tmp/copy-validation/node_modules/@electric-sql/pglite/dist/index.js';
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const owner=id(1),supervisor=id(2),teacher=id(3),other=id(4),returned=id(5),empty=id(6),week=id(10),plan=id(20),subject=id(30),schoolClass=id(40);
async function database(){
 const db=new PGlite();
 await db.exec(`
 create schema auth; create schema private; create role anon; create role authenticated; create role service_role;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function private.is_active_staff(text[]) returns boolean language sql stable as $$select auth.uid()='${owner}'::uuid$$;
 create table public.academic_weeks(id uuid primary key,teacher_entry_enabled boolean,parent_portal_visible boolean);
 create table public.weekly_plans(id uuid primary key,class_id uuid,week_id uuid,status text,manual_publication_override boolean default false,published_by uuid,published_at timestamptz,updated_at timestamptz);
 create table public.profiles(user_id uuid primary key,status text,role text);
 create table public.subjects(id uuid primary key,include_in_weekly_plan boolean);
 create table public.timetable_slots(class_id uuid,teacher_id uuid,subject_id uuid,requires_weekly_plan_submission boolean);
 create table public.plan_entries(weekly_plan_id uuid,teacher_id uuid,subject_id uuid,classwork text,homework text,classera_notes text);
 create table public.plan_submissions(weekly_plan_id uuid,teacher_id uuid,subject_id uuid,status text,reviewed_by uuid,reviewed_at timestamptz,review_note text);
 create function private.refresh_weekly_plan_publication_state(uuid) returns boolean language plpgsql as $$begin
 update public.weekly_plans set status=case when manual_publication_override or exists(select 1 from public.plan_submissions s where s.weekly_plan_id=$1 and status='approved') then 'published' else 'draft' end where id=$1; return true; end$$;
 grant usage on schema public,private,auth to anon,authenticated;
 insert into public.academic_weeks values('${week}',false,true);
 insert into public.weekly_plans(id,class_id,week_id,status) values('${plan}','${schoolClass}','${week}','draft');
 insert into public.subjects values('${subject}',true);
 insert into public.profiles values('${teacher}','active','teacher'),('${other}','active','teacher'),('${returned}','active','teacher'),('${empty}','active','teacher');
 insert into public.timetable_slots values('${schoolClass}','${teacher}','${subject}',true),('${schoolClass}','${other}','${subject}',true),('${schoolClass}','${returned}','${subject}',true),('${schoolClass}','${empty}','${subject}',true);
 insert into public.plan_entries values('${plan}','${teacher}','${subject}','Draft lesson','',''),('${plan}','${other}','${subject}','Submitted lesson','',''),('${plan}','${returned}','${subject}','Returned lesson','',''),('${plan}','${empty}','${subject}','   ','','');
 insert into public.plan_submissions values('${plan}','${teacher}','${subject}','draft',null,null,null),('${plan}','${other}','${subject}','submitted',null,null,null),('${plan}','${returned}','${subject}','changes_requested','${supervisor}',now(),'Keep this review note'),('${plan}','${empty}','${subject}','draft',null,null,null);
 set test.uid='${owner}';
 `);
 await db.exec(await readFile(new URL('../supabase/teacher_exceptional_publication.sql',import.meta.url),'utf8'));
 return db;
}
async function publish(db,target=other){return (await db.query('select public.publish_teacher_plan_exceptionally($1,$2) result',[plan,target])).rows[0].result;}
async function visible(db,target){return (await db.query('select private.parent_can_read_approved_plan_content($1,$2,$3) visible',[plan,target,subject])).rows[0].visible;}
async function decisions(db){return (await db.query('select * from public.plan_submissions order by teacher_id')).rows;}
const pair=teacherId=>({plan_id:plan,teacher_id:teacherId});
test('installation changes no existing plan or supervisor decision',async()=>{const db=await database();try{assert.equal((await db.query('select status from public.weekly_plans')).rows[0].status,'draft');assert.deepEqual((await decisions(db)).map(s=>s.status),['draft','submitted','changes_requested','draft']);assert.equal((await db.query('select count(*)::int n from public.teacher_plan_publication_overrides')).rows[0].n,0);}finally{await db.close();}});
test('closed-week individual publication exposes only selected teacher and preserves reviews',async()=>{const db=await database();try{const before=await decisions(db);assert.equal(await publish(db),true);assert.equal(await visible(db,other),true);assert.equal(await visible(db,teacher),false);assert.equal(await visible(db,returned),false);assert.deepEqual(await decisions(db),before);assert.equal((await db.query('select teacher_entry_enabled from public.academic_weeks')).rows[0].teacher_entry_enabled,false);}finally{await db.close();}});
test('batch publishes sent plans only and skips drafts and returned work',async()=>{const db=await database();try{const before=await decisions(db);const result=await db.query('select public.publish_week_teacher_plans_exceptionally($1,$2::jsonb) n',[week,JSON.stringify([pair(teacher),pair(other),pair(returned)])]);assert.equal(result.rows[0].n,1);assert.equal(await visible(db,other),true);for(const t of [teacher,returned])assert.equal(await visible(db,t),false);assert.equal(await visible(db,empty),false);assert.deepEqual(await decisions(db),before);}finally{await db.close();}});
test('batch failure rolls back every earlier publication',async()=>{const db=await database();try{await db.exec(`update public.plan_submissions set status='submitted' where teacher_id='${empty}'`);await assert.rejects(db.query('select public.publish_week_teacher_plans_exceptionally($1,$2::jsonb)',[week,JSON.stringify([pair(other),pair(empty)])]),/no assigned, saved plan content/);assert.equal((await db.query('select count(*)::int n from public.teacher_plan_publication_overrides')).rows[0].n,0);assert.equal((await db.query('select status from public.weekly_plans')).rows[0].status,'draft');}finally{await db.close();}});
test('hidden week remains invisible after exceptional publication',async()=>{const db=await database();try{await db.exec('update public.academic_weeks set parent_portal_visible=false');await publish(db);assert.equal(await visible(db,teacher),false);}finally{await db.close();}});
test('repeated clicks preserve original audit actor and timestamp',async()=>{const db=await database();try{await publish(db);const before=(await db.query('select * from public.teacher_plan_publication_overrides')).rows;assert.equal(await publish(db),false);assert.deepEqual((await db.query('select * from public.teacher_plan_publication_overrides')).rows,before);}finally{await db.close();}});
test('teacher and subject supervisor cannot publish or write audit records; RLS hides audit data',async()=>{const db=await database();try{await publish(db);for(const actor of [teacher,supervisor]){await db.exec(`set test.uid='${actor}'; set role authenticated`);await assert.rejects(publish(db),/Only the active General Supervisor/);assert.equal((await db.query('select count(*)::int n from public.teacher_plan_publication_overrides')).rows[0].n,0);await assert.rejects(db.query('insert into public.teacher_plan_publication_overrides values($1,$2,$3,now())',[plan,other,actor]),/permission denied/);await db.exec('reset role');}}finally{await db.close();}});
test('anonymous caller cannot invoke publication RPC; wrong confirmed week is rejected',async()=>{const db=await database();try{await db.exec('set role anon');await assert.rejects(publish(db),/permission denied/);await db.exec('reset role');await assert.rejects(db.query('select public.publish_week_teacher_plans_exceptionally($1,$2::jsonb)',[id(11),JSON.stringify([pair(teacher)])]),/confirmed week/);}finally{await db.close();}});
test('existing class override continues exposing submitted content, not other private drafts',async()=>{const db=await database();try{await db.exec("update public.weekly_plans set status='published',manual_publication_override=true");assert.equal(await visible(db,other),true);assert.equal(await visible(db,teacher),false);}finally{await db.close();}});

test('individual publication rejects drafts and returned work until resubmitted',async()=>{const db=await database();try{for(const t of [teacher,returned])await assert.rejects(publish(db,t),/must be submitted first/);assert.equal((await db.query('select count(*)::int n from public.teacher_plan_publication_overrides')).rows[0].n,0);}finally{await db.close();}});
test('teacher exception never exposes a subject subsequently saved as draft',async()=>{const db=await database();try{await publish(db);await db.exec(`update public.plan_submissions set status='draft' where teacher_id='${other}'`);assert.equal(await visible(db,other),false);}finally{await db.close();}});
test('mixed sent and draft subjects cannot be exceptionally published',async()=>{const db=await database();try{await db.exec(`insert into public.plan_entries values('${plan}','${other}','${id(31)}','Private draft','',''); insert into public.plan_submissions values('${plan}','${other}','${id(31)}','draft',null,null,null)`);await assert.rejects(publish(db),/must be submitted first/);assert.equal(await visible(db,other),false);}finally{await db.close();}});
