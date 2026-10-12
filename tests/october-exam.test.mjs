import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { PGlite } from '../tmp/copy-validation/node_modules/@electric-sql/pglite/dist/index.js';
const read = path => readFile(new URL(path,import.meta.url),'utf8');
const sql = await read('../supabase/migrations/20261012094154_october_exam_week_seven.sql');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const teacher=id(1),other=id(2),source=id(10),target=id(11),week=id(20),plan=id(30),arabic=id(40),religion=id(41),english=id(42),plus=id(43),discover=id(44);
const variables={teacher,other,source,target,week,plan,arabic,religion,english,plus,discover};
async function fixture() {
  const db = new PGlite();
  const existing = await read('./copy-weekly-plan.test.mjs');
  await db.exec(existing.match(/const fixture = `([\s\S]*?)`;/)[1].replace(/\$\{(\w+)\}/g,(_,key)=>variables[key]));
  await db.exec(await read('../supabase/migrations/20261002161652_copy_teacher_weekly_plan.sql'));
  const correction=await read('../supabase/migrations/20260929180000_allow_approved_unpublished_plan_corrections.sql');
  await db.exec(correction.slice(correction.indexOf('create or replace function public.update_my_published_plan'),correction.lastIndexOf('commit;')));
  // Install the actual normal-publication implementation under its deployed name.
  const publication=await read('../supabase/migrations/20260926193000_block_meaningful_drafts_before_partial_publication.sql');
  const start=publication.indexOf('create or replace function private.refresh_weekly_plan_publication_state');
  const end=publication.indexOf('$$;',start)+3;
  await db.exec(publication.slice(start,end).replace('private.refresh_weekly_plan_publication_state','private.refresh_weekly_plan_without_teacher_override'));
  await db.exec(`alter table plan_entries add updated_at timestamptz;
    update academic_weeks set week_number=7;
    insert into teacher_assignments values('${teacher}','${source}','${arabic}'),('${teacher}','${target}','${arabic}');
    insert into timetable_slots(id,class_id,teacher_id,subject_id,day_of_week,period_number) values
      ('${id(50)}','${source}','${teacher}','${arabic}',0,1),('${id(51)}','${source}','${teacher}','${arabic}',0,3),
      ('${id(52)}','${target}','${teacher}','${arabic}',0,3),('${id(53)}','${target}','${teacher}','${arabic}',1,5);
    insert into plan_entries(id,weekly_plan_id,timetable_slot_id,teacher_id,subject_id,day_of_week,period_number,classwork) values
      ('${id(60)}','${plan}','${id(50)}','${teacher}','${arabic}',0,1,'Real teaching'),
      ('${id(61)}','${plan}','${id(51)}','${teacher}','${arabic}',0,3,'Preserve this old exam-slot text');
    insert into plan_submissions(weekly_plan_id,teacher_id,subject_id,status) values('${plan}','${teacher}','${arabic}','approved');`);
  return db;
}
test('Week 7 only, period 3, all five school days; adjacent weeks untouched',async()=>{
  const code=ts.transpileModule(await read('../lib/october-exam.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
  const {isOctoberExam}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  for(const w of [undefined,6,7,8]) for(let d=-1;d<=6;d++) for(let p=1;p<=8;p++)
    assert.equal(isOctoberExam(w,p,d),w===7&&p===3&&d>=0&&d<=4);
});
test('Installation is idempotent and preserves every saved entry, approval and plan',async()=>{
  const db=await fixture();try{
    const before=(await db.query('select to_jsonb(e) data from plan_entries e order by id')).rows;
    await db.exec(sql);await db.exec(sql);
    assert.deepEqual((await db.query('select to_jsonb(e) data from plan_entries e order by id')).rows,before);
    assert.equal((await db.query('select status from plan_submissions')).rows[0].status,'approved');
    assert.equal((await db.query('select status from weekly_plans')).rows[0].status,'published');
  }finally{await db.close();}
});
test('DB blocks exam insert, move, text update and delete; ordinary lessons remain editable',async()=>{
  const db=await fixture();try{
    await db.exec(sql);
    await db.exec(`set test.uid='${teacher}'; set role authenticated;`);
    for(const operation of [
      `update plan_entries set classwork='Changed' where id='${id(61)}'`,
      `delete from plan_entries where id='${id(61)}'`,
      `update plan_entries set period_number=2 where id='${id(61)}'`,
      `update plan_entries set day_of_week=2,period_number=3 where id='${id(60)}'`,
      `insert into plan_entries(weekly_plan_id,teacher_id,subject_id,day_of_week,period_number) values('${plan}','${teacher}','${arabic}',2,3)`
    ]) await assert.rejects(db.exec(operation),/October Exam/);
    await db.exec(`update plan_entries set classwork='Normal lesson updated' where id='${id(60)}'`);
    await db.exec('reset role; update academic_weeks set week_number=8;');
    await db.exec(`set role authenticated; update plan_entries set classwork='Week 8 allowed' where id='${id(61)}'; reset role;`);
    assert.equal((await db.query('select classwork from plan_entries where id=$1',[id(61)])).rows[0].classwork,'Week 8 allowed');
  }finally{await db.close();}
});
test('Copy ignores old exam text, skips target period 3 and preserves an existing exam row',async()=>{
  const db=await fixture();try{
    await db.exec(`do $$declare definition text; begin select pg_get_functiondef('public.copy_my_weekly_plan(uuid,uuid)'::regprocedure) into definition;
      execute replace(definition,'e.teacher_id = actor_id','e.teacher_id=actor_id'); end$$;`);
    await db.exec(`insert into weekly_plans(id,class_id,week_id) values('${id(70)}','${target}','${week}');
      insert into plan_entries(id,weekly_plan_id,timetable_slot_id,teacher_id,subject_id,day_of_week,period_number,classwork)
      values('${id(71)}','${id(70)}','${id(52)}','${teacher}','${arabic}',0,3,'Old target protected');`);
    await db.exec(sql);
    await db.exec(`set test.uid='${teacher}'; set role authenticated;`);
    const result=(await db.query('select copy_my_weekly_plan($1,$2) result',[plan,target])).rows[0].result;
    assert.equal(result.status,'copied');assert.equal(result.copied_lessons,1);
    await db.exec('reset role;');
    assert.deepEqual((await db.query('select period_number,classwork from plan_entries where weekly_plan_id=$1 order by period_number',[id(70)])).rows,
      [{period_number:3,classwork:'Old target protected'},{period_number:5,classwork:'Real teaching'}]);
  }finally{await db.close();}
});
test('Approved correction accepts remaining lessons without rewriting protected exam content',async()=>{
  const db=await fixture();try{
    await db.exec(sql);await db.exec(`set test.uid='${teacher}'; set role authenticated;`);
    const result=await db.query('select update_my_published_plan($1,$2::jsonb,null) count',[plan,JSON.stringify([{slot_id:id(50),classwork:'Corrected teaching',homework:'',classera_notes:''}])]);
    assert.equal(result.rows[0].count,1);await db.exec('reset role;');
    assert.equal((await db.query('select classwork from plan_entries where id=$1',[id(61)])).rows[0].classwork,'Preserve this old exam-slot text');
  }finally{await db.close();}
});
