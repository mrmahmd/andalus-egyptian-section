import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {editorTimetableAvailability,editorTimetableCopy} from '../lib/editor-timetable-availability.ts';
import {isOctoberExam} from '../lib/october-exam.ts';
import {gradeEightHistoricalCounterpart} from '../lib/grade-eight-timetable.ts';
import {editorLessonProgress} from '../lib/weekly-editor-tools.ts';

const source=await readFile(new URL('../app/teachers/page.tsx',import.meta.url),'utf8');
const file=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const fn=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='assignedPlanSlotsForWeek');
assert.ok(fn);
const code=ts.transpileModule(fn.getText(file),{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
const assigned=new Function('isOctoberExam','gradeEightHistoricalCounterpart',code+';return assignedPlanSlotsForWeek;')(isOctoberExam,gradeEightHistoricalCounterpart);
const slot=(id,day,overrides={})=>({id,class_id:'5B',subject_id:'art',teacher_id:'teacher',day_of_week:day,period_number:7,requires_weekly_plan_submission:true,...overrides});
const assignments=[{classId:'5B',subjectId:'art',grade:5,section:'B'}];
const holidays=[{week_id:'week8',day_of_week:0,title:'Long Weekend'}];
function state(slots,week,schoolHolidays=holidays,teacher='teacher',classAssignments=assignments) {
  const active=assigned(slots,classAssignments,teacher,'5B',week,schoolHolidays);
  const scheduled=assigned(slots,classAssignments,teacher,'5B',week,schoolHolidays,true);
  const grade=classAssignments.find(a=>a.classId==='5B')?.grade;
  return {active,scheduled,availability:editorTimetableAvailability(scheduled.map(s=>({holiday:schoolHolidays.some(h=>h.week_id===week.id&&h.day_of_week===s.day_of_week),exam:isOctoberExam(week.week_number,s.period_number,s.day_of_week,grade)})),active.length)};
}

test('Ali Badir Grade 5B Week 8: Sunday period 7 is linked but exempt for the holiday, never writable or missing',()=>{
  const slots=[slot('art-sunday',0)];const before=structuredClone(slots);
  const result=state(slots,{id:'week8',week_number:8});
  assert.equal(result.availability,'holiday');assert.equal(result.scheduled.length,1);assert.equal(result.active.length,0);
  assert.equal(editorLessonProgress(result.active,{}).missing.length,0);assert.deepEqual(slots,before);
  assert.doesNotMatch(editorTimetableCopy(result.availability,true).title,/يلزم ربط/);
});
test('the same lesson remains required in other weeks, and a different week holiday never removes it',()=>{
  for(const week_number of [1,5,6,7,9,17]){
    const r=state([slot('art-sunday',0)],{id:'week'+week_number,week_number});
    assert.equal(r.availability,'ready');assert.equal(r.active.length,1);assert.equal(editorLessonProgress(r.active,{}).missing.length,1);
  }
});
test('all teachers use their own assigned timetable; real missing mappings remain errors',()=>{
  for(const slots of [[],[slot('other-teacher',0,{teacher_id:'someone-else'})],[slot('other-subject',0,{subject_id:'english'})],[slot('other-class',0,{class_id:'4A'})]])assert.equal(state(slots,{id:'week8',week_number:8}).availability,'missing');
  const r=state([slot('tuesday',2)],{id:'week8',week_number:8});assert.equal(r.availability,'ready');assert.equal(r.active.length,1);
  const mixed=state([slot('sunday',0),slot('monday',1)],{id:'week8',week_number:8});assert.equal(mixed.availability,'ready');assert.deepEqual(mixed.active.map(s=>s.id),['monday']);
});
test('shared-exam exemptions are distinct from missing links and are scoped to Week 7 Grades 3+ only',()=>{
  const slots=[slot('exam',1,{period_number:3})];
  assert.equal(state(slots,{id:'week7',week_number:7}).availability,'exam');
  assert.equal(state(slots,{id:'week8',week_number:8}).availability,'ready');
  assert.equal(state(slots,{id:'week7',week_number:7},holidays,'teacher',[{...assignments[0],grade:2}]).availability,'ready');
  assert.equal(editorTimetableAvailability([{holiday:true,exam:false},{holiday:false,exam:true}],0),'excluded');
  assert.equal(editorTimetableAvailability([{holiday:false,exam:false}],0),'missing');
});

const require=createRequire(import.meta.url);
const noticeSource=await readFile(new URL('../app/teachers/editor-timetable-notice.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(noticeSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const module={exports:{}};
new Function('require','module','exports',compiled)(id=>id==='../../lib/editor-timetable-availability'?{editorTimetableCopy}:require(id),module,module.exports);
const Notice=module.exports.default;
for(const arabic of [true,false])test('actual empty-state notice is clear, translated and has no save/submit action: '+arabic,()=>{
  const html=renderToStaticMarkup(React.createElement(Notice,{availability:'holiday',arabic}));
  assert.match(html,/role="status"/);assert.match(html,arabic?/dir="rtl"/:/dir="ltr"/);
  assert.match(html,arabic?/جدول حصصك مرتبط بالفعل/:/timetable is already linked/);
  assert.match(html,arabic?/لا يُطلب منك حفظ أو إرسال/:/no plan needs to be saved or submitted/);
  assert.doesNotMatch(html,/يلزم ربط|Timetable connection required|0%|100%|<button|<input|<textarea/);
  const missing=renderToStaticMarkup(React.createElement(Notice,{availability:'missing',arabic}));assert.match(missing,arabic?/يلزم ربط/:/Timetable connection required/);
  assert.equal(renderToStaticMarkup(React.createElement(Notice,{availability:'ready',arabic})), '');
});
test('production editor keeps unfiltered diagnosis out of saving, progress and gap lists; zero lessons never imply 0% work',()=>{
  assert.match(source,/selectedClassSlots = useMemo\(\(\) => assignedPlanSlotsForWeek\(timetableSlots, assignments, profileId, selectedClassId, slotWeek, schoolHolidays\)/);
  assert.equal(source.match(/schoolHolidays, true\)/g)?.length,1);
  assert.match(source,/selectedClassSlots.length > 0 \? <EditorProgressTools[\s\S]*?<EditorTimetableNotice availability=\{editorTimetableState\}/);
  assert.match(source,/selectedClassSlots.length > 0 && builderStatus !== "new"/);
  assert.match(source,/!publishedEditPlanId && selectedClassSlots.length > 0 && <b/);
  assert.doesNotMatch(source,/يتوقف الحفظ حتى يتم ربط|Saving is blocked until the timetable is connected/);
  const guard=source.slice(source.indexOf('if (selectedClassSlots.length === 0) {'),source.indexOf('const englishSlotMissingProgramme'));
  assert.match(guard,/editorTimetableText.detail/);assert.match(guard,/return;/);assert.doesNotMatch(guard,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
  assert.match(source,/assignedPlanSlotsForWeek\(timetableSlots, assignments, profileId, schoolClass.id, dashboardWeek, schoolHolidays\).length > 0/);
  assert.match(source,/assignedPlanSlotsForWeek\(timetableSlots, teacher.assignments, teacher.userId, assignment.classId, dashboardWeek, schoolHolidays\).some/);
});

function dashboardValue(name,bindings) {
  let declaration;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(file)===name)declaration=node;else ts.forEachChild(node,visit);}
  visit(file);assert.ok(declaration);
  const js=ts.transpileModule('const '+declaration.getText(file)+';',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  return new Function(...Object.keys(bindings),js+';return '+name+';')(...Object.values(bindings));
}
test('actual teacher and supervisor follow-up do not demand a holiday-only class, including an existing saved draft',()=>{
  const ownAssignments=[...assignments,{classId:'4A',subjectId:'art',grade:4,section:'A'}];
  const timetableSlots=[slot('sun',0),slot('mon',1,{class_id:'4A'})];
  const dashboardPlans=[{planId:'saved-plan',classId:'5B',status:'draft'}];
  const before=structuredClone(dashboardPlans);
  const bindings={assignedPlanSlotsForWeek:assigned,assignments:ownAssignments,profileId:'teacher',timetableSlots,dashboardWeek:{id:'week8',week_number:8},schoolHolidays:holidays,dashboardPlans,assignedClassChoices:[{id:'5B'},{id:'4A'}],departmentTeachers:[{userId:'teacher',name:'Synthetic teacher',assignments:ownAssignments}],reviewItems:[],dashboardWeekId:'week8'};
  assert.deepEqual(dashboardValue('actionablePlans',bindings),[]);
  assert.deepEqual(dashboardValue('unstartedClasses',{...bindings,dashboardPlans:[]}),[{id:'4A'}]);
  assert.deepEqual(dashboardValue('missingTeacherClassPlans',bindings).map(c=>c.classId),['4A']);
  const nextWeek={...bindings,dashboardWeek:{id:'week9',week_number:9},dashboardWeekId:'week9'};
  assert.equal(dashboardValue('actionablePlans',nextWeek).length,1);
  assert.deepEqual(dashboardValue('missingTeacherClassPlans',nextWeek).map(c=>c.classId),['5B','4A']);
  assert.deepEqual(dashboardPlans,before,'Existing plans and statuses are not rewritten');
});
