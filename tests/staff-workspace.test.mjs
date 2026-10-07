import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function workspace(query='') {
  let options;const requests=[];const normal={auth:{getSession:async()=>({data:{session:{access_token:'real-admin-session'}}})}};
  globalThis.window={location:{search:query}};
  globalThis.fetch=async(input,init)=>{requests.push({input,init});return new Response('{}');};
  globalThis.__workspaceTest={createClient:(_url,_key,configuration)=>{options=configuration;return {delegated:true};},getSupabaseBrowserClient:()=>normal};
  let source=fs.readFileSync('lib/supabase/staff-workspace.ts','utf8').replace(/import .*?from "@supabase\/supabase-js";/,'const { createClient } = globalThis.__workspaceTest;').replace(/import .*?from "\.\/client";/,'const { getSupabaseBrowserClient } = globalThis.__workspaceTest;');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const module=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}#${Math.random()}`);
  module.getStaffWorkspaceClient();return {module,normal,requests,options};
}
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='public-test-key';
test('ordinary teacher workspace retains its normal client',async()=>{const x=await workspace();assert.equal(x.module.getStaffWorkspaceClient(),x.normal);});
test('delegation retains the real actor token and routes RPC with selected identity',async()=>{const x=await workspace('?staff=selected-teacher');assert.equal(await x.options.accessToken(),'real-admin-session');await x.options.global.fetch('https://example.supabase.co/rest/v1/rpc/save_staff_plan',{method:'POST',headers:{Authorization:'Bearer real-admin-session'},body:JSON.stringify({class_id:'class-a'})});const request=x.requests[0];assert.match(request.input,/super_admin_staff_action$/);assert.deepEqual(JSON.parse(request.init.body),{target_user_id:'selected-teacher',operation:'save_staff_plan',payload:{class_id:'class-a'}});assert.equal(request.init.headers.Authorization,'Bearer real-admin-session');});
test('unhandled writes fail before a request and reads preserve filters',async()=>{const x=await workspace('?staff=selected-teacher');await assert.rejects(()=>x.options.global.fetch('https://example.supabase.co/rest/v1/plan_entries',{method:'PATCH',body:'{}'}),/audited workspace action/);assert.equal(x.requests.length,0);const read='https://example.supabase.co/rest/v1/plan_entries?teacher_id=eq.selected-teacher';await x.options.global.fetch(read,{method:'GET'});assert.equal(x.requests[0].input,read);});
test('delegated RPC cannot be called via GET',async()=>{const x=await workspace('?staff=selected-teacher');await assert.rejects(()=>x.options.global.fetch('https://example.supabase.co/rest/v1/rpc/save_staff_plan',{method:'GET'}),/require POST/);assert.equal(x.requests.length,0);});
