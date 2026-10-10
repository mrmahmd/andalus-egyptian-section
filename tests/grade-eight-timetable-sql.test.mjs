import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/copy-validation/node_modules/@electric-sql/pglite/dist/index.js';
const sql = await readFile(new URL('../supabase/grade8_week7_timetable.sql',import.meta.url),'utf8');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
async function fixture() {
  const db = new PGlite();
  await db.exec(`create schema private; create role authenticated;
    create table profiles(user_id uuid primary key,display_name text,status text);
    create table subjects(id uuid primary key,code text);
    create table school_classes(id uuid primary key,grade int,section text,is_active boolean default true);
    create table academic_weeks(id uuid primary key,week_number int);
    create table teacher_assignments(teacher_id uuid,class_id uuid,subject_id uuid);
    create table timetable_slots(id uuid primary key,class_id uuid,teacher_id uuid,subject_id uuid,day_of_week int,period_number int);
    create table weekly_plans(id uuid primary key,class_id uuid,week_id uuid,status text);
    create table plan_entries(id uuid primary key,weekly_plan_id uuid,teacher_id uuid,subject_id uuid,classwork text);
    create table plan_submissions(id uuid primary key,weekly_plan_id uuid,status text);
    insert into profiles values('${id(1)}','محمد سيد بكر','active');
    insert into subjects values('${id(2)}','arabic'),('${id(3)}','islamic');
    insert into school_classes(id,grade,section) values('${id(4)}',8,'A'),('${id(5)}',8,'B');
    insert into academic_weeks values('${id(6)}',6),('${id(7)}',7);
    insert into teacher_assignments select '${id(1)}',c.id,s.id from school_classes c cross join subjects s;
    insert into weekly_plans values('${id(8)}','${id(4)}','${id(6)}','published');
    insert into plan_entries values('${id(9)}','${id(8)}','${id(1)}','${id(2)}','Do not change saved text');
    insert into plan_submissions values('${id(10)}','${id(8)}','approved');
    create function public.copy_my_weekly_plan(uuid,uuid) returns text language plpgsql as $$begin
      -- coalesce(previous_slot.subject_id,t.subject_id)
      return 'copy'; end$$;
    create function public.super_admin_staff_action(uuid,text,jsonb) returns text language plpgsql as $$declare slot public.timetable_slots%rowtype; v_week_id uuid; begin
      -- if not found then raise exception 'A lesson is outside the selected teacher assignments.' using errcode='42501'; end if;
      return 'delegated'; end$$;`);
  for (const [index,section,day,period,subject] of [[20,'A',0,7,3],[21,'A',2,8,2],[22,'A',4,3,3],[23,'B',2,7,3],[24,'B',3,3,3],[25,'B',4,6,2]]) {
    await db.query('insert into timetable_slots values($1,$2,$3,$4,$5,$6)',[id(index),id(section==='A'?4:5),id(1),id(subject),day,period]);
  }
  return db;
}
test('SQL preserves every saved record; correction is effective from Week 7 and idempotent',async()=>{
  const db=await fixture();
  try {
    const before=(await db.query('select * from plan_entries')).rows;
    await db.exec(sql);
    assert.deepEqual((await db.query('select * from plan_entries')).rows,before);
    for (const [slot,oldSubject,newSubject] of [[20,3,3],[21,2,3],[22,3,2],[23,3,3],[24,3,2],[25,2,3]]) {
      for (const [week,subject] of [[6,oldSubject],[7,newSubject]]) {
        assert.equal((await db.query('select private.grade_eight_subject_at_week($1,$2) as subject',[id(slot),id(week)])).rows[0].subject,id(subject));
      }
    }
    await db.exec(sql);
    assert.equal((await db.query('select status from weekly_plans')).rows[0].status,'published');
    assert.equal((await db.query('select status from plan_submissions')).rows[0].status,'approved');
  } finally {await db.close();}
});
test('SQL refuses a different teacher and rolls back all changes',async()=>{
  const db=await fixture();
  try {
    await db.query('update timetable_slots set teacher_id=$1 where id=$2',[id(99),id(25)]);
    await assert.rejects(db.exec(sql),/Unexpected teacher/);
    await db.exec('rollback');
    assert.equal((await db.query('select subject_id from timetable_slots where id=$1',[id(21)])).rows[0].subject_id,id(2));
  } finally {await db.close();}
});
test('SQL refuses future saved content instead of silently relabelling it',async()=>{
  const db=await fixture();
  try {
    await db.exec(`insert into weekly_plans values('${id(30)}','${id(4)}','${id(7)}','draft'); insert into plan_entries values('${id(31)}','${id(30)}','${id(1)}','${id(2)}','Already written');`);
    await assert.rejects(db.exec(sql),/already has saved lessons/);
    await db.exec('rollback');
    assert.equal((await db.query('select classwork from plan_entries where id=$1',[id(31)])).rows[0].classwork,'Already written');
  } finally {await db.close();}
});

test('Real copy RPC matches Arabic and Religion to historic Week 6 and corrected Week 7',async()=>{
  const db=new PGlite();
  try {
    const copyTests=await readFile(new URL('./copy-weekly-plan.test.mjs',import.meta.url),'utf8');
    const values={teacher:id(1),other:id(99),source:id(4),target:id(5),week:id(6),plan:id(8),arabic:id(2),religion:id(3),english:id(40),plus:id(41),discover:id(42)};
    const base=copyTests.match(/const fixture = `([\s\S]*?)`;/)[1].replace(/\$\{(\w+)\}/g,(_,key)=>values[key]);
    await db.exec(base);
    await db.exec(await readFile(new URL('../supabase/migrations/20261002161652_copy_teacher_weekly_plan.sql',import.meta.url),'utf8'));
    await db.exec(`alter table subjects add code text; update subjects set code=case when id='${id(2)}' then 'arabic' when id='${id(3)}' then 'islamic' else name_en end;
      alter table school_classes add is_active boolean default true; update school_classes set grade=8;
      update academic_weeks set week_number=6; insert into academic_weeks(id,week_number,teacher_entry_enabled) values('${id(7)}',7,true);
      create table profiles(user_id uuid primary key,display_name text,status text); insert into profiles values('${id(1)}','محمد سيد بكر','active');
      insert into teacher_assignments select '${id(1)}',c.id,s.id from school_classes c cross join subjects s where s.code in ('arabic','islamic');
      create function public.super_admin_staff_action(uuid,text,jsonb) returns text language plpgsql as $$declare slot public.timetable_slots%rowtype; v_week_id uuid; begin
      -- if not found then raise exception 'A lesson is outside the selected teacher assignments.' using errcode='42501'; end if;
      return 'delegated'; end$$;`);
    for(const [index,section,day,period,subject] of [[20,'A',0,7,3],[21,'A',2,8,2],[22,'A',4,3,3],[23,'B',2,7,3],[24,'B',3,3,3],[25,'B',4,6,2]]) {
      await db.query('insert into timetable_slots(id,class_id,teacher_id,subject_id,day_of_week,period_number) values($1,$2,$3,$4,$5,$6)',[id(index),id(section==='A'?4:5),id(1),id(subject),day,period]);
    }
    await db.exec(sql);
    for(const week of [6,7]) {
      const sourcePlan=week===6?id(8):id(60);
      if(week===7) await db.query('insert into weekly_plans(id,class_id,week_id,status) values($1,$2,$3,$4)',[sourcePlan,id(4),id(7),'draft']);
      for(const [slot,subject,day,period,text] of week===6?[[20,3,0,7,'Religion first'],[21,2,2,8,'Arabic content'],[22,3,4,3,'Religion second']]:[[20,3,0,7,'Religion first'],[21,3,2,8,'Religion second'],[22,2,4,3,'Arabic content']]) {
        await db.query('insert into plan_entries(weekly_plan_id,timetable_slot_id,teacher_id,subject_id,day_of_week,period_number,classwork) values($1,$2,$3,$4,$5,$6,$7)',[sourcePlan,id(slot),id(1),id(subject),day,period,text]);
      }
      await db.exec(`set role authenticated; select set_config('test.uid','${id(1)}',false);`);
      await db.query('select public.copy_my_weekly_plan($1,$2)',[sourcePlan,id(5)]);
      await db.exec('reset role');
      const rows=(await db.query('select e.subject_id,e.day_of_week,e.period_number,e.classwork from plan_entries e join weekly_plans p on p.id=e.weekly_plan_id where p.class_id=$1 and p.week_id=$2 order by e.subject_id',[id(5),id(week)])).rows;
      assert.deepEqual(rows.map(r=>[r.subject_id,r.day_of_week,r.period_number,r.classwork]),week===6?[[id(2),4,6,'Arabic content'],[id(3),2,7,'Religion first'],[id(3),3,3,'Religion second']]:[[id(2),3,3,'Arabic content'],[id(3),2,7,'Religion first'],[id(3),4,6,'Religion second']]);
    }
  } finally {await db.close();}
});
