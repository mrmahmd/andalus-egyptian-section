import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hasHorizontalTeacherEditor,readTeacherEditorLayout,rememberTeacherEditorLayout} from '../lib/teacher-editor-layout.ts';
test('the horizontal DEFAULT remains enabled for the confirmed active teacher account only',()=>{
  assert.equal(hasHorizontalTeacherEditor({username:'m.abdelhameed',role:'teacher',status:'active'}),true);
  for(const username of ['mrmahmd','msaid','ahmed.hassan2030','m.abdelhameed2','m.abdelhamid',''])assert.equal(hasHorizontalTeacherEditor({username,role:'teacher',status:'active'}),false);
  for(const role of ['admin','super_admin',null])assert.equal(hasHorizontalTeacherEditor({username:'m.abdelhameed',role,status:'active'}),false);
  for(const status of ['inactive','pending',null])assert.equal(hasHorizontalTeacherEditor({username:'m.abdelhameed',role:'teacher',status}),false);
  assert.equal(hasHorizontalTeacherEditor(null),false);assert.equal(hasHorizontalTeacherEditor(undefined),false);
});
test('layout is derived from the effective loaded profile and is applied only to the editor modal',async()=>{
  const source=await readFile(new URL('../app/teachers/page.tsx',import.meta.url),'utf8');
  assert.match(source,/\.eq\("user_id", targetUserId\)/);
  assert.match(source,/hasHorizontalTeacherEditor\(profile\) \? "rows" : "columns"/);
  assert.match(source,/readTeacherEditorLayout\(\(\) => window.localStorage, targetUserId/);
  assert.match(source,/setHorizontalEditor\(editorLayout === "rows"\)/);
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
test('every horizontal layout CSS selector is editor-scoped; desktop lesson fields align side-by-side and mobile stays readable',async()=>{
  const css=await readFile(new URL('../app/teachers/horizontal-editor.css',import.meta.url),'utf8');
  const selectors=css.replace(/\/\*[\s\S]*?\*\//g,'').match(/[^{}]+(?=\{)/g).filter(selector=>!selector.trim().startsWith('@'));
  for(const group of selectors)for(const selector of group.split(','))assert.match(selector,/\.weekly-editor-refresh\.weekly-editor-horizontal/);
  assert.match(css,/\.weekly-builder-days \{ display:grid; grid-template-columns:minmax\(0,1fr\)/);
  for(const [field,column] of [['classwork',2],['homework',3],['notes',4]])assert.match(css,new RegExp(`weekly-field-${field} \\{ grid-column:${column}; grid-row:1 / span 3`));
  assert.match(css,/@media\(max-width:900px\)/);
});

test('horizontal day title and lesson count stay centered together, without changing column view',async()=>{
  const css=await readFile(new URL('../app/teachers/horizontal-editor.css',import.meta.url),'utf8');
  const rule=css.match(/\.weekly-editor-refresh\.weekly-editor-horizontal \.weekly-builder-day > header \{([^}]+)\}/)?.[1];
  assert.ok(rule);assert.match(rule,/flex-direction:row/);assert.match(rule,/align-items:center/);
  assert.match(rule,/justify-content:center/);assert.match(rule,/gap:12px/);assert.match(rule,/text-align:center/);
  assert.doesNotMatch(rule,/space-between/);
  assert.match(css,/header > small \{ flex:0 0 auto; margin:0; width:auto;/);
});

test('period labels are larger and high contrast in both editor layouts, scoped away from the parent paper',async()=>{
  const css=await readFile(new URL('../app/teachers/lesson-period-label.css',import.meta.url),'utf8');
  assert.match(css,/@media screen/);
  assert.match(css,/\.teacher-portal:not\(\.super-admin-portal\) \.weekly-editor-refresh \.weekly-builder-day article > header > span:first-child/);
  assert.match(css,/font-size:20px/);assert.match(css,/font-weight:900/);
  assert.match(css,/background:#eaf5fd; color:#113c65/);
  assert.match(css,/white-space:nowrap/);assert.match(css,/min-height:38px/);
  assert.doesNotMatch(css,/weekly-editor-horizontal|plan-paper|weekly-table/);
  const page=await readFile(new URL('../app/teachers/page.tsx',import.meta.url),'utf8');
  assert.match(page,/import "\.\/lesson-period-label.css"/);
});

test('each teacher independently chooses either layout and the choice survives reload',()=>{
  const data=new Map();const storage=()=>({getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)});
  assert.equal(readTeacherEditorLayout(storage,'teacher-a','columns'),'columns');
  assert.equal(readTeacherEditorLayout(storage,'abdelhameed','rows'),'rows');
  assert.equal(rememberTeacherEditorLayout(storage,'teacher-a','rows'),true);
  assert.equal(rememberTeacherEditorLayout(storage,'abdelhameed','columns'),true);
  assert.equal(readTeacherEditorLayout(storage,'teacher-a','columns'),'rows');
  assert.equal(readTeacherEditorLayout(storage,'abdelhameed','rows'),'columns');
  assert.equal(readTeacherEditorLayout(storage,'teacher-b','columns'),'columns');
  assert.deepEqual([...data.values()].sort(),['columns','rows']);
  assert.ok([...data.keys()].every(key=>key.startsWith('andalus:teacher-editor-layout:v1:')));
});

test('blocked, unavailable or corrupt preference storage never prevents editing',()=>{
  const blocked=()=>{throw new Error('storage blocked');};
  assert.equal(readTeacherEditorLayout(blocked,'teacher-a','rows'),'rows');
  assert.equal(rememberTeacherEditorLayout(blocked,'teacher-a','rows'),false);
  const corrupt=()=>({getItem:()=>'<script>bad</script>',setItem(){throw new Error('quota');}});
  assert.equal(readTeacherEditorLayout(corrupt,'teacher-a','columns'),'columns');
  assert.equal(rememberTeacherEditorLayout(corrupt,'teacher-a','rows'),false);
  assert.equal(rememberTeacherEditorLayout(corrupt,'','rows'),false);
  assert.equal(readTeacherEditorLayout(blocked,'','columns'),'columns');
});

test('layout switching touches presentation/preferences only; it never saves, resets or rehydrates lesson drafts',async()=>{
  const source=await readFile(new URL('../app/teachers/page.tsx',import.meta.url),'utf8');
  const handler=source.slice(source.indexOf('const chooseEditorLayout ='),source.indexOf('const openWeeklyEditor ='));
  assert.match(handler,/setHorizontalEditor\(layout === "rows"\)/);
  assert.match(handler,/rememberTeacherEditorLayout\(\(\) => window.localStorage, profileId, layout\)/);
  assert.doesNotMatch(handler,/setSlotDrafts|saveWholeWeek|\.rpc\(|\.from\(|openWeeklyEditor|setWeeklyBuilder/);
  assert.match(source,/<EditorLayoutPicker value=\{horizontalEditor \? "rows" : "columns"\}/);
  assert.match(source,/previousLayout\?\.staffId === targetUserId \? previousLayout.layout : defaultLayout/);
  assert.match(source,/\}, \[profileId, selectedClassId, selectedWeekId, selectedClassSlots, weeklyBuilderOpen, savedParentPreview, selectedWeekStartsOn\]\)/);
});
