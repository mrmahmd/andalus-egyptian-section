import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=(await readFile(new URL('../app/teachers/supervisor-review-queue.tsx',import.meta.url),'utf8')).replace('import "./supervisor-review-queue.css";','');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const plan=(key,status='submitted')=>({key,status,teacherId:key,teacherName:key,className:'4A',note:'',entries:[],missingLessons:[],quizzes:[],dictations:[]});
// Isolated component event harness: real JSX objects, local hook state, no DOM
// or Supabase writes. Existing RPC/RLS tests cover the approval callback.
function harness(overrides={}) {
  const states=[];let cursor=0;const writes=[];
  const react={...require('react'),useState(initial){const index=cursor++;if(!(index in states))states[index]=initial;return[states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}];},useEffect(){},useRef(){return{current:null};}};
  const module={exports:{}};
  new Function('require','module','exports',compiled)(name=>name==='react'?react:require(name),module,module.exports);
  const props={plans:[plan('pending1'),plan('approved','approved'),plan('returned','changes_requested'),plan('draft','draft'),plan('pending2')],teachers:[],arabic:true,open:true,saving:false,onReview:async()=>{},onApprove:async(keys)=>{writes.push(keys);},...overrides};
  return {writes,render(){cursor=0;return module.exports.default(props);},props};
}
function nodes(tree) {if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return [tree,...nodes(tree.props?.children)];}
const allButton=tree=>nodes(tree).find(node=>node.props?.['data-testid']==='approve-all-submitted');
const text=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):'';
const button=(tree,label)=>nodes(tree).find(node=>node.type==='button'&&text(node)===label);
test('bulk button is visible, counts only submitted plans and requires confirmation before any approval',async()=>{
  const h=harness();let tree=h.render();const all=allButton(tree);
  assert.equal(all.props.disabled,false);assert.match(text(all),/اعتماد جميع الخطط المرسلة \(2\)/);
  all.props.onClick();tree=h.render();assert.equal(h.writes.length,0);
  const dialog=nodes(tree).find(node=>node.props?.role==='dialog');
  assert.match(text(dialog),/pending1/);assert.match(text(dialog),/pending2/);
  assert.doesNotMatch(text(dialog),/approved|returned|draft/);
  button(tree,'تأكيد الاعتماد').props.onClick();await Promise.resolve();
  assert.deepEqual(h.writes,[['pending1','pending2']]);
});
test('cancel never approves; selected-only action remains available',()=>{
  const h=harness();let tree=h.render();allButton(tree).props.onClick();tree=h.render();button(tree,'إلغاء').props.onClick();tree=h.render();
  assert.equal(h.writes.length,0);assert.ok(!nodes(tree).some(node=>node.props?.role==='dialog'));
  assert.ok(button(tree,'اعتماد الخطط المحددة'));
});
test('bulk button stays visible but disabled for a closed week, saving or no submitted plans',()=>{
  for(const overrides of [{open:false},{saving:true},{plans:[plan('approved','approved')]}])assert.equal(allButton(harness(overrides).render()).props.disabled,true);
});
test('bulk confirmation cannot include classes or weeks absent from the supplied scope',async()=>{
  const h=harness({plans:[plan('chosen-class-week')]});let tree=h.render();allButton(tree).props.onClick();tree=h.render();button(tree,'تأكيد الاعتماد').props.onClick();await Promise.resolve();
  assert.deepEqual(h.writes,[['chosen-class-week']]);
});
test('a plan that is no longer submitted is excluded at confirmation time',async()=>{
  const h=harness();allButton(h.render()).props.onClick();h.props.plans=[plan('pending1','approved'),plan('pending2')];const tree=h.render();button(tree,'تأكيد الاعتماد').props.onClick();await Promise.resolve();assert.deepEqual(h.writes,[['pending2']]);
});
