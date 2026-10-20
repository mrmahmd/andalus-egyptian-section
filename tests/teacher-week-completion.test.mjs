import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createClient} from '@supabase/supabase-js';
import {summarizeTeachingWeek,teachingWeekMessage,fetchTeachingWeek} from '../lib/teacher-week-completion.ts';
const requirements=[{id:'arabic',classId:'5A',subjectId:'Arabic',dayOfWeek:1,periodNumber:1},{id:'religion',classId:'5A',subjectId:'Religion',dayOfWeek:2,periodNumber:3},{id:'art',classId:'4B',subjectId:'Art',dayOfWeek:3,periodNumber:4}];
const snapshot=(statuses=['submitted','submitted','submitted'])=>({entries:requirements.map(r=>({planId:'plan-'+r.classId,classId:r.classId,subjectId:r.subjectId,slotId:r.id,dayOfWeek:r.dayOfWeek,periodNumber:r.periodNumber,written:true})),submissions:requirements.map((r,i)=>({planId:'plan-'+r.classId,classId:r.classId,subjectId:r.subjectId,status:statuses[i]}))});

test('all required classes and subjects must be written and sent before congratulations; every approval is required',()=>{
 const s=snapshot();const before=structuredClone(s);
 const sent=summarizeTeachingWeek(requirements,s);assert.equal(sent.state,'submitted');assert.equal(sent.classes,2);assert.equal(sent.subjectPlans,3);assert.equal(sent.missing,0);
 assert.equal(summarizeTeachingWeek(requirements,snapshot(['approved','submitted','submitted'])).state,'partial');
 assert.equal(summarizeTeachingWeek(requirements,snapshot(['approved','approved','approved'])).state,'approved');
 assert.equal(summarizeTeachingWeek(requirements,snapshot(['approved','draft','approved'])).state,'action');
 assert.equal(summarizeTeachingWeek(requirements,snapshot(['approved','changes_requested','approved'])).state,'returned');
 assert.equal(summarizeTeachingWeek(requirements,{...s,submissions:s.submissions.slice(0,2)}).state,'action');
 assert.equal(summarizeTeachingWeek(requirements,{...s,submissions:[...s.submissions,{...s.submissions[0],status:'draft'}]}).state,'action');
 assert.deepEqual(s,before);
});
test('approval, publication, homework and old displaced entries cannot conceal missing required Classwork',()=>{
 const approved=snapshot(['approved','approved','approved']);
 for(const changes of [{written:false,homework:'Written homework',classeraNotes:'Written notes'},{slotId:'someone-elses-slot'},{subjectId:'English'},{classId:'another-class'},{planId:'another-plan'}]){
  const s={...approved,entries:approved.entries.map((e,i)=>i===1?{...e,...changes}:e)};
  const result=summarizeTeachingWeek(requirements,s);assert.equal(result.state,'action');assert.equal(result.missing,1);
 }
 const legacy={...approved,entries:approved.entries.map(e=>({...e,slotId:null}))};assert.equal(summarizeTeachingWeek(requirements,legacy).state,'approved');
 assert.equal(summarizeTeachingWeek(requirements,{entries:[],submissions:approved.submissions}).missing,3);
 assert.equal(summarizeTeachingWeek([],approved).state,'none');
 assert.equal(summarizeTeachingWeek([...requirements,requirements[0]],approved).lessons,3);
});
test('fresh review transitions are computed rather than persisted: sent → partially approved → approved → returned',()=>{
 const states=[['submitted','submitted','submitted'],['approved','submitted','approved'],['approved','approved','approved'],['approved','changes_requested','approved']].map(statuses=>summarizeTeachingWeek(requirements,snapshot(statuses)).state);
 assert.deepEqual(states,['submitted','partial','approved','returned']);
});

test('real Supabase transport reads only the selected teacher/week; normalization rejects other identities and weeks',async()=>{
 const requests=[];const base={teacher_id:'teacher',weekly_plan_id:'plan-5A',subject_id:'Arabic',weekly_plans:{class_id:'5A',week_id:'week8'}};
 const client=createClient('https://synthetic.supabase.co','synthetic-public-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init)=>{
  const request=new URL(url);requests.push({url:request,method:init.method});
  const own=request.pathname.endsWith('/plan_entries')?{...base,timetable_slot_id:'arabic',day_of_week:1,period_number:1,classwork:'  Written  '}:{...base,status:'approved'};
  return new Response(JSON.stringify([own,{...own,teacher_id:'other'},{...own,weekly_plans:{class_id:'5A',week_id:'week9'}},{...own,weekly_plans:null}]),{status:200,headers:{'Content-Type':'application/json'}});
 }}});
 const data=await fetchTeachingWeek(client,'teacher','week8');assert.equal(data.entries.length,1);assert.equal(data.submissions.length,1);assert.equal(data.entries[0].written,true);
 assert.equal(summarizeTeachingWeek([requirements[0]],data).state,'approved');assert.equal(requests.length,2);
 for(const request of requests){assert.equal(request.method,'GET');assert.equal(request.url.searchParams.get('teacher_id'),'eq.teacher');assert.equal(request.url.searchParams.get('weekly_plans.week_id'),'eq.week8');assert.match(request.url.searchParams.get('select'),/weekly_plans!inner/);}
 await assert.rejects(fetchTeachingWeek(client,'','week8'));assert.equal(requests.length,2);
});
test('failed, malformed, or missing read results never mean all plans are complete',async()=>{
 for(const body of [null,{message:'permission denied'}]){
  const client=createClient('https://synthetic.supabase.co','synthetic-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async()=>new Response(JSON.stringify(body),{status:body?403:200,headers:{'Content-Type':'application/json'}})}});
  await assert.rejects(fetchTeachingWeek(client,'teacher','week8'));
 }
});

const require=createRequire(import.meta.url);
const source=await readFile(new URL('../app/teachers/teaching-week-completion.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function loadComponent(react=React,fetcher=fetchTeachingWeek){const module={exports:{}};new Function('require','module','exports',compiled)(id=>id==='react'?react:id==='../../lib/supabase/staff-workspace'?{getStaffWorkspaceClient:()=>({})}:id==='../../lib/teacher-week-completion'?{fetchTeachingWeek:fetcher,summarizeTeachingWeek,teachingWeekMessage}:require(id),module,module.exports);return module.exports;}
const Card=loadComponent().TeachingWeekCompletionCard;
for(const arabic of [true,false])test('actual card is translated, accessible, and omits the unnecessary publication note: '+arabic,()=>{
 for(const state of ['none','action','returned','submitted','partial','approved']){
  const summary={...summarizeTeachingWeek(requirements,snapshot()),state};const html=renderToStaticMarkup(React.createElement(Card,{summary,arabic,weekNumber:8,busy:false,error:false,onRefresh(){},onOpenPlans(){}}));
  assert.match(html,/role="status"/);assert.match(html,arabic?/dir="rtl"/:/dir="ltr"/);assert.match(html,/type="button"/);assert.doesNotMatch(html,/type="submit"/);
  assert.ok(html.includes(teachingWeekMessage(summary,arabic).title));
  assert.doesNotMatch(html,/الاعتماد لا يعني النشر|Approval does not mean family publication|teaching-week-publication-note/);
  if(!['submitted','partial','approved'].includes(state))assert.doesNotMatch(html,arabic?/لا يوجد إجراء مطلوب منك/:/No action is needed/);
 }
 const error=renderToStaticMarkup(React.createElement(Card,{summary:summarizeTeachingWeek(requirements,snapshot(['approved','approved','approved'])),arabic,weekNumber:8,busy:false,error:true,onRefresh(){},onOpenPlans(){}}));
 assert.match(error,arabic?/تعذر التحقق/:/could not be verified/);assert.doesNotMatch(error,arabic?/شكرًا لإنجازك/:/Thank you/);
});

test('monitor coalesces refreshes, ignores late account/week responses, pauses for editor, and removes listeners',async()=>{
 let values=[],cursor=0,effects=[],calls=0;const pending=[];const listeners=new Map();const timers=new Map();let timerId=0;
 const react={useState:initial=>{const i=cursor++;if(!(i in values))values[i]=initial;return[values[i],v=>values[i]=typeof v==='function'?v(values[i]):v];},useEffect:fn=>effects.push(fn)};
 const Component=loadComponent(react,()=>{calls++;return new Promise((resolve,reject)=>pending.push({resolve,reject}));}).default;
 const verified=[];const props={teacherId:'teacher',weekId:'week8',weekNumber:8,requirements,arabic:true,enabled:true,onOpenPlans(){},onVerified:(weekId,data)=>verified.push({weekId,data})};
 const originalWindow=globalThis.window,originalDocument=globalThis.document;
 globalThis.window={setInterval:fn=>{timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id),addEventListener:(name,fn)=>listeners.set('w:'+name,fn),removeEventListener:name=>listeners.delete('w:'+name)};
 globalThis.document={visibilityState:'visible',addEventListener:(name,fn)=>listeners.set('d:'+name,fn),removeEventListener:name=>listeners.delete('d:'+name)};
 try{
  cursor=0;Component(props);const dispose=effects.pop()();assert.equal(calls,1);listeners.get('w:focus')();assert.equal(calls,1);
  dispose();assert.equal(listeners.size,0);assert.equal(timers.size,0);
  cursor=0;Component({...props,weekId:'week9'});const disposeNext=effects.pop()();assert.equal(calls,2);
  pending[0].resolve(snapshot(['approved','approved','approved']));await new Promise(r=>setImmediate(r));assert.equal(values[0],null);assert.equal(verified.length,0);
  pending[1].resolve(snapshot());await new Promise(r=>setImmediate(r));assert.equal(values[0].weekId,'week9');assert.equal(verified.length,1);assert.equal(verified[0].weekId,'week9');
  document.visibilityState='hidden';listeners.get('w:focus')();assert.equal(calls,2);document.visibilityState='visible';listeners.get('d:visibilitychange')();assert.equal(calls,3);
  pending[2].reject(Error('Offline'));await new Promise(r=>setImmediate(r));assert.equal(values[0].error,true);assert.equal(values[0].data,null);
  disposeNext();cursor=0;assert.equal(Component({...props,enabled:false}),null);effects.pop()();assert.equal(calls,3);
 }finally{globalThis.window=originalWindow;globalThis.document=originalDocument;}
});
test('overview integration reuses the holiday/exam-filtered own timetable, never rehydrates or writes editor drafts',async()=>{
 const page=await readFile(new URL('../app/teachers/page.tsx',import.meta.url),'utf8');
 assert.match(page,/assignedPlanSlotsForWeek\(timetableSlots, assignments, profileId, classId, dashboardWeek, schoolHolidays\).map/);
 assert.match(page,/!isSupervisor && dashboardWeek && <TeachingWeekCompletion/);
 assert.match(page,/enabled=\{!loading && !saving && !weeklyBuilderOpen && !parentPreviewOpen\}/);
 assert.doesNotMatch(source,/setSlotDrafts|loadTeacherDashboard|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});
test('approval polling updates existing dashboard badges/notes without changing other weeks or editor data',async()=>{
 const text=await readFile(new URL('../app/teachers/page.tsx',import.meta.url),'utf8');const file=ts.createSourceFile('page.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let declaration;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(file)==='syncOwnWeekCompletion')declaration=n;else ts.forEachChild(n,visit);}visit(file);assert.ok(declaration);
 const js=ts.transpileModule('const '+declaration.getText(file)+';return syncOwnWeekCompletion;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 let submissions=[{weekId:'week8',weeklyPlanId:'plan-5A',classId:'5A',subjectId:'Arabic',status:'submitted',reviewNote:''},{weekId:'week7',weeklyPlanId:'old',classId:'5A',subjectId:'Arabic',status:'submitted',reviewNote:'keep'}];
 let entries=[{weekId:'week8',weeklyPlanId:'plan-5A',classId:'5A',subjectId:'Arabic',timetableSlotId:'arabic',hasClasswork:true}];
 const old=submissions[1];const setter=fn=>fn;const sync=new Function('useCallback','setMySubmissions','setEntries',js)(setter,fn=>submissions=fn(submissions),fn=>entries=fn(entries));
 const data=snapshot(['approved','submitted','submitted']);data.submissions[0].reviewNote='Approved';
 sync('week8',data);assert.equal(submissions[0].status,'approved');assert.equal(submissions[0].reviewNote,'Approved');assert.equal(submissions[1],old);
 const unchanged=submissions;sync('week8',data);assert.equal(submissions,unchanged);
 data.submissions[0].status='changes_requested';data.submissions[0].reviewNote='Please review';data.entries[0].written=false;sync('week8',data);
 assert.equal(submissions[0].status,'changes_requested');assert.equal(entries[0].hasClasswork,false);
});
