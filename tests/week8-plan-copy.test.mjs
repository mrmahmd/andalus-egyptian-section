// Isolated PostgreSQL; never connects to the school database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { database, seedSubject, targetRows, id, teacher, other, target, week, plan, arabic, religion, english } from './fixtures/plan-copy.mjs';
const installation = await readFile(new URL('../supabase/week8_holiday_plan_copy.sql', import.meta.url), 'utf8');
async function db8() {
  const db = await database();
  await db.exec(installation);
  await db.exec('update public.academic_weeks set week_number=8');
  await db.query('insert into public.weekly_plan_holidays values($1,0)', [week]);
  return db;
}
async function merge(db, token = null, actor = teacher) {
  await db.exec(`set test.uid='${actor}'; set role authenticated;`);
  try { return (await db.query('select public.copy_week8_plan_with_merge($1,$2,$3) result', [plan,target,token])).rows[0].result; }
  finally { await db.exec('reset role'); }
}
async function snapshot(db) {
  return (await db.query(`select jsonb_build_object('plans',(select jsonb_agg(to_jsonb(p) order by id) from weekly_plans p),'entries',(select jsonb_agg(to_jsonb(e) order by id) from plan_entries e),'submissions',(select jsonb_agg(to_jsonb(s) order by id) from plan_submissions s)) data`)).rows[0].data;
}
async function sixToFour(db, subject = arabic) {
  await seedSubject(db,subject,[[1,3],[2,3],[2,6],[3,3],[4,1],[4,8]].map(([day,period],i)=>({day,period,text:`Lesson ${i+1}`,homework:`HW ${i+1}`,notes:`Note ${i+1}`})),
    [[0,4],[0,6],[0,8],[1,5],[2,8],[3,7],[4,4]].map(([day,period])=>({day,period})));
}

test('Week 8 6-to-4: install/preview write nothing; confirmed merge preserves all three fields exactly once and source unchanged', async()=>{
  const db=await db8(); try {
    await sixToFour(db); const before=await snapshot(db);
    const originalRpc=(await db.query("select pg_get_functiondef('public.copy_my_weekly_plan(uuid,uuid)'::regprocedure) definition")).rows[0].definition;
    await db.exec(installation); assert.deepEqual(await snapshot(db),before);
    assert.equal((await db.query("select pg_get_functiondef('public.copy_my_weekly_plan(uuid,uuid)'::regprocedure) definition")).rows[0].definition,originalRpc);
    const preview=await merge(db); assert.equal(preview.status,'preview'); assert.equal(preview.source_lessons,6); assert.equal(preview.target_lessons,4); assert.equal(preview.merged_slots,2);
    assert.deepEqual(await snapshot(db),before);
    assert.deepEqual(preview.mappings.map(m=>[m.slot.day_of_week,m.slot.period_number,m.sources.length]),[[1,5,1],[2,8,2],[3,7,1],[4,4,2]]);
    const result=await merge(db,preview.token); assert.equal(result.status,'copied');
    const rows=await targetRows(db); assert.equal(rows.length,4);
    for(const [field,prefix] of [['classwork','Lesson'],['homework','HW'],['classera_notes','Note']]) {
      const text=rows.map(r=>r[field]).join('\n');
      for(let i=1;i<=6;i++) assert.equal(text.split(`${prefix} ${i}`).length-1,1);
    }
    const after=await snapshot(db); assert.deepEqual(after.entries.filter(e=>e.weekly_plan_id===plan),before.entries);
    assert.ok(after.submissions.every(s=>s.status==='draft' && s.reviewed_by===null && s.submitted_at===null));
    assert.equal(after.plans.find(p=>p.class_id===target).status,'draft');
    assert.equal((await merge(db)).status,'conflict');
    const security=(await db.query("select prosecdef,proconfig,has_function_privilege('anon',oid,'execute') anon,has_function_privilege('authenticated',oid,'execute') authenticated from pg_proc where oid='public.copy_week8_plan_with_merge(uuid,uuid,text)'::regprocedure")).rows[0];
    assert.equal(security.prosecdef,false); assert.equal(security.anon,false); assert.equal(security.authenticated,true); assert.ok(security.proconfig.includes('search_path=""'));
  } finally {await db.close();}
});

for(const change of ["update plan_entries set homework='changed' where weekly_plan_id='PLAN'", "update timetable_slots set period_number=period_number+1 where day_of_week=2", "insert into weekly_plan_holidays values('WEEK',4)"])
test(`preview cannot authorize changed source/timetable/holiday: ${change}`,async()=>{
  const db=await db8(); try{await sixToFour(db);const p=await merge(db);await db.exec(change.replaceAll('PLAN',plan).replaceAll('WEEK',week));const before=await snapshot(db);await assert.rejects(merge(db,p.token),/COPY_PREVIEW_STALE|COPY_SOURCE_HOLIDAY_CONTENT/);assert.deepEqual(await snapshot(db),before);}finally{await db.close();}
});

for(const status of ['draft','submitted','approved','changes_requested']) test(`existing ${status} destination is protected`,async()=>{
  const db=await db8();try{await sixToFour(db);await db.query('insert into weekly_plans(id,class_id,week_id) values($1,$2,$3)',[id(31),target,week]);
    if(status==='draft') await db.query("insert into plan_entries(weekly_plan_id,teacher_id,subject_id,day_of_week,period_number,classwork) values($1,$2,$3,1,5,'Keep me')",[id(31),teacher,arabic]);
    else await db.query('insert into plan_submissions(weekly_plan_id,teacher_id,subject_id,status) values($1,$2,$3,$4)',[id(31),teacher,arabic,status]);
    const before=await snapshot(db);assert.equal((await merge(db,'forged')).status,'conflict');assert.deepEqual(await snapshot(db),before);
  }finally{await db.close();}
});

test('Arabic and Religion remain separate; ordinary Religion can move to a different day',async()=>{
  const db=await db8();try{await sixToFour(db);await seedSubject(db,religion,[{day:1,period:1,text:'Faith',homework:'R HW'}],[{day:2,period:7}]);const p=await merge(db);assert.equal(p.mappings.filter(m=>m.subject==='Islamic Studies').length,1);await merge(db,p.token);const r=(await targetRows(db)).find(r=>r.subject_id===religion);assert.equal(r.classwork,'Faith');assert.equal(r.day_of_week,2);assert.ok((await targetRows(db)).filter(r=>r.subject_id===arabic).every(r=>!r.classwork.includes('Faith')));}finally{await db.close();}
});

for(const variant of ['missing day','missing subject','holiday source','mixed programmes','wrong week','closed week','denied access','other teacher'])
test(`unsafe merge blocked atomically: ${variant}`,async()=>{
 const db=await db8();try{
  await sixToFour(db,variant==='mixed programmes'?english:arabic);
  let expected;
  if(variant==='missing day'){await db.exec('delete from timetable_slots where day_of_week=2');expected=/COPY_MERGE_DAY_UNAVAILABLE/;}
  if(variant==='missing subject'){await seedSubject(db,religion,[{day:1,period:1,text:'Faith'}],[]);expected=/COPY_SUBJECT_UNAVAILABLE/;}
  if(variant==='holiday source'){await db.exec('update plan_entries set day_of_week=0 where period_number=6');expected=/COPY_SOURCE_HOLIDAY_CONTENT/;}
  if(variant==='mixed programmes'){await db.exec("update plan_entries set classwork=case when period_number=6 then 'OL - B' else 'AL - A' end");expected=/COPY_MERGE_PROGRAMME_MISMATCH/;}
  if(variant==='wrong week'){await db.exec('update academic_weeks set week_number=7');expected=/COPY_WEEK8_HOLIDAY_ONLY/;}
  if(variant==='closed week'){await db.exec('update academic_weeks set teacher_entry_enabled=false');expected=/COPY_CLOSED_WEEK/;}
  if(variant==='denied access'){await db.query('insert into weekly_plan_teacher_access values($1,false)',[teacher]);expected=/COPY_ACCESS_DENIED/;}
  if(variant==='other teacher')expected=/COPY_ACCESS_DENIED/;
  const before=await snapshot(db);await assert.rejects(merge(db,null,variant==='other teacher'?other:teacher),expected);assert.deepEqual(await snapshot(db),before);
 }finally{await db.close();}
});

test('invisible other-teacher slot collision rolls back the entire confirmed merge',async()=>{
 const db=await db8();try{await sixToFour(db);await db.query('insert into weekly_plans(id,class_id,week_id) values($1,$2,$3)',[id(31),target,week]);await db.query("insert into plan_entries(weekly_plan_id,teacher_id,subject_id,day_of_week,period_number,classwork) values($1,$2,$3,2,8,'Other work')",[id(31),other,arabic]);const p=await merge(db);const before=await snapshot(db);await assert.rejects(merge(db,p.token),/duplicate key/);assert.deepEqual(await snapshot(db),before);}finally{await db.close();}
});

test('no merge needed: use unchanged normal copy, no preview or save',async()=>{
 const db=await db8();try{await seedSubject(db,arabic,[{day:1,period:1,text:'one'}],[{day:1,period:5}]);const before=await snapshot(db);assert.equal((await merge(db)).status,'normal_copy_available');assert.deepEqual(await snapshot(db),before);}finally{await db.close();}
});

test('same English programme keeps the leading programme and every lesson',async()=>{
 const db=await db8();try{await sixToFour(db,english);await db.exec("update plan_entries set classwork='AL - ' || classwork");const p=await merge(db);await merge(db,p.token);assert.ok((await targetRows(db)).every(r=>r.classwork.startsWith('AL - ')));}finally{await db.close();}
});

test('audited delegation extension is idempotent and logs metadata, not preview content or token',async()=>{
 const db=await db8();try{
  await db.exec(`create function public.super_admin_staff_action(target_user_id uuid,operation text,payload jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$declare result jsonb; context jsonb; begin
    if operation not in ('copy_my_weekly_plan','review_plan_submission') then raise exception 'denied'; end if;
    case operation when 'copy_my_weekly_plan' then result:=public.copy_my_weekly_plan((payload->>'source_plan_id')::uuid,(payload->>'target_class_id')::uuid); else raise exception 'denied'; end case;
    return jsonb_build_object('result',result,'audit',context);
  end $$;`);
  await db.exec(installation);const first=(await db.query("select pg_get_functiondef('public.super_admin_staff_action(uuid,text,jsonb)'::regprocedure) def")).rows[0].def;
  await db.exec(installation);assert.equal((await db.query("select pg_get_functiondef('public.super_admin_staff_action(uuid,text,jsonb)'::regprocedure) def")).rows[0].def,first);
  await sixToFour(db);await db.exec(`set test.uid='${teacher}';set role authenticated;`);
  const r=(await db.query("select super_admin_staff_action($1,'copy_week8_plan_with_merge',$2) data",[teacher,{source_plan_id:plan,target_class_id:target}])).rows[0].data;
  await db.exec('reset role');assert.equal(r.result.status,'preview');assert.equal(r.audit.status,'preview');assert.ok(!JSON.stringify(r.audit).includes('Lesson'));assert.ok(!JSON.stringify(r.audit).includes('token'));assert.equal((await targetRows(db)).length,0);
 }finally{await db.close();}
});
