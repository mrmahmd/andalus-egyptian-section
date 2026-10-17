import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const source=await readFile(new URL('../app/teachers/week8-copy-preview.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const module={exports:{}};new Function('require','module','exports',compiled)(require,module,module.exports);
const Preview=module.exports.default;
const preview={token:'test-only',source_lessons:2,target_lessons:1,merged_slots:1,mappings:[{subject:'Arabic',slot:{id:'target',day_of_week:2,period_number:8},sources:[{id:'1',day_of_week:2,period_number:3},{id:'2',day_of_week:2,period_number:6}],classwork:'أول درس\n\n[Source lesson 2 - Period 6]\nثاني درس',homework:'Read page 1',classera_notes:'<script>not executable</script>'}]};
for(const arabic of [true,false])test(`actual preview component is readable, localized and escapes teacher text: ${arabic}`,()=>{
 const html=renderToStaticMarkup(React.createElement(Preview,{preview,arabic}));
 assert.match(html,arabic?/راجع التوزيع قبل تأكيد النسخ/:/Review the distribution before confirming/);
 assert.match(html,arabic?/الثلاثاء/:/Tuesday/);assert.match(html,/class="merged"/);assert.match(html,/أول درس/);assert.match(html,/ثاني درس/);assert.match(html,/Read page 1/);
 assert.match(html,/&lt;script&gt;not executable&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);
 assert.match(html,/dir="auto"/);assert.match(html,arabic?/الخطة الأصلية لا تتغير/:/original is unchanged/);
 assert.doesNotMatch(html,/test-only/); // Confirmation token is not rendered as lesson content.
});
test('Week8 opt-in integration keeps normal copy and invalidates confirmation when changing class',async()=>{
 const page=await readFile(new URL('../app/teachers/page.tsx',import.meta.url),'utf8');
 assert.match(page,/week_number === 8 && schoolHolidays.some/);
 assert.match(page,/rpc\("copy_my_weekly_plan", payload\)/);
 assert.match(page,/confirmation_token: mergeAction === "confirm" \? copyMergePreview!\.token : null/);
 assert.match(page,/mergeAction === "confirm" && !copyMergePreview/);
 assert.match(page,/setCopyTargetClassId\(event.target.value\); setCopyMergePreview\(null\)/);
 assert.match(page,/onClick=\{\(\) => void copyPlanToOtherClasses\("preview"\)\}/);
 assert.match(page,/onClick=\{\(\) => void copyPlanToOtherClasses\("confirm"\)\}/);
});
