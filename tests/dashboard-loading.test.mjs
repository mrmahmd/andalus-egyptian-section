import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, createClient, isAuthSessionMissingError} from '@supabase/supabase-js';
import {readDashboardPages} from '../lib/dashboard-loading.ts';
import {readSchoolDashboardDirectory} from '../lib/school-dashboard-directory.ts';
import {resolveStaffWeek,readStaffWeek,rememberStaffWeek} from '../lib/staff-week-selection.ts';

// Execute the actual loaders, extracted with the TypeScript AST, against the real
// Supabase HTTP transport. No copied implementation or production writes.
async function loader(path,name,scope) {
  const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
  const file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let initializer;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(file)===name)initializer=node.initializer;ts.forEachChild(node,visit);}
  visit(file);assert.ok(initializer,name);
  const arrow=ts.isCallExpression(initializer)?initializer.arguments[0]:initializer;
  const compiled=ts.transpileModule('export default '+arrow.getText(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText.replace('"use strict";','');
  const compiledModule={exports:{}};
  new Function('scope','module','exports','with(scope){'+compiled+'}')(scope,compiledModule,compiledModule.exports);
  return compiledModule.exports.default;
}
const weeks=[{id:'w1',week_number:1,is_current:true,teacher_entry_enabled:true,label:'Week 1'}, {id:'w2',week_number:2,is_current:false,teacher_entry_enabled:false,label:'Week 2'}];
const plan=(id,week)=>({id,class_id:'class',week_id:week,class_teacher_name:'Teacher',status:'published',manual_publication_override:true,updated_at:'2026-11-01',school_classes:{grade:5,section:'A'},academic_weeks:{label:week,week_number:week==='w1'?1:2},plan_entries:[{count:2}]});
const entry=(id,week,teacher='teacher')=>({id,weekly_plan_id:'plan-'+week,timetable_slot_id:id,teacher_id:teacher,subject_id:'English',day_of_week:0,period_number:1,classwork:'Saved '+id,homework:'Homework',classera_notes:'Notes',updated_at:'2026-11-01',subjects:{name_en:'English'},weekly_plans:{class_id:'class',week_id:week,status:'published',school_classes:{grade:5,section:'A'},academic_weeks:{label:week}}});
const submission=(week)=>({id:'submission-'+week,weekly_plan_id:'plan-'+week,teacher_id:'teacher',subject_id:'English',status:'submitted',submitted_at:'2026-11-01',updated_at:'2026-11-01',subjects:{name_en:'English'},weekly_plans:{class_id:'class',week_id:week,school_classes:{grade:5,section:'A'},academic_weeks:{label:week}}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function fixture({role='super_admin',entries=[entry('current','w1'),entry('old','w2')],beforeReply}={}) {
  const requests=[],states={},refs={dashboardRequest:{current:0},dashboardDirectory:{current:null},reportWeek:{current:'w1'},workspaceWeek:{current:{staffId:'teacher',weekId:'w1'}},detailRequest:{current:0}};
  const client=createClient('https://dashboard-fixture.supabase.co','synthetic-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input,init)=>{
    const url=new URL(input),table=url.pathname.split('/').pop();requests.push({url,method:init.method??'GET',body:init.body?JSON.parse(init.body):null});
    if(beforeReply)await beforeReply(url);
    let rows=({profiles:[{user_id:'teacher',staff_id:'staff',username:'teacher',display_name:'Teacher',status:'active',role,departments:{name_en:'English'},staff_directory:{administrative_role:role==='admin'?'English Supervisor':null}}],academic_weeks:weeks,weekly_plans:[plan('plan-w1','w1'),plan('plan-w2','w2')],plan_entries:entries,plan_submissions:[submission('w1'),submission('w2')],get_my_department_teachers:[],get_my_supervisor_review_queue:[{...submission('w1'),week_id:'w1'},{...submission('w2'),week_id:'w2'}]})[table]??[];
    if(init.method==='POST'&&!url.pathname.includes('/rpc/'))rows=Array.isArray(JSON.parse(init.body))?JSON.parse(init.body):[JSON.parse(init.body)];
    for(const key of ['teacher_id','id','class_id','weekly_plan_id','subject_id','weekly_plans.week_id','week_id','status']) {
      const filter=url.searchParams.get(key);
      if(filter?.startsWith('eq.'))rows=rows.filter(row=>(key==='weekly_plans.week_id'?row.weekly_plans?.week_id:row[key])===filter.slice(3));
    }
    const from=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??rows.length);
    rows=rows.slice(from,from+limit);
    if(table==='weekly_plans'&&url.searchParams.get('select')?.includes('classwork')) rows=rows.map(p=>({...p,plan_entries:entries.filter(e=>e.weekly_plan_id===p.id)}));
    const singleton=new Headers(init.headers).get('Accept')?.includes('vnd.pgrst.object');
    return new Response(JSON.stringify(singleton?rows[0]??null:rows),{status:200,headers:{'Content-Type':'application/json'}});
  }}});
  client.auth.getUser=async()=>({data:{user:{id:'teacher'}},error:null});
  client.auth.signOut=async()=>{throw Error('Unexpected sign-out');};
  const bindings={...refs,basePath:'',getSupabaseBrowserClient:()=>client,getStaffWorkspaceClient:()=>client,delegatedStaffId:()=>'',readDashboardPages,readSchoolDashboardDirectory,resolveStaffWeek,readStaffWeek,rememberStaffWeek,hasHorizontalTeacherEditor:()=>false,getEditorLayoutPreference:()=>({initialize(){}}),singleRelation:value=>Array.isArray(value)?value[0]:value,one:value=>Array.isArray(value)?value[0]:value,formatDate:value=>value,dayNames:['Sunday','Monday','Tuesday','Wednesday','Thursday'],hasMeaningfulPlanContent:e=>[e.classwork,e.homework,e.classera_notes].some(v=>String(v??'').trim()),window:{location:{assign(){throw Error('Unexpected navigation');},replace(){throw Error('Unexpected navigation');}},localStorage:{getItem(){return null;},setItem(){}}}};
  bindings.isAuthSessionMissingError=isAuthSessionMissingError;
  const scope=new Proxy(bindings,{has:(target,key)=>typeof key==='string'&&(key in target||key in states||/^set[A-Z]/.test(key)),get:(target,key)=>{
    if(typeof key==='string'&&/^set[A-Z]/.test(key))return value=>{const name=key[3].toLowerCase()+key.slice(4);states[name]=typeof value==='function'?value(states[name]):value;};
    return key in states?states[key]:target[key];
  }});
  return{scope,states,refs,requests,client};
}

test('pagination preserves every row and rejects incomplete/error responses instead of returning a partial report',async()=>{
  const data=Array.from({length:1101},(_,i)=>i),ranges=[];
  assert.deepEqual(await readDashboardPages((from,to)=>{ranges.push([from,to]);return Promise.resolve({data:data.slice(from,to+1),error:null});}),data);
  assert.deepEqual(ranges,[[0,499],[500,999],[1000,1499]]);
  await assert.rejects(readDashboardPages(from=>Promise.resolve(from?{data:null,error:Error('Offline')}:{data:data.slice(0,500),error:null})),/Offline/);
  await assert.rejects(readDashboardPages(()=>Promise.resolve({data:null,error:null})),/verified/);
});

test('school loader requests only the selected week, including >500 lessons, and can read a past closed week',async()=>{
  const current=Array.from({length:1101},(_,i)=>entry('row-'+i,'w1'));
  const f=fixture({entries:[...current,entry('old','w2')]});
  const load=await loader('app/super-admin/page.tsx','loadDashboard',f.scope);
  assert.equal(await load(),true);assert.equal(f.states.planEntrySummaries.length,1101);assert.equal(f.states.planSubmissions.length,1);assert.equal(f.states.loadedReportWeek,'w1');
  assert.equal(f.requests.filter(r=>r.url.pathname.endsWith('/academic_weeks')).length,1,'A shared promise must not execute its thenable query twice');
  for(const request of f.requests.filter(r=>['plan_entries','plan_submissions'].some(t=>r.url.pathname.endsWith(t)))) {
    assert.match(request.url.searchParams.get('select'),/weekly_plans!inner/);assert.equal(request.url.searchParams.get('weekly_plans.week_id'),'eq.w1');assert.equal(request.url.searchParams.get('order'),'id.asc');
  }
  f.refs.reportWeek.current='w2';assert.equal(await load(),true);assert.equal(f.states.planEntrySummaries.length,1);assert.equal(f.states.selectedPlanWeekId,'w2');assert.equal(f.states.planSubmissions[0].weeklyPlanId,'plan-w2');
  assert.ok(f.requests.every(r=>r.method==='GET'));
});

test('a late school-week response cannot replace the newly selected report or mark it ready',async()=>{
  const pending=deferred(),started=deferred();
  const f=fixture({beforeReply:async url=>{if(url.pathname.endsWith('plan_entries')&&url.searchParams.get('weekly_plans.week_id')==='eq.w1'){started.resolve();await pending.promise;}}});
  const load=await loader('app/super-admin/page.tsx','loadDashboard',f.scope);
  const old=load();await started.promise;f.refs.reportWeek.current='w2';await load();pending.resolve();assert.equal(await old,false);
  assert.equal(f.states.selectedPlanWeekId,'w2');assert.equal(f.states.loadedReportWeek,'w2');assert.equal(f.states.planEntrySummaries[0].weeklyPlanId,'plan-w2');assert.equal(f.states.loading,false);
});

test('week navigation skips ten directory reads but refreshes week data and checks the current admin',async()=>{
  const f=fixture(),load=await loader('app/super-admin/page.tsx','loadDashboard',f.scope);
  let authChecks=0;f.client.auth.getUser=async()=>{authChecks++;return{data:{user:{id:'teacher'}},error:null};};
  assert.equal(await load(),true);
  const fullCount=f.requests.length,originalSnapshot=f.refs.dashboardDirectory.current;
  assert.equal(f.states.weeklyPlans.length,1);
  assert.equal(f.states.weeklyPlans[0].entries,1,'Count only the complete selected-week lessons already fetched');
  f.requests.length=0;f.refs.reportWeek.current='w2';
  assert.equal(await load('week'),true);
  assert.equal(authChecks,2);
  assert.equal(f.requests.length,fullCount-10);
  assert.equal(f.refs.dashboardDirectory.current,originalSnapshot,'Switches must not extend the cache lifetime');
  const tables=f.requests.map(r=>r.url.pathname.split('/').pop());
  assert.ok(!tables.includes('staff_directory'));assert.ok(!tables.includes('teacher_assignments'));
  assert.ok(tables.includes('academic_weeks'));assert.ok(tables.includes('weekly_plan_holidays'));
  assert.equal(tables.filter(t=>t==='profiles').length,1,'Verify the active Super Admin on every switch');
  assert.equal(f.states.weeklyPlans[0].weekId,'w2');assert.equal(f.states.weeklyPlans[0].entries,1);
  for(const request of f.requests.filter(r=>r.url.pathname.endsWith('/weekly_plans'))) {
    assert.equal(request.url.searchParams.get('week_id'),'eq.w2');
    assert.doesNotMatch(request.url.searchParams.get('select'),/plan_entries\(count\)/);
  }
  const overrides=f.requests.find(r=>r.url.pathname.endsWith('/teacher_plan_publication_overrides'));
  assert.equal(overrides.url.searchParams.get('weekly_plans.week_id'),'eq.w2');
  assert.ok(f.requests.every(r=>r.method==='GET'));
  f.requests.length=0;assert.equal(await load(),true);
  assert.ok(f.requests.some(r=>r.url.pathname.endsWith('/teacher_assignments')),'A printable report/full refresh must see current assignments');
});

test('week directory reuse expires and cannot cross account identities',async()=>{
  const f=fixture(),load=await loader('app/super-admin/page.tsx','loadDashboard',f.scope);
  await load();f.refs.dashboardDirectory.current.loadedAt=Date.now()-61_000;f.requests.length=0;
  await load('week');assert.ok(f.requests.some(r=>r.url.pathname.endsWith('/staff_directory')));
  f.refs.dashboardDirectory.current.userId='another-admin';f.requests.length=0;
  await load('week');assert.ok(f.requests.some(r=>r.url.pathname.endsWith('/staff_directory')));
});

test('a failed second page cannot produce verified week totals or replace the last complete snapshot',async()=>{
  let fail=false;
  const entries=Array.from({length:501},(_,i)=>entry('row-'+i,'w1'));
  const f=fixture({entries,beforeReply:async url=>{if(fail&&url.pathname.endsWith('/plan_entries')&&url.searchParams.get('offset')==='500')throw Error('Lesson page unavailable');}});
  const load=await loader('app/super-admin/page.tsx','loadDashboard',f.scope);
  assert.equal(await load(),true);assert.equal(f.states.weeklyPlans[0].entries,501);
  const previous=f.states.planEntrySummaries;fail=true;
  assert.equal(await load('week'),false);assert.equal(f.states.loadedReportWeek,'');
  assert.equal(f.states.planEntrySummaries,previous);assert.equal(f.states.loading,false);
  assert.match(f.states.errorMessage,/Lesson page unavailable/);
});

test('teacher loader retains identity filtering, reads selected history only, and makes no plan writes',async()=>{
  const f=fixture({role:'teacher',entries:[entry('current','w1'),entry('old','w2'),entry('other-teacher','w1','someone-else')]});
  const load=await loader('app/teachers/page.tsx','loadTeacherDashboard',f.scope);
  await load();assert.equal(f.states.entries.length,1);assert.equal(f.states.entries[0].id,'current');assert.equal(f.states.mySubmissions.length,1);
  assert.equal(f.requests.filter(r=>r.url.pathname.endsWith('/academic_weeks')).length,1);
  for(const r of f.requests.filter(r=>['plan_entries','plan_submissions'].some(t=>r.url.pathname.endsWith(t)))){assert.equal(r.url.searchParams.get('teacher_id'),'eq.teacher');assert.equal(r.url.searchParams.get('weekly_plans.week_id'),'eq.w1');}
  f.refs.workspaceWeek.current.weekId='w2';await load();assert.equal(f.states.entries[0].id,'old');assert.equal(f.states.dashboardWeekId,'w2');assert.equal(f.states.mySubmissions[0].weekId,'w2');assert.ok(f.requests.every(r=>r.method==='GET'));
});

test('a missing or expired session on entry goes to staff sign-in before attempting to read any weeks',async()=>{
  for(const error of [new AuthSessionMissingError(),new AuthApiError('Session ended',403,'session_not_found')]){
    const f=fixture({role:'teacher'}),destinations=[];
    f.refs.workspaceWeek.current={staffId:'',weekId:''};
    f.scope.window.location.replace=url=>destinations.push(url);
    f.client.auth.getUser=async()=>({data:{user:null},error});
    const load=await loader('app/teachers/page.tsx','loadTeacherDashboard',f.scope);
    await load();
    assert.deepEqual(destinations,['/teachers/login/']);
    assert.deepEqual(f.requests,[]);
    assert.equal(f.states.loading,false);
  }
});

test('a transient auth failure allows retry and an ended session in an open workspace leaves it in place',async()=>{
  const f=fixture({role:'teacher'}),destinations=[];
  f.scope.window.location.replace=url=>destinations.push(url);
  const load=await loader('app/teachers/page.tsx','loadTeacherDashboard',f.scope);
  f.client.auth.getUser=async()=>({data:{user:null},error:new AuthRetryableFetchError('Offline',0)});
  await load();assert.equal(f.states.workspaceAuthIssue,'connection');assert.deepEqual(f.requests,[]);
  f.client.auth.getUser=async()=>({data:{user:{id:'teacher'}},error:null});
  await load();assert.equal(f.states.workspaceAuthIssue,null);assert.equal(f.states.academicWeeks.length,2);
  const loadedWeeks=f.states.academicWeeks;
  f.client.auth.getUser=async()=>({data:{user:null},error:new AuthSessionMissingError()});
  await load();assert.equal(f.states.workspaceAuthIssue,'session');assert.equal(f.states.academicWeeks,loadedWeeks);
  assert.deepEqual(destinations,[]);
});

test('supervisor uses the existing secured review RPC with a week filter, preserving its authority boundary',async()=>{
  const f=fixture({role:'admin'});const load=await loader('app/teachers/page.tsx','loadTeacherDashboard',f.scope);await load();
  const review=f.requests.find(r=>r.url.pathname.endsWith('/get_my_supervisor_review_queue'));assert.ok(review);assert.equal(review.url.searchParams.get('week_id'),'eq.w1');
  assert.equal(f.states.reviewItems.length,1);assert.equal(f.states.reviewItems[0].weekId,'w1');assert.ok(f.requests.every(r=>r.method==='GET'||r.url.pathname.includes('/rpc/get_my_')));
});

test('administrator first loads counts; report text is fetched only for the explicitly opened published plan',async()=>{
  const f=fixture({role:'admin'});f.states.expandedPlanId='';const load=await loader('app/admin/page.tsx','loadPublishedReport',f.scope);
  // Deputy account, rather than subject supervisor, is required by this page.
  f.client.auth.getUser=async()=>({data:{user:{id:'teacher'}},error:null});
  // A separate role label in the fixture controls the returned staff role.
  const original=f.scope.one;f.scope.one=value=>{const result=original(value);return result?.administrative_role?{...result,administrative_role:'Deputy'}:result;};
  await load();assert.equal(f.states.plans.length,2);assert.ok(f.states.plans.every(p=>p.entries===null&&p.entryCount===2));
  const metadata=f.requests.find(r=>r.url.pathname.endsWith('weekly_plans'));assert.match(metadata.url.searchParams.get('select'),/plan_entries\(count\)/);assert.doesNotMatch(metadata.url.searchParams.get('select'),/classwork|homework|classera_notes/);
  const open=await loader('app/admin/page.tsx','openPlanReport',f.scope);await open('plan-w1');
  const detail=f.requests.filter(r=>r.url.pathname.endsWith('weekly_plans')).at(-1);assert.equal(detail.url.searchParams.get('id'),'eq.plan-w1');assert.equal(detail.url.searchParams.get('status'),'eq.published');
  assert.equal(f.states.plans.find(p=>p.id==='plan-w1').entries[0].classwork,'Saved current');assert.equal(f.states.plans.find(p=>p.id==='plan-w2').entries,null);assert.ok(f.requests.every(r=>r.method==='GET'));
});

test('late administrator details cannot replace the newly opened report',async()=>{
  const pending=deferred(),started=deferred();
  const f=fixture({beforeReply:async url=>{if(url.pathname.endsWith('/weekly_plans')&&url.searchParams.get('id')==='eq.plan-w1'){started.resolve();await pending.promise;}}});
  f.states.expandedPlanId='';f.states.plans=[{...plan('plan-w1','w1'),entries:null},{...plan('plan-w2','w2'),entries:null}];
  const open=await loader('app/admin/page.tsx','openPlanReport',f.scope);
  const first=open('plan-w1');await started.promise;await open('plan-w2');pending.resolve();await first;
  assert.equal(f.states.expandedPlanId,'plan-w2');assert.equal(f.states.plans[0].entries,null);assert.equal(f.states.plans[1].entries[0].id,'old');assert.equal(f.states.detailsLoading,false);
});

test('late teacher history cannot replace the new selected week',async()=>{
  const pending=deferred(),started=deferred();
  const f=fixture({role:'teacher',beforeReply:async url=>{if(url.pathname.endsWith('/plan_entries')&&url.searchParams.get('weekly_plans.week_id')==='eq.w1'){started.resolve();await pending.promise;}}});
  const load=await loader('app/teachers/page.tsx','loadTeacherDashboard',f.scope);
  const first=load();await started.promise;f.refs.workspaceWeek.current.weekId='w2';await load();pending.resolve();await first;
  assert.equal(f.states.entries[0].id,'old');assert.equal(f.states.dashboardWeekId,'w2');assert.equal(f.states.loading,false);
});

for(const isSupervisor of [false,true])test('actual save flow retains teacher identity, target week and '+(isSupervisor?'automatic supervisor approval':'submission for supervisor review'),async()=>{
  const f=fixture({role:isSupervisor?'admin':'teacher'});
  const slot={id:'slot',subject_id:'English',class_id:'class',day_of_week:0,period_number:1};
  Object.assign(f.scope,{loading:false,builderHydrated:true,publishedEditPlanId:'',workingOnBehalf:false,profileId:'teacher',selectedClass:{grade:5,section:'A'},selectedClassId:'class',selectedWeek:{id:'w1'},selectedWeekId:'w1',selectedClassSlots:[slot],editableClassSlots:[slot],approvedSubjectIds:new Set(),builderStatus:'draft',autoSaveTimer:{current:null},pendingSupervisorSubmission:{current:false},autoSavedSignature:{current:''},autosaveSignature:'signature',isSupervisor,departmentName:'English Department',dashboardArabic:false,slotDraftFor:()=>({classwork:'Lesson unchanged',homework:'Workbook page 2',classeraNotes:'Bring book',englishProgramme:'OL'}),assignmentForSlot:()=>({subject:'English'}),isEnglishSubject:()=>true,formatEnglishClasswork:(programme,text)=>programme+' - '+text,verifyTeacherWeekAccess:async()=>true,quizDetails:'',quizSubjectId:'',dictationWords:'',parseDictationWords:()=>[],loadTeacherDashboard:async()=>{},closeWeeklyEditor:()=>{}});
  const save=await loader('app/teachers/page.tsx','saveWholeWeek',f.scope);
  await save(true);
  const entries=f.requests.find(r=>r.url.pathname.endsWith('/plan_entries')&&r.method==='POST');
  assert.ok(entries,JSON.stringify(f.states));assert.equal(entries.body[0].weekly_plan_id,'plan-w1');assert.equal(entries.body[0].teacher_id,'teacher');assert.equal(entries.body[0].classwork,'OL - Lesson unchanged');assert.equal(entries.body[0].homework,'Workbook page 2');
  const decision=f.requests.find(r=>r.url.pathname.endsWith('/plan_submissions')&&r.method==='POST');assert.equal(decision.body[0].status,isSupervisor?'approved':'submitted');assert.equal(decision.body[0].teacher_id,'teacher');assert.equal(decision.body[0].weekly_plan_id,'plan-w1');assert.equal(f.states.messageTone,'success');
  const before=f.requests.length;f.scope.loading=true;await save(true);assert.equal(f.requests.length,before,'Switching/loading the week blocks saves until the correct editor data is ready');
});
