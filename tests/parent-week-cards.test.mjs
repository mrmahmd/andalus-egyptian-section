import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve('next/package.json'))('postcss');
const css=postcss.parse(await readFile(new URL('../app/globals.css',import.meta.url),'utf8'));
function declarations(selector,media=null){
 const matches=[];
 css.walkRules(rule=>{if(rule.selector===selector && (media===null ? rule.parent.type==='root' : rule.parent.params===media)) matches.push(rule);});
 assert.ok(matches.length,selector);
 return Object.fromEntries(matches.at(-1).nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));
}
test('parent week cards have content-sized rows rather than a large fixed minimum height',()=>{
 const card=declarations('.plan-directory .week-library-item');
 assert.equal(card['min-height'],'0');
 assert.equal(card['grid-template-rows'],'auto auto auto');
 assert.equal(card.padding,'14px');
 assert.equal(card.gap,'8px 10px');
 assert.equal(declarations('.plan-directory .week-number').width,'40px');
 assert.equal(declarations('.plan-directory .week-status')['grid-column'],'2');
});
test('responsive cards keep three, two and one columns without a tall mobile minimum',()=>{
 assert.equal(declarations('.plan-directory .week-library-list')['grid-template-columns'],'repeat(3, minmax(0, 1fr))');
 assert.equal(declarations('.plan-directory .week-library-list','(max-width: 1050px)')['grid-template-columns'],'repeat(2, minmax(0, 1fr))');
 assert.equal(declarations('.plan-directory .week-library-list','(max-width: 700px)')['grid-template-columns'],'1fr');
 assert.equal(declarations('.plan-directory .week-library-item','(max-width: 700px)')['min-height'],'0');
});
test('compact card buttons keep touch targets and English overrides do not inflate cards',()=>{
 const button=declarations('.plan-directory .week-actions button');
 assert.equal(button['min-height'],'44px');
 assert.equal(button['min-width'],'0');
 assert.equal(button['overflow-wrap'],'anywhere');
 assert.equal(declarations('body:not(.arabic-ui) .plan-directory .week-actions button')['font-size'],'13px');
 assert.equal(declarations('body:not(.arabic-ui) .plan-directory .week-status')['font-size'],'12px');
 assert.equal(declarations('body:not(.arabic-ui) .plan-directory .week-details strong')['font-size'],'18px');
});
test('week actions still use the existing real plan selection and print handlers',async()=>{
 const page=await readFile(new URL('../app/weekly-plan/page.tsx',import.meta.url),'utf8');
 assert.match(page,/className="week-view-button" onClick=\{\(\) => openPlan\(plan.weekNumber\)\}/);
 assert.match(page,/className="week-download-button" onClick=\{\(\) => \{ openPlan\(plan.weekNumber\); window.setTimeout\(\(\) => window.print\(\), 150\); \}\}/);
});
