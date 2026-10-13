import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hasHorizontalTeacherEditor} from '../lib/teacher-editor-layout.ts';
test('horizontal editor is enabled for the confirmed active teacher account only',()=>{
  assert.equal(hasHorizontalTeacherEditor({username:'m.abdelhameed',role:'teacher',status:'active'}),true);
  for(const username of ['mrmahmd','msaid','ahmed.hassan2030','m.abdelhameed2','m.abdelhamid',''])assert.equal(hasHorizontalTeacherEditor({username,role:'teacher',status:'active'}),false);
  for(const role of ['admin','super_admin',null])assert.equal(hasHorizontalTeacherEditor({username:'m.abdelhameed',role,status:'active'}),false);
  for(const status of ['inactive','pending',null])assert.equal(hasHorizontalTeacherEditor({username:'m.abdelhameed',role:'teacher',status}),false);
  assert.equal(hasHorizontalTeacherEditor(null),false);assert.equal(hasHorizontalTeacherEditor(undefined),false);
});
test('layout is derived from the effective loaded profile and is applied only to the editor modal',async()=>{
  const source=await readFile(new URL('../app/teachers/page.tsx',import.meta.url),'utf8');
  assert.match(source,/\.eq\("user_id", targetUserId\)/);
  assert.match(source,/setHorizontalEditor\(hasHorizontalTeacherEditor\(profile\)\)/);
  assert.match(source,/weekly-editor-refresh \$\{horizontalEditor \? "weekly-editor-horizontal" : ""\}/);
  assert.equal((source.match(/weekly-editor-horizontal/g)||[]).length,1);
  // Same lesson nodes, same save/copy handlers, same read-only and exam restrictions.
  assert.match(source,/const daySlots = visibleClassSlots.filter/);
  assert.match(source,/daySlots.map\(\(slot\) =>/);
  assert.match(source,/verifyTeacherWeekAccess\(selectedWeek.id\)/);
  assert.match(source,/copyLessonDraft\(writableCopySlots, slotDrafts/);
  assert.match(source,/disabled=\{weeklyBuilderReadOnly\}/);
  assert.match(source,/isOctoberExam\(selectedWeek\?\.week_number, 3, index, selectedClass\?\.grade\)/);
});
test('every layout CSS selector is account-scoped; desktop lesson fields align side-by-side and mobile stays readable',async()=>{
  const css=await readFile(new URL('../app/teachers/horizontal-editor.css',import.meta.url),'utf8');
  const selectors=css.replace(/\/\*[\s\S]*?\*\//g,'').match(/[^{}]+(?=\{)/g).filter(selector=>!selector.trim().startsWith('@'));
  for(const group of selectors)for(const selector of group.split(','))assert.match(selector,/\.weekly-editor-refresh\.weekly-editor-horizontal/);
  assert.match(css,/\.weekly-builder-days \{ display:grid; grid-template-columns:minmax\(0,1fr\)/);
  for(const [field,column] of [['classwork',2],['homework',3],['notes',4]])assert.match(css,new RegExp(`weekly-field-${field} \\{ grid-column:${column}; grid-row:1 / span 3`));
  assert.match(css,/@media\(max-width:900px\)/);
});
