import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../lib/weekly-gap-report.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {missingTeacherLessons,teacherGapGroups,supervisorGapGroups}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const req=(subjectId,dayOfWeek,periodNumber)=>({subjectId,subjectName:subjectId,dayOfWeek,periodNumber});
test('a sent subject does not hide the same teacher’s unsent subject',()=>{
 const requirements=[req('English',0,1),req('Discover',0,2)];
 const entries=requirements.map(row=>({...row,hasClasswork:true}));
 assert.deepEqual(missingTeacherLessons(requirements,entries,[{subjectId:'English',status:'submitted'},{subjectId:'Discover',status:'draft'}]).map(row=>[row.subjectId,row.reason,row.written]),[['Discover','unsent',true]]);
});
test('returned work, empty sent lessons and written unsent work remain distinct',()=>{
 const requirements=[req('A',2,4),req('B',0,2),req('C',1,3),req('C',1,3)];
 const entries=[{...req('A',2,4),hasClasswork:true},{...req('C',1,3),hasClasswork:true}];
 const result=missingTeacherLessons(requirements,entries,[{subjectId:'A',status:'changes_requested'},{subjectId:'B',status:'approved'}]);
 assert.deepEqual(result.map(row=>[row.dayOfWeek,row.reason,row.written]),[[0,'empty',false],[1,'unsent',true],[2,'returned',true]]);
});
test('teachers appear once with sorted classes and numeric period ordering',()=>{
 const make=(grade,section,missing)=>({key:grade+section,teacherId:'t',teacherName:'معلم',grade,section,completed:0,total:missing.length,missing});
 const missing=[{...req('English',0,10),reason:'unsent',written:true},{...req('English',0,2),reason:'unsent',written:true}];
 const result=teacherGapGroups([make(9,'B',missing),make(2,'A',missing)],true);
 assert.equal(result.length,1);assert.equal(result[0].count,4);assert.match(result[0].blocks[0].title,/الصف 2/);assert.equal(result[0].blocks[0].rows[0].cells[2],'2، 10');assert.match(result[0].blocks[0].rows[0].cells[3],/المحتوى مكتوب/);
});
test('supervisor groups show oldest submissions first and keep people with identical names separate',()=>{
 const make=(supervisorId,date,teacher)=>({key:teacher,supervisorId,supervisorName:'مشرف',teacherName:teacher,grade:4,section:'A',subjects:['English'],submittedAt:date});
 const groups=supervisorGapGroups([make('s','2026-10-05T12:00:00Z','Recent'),make('s','2026-10-01T12:00:00Z','Older'),make('other','2026-10-02T12:00:00Z','Other')],true,Date.parse('2026-10-06T12:00:00Z'));
 assert.equal(groups.length,2);assert.equal(groups.find(row=>row.id==='s').blocks[0].rows[0].cells[0],'Older');assert.match(groups.find(row=>row.id==='s').blocks[0].rows[0].cells[3],/5 يوم/);
});
