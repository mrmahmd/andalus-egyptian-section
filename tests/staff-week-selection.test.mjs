import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readStaffWeek,rememberStaffWeek,resolveStaffWeek} from '../lib/staff-week-selection.ts';
const weeks=[
  {id:'week1',week_number:1,is_current:true,teacher_entry_enabled:false},
  {id:'week5',week_number:5,is_current:false,teacher_entry_enabled:false},
  {id:'week6',week_number:6,is_current:false,teacher_entry_enabled:true},
  {id:'week7',week_number:7,is_current:false,teacher_entry_enabled:true},
];
function storage(){const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}
test('teachers and supervisors retain their selection across overview, reviews, plans and reload',()=>{
  for(const account of ['teacher','supervisor']) {
    const saved=storage();rememberStaffWeek(saved,account,'week6');
    let current=resolveStaffWeek(weeks,'',readStaffWeek(saved,account));
    for(const page of ['Overview','Teacher Reviews','Weekly Plans','Overview']) {
      assert.equal(resolveStaffWeek(weeks,current,readStaffWeek(saved,account)),'week6',page);
    }
    rememberStaffWeek(saved,account,'week7');
    current=resolveStaffWeek(weeks,'',readStaffWeek(saved,account));
    assert.equal(current,'week7');
  }
});
test('a closed remembered week remains selected despite newer open weeks',()=>{
  assert.equal(resolveStaffWeek(weeks,'','week5'),'week5');
  assert.equal(resolveStaffWeek(weeks,'week6','week5'),'week6');
  assert.equal(resolveStaffWeek(weeks.map(week=>({...week,teacher_entry_enabled:false})),'week7','week6'),'week7');
});
test('each account has its own remembered week, including delegated staff',()=>{
  const saved=storage();rememberStaffWeek(saved,'teacherA','week5');rememberStaffWeek(saved,'supervisorB','week7');
  assert.equal(readStaffWeek(saved,'teacherA'),'week5');assert.equal(readStaffWeek(saved,'supervisorB'),'week7');assert.equal(readStaffWeek(saved,'other'),'');
});
test('only an invalid or absent selection falls back; a stale Week 1 current flag does not override open weeks',()=>{
  assert.equal(resolveStaffWeek(weeks,'invalid','gone'),'week7');
  assert.equal(resolveStaffWeek(weeks,'invalid','week6'),'week6');
  assert.equal(resolveStaffWeek(weeks.map(week=>({...week,is_current:week.id==='week6'}))),'week6');
  assert.equal(resolveStaffWeek([]),'');
});
test('unavailable storage never breaks in-memory navigation or initialization',()=>{
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(readStaffWeek(blocked,'teacher'),'');assert.doesNotThrow(()=>rememberStaffWeek(blocked,'teacher','week6'));
  assert.equal(readStaffWeek(()=>{throw Error('property blocked');},'teacher'),'');
  assert.doesNotThrow(()=>rememberStaffWeek(()=>{throw Error('property blocked');},'teacher','week7'));
  assert.equal(resolveStaffWeek(weeks,'week6',readStaffWeek(blocked,'teacher')),'week6');
});
test('actual workspace uses one week state for all pages and keeps closed selections in the dropdown',async()=>{
  const source=await readFile(new URL('../app/teachers/page.tsx',import.meta.url),'utf8');
  assert.match(source,/const selectedReviewWeekId = dashboardWeekId;/);
  assert.match(source,/const selectedWeekId = dashboardWeekId;/);
  assert.doesNotMatch(source,/setSelectedReviewWeekId|setSelectedWeekId/);
  assert.match(source,/onChange=\{\(event\) => selectWorkspaceWeek\(event\.target\.value\)\}/);
  assert.match(source,/week\.id === dashboardWeekId \|\| week\.teacher_entry_enabled/);
  assert.match(source,/if \(!await verifySupervisorWeekAccess\(selectedReviewWeekId\)\)/);
  assert.match(source,/if \(!\(await verifyTeacherWeekAccess\(selectedWeek\.id\)\)\)/);
});
