import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as helpers from '../lib/parent-plan-reader.ts';
import * as exams from '../lib/october-exam.ts';
const require=createRequire(import.meta.url);
const holidaySource=await readFile(new URL('../app/weekly-plan/plan-holiday.tsx',import.meta.url),'utf8');
const holidayModule={exports:{}};
new Function('require','module','exports',ts.transpileModule(holidaySource.replace('import "./plan-holiday.css";',''),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(require,holidayModule,holidayModule.exports);
const source=await readFile(new URL('../app/weekly-plan/parent-plan-reader.tsx',import.meta.url),'utf8');
const css=await readFile(new URL('../app/weekly-plan/parent-plan-reader.css',import.meta.url),'utf8');
const approvedTableMarkup="<table className=\"weekly-table\"><colgroup><col className=\"day-column\" /><col className=\"course-column\" /><col className=\"classwork-column\" /><col className=\"homework-column\" /><col className=\"classera-column\" /></colgroup><thead><tr><th>Day</th><th>Course</th><th>Classwork</th><th>Homework</th><th>Classera Notes</th></tr></thead>{days.map(({ day, lessons }) => <tbody className=\"weekly-day-group\" key={day}>{lessons.map((lesson, lessonIndex) => <tr key={`${day}-${lesson.period_number}`} className={lessonIndex === 0 ? \"new-day\" : \"\"}>{lessonIndex === 0 && <td className=\"day-cell\" rowSpan={lessons.length} aria-label={day}>{day.slice(0, 3)}</td>}<td className=\"course-cell\">{lesson.course}</td><td className={isOctoberExam(selectedPlan.weekNumber, lesson.period_number, lesson.day_of_week, selectedPlan.grade) ? \"october-exam-cell\" : lesson.classwork === \"Plan not published\" ? \"unpublished-plan\" : \"\"}>{lesson.classwork || \"—\"}</td><td>{lesson.homework || \"—\"}</td><td>{lesson.notes || \"—\"}</td></tr>)}</tbody>)}</table>";
const compiled=ts.transpileModule(source.replace('import "./parent-plan-reader.css";',''),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const days=helpers.parentReaderDays.map((day,day_of_week)=>({day,lessons:[{day_of_week,period_number:3,course:'English',classwork:'Content '+day,homework:'Page 3',notes:'Bring book'}]}));
function harness(props={}){
  const states=[];let cursor=0;const effects=[];
  const react={...require('react'),useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],value=>{states[i]=value;}];},useEffect(fn){effects.push(fn);}};
  const module={exports:{}};
  new Function('require','module','exports',compiled)(name=>name==='react'?react:name==='../../lib/parent-plan-reader'?helpers:name==='../../lib/october-exam'?exams:name==='./plan-holiday'?holidayModule.exports:require(name),module,module.exports);
  const child=require('react').createElement('table',{'data-original':'approved'},'All five days');
  const p={days,grade:4,weekNumber:6,arabic:false,children:child,...props};
  return{props:p,child,effects,render(){cursor=0;return module.exports.default(p);}};
}
function nodes(tree){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
function text(tree){return typeof tree==='string'||typeof tree==='number'?String(tree):Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):'';}
function button(tree,label){return nodes(tree).find(node=>node.type==='button'&&text(node)===label);}

test('size preference validates values and handles both denied storage access and method errors',()=>{
  for(const value of [null,undefined,'unknown','normal'])assert.equal(helpers.parentReaderSize(value),'normal');
  for(const value of ['large','larger'])assert.equal(helpers.parentReaderSize(value),value);
  assert.equal(helpers.readParentReaderSize(()=>{throw Error('Denied');}),'normal');
  assert.equal(helpers.readParentReaderSize(()=>({getItem(){throw Error('Denied');}})),'normal');
  assert.doesNotThrow(()=>helpers.rememberParentReaderSize(()=>{throw Error('Denied');},'larger'));
  assert.doesNotThrow(()=>helpers.rememberParentReaderSize(()=>({setItem(){throw Error('Full');}}),'large'));
  let saved;helpers.rememberParentReaderSize(()=>({setItem(key,value){saved=[key,value];}}),'large');
  assert.deepEqual(saved,['andalus-parent-reader-size','large']);
  assert.equal(helpers.readParentReaderSize(()=>({getItem(){return'larger';}})),'larger');
});
test('missing and invalid selected days fall back to full week',()=>{
  assert.equal(helpers.selectedReaderDay('Tuesday',['Tuesday']),'Tuesday');
  for(const day of [null,'Friday','Monday'])assert.equal(helpers.selectedReaderDay(day,['Tuesday']),null);
});
test('day selection changes screen attribute only: original table and all five card groups stay intact',()=>{
  const h=harness();let tree=h.render();
  assert.equal(tree.props['data-reader-day'],'all');assert.equal(button(tree,'Full week').props['aria-pressed'],true);
  for(const day of helpers.parentReaderDays){
    button(tree,day).props.onClick();tree=h.render();
    assert.equal(tree.props['data-reader-day'],day);
    assert.equal(nodes(tree).filter(node=>node.type==='section').length,5);
    assert.ok(nodes(tree).includes(h.child));
    assert.ok(nodes(tree).every(node=>!node.props?.hidden));
    assert.equal(button(tree,day).props['aria-pressed'],true);
  }
  button(tree,'Full week').props.onClick();assert.equal(h.render().props['data-reader-day'],'all');
  h.props.days=[days[0]];button(tree,'Thursday').props.onClick();assert.equal(h.render().props['data-reader-day'],'all');
});
test('text controls work without storage, never modify plan content, and reset day on new reader mount',()=>{
  const h=harness();const before=structuredClone(days);
  let tree=h.render();button(tree,'Large').props.onClick();tree=h.render();
  assert.equal(tree.props['data-reader-size'],'larger');assert.ok(nodes(tree).includes(h.child));
  button(tree,'Normal').props.onClick();assert.equal(h.render().props['data-reader-size'],'normal');
  button(tree,'Sunday').props.onClick();assert.equal(harness().render().props['data-reader-day'],'all');
  assert.deepEqual(days,before);
});
test('Arabic controls are translated while public cards retain English labels and LTR direction',()=>{
  const tree=harness({arabic:true}).render();assert.equal(tree.props.dir,'ltr');
  assert.ok(button(tree,'الأسبوع كاملًا'));assert.ok(button(tree,'الثلاثاء'));assert.ok(button(tree,'متوسط'));
  assert.equal(nodes(tree).find(node=>node.props?.className==='parent-reader-controls').props.dir,'rtl');
  const cards=nodes(tree).find(node=>node.props?.className==='parent-reader-cards');
  assert.equal(cards.props.dir,'ltr');assert.match(text(cards),/Sunday.*Classwork.*Homework.*Classera Notes/);
});
test('size labels are normal, medium and large in order without changing their stored sizes',()=>{
  for(const arabic of [true,false]){
    const h=harness({arabic});
    const labels=arabic?['عادي','متوسط','كبير']:['Normal','Medium','Large'];
    const group=nodes(h.render()).find(node=>node.props?.className==='parent-reader-size-controls');
    assert.deepEqual(nodes(group).filter(node=>node.type==='button').map(text),labels);
    for(const [index,label] of labels.entries()){
      button(h.render(),label).props.onClick();
      assert.equal(h.render().props['data-reader-size'],['normal','large','larger'][index]);
    }
  }
});
test('mobile cards preserve holiday, unpublished, mixed-language, multiline and long content',()=>{
  const lesson={day_of_week:0,period_number:0,course:'School holiday',classwork:'No classes today.\nالعطلة المدرسية '+ 'LongWord'.repeat(40),homework:'',notes:'School-wide holiday'};
  const tree=harness({days:[{day:'Sunday',lessons:[lesson,{...lesson,period_number:1,classwork:'Plan not published'}]}]}).render();
  assert.match(text(tree),/School holiday/);assert.ok(text(tree).includes(lesson.classwork));assert.match(text(tree),/—/);
  assert.equal(nodes(tree).filter(node=>node.type==='article'&&node.props.className.includes('is-unpublished')).length,1);
  assert.match(css,/white-space:pre-wrap/);assert.match(css,/overflow-wrap:anywhere/);
  assert.doesNotMatch(source,/dangerouslySetInnerHTML/);
});
test('exam styling is restricted to the existing Week 7 Grades 3+ rule',()=>{
  assert.equal(nodes(harness({weekNumber:7}).render()).filter(node=>node.type==='article'&&node.props.className.includes('is-exam')).length,5);
  for(const props of [{weekNumber:6},{weekNumber:8},{weekNumber:7,grade:1},{weekNumber:7,grade:2}])assert.equal(nodes(harness(props).render()).filter(node=>node.type==='article'&&node.props.className.includes('is-exam')).length,0);
});
test('print never applies day filters, size changes or mobile card layout; original paper markup remains',async()=>{
  const page=await readFile(new URL('../app/weekly-plan/page.tsx',import.meta.url),'utf8');
  assert.match(page,/<ParentPlanReader key=\{selectedPlan.id\}/);
  assert.match(page,/<tbody className="weekly-day-group" data-reader-day=\{day\}/);
  assert.match(page,/rowSpan=\{lessons.length\}/);
  assert.match(page,/<colgroup><col className="day-column"/);
  const regularTable=page.match(/<table className="weekly-table">.*?<\/table>/s)[0]
    .replace(' data-reader-day={day}','')
    .replace(/ data-plan-script=\{parentPlanTextScript\(lesson\.(classwork|homework|notes)\)\}/g,'')
    .replace('({ day, lessons, holiday })','({ day, lessons })')
    .replace('holiday ? <PlanHolidayRow title={holiday.title} day={day} /> : lessons.map(', 'lessons.map(');
  assert.equal(regularTable,approvedTableMarkup, 'Every non-holiday row keeps its approved markup');
  const print=css.slice(css.indexOf('@media print'));
  assert.match(print,/parent-reader-controls.*parent-reader-cards.*display:none!important/s);
  assert.doesNotMatch(print,/font-size|weekly-table|data-reader-day|table-wrap/);
  assert.match(css,/@media screen \{/);assert.match(css,/@media screen and \(max-width:700px\)/);
  assert.doesNotMatch(source,/supabase|fetch\(|\.filter\(|hidden=/);
});
