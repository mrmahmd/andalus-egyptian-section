import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {isOctoberExam} from '../lib/october-exam.ts';
import * as readerHelpers from '../lib/parent-plan-reader.ts';
const require=createRequire(import.meta.url);
function load(source,bindings={}){const module={exports:{}};const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','module','exports',code)(id=>bindings[id]??require(id),module,module.exports);return module.exports;}
const source=await readFile(new URL('../app/weekly-plan/plan-holiday.tsx',import.meta.url),'utf8');
const holiday=load(source.replace('import "./plan-holiday.css";',''));
test('holiday keeps a visible day cell and merges only the other four columns',()=>{
 for(const title of ['Long Weekend','Long weekend',' long  weekend ']){
  const html=renderToStaticMarkup(React.createElement(holiday.PlanHolidayRow,{title,day:'Sunday'}));
  assert.equal((html.match(/<td/g)||[]).length,2);assert.match(html,/colSpan="4"/);assert.match(html,/<td class="day-cell">Sunday<\/td>/);assert.match(html,/>Long weekend<\/span>/);
  assert.doesNotMatch(html,/No classes today|School-wide holiday|Homework|Classera|rowSpan|colSpan="5"/);
  assert.match(html,/aria-label="Sunday school holiday"/);
 }
 assert.equal(holiday.holidayDisplayTitle('National Day'),'National Day','Unrelated holidays are not renamed');
});
const page=await readFile(new URL('../app/weekly-plan/page.tsx',import.meta.url),'utf8');
const markup=page.match(/<table className="weekly-table">.*?<\/table>/s)[0];
// Production JSX references are injected as globals into the compiled render function.
const renderTable=load('import {PlanHolidayRow} from "./plan-holiday"; import {isOctoberExam} from "../../lib/october-exam"; import {parentPlanTextScript} from "../../lib/parent-plan-reader"; export default function Table({days,selectedPlan}) {return ('+markup+');}',{'./plan-holiday':holiday,'../../lib/october-exam':{isOctoberExam},'../../lib/parent-plan-reader':readerHelpers}).default;
test('actual public table ignores holiday lesson placeholders but keeps the next day timetable and text unchanged',()=>{
 const days=[{day:'Sunday',holiday:{title:'Long Weekend'},lessons:[{day_of_week:0,period_number:0,course:'Long Weekend',classwork:'No classes today.',homework:'—',notes:'School-wide holiday'}]},{day:'Monday',holiday:null,lessons:[{day_of_week:1,period_number:1,course:'English',classwork:'Keep this lesson',homework:'Keep homework',notes:'Keep Classera'}]}];
 const before=structuredClone(days);
 const html=renderToStaticMarkup(React.createElement(renderTable,{days,selectedPlan:{weekNumber:8,grade:5}}));
 assert.match(html,/colSpan="4"/);assert.match(html,/<td class="day-cell">Sunday<\/td>/);assert.equal((html.match(/Long weekend/g)||[]).length,1);
 assert.doesNotMatch(html,/No classes today|School-wide holiday/);assert.match(html,/>Monday<\/td>/);assert.match(html,/Keep this lesson/);assert.match(html,/Keep homework/);assert.match(html,/Keep Classera/);assert.deepEqual(days,before);
});
test('mobile holiday is one banner rather than Course/Classwork/Homework/Notes fields; normal cards are untouched',async()=>{
 const reader=await readFile(new URL('../app/weekly-plan/parent-plan-reader.tsx',import.meta.url),'utf8');
 const hooks={...React,useState:initial=>[initial,()=>{}],useEffect:()=>{}};
 const Reader=load(reader.replace('import "./parent-plan-reader.css";',''),{react:hooks,'../../lib/october-exam':{isOctoberExam},'../../lib/parent-plan-reader':readerHelpers,'./plan-holiday':holiday}).default;
 const tree=Reader({days:[{day:'Sunday',holiday:{title:'Long Weekend'},lessons:[]}],grade:5,weekNumber:8,arabic:true,children:null});
 const html=renderToStaticMarkup(tree);const cards=html.slice(html.indexOf('class="parent-reader-cards"'));
 assert.match(cards,/parent-holiday-card/);assert.match(cards,/Long weekend/);assert.match(cards,/<h3>Sunday<\/h3>/);assert.doesNotMatch(cards,/Classwork|Homework|Classera Notes|parent-reader-lesson/);
 assert.match(html,/الأحد/,'Holiday remains selectable through the existing day controls');
});
test('holiday typography and alignment are scoped, print-safe and independent of reading-size controls',async()=>{
 const css=await readFile(new URL('../app/weekly-plan/plan-holiday.css',import.meta.url),'utf8');
 assert.match(css,/text-align:center!important/);assert.match(css,/vertical-align:middle/);
 assert.match(css,/font-family:"Outfit"[\s\S]*?!important/);assert.match(css,/font-weight:800/);
 assert.match(css,/\.plan-page \.plan-paper \.parent-plan-reader \.parent-holiday-label/,'Outrank the global Arabic UI font rule');
 assert.match(css,/@media print[\s\S]*?parent-holiday-cell/);assert.match(css,/print-color-adjust:exact/);
 assert.doesNotMatch(css,/@page|\.paper-meta|\.plan-brand|table-layout|\.weekly-table td \{/);
});
