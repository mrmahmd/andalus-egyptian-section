import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
const source=await readFile(new URL('../app/teachers/editor-layout-picker.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const module={exports:{}};new Function('require','module','exports',code)(require,module,module.exports);
const Picker=module.exports.default;
function nodes(tree){return !tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];}
for(const arabic of [true,false])for(const value of ['rows','columns'])test(`actual layout picker controls and translation: ${arabic}/${value}`,()=>{
 const calls=[];const props={value,arabic,sessionOnly:false,onChange:x=>calls.push(x)};
 const tree=Picker(props);const inputs=nodes(tree).filter(n=>n.type==='input');
 assert.equal(inputs.length,2);assert.ok(inputs.every(n=>n.props.type==='radio'));assert.equal(inputs.filter(n=>n.props.checked).length,1);
 inputs.find(n=>n.props.value!==value).props.onChange();assert.deepEqual(calls,[value==='rows'?'columns':'rows']);
 const html=renderToStaticMarkup(React.createElement(Picker,props));assert.match(html,arabic?/طريقة عرض المحرر/:/Editor layout/);assert.match(html,arabic?/العرض الأفقي/:/Horizontal view/);
 assert.match(html,arabic?/اختيارك محفوظ على هذا الجهاز فقط/:/Remembered on this device only/);assert.match(html,new RegExp(`dir="${arabic?'rtl':'ltr'}"`));
 assert.match(html,arabic?/عرض الأعمدة/:/Column view/);assert.doesNotMatch(html,/العرض الحالي/);
 assert.doesNotMatch(html,/<button|type="submit"/);
});
test('when storage is blocked the picker honestly describes session-only choice',()=>{
 for(const arabic of [true,false]) {const html=renderToStaticMarkup(React.createElement(Picker,{value:'rows',arabic,sessionOnly:true,onChange(){}}));assert.match(html,arabic?/لهذه الجلسة فقط/:/this session only/);}
});

test('compact layout options do not stretch across the editor or show oversized descriptions',async()=>{
 const css=await readFile(new URL('../app/teachers/editor-layout-picker.css',import.meta.url),'utf8');
 assert.match(css,/width:fit-content/);assert.match(css,/min-height:38px/);
 assert.match(css,/\.editor-layout-description \{[^}]*clip-path:inset\(50%\)/);
 assert.doesNotMatch(css,/flex-basis:100%|grid-template-columns:repeat\(2/);
 assert.match(css,/@media\(max-width:360px\) \{ \.teacher-editor-layout-options \{ flex-wrap:wrap/);
});
