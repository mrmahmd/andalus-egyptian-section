import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as helpers from '../lib/weekly-editor-tools.ts';
const {copyLessonDraft,editorLessonProgress,blankLessonDraft}=helpers;
const require=createRequire(import.meta.url);
const slot=(id,subject='english',overrides={})=>({id,class_id:'4A',subject_id:subject,day_of_week:0,period_number:1,requires_weekly_plan_submission:true,...overrides});
const slots=[slot('source'),slot('target'),slot('second'),slot('other','arabic')];
const draft=(overrides={})=>({...blankLessonDraft(),...overrides});
const fields={classwork:true,homework:false,classeraNotes:false};

test('copy selected fields only, preserve other fields and all source data, and copy AL/OL with Classwork',()=>{
  const drafts={source:draft({classwork:'Lesson 1',homework:'Page 2',classeraNotes:'Bring book',englishProgramme:'AL'}),target:draft({homework:'Keep homework',classeraNotes:'Keep notes'})};
  const before=structuredClone(drafts);
  const result=copyLessonDraft(slots,drafts,'source',['target','target'],fields);
  assert.equal(result.status,'copied');assert.equal(result.count,1);
  assert.deepEqual(result.drafts.target,draft({classwork:'Lesson 1',englishProgramme:'AL',homework:'Keep homework',classeraNotes:'Keep notes'}));
  assert.deepEqual(drafts,before);assert.notEqual(result.drafts.target,drafts.target);
});
test('homework-only copy leaves Classwork and programme untouched',()=>{
  const drafts={source:draft({homework:'New homework',englishProgramme:'AL'}),target:draft({classwork:'Keep classwork',englishProgramme:'OL'})};
  const result=copyLessonDraft(slots,drafts,'source',['target'],{classwork:false,homework:true,classeraNotes:false});
  assert.equal(result.status,'copied');assert.deepEqual(result.drafts.target,draft({classwork:'Keep classwork',englishProgramme:'OL',homework:'New homework'}));
});
test('written destination requires exact-content confirmation; cancellation performs no mutation',()=>{
  const drafts={source:draft({classwork:'New'}),target:draft({classwork:'Old',homework:'Keep'})};
  const before=structuredClone(drafts);
  const warning=copyLessonDraft(slots,drafts,'source',['target'],fields);
  assert.equal(warning.status,'conflict');assert.deepEqual(warning.targetIds,['target']);assert.deepEqual(drafts,before);
  const result=copyLessonDraft(slots,drafts,'source',['target'],fields,warning.confirmationToken);
  assert.equal(result.status,'copied');assert.equal(result.drafts.target.classwork,'New');assert.equal(result.drafts.target.homework,'Keep');
  const changed={...drafts,target:draft({classwork:'New unseen writing'})};
  assert.equal(copyLessonDraft(slots,changed,'source',['target'],fields,warning.confirmationToken).status,'conflict');
  assert.equal(copyLessonDraft(slots,{...drafts,source:draft({classwork:'Changed source'})},'source',['target'],fields,warning.confirmationToken).status,'conflict');
});
test('invalid, excluded, different-subject and different-class destinations cause no partial copy',()=>{
  const drafts={source:draft({classwork:'Source'})};
  const available=[...slots,slot('different-class','english',{class_id:'4B'}),slot('fixed','english',{requires_weekly_plan_submission:false})];
  for(const ids of [[],['source'],['target','unknown'],['target','other'],['target','different-class'],['target','fixed']])assert.equal(copyLessonDraft(available,drafts,'source',ids,fields).status,'invalid');
  assert.equal(copyLessonDraft(slots,drafts,'unknown',['target'],fields).status,'invalid');
  assert.equal(copyLessonDraft(slots,drafts,'source',['target'],{classwork:false,homework:false,classeraNotes:false}).status,'invalid');
  assert.equal(copyLessonDraft(slots,{source:blankLessonDraft()},'source',['target'],fields).status,'invalid');
  assert.deepEqual(drafts,{source:draft({classwork:'Source'})});
});
test('progress uses Classwork only, counts required unique slots, and distinguishes zero lessons from completion',()=>{
  const rows=[slot('first'),slot('second'),slot('third'),slot('first'),slot('fixed','arabic',{requires_weekly_plan_submission:false})];
  const drafts={first:draft({classwork:'Written'}),second:draft({classwork:'  ',homework:'Homework only'}),third:draft({classeraNotes:'Notes only'})};
  const p=editorLessonProgress(rows,drafts);assert.equal(p.total,3);assert.equal(p.completed,1);assert.equal(p.percent,33);assert.deepEqual(p.missing.map(row=>row.id),['second','third']);
  assert.equal(editorLessonProgress([],{}).percent,0);
  assert.equal(editorLessonProgress(rows,{...drafts,second:draft({classwork:'Done'}),third:draft({classwork:'Done'})}).percent,100);
});

const componentSource=await readFile(new URL('../app/teachers/weekly-editor-tools.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(componentSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function harness(component,props) {
  const states=[];let cursor=0;
  const react={...require('react'),useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useEffect(){},useRef(){return{current:null};}};
  const module={exports:{}};new Function('require','module','exports',compiled)(name=>name==='react'?react:name==='../../lib/weekly-editor-tools'?helpers:require(name),module,module.exports);
  return{props,render(){cursor=0;return module.exports[component](props);}};
}
function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
function text(tree){return typeof tree==='string'||typeof tree==='number'?String(tree):Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):'';}
function button(tree,label){return nodes(tree).find(node=>node.type==='button'&&text(node)===label);}
test('actual copy dialog selects fields and targets, warns before replacement, and keeps cancellation write-free',()=>{
  const drafts={source:draft({classwork:'New'}),target:draft({classwork:'Existing',homework:'Keep'})};let copies=0,closed=0;
  const h=harness('LessonCopyDialog',{source:slots[0],targets:[slots[1]],arabic:true,subject:'English',busy:false,onClose(){closed++;},onApply(ids,f,token){const result=copyLessonDraft(slots,drafts,'source',ids,f,token);if(result.status==='copied')copies++;return result;}});
  let tree=h.render();assert.equal(button(tree,'نسخ إلى الحصص المختارة').props.disabled,true);
  const target=nodes(tree).filter(node=>node.type==='input').at(-1);target.props.onChange({target:{checked:true}});
  tree=h.render();button(tree,'نسخ إلى الحصص المختارة').props.onClick();tree=h.render();assert.equal(copies,0);assert.match(text(tree),/تنبيه: توجد كتابة/);
  button(tree,'إلغاء').props.onClick();assert.equal(closed,1);assert.equal(copies,0);
  button(tree,'تأكيد استبدال الخانات المختارة').props.onClick();assert.equal(copies,1);
});
test('copy dialog waits for ongoing saves and changing selected fields clears old replacement confirmation',()=>{
  let calls=0;const h=harness('LessonCopyDialog',{source:slots[0],targets:[slots[1]],arabic:false,subject:'English',busy:true,onClose(){},onApply(){calls++;return{status:'conflict',targetIds:['target'],confirmationToken:'token'};}});
  let tree=h.render();nodes(tree).filter(node=>node.type==='input').at(-1).props.onChange({target:{checked:true}});tree=h.render();assert.equal(button(tree,'Saving…').props.disabled,true);button(tree,'Saving…').props.onClick();assert.equal(calls,0);
  h.props.busy=false;tree=h.render();button(tree,'Copy to selected lessons').props.onClick();tree=h.render();assert.ok(button(tree,'Confirm selected-field replacement'));
  nodes(tree).filter(node=>node.type==='input')[1].props.onChange({target:{checked:true}});tree=h.render();assert.ok(button(tree,'Copy to selected lessons'));
});
test('progress controls are translated, interactive and never imply that 100% means saved or sent',()=>{
  for(const arabic of [true,false]) {
    let toggled;let jumped=0;const h=harness('EditorProgressTools',{slots:[slots[0],slots[1]],drafts:{source:draft({classwork:'Done'})},arabic,missingOnly:false,hydrated:true,onMissingOnly:value=>{toggled=value;},onNextMissing(){jumped++;}});
    const tree=h.render();assert.match(text(tree),arabic ? /ليس تأكيدًا للحفظ/ : /not a save or submission confirmation/);
    assert.equal(nodes(tree).find(node=>node.props?.role==='progressbar').props['aria-valuenow'],50);
    nodes(tree).filter(node=>node.type==='button')[0].props.onClick();assert.equal(toggled,true);
    nodes(tree).filter(node=>node.type==='button')[1].props.onClick();assert.equal(jumped,1);
  }
});
test('actual editor integration preserves permissions, copying between classes and focus while filtering',async()=>{
  const source=await readFile(new URL('../app/teachers/page.tsx',import.meta.url),'utf8');
  assert.match(source,/copyLessonDraft\(writableCopySlots, slotDrafts/);
  assert.match(source,/!weeklyBuilderReadOnly && \(Boolean\(publishedEditPlanId\)/);
  assert.match(source,/builderStatus !== "submitted" && builderStatus !== "approved"/);
  assert.match(source,/publishedEditPlanId \? approvedSubjectIds\.has\(slot.subject_id\) : !approvedSubjectIds\.has/);
  assert.match(source,/missingLessonIds\.has\(slot.id\) \|\| slot.id === focusedLessonId/);
  assert.match(source,/onBlurCapture/);assert.match(source,/id=\{`weekly-editor-lesson-/);
  assert.match(source,/rpc\("copy_my_weekly_plan"/);assert.match(source,/verifyTeacherWeekAccess\(selectedWeek.id\)/);
});
