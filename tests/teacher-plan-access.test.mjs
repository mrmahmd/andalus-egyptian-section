import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const code=ts.transpileModule(await readFile(new URL('../lib/teacher-plan-access.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {fetchTeacherPlanAccess,mergeTeacherAccessWeeks}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const week=open=>({id:'week7',week_number:7,label:'Week 7',starts_on:'2026-10-18',ends_on:'2026-10-22',is_current:false,teacher_entry_enabled:open,parent_portal_visible:true});
function client(state,log=[]) {
  return {from(table){const request={select(){return request;},eq(field,value){log.push([table,field,value]);return request;},order(){return Promise.resolve(state[table]);},maybeSingle(){return Promise.resolve(state[table]);}};return request;}};
}
test('live reopening is read even when a prior snapshot was closed',async()=>{
  const state={academic_weeks:{data:[week(false)]},weekly_plan_access_control:{data:{is_open:true}},weekly_plan_teacher_access:{data:null}};
  const api=client(state);
  assert.equal((await fetchTeacherPlanAccess(api,'teacher1')).weeks[0].teacher_entry_enabled,false);
  state.academic_weeks.data=[week(true)];
  assert.equal((await fetchTeacherPlanAccess(api,'teacher1')).weeks[0].teacher_entry_enabled,true);
});
test('personal and global access restrictions are preserved rather than bypassed',async()=>{
  for(const [global,personal,expected] of [[true,false,false],[false,null,false],[false,true,true],[true,null,true]]) {
    const log=[];const snapshot=await fetchTeacherPlanAccess(client({academic_weeks:{data:[week(true)]},weekly_plan_access_control:{data:{is_open:global}},weekly_plan_teacher_access:{data:personal===null?null:{is_open:personal}}},log),'teacher1');
    assert.equal(snapshot.creationOpen,expected);
    assert.deepEqual(log,[['weekly_plan_access_control','id',1],['weekly_plan_teacher_access','teacher_id','teacher1']]);
  }
});
test('access request errors never turn a closed account into an open one',async()=>{
  for(const table of ['academic_weeks','weekly_plan_access_control','weekly_plan_teacher_access']) {
    const state={academic_weeks:{data:[week(true)]},weekly_plan_access_control:{data:{is_open:true}},weekly_plan_teacher_access:{data:null}};
    state[table]={error:new Error('Read denied')};
    await assert.rejects(fetchTeacherPlanAccess(client(state),'teacher1'),/Read denied/);
  }
});
test('unchanged polling retains week identity; changed access is merged without editing plan content',()=>{
  const current=[week(true)],incoming=[week(true)];
  assert.equal(mergeTeacherAccessWeeks(current,incoming)[0],current[0]);
  assert.equal(mergeTeacherAccessWeeks(current,[week(false)])[0].teacher_entry_enabled,false);
  assert.equal(current[0].teacher_entry_enabled,true);
});
