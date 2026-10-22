import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parentPlanTextScript } from '../lib/parent-plan-reader.ts';
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
const postcss = nextRequire('postcss');
const css = await readFile(new URL('../app/weekly-plan/parent-plan-reader.css', import.meta.url), 'utf8');
const root = postcss.parse(css);

test('all reading typography overrides are screen-only; print rules remain unchanged', () => {
  root.walkRules(rule => {
    if (!rule.nodes.some(n => n.type === 'decl' && /font-|line-height|letter-spacing|--reader-/.test(n.prop))) return;
    let media = rule.parent;
    while (media && media.type !== 'atrule') media = media.parent;
    assert.ok(media?.name === 'media' && media.params.startsWith('screen'), rule.selector);
  });
  const print = root.nodes.find(n => n.type === 'atrule' && n.params === 'print');
  assert.equal(print.nodes.length, 1);
  assert.equal(print.nodes[0].selector, '.parent-plan-reader .parent-reader-controls, .parent-plan-reader .parent-reader-cards');
  assert.equal(print.nodes[0].nodes[0].toString(), 'display:none!important');
});

test('screen fonts use Latin first with Arabic fallback, scoped beyond the Arabic shell', () => {
  const rule = root.nodes.find(n => n.type === 'atrule' && n.params === 'screen').nodes.find(n => n.type === 'rule' && n.selector.includes('.weekly-table td,'));
  assert.equal(rule.nodes[0].value, '"Plus Jakarta Sans","Alexandria","Cairo",sans-serif');
  assert.equal(rule.nodes[0].important, true);
  for (const selector of rule.selector.split(',')) assert.ok(selector.trim().startsWith('.plan-page .plan-paper .parent-plan-reader '));
});

test('column colours follow rowspans safely, without overriding holidays or exam status', () => {
  for (const selector of ['td:nth-last-child(3):not(.october-exam-cell):not(.unpublished-plan)', 'td:nth-last-child(2)', 'td:last-child']) {
    const rules = [];
    root.walkRules(rule => { if (rule.selector.endsWith(selector)) rules.push(rule); });
    assert.equal(rules.length, 1);
    assert.ok(rules[0].selector.includes('tr:not(.parent-holiday-row)'));
  }
  assert.match(css, /is-unpublished \.reader-classwork p \{ color:#8a4562/);
  assert.match(css, /is-exam \.reader-classwork p \{ font-weight:800; text-align:center; color:#9b287e/);
  assert.match(css, /td\.october-exam-cell \{ font-size:max\(var\(--reader-table-text-size\),17px\)!important; font-weight:800/);
});

test('normal, medium, large increase both table and card sizes; dark colours remain readable', () => {
  for (const [size, table, card] of [['normal',14.5,16], ['large',16,18], ['larger',18,20]]) {
    const selector = size === 'normal' ? '.parent-plan-reader' : `.parent-plan-reader[data-reader-size="${size}"]`;
    const rules = [];
    root.walkRules(rule => { if (rule.selector === selector) rules.push(rule); });
    assert.equal(rules[0].nodes.find(n => n.prop === '--reader-table-text-size').value, `${table}px`);
    assert.equal(rules[0].nodes.find(n => n.prop === '--reader-card-text-size').value, `${card}px`);
  }
  const luminance = hex => {
    const values = hex.match(/\w\w/g).map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
    return values[0]*.2126 + values[1]*.7152 + values[2]*.0722;
  };
  for (const ink of ['183c64','743775','116579']) for (const fill of ['ffffff','f5fcfd','f7f9fe','faf8fd','fff8fb','fff9f6']) {
    assert.ok((luminance(fill)+.05)/(luminance(ink)+.05) >= 4.5, `${ink} on ${fill}`);
  }
});

test('lesson text stays bold on desktop and mobile', () => {
  for (const selector of ['.plan-paper .parent-plan-reader .weekly-table td', '.parent-reader-lesson p']) {
    const rules = [];
    root.walkRules(rule => { if (rule.selector === selector) rules.push(rule); });
    assert.equal(rules[0].nodes.find(n => n.prop === 'font-weight').value, '700');
  }
});

test('Latin size is independent of Arabic for all three reading settings', () => {
  for (const [size, table, card] of [['normal',17.5,18], ['large',19,20], ['larger',21,22]]) {
    const selector=size==='normal'?'.parent-plan-reader':`.parent-plan-reader[data-reader-size="${size}"]`;
    const rules=[];root.walkRules(rule=>{if(rule.selector===selector)rules.push(rule);});
    assert.equal(rules[0].nodes.find(n=>n.prop==='--reader-table-latin-size').value,`${table}px`);
    assert.equal(rules[0].nodes.find(n=>n.prop==='--reader-card-latin-size').value,`${card}px`);
  }
  assert.match(css,/p\[data-plan-script="latin"\] \{ font-size:var\(--reader-card-latin-size\)/);
  assert.match(css,/td\[data-plan-script="latin"\] \{ font-size:var\(--reader-table-latin-size\)!important/);
  assert.match(css,/font-family:"Outfit","Alexandria","Cairo",sans-serif!important/);
});

test('language detection protects Arabic, mixed scripts, empty cells and numeric placeholders', () => {
  for (const text of ['AL - Unit 3 - page 34\n+ activity book','Watch a video on Classera','Écrivez la réponse']) assert.equal(parentPlanTextScript(text),'latin');
  for (const text of ['حل تدريبات حرف العين','درس الله تعالى الواحد ص 62','حفظ كتاب اللّٰه']) assert.equal(parentPlanTextScript(text),'arabic');
  for (const text of ['راجع Classera ص 35','Unit 3 — درس جديد']) assert.equal(parentPlanTextScript(text),'mixed');
  for (const text of ['',null,undefined,'—','123 / 34','✅']) assert.equal(parentPlanTextScript(text),'neutral');
});
