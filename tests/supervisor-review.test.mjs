import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTeacherCompletion, reviewSelectedSubmissions } from '../lib/supervisor-review.ts';

const requirements = [
  { teacherId:'t1', teacherName:'Teacher 1', classId:'a', className:'4A', subjectId:'english' },
  { teacherId:'t1', teacherName:'Teacher 1', classId:'a', className:'4A', subjectId:'discover' },
  { teacherId:'t1', teacherName:'Teacher 1', classId:'b', className:'4B', subjectId:'english' },
  { teacherId:'t2', teacherName:'Teacher 2', classId:'a', className:'4A', subjectId:'arabic' },
];
test('one row per teacher, unique missing classes, all assigned subjects required', () => {
  const result = summarizeTeacherCompletion([...requirements,requirements[1]], [{teacherId:'t1',classId:'a',subjectId:'english',status:'submitted'}]);
  assert.equal(result.length,2);
  assert.deepEqual(result[0].missingClasses,['4A','4B']);
  assert.equal(result[0].required,2);
  assert.equal(result[0].waiting,1);
});
test('drafts remain missing; returned plans need changes; pending approvals are not missing', () => {
  const records = requirements.map((item) => ({...item,status:'submitted'}));
  let result = summarizeTeacherCompletion(requirements,records);
  assert.deepEqual(result[0].missingClasses,[]);
  assert.equal(result[0].waiting,2);
  records[0].status='draft'; records[1].status='changes_requested';
  result = summarizeTeacherCompletion(requirements,records);
  assert.deepEqual(result[0].missingClasses,['4A']);
  assert.deepEqual(result[0].returnedClasses,['4A']);
});
test('approval writes only explicit unique selection', async () => {
  const writes=[];
  const result=await reviewSelectedSubmissions(['a','a','b'],async(ids)=>assert.deepEqual(ids,['a','b']),async(id)=>writes.push(id));
  assert.deepEqual(writes,['a','b']); assert.equal(result.completed,2); assert.equal(result.error,null);
});
test('closed week or stale selection preflight blocks every write', async () => {
  let writes=0;
  const result=await reviewSelectedSubmissions(['a','b'],async()=>{throw new Error('closed or stale');},async()=>writes++);
  assert.equal(writes,0); assert.equal(result.completed,0); assert.ok(result.error);
});
test('failure stops later writes and accurately reports partial completion', async () => {
  const writes=[];
  const result=await reviewSelectedSubmissions(['a','b','c'],async()=>{},async(id)=>{writes.push(id); if(id==='b') throw new Error('failed');});
  assert.deepEqual(writes,['a','b']); assert.equal(result.completed,1); assert.ok(result.error);
});
