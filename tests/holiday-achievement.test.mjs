import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {isOctoberExam} from '../lib/october-exam.ts';
import {gradeEightHistoricalCounterpart} from '../lib/grade-eight-timetable.ts';
import {classApprovalState} from '../lib/school-publication.ts';
import {missingTeacherLessons} from '../lib/weekly-gap-report.ts';
const source=await readFile(new URL('../app/super-admin/page.tsx',import.meta.url),'utf8');
const file=ts.createSourceFile('admin.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function find(predicate){let result;function visit(n){if(!result&&predicate(n))result=n;if(!result)ts.forEachChild(n,visit);}visit(file);assert.ok(result);return result;}
const definition=name=>find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name).getText(file);
const variable=name=>find(n=>ts.isVariableDeclaration(n)&&n.name.getText(file)===name).getText(file);
const helpers=['hasCompletedTeachingWeek','completedLessonCount','lessonCompletionPercent'].map(definition).join('\n');
function evaluate(code,bindings){const js=ts.transpileModule(helpers+'\n'+code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;return new Function(...Object.keys(bindings),js)(...Object.values(bindings));}
const memo=(name,bindings)=>evaluate('const useMemo=cb=>cb();const '+variable(name)+';return '+name+';',bindings);
const reportCallback=find(n=>ts.isCallExpression(n)&&n.expression.getText(file)==='useEffect'&&n.arguments[0]?.getText(file).includes('const rowsByTeacher = new Map')).arguments[0];
const reportStatements=reportCallback.body.statements;
const end=reportStatements.findIndex(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText(file)==='teachers'));
assert.ok(end>0);
const reportCode=reportStatements.slice(1,end+1).map(s=>s.getText(file)).join('\n')+';return teachers;';
function fixture(week_number=8,writeSunday=false){
  const weekId='week'+week_number;
  const classes=[{id:'5B',grade:5,section:'B'},{id:'4A',grade:4,section:'A'}];
  const requirement=(classId,teacherId,subjectId,dayOfWeek,periodNumber)=>({classId,teacherId,subjectId,subjectName:subjectId,dayOfWeek,periodNumber,department:subjectId});
  const effectiveTimetableRequirements=[requirement('5B','art-teacher','Art',0,7),requirement('4A','art-teacher','Art',1,4),requirement('5B','english-teacher','English',0,3),requirement('5B','english-teacher','English',1,2),requirement('5B','english-teacher','English',2,3)];
  const accounts=[{userId:'art-teacher',staffId:'art-staff',name:'Synthetic Art',department:'Art',role:'Teacher'},{userId:'english-teacher',staffId:'english-staff',name:'Synthetic English',department:'English',role:'Teacher'}];
  const weeklyPlans=classes.map(c=>({id:'plan-'+c.id,classId:c.id,weekId,status:'draft',manualPublicationOverride:false}));
  const planSubmissions=[...new Map(effectiveTimetableRequirements.map(r=>[r.classId+r.teacherId,{weeklyPlanId:'plan-'+r.classId,teacherId:r.teacherId,subjectId:r.subjectId,subjectName:r.subjectName,status:'approved',updatedAt:'2026-10-20T12:00:00Z',submittedAt:'2026-10-20T12:00:00Z',reviewedAt:'2026-10-20T12:00:00Z'}])).values()];
  const planEntrySummaries=effectiveTimetableRequirements.map(r=>({...r,weeklyPlanId:'plan-'+r.classId,hasContent:r.dayOfWeek!==0||writeSunday,hasClasswork:r.dayOfWeek!==0||writeSunday}));
  const bindings={isOctoberExam,gradeEightHistoricalCounterpart,classApprovalState,accounts,classes,effectiveTimetableRequirements,weeklyPlans,planSubmissions,planEntrySummaries,schoolHolidays:[{week_id:'week8',day_of_week:0,title:'Long Weekend'}],selectedPlanWeekId:weekId,teacherPublicationOverrides:[],supervisorLinks:[]};
  const weeklyClassCoverage=memo('weeklyClassCoverage',bindings);
  const planTrackingRows=memo('planTrackingRows',bindings);
  const teachers=evaluate(reportCode,{...bindings,weeklyClassCoverage,planTrackingRows});
  return {bindings,weeklyClassCoverage,planTrackingRows,teachers};
}
test('Week 8 Sunday is excluded from actual school coverage, every teacher percentage and downloaded report classes',()=>{
  for(const writeSunday of [false,true]){
    const {bindings,weeklyClassCoverage,planTrackingRows,teachers}=fixture(8,writeSunday);
    assert.equal(weeklyClassCoverage.reduce((n,c)=>n+c.requiredLessons,0),3);
    assert.equal(weeklyClassCoverage.reduce((n,c)=>n+c.completedLessons,0),3);
    assert.ok(weeklyClassCoverage.every(c=>c.completionPercent===100));
    assert.equal(planTrackingRows.some(r=>r.teacher.userId==='art-teacher'&&r.classId==='5B'),false);
    assert.equal(teachers.length,2);assert.ok(teachers.every(t=>t.percent===100&&t.status==='مكتمل'));
    const art=teachers.find(t=>t.id==='art-staff');assert.deepEqual(art.completedClasses,['4A']);assert.deepEqual(art.incompleteClasses,[]);assert.equal(art.total,1);
    const holidayDays=new Set(bindings.schoolHolidays.filter(h=>h.week_id===bindings.selectedPlanWeekId).map(h=>h.day_of_week));
    const requirements=bindings.effectiveTimetableRequirements.filter(r=>!holidayDays.has(r.dayOfWeek));
    assert.deepEqual(missingTeacherLessons(requirements,bindings.planEntrySummaries,bindings.planSubmissions),[]);
  }
});
test('non-holiday weeks keep Sunday in the denominator; empty Monday or Tuesday still lowers Week 8 completion',()=>{
  const next=fixture(9);
  assert.equal(next.weeklyClassCoverage.reduce((n,c)=>n+c.requiredLessons,0),5);
  assert.equal(next.teachers.find(t=>t.id==='art-staff').percent,50);
  assert.equal(next.teachers.find(t=>t.id==='english-staff').percent,66);
  assert.ok(next.planTrackingRows.some(r=>r.teacher.userId==='art-teacher'&&r.classId==='5B'));
  const base=fixture(8);const bindings={...base.bindings,planEntrySummaries:base.bindings.planEntrySummaries.map(e=>e.teacherId==='english-teacher'&&e.dayOfWeek===2?{...e,hasClasswork:false,hasContent:false}:e)};
  const weeklyClassCoverage=memo('weeklyClassCoverage',bindings),planTrackingRows=memo('planTrackingRows',bindings);
  const teachers=evaluate(reportCode,{...bindings,weeklyClassCoverage,planTrackingRows});
  assert.equal(teachers.find(t=>t.id==='english-staff').percent,50);assert.equal(teachers.find(t=>t.id==='art-staff').percent,100);
});
