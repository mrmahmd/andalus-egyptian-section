import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createEditorLayoutPreference,readAccountEditorLayout,saveAccountEditorLayout,rememberTeacherEditorLayout} from '../lib/teacher-editor-layout.ts';

const key='weekly_plan_editor_layout';
const user=(id='teacher-a',layout)=>({id,user_metadata:{display_name:'Preserve this name',...(layout?{[key]:layout}:{})}});
const storage=()=>{const values=new Map();return{values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(initialUser=user(), cache=storage()) {
 let account=structuredClone(initialUser), failRead=false, failWrite=false, writes=[];
 const states=[];
 const auth={async getUser(){if(failRead)throw new Error('offline');return{data:{user:structuredClone(account)},error:null};},async updateUser(attributes){writes.push(attributes);if(failWrite)return{data:{user:null},error:new Error('offline')};account.user_metadata={...account.user_metadata,...attributes.data};return{data:{user:structuredClone(account)},error:null};}};
 const controller=createEditorLayoutPreference({auth:()=>auth,storage:()=>cache,onChange:s=>states.push(s)});
 const initialize=(input={})=>controller.initialize({staffId:account?.id??'teacher-a',user:structuredClone(account),defaultLayout:'columns',delegated:false,...input});
 return{auth,cache,states,writes,controller,initialize,get account(){return account;},set account(x){account=x;},set failRead(x){failRead=x;},set failWrite(x){failWrite=x;}};
}

test('cloud choice wins over stale local cache and is mirrored to that device without a write',()=>{
 const h=harness(user('teacher-a','rows'));rememberTeacherEditorLayout(()=>h.cache,'teacher-a','columns');h.initialize();
 assert.deepEqual(h.states.at(-1),{layout:'rows',syncState:'saved'});assert.equal(h.writes.length,0);assert.deepEqual([...h.cache.values.values()],['rows']);
});

test('saving on one device loads the same choice on a second, independent device and preserves other metadata',async()=>{
 const a=harness();a.initialize();assert.equal(a.writes.length,0);assert.equal(a.states.at(-1).syncState,'local');
 assert.equal(await a.controller.choose('rows'),true);assert.deepEqual(a.writes,[{data:{[key]:'rows'}}]);assert.equal(a.account.user_metadata.display_name,'Preserve this name');
 const b=harness(a.account);rememberTeacherEditorLayout(()=>b.cache,'teacher-a','columns');b.initialize();
 assert.deepEqual(b.states.at(-1),{layout:'rows',syncState:'saved'});assert.notEqual(a.cache,b.cache);assert.equal(b.writes.length,0);
});

test('legacy per-device preference is promoted once, but default-only views do not write accounts',async()=>{
 const h=harness();rememberTeacherEditorLayout(()=>h.cache,'teacher-a','rows');h.initialize();assert.equal(h.states.at(-1).syncState,'saving');await tick();
 assert.deepEqual(h.states.at(-1),{layout:'rows',syncState:'saved'});assert.equal(h.writes.length,1);h.initialize();await tick();assert.equal(h.writes.length,1);
 const fresh=harness();fresh.initialize({defaultLayout:'rows'});await tick();assert.equal(fresh.writes.length,0);assert.deepEqual(fresh.states.at(-1),{layout:'rows',syncState:'local'});
});

test('migration rechecks the server and never overwrites a choice saved on another device after initial load',async()=>{
 const h=harness(user('teacher-a','rows'));rememberTeacherEditorLayout(()=>h.cache,'teacher-a','columns');h.initialize({user:user()});await tick();
 assert.equal(h.writes.length,0);assert.deepEqual(h.states.at(-1),{layout:'rows',syncState:'saved'});
});

for(const failure of ['read','write'])test(`offline ${failure} keeps the local display, reports error, and allows confirmed retry`,async()=>{
 const h=harness();h.initialize();h[failure==='read'?'failRead':'failWrite']=true;
 assert.equal(await h.controller.choose('rows'),false);assert.deepEqual(h.states.at(-1),{layout:'rows',syncState:'error'});assert.ok(!h.states.some(s=>s.syncState==='saved'));
 h.failRead=false;h.failWrite=false;assert.equal(await h.controller.choose('rows'),true);assert.equal(h.states.at(-1).syncState,'saved');
});

test('blocked browser storage does not prevent account sync or cloud restoration',async()=>{
 const h=harness();const states=[];const controller=createEditorLayoutPreference({auth:()=>h.auth,storage:()=>{throw new Error('blocked');},onChange:s=>states.push(s)});
 controller.initialize({staffId:'teacher-a',user:user(),defaultLayout:'columns',delegated:false});assert.equal(await controller.choose('rows'),true);assert.deepEqual(states.at(-1),{layout:'rows',syncState:'saved'});
 const second=harness(h.account);second.initialize();assert.equal(second.states.at(-1).layout,'rows');
});

test('delegated view never reads the real Super Admin preference as the teacher choice, and never writes either account',async()=>{
 const h=harness(user('super-admin','rows'));h.initialize({staffId:'teacher-a',delegated:true});
 assert.deepEqual(h.states.at(-1),{layout:'columns',syncState:'delegated'});assert.equal(await h.controller.choose('rows'),false);assert.equal(h.writes.length,0);assert.equal(h.account.user_metadata[key],'rows');assert.equal(h.states.at(-1).syncState,'delegated');assert.equal(h.cache.values.size,0);
});

test('missing or changed account prevents metadata writes',async()=>{
 for(const other of [null,user('teacher-b')]){const h=harness();h.initialize();h.account=other;assert.equal(await h.controller.choose('rows'),false);assert.equal(h.writes.length,0);assert.equal(h.states.at(-1).syncState,'error');}
 assert.equal(readAccountEditorLayout(user('super-admin','rows'),'teacher-a'),null);
});

test('only valid layouts are accepted and unconfirmed responses are never marked saved',async()=>{
 const h=harness();h.initialize();assert.equal(await h.controller.choose('invalid'),false);assert.equal(h.writes.length,0);
 await assert.rejects(saveAccountEditorLayout(h.auth,'teacher-a','invalid'),/Invalid/);
 const auth={...h.auth,async updateUser(){return{data:{user:user('teacher-a','columns')},error:null};}};
 await assert.rejects(saveAccountEditorLayout(auth,'teacher-a','rows'),/not confirmed/);
 assert.equal(readAccountEditorLayout({id:'teacher-a',user_metadata:{[key]:{role:'admin'}}},'teacher-a'),null);
});

test('rapid changes and dashboard refresh cannot reorder a pending preference save',async()=>{
 const h=harness();let finish;h.auth.updateUser=()=>new Promise(resolve=>{finish=()=>resolve({data:{user:user('teacher-a','rows')},error:null});});
 h.initialize();const saving=h.controller.choose('rows');await tick();assert.equal(await h.controller.choose('columns'),false);
 h.initialize({user:user('teacher-a','columns')});assert.deepEqual(h.states.at(-1),{layout:'rows',syncState:'saving'});finish();assert.equal(await saving,true);assert.deepEqual(h.states.at(-1),{layout:'rows',syncState:'saved'});
});

test('late success after account switch or unmount cannot change the new screen',async()=>{
 for(const dispose of [false,true]){const h=harness();let finish;h.auth.updateUser=()=>new Promise(resolve=>{finish=()=>resolve({data:{user:user('teacher-a','rows')},error:null});});h.initialize();const saving=h.controller.choose('rows');await tick();
  if(dispose)h.controller.dispose();else h.initialize({staffId:'teacher-b',user:user('teacher-b','columns')});
  const before=structuredClone(h.states);finish();assert.equal(await saving,false);assert.deepEqual(h.states,before);
 }
});

test('actual Supabase SDK uses the self-service metadata endpoint and independent sessions read the saved choice',async()=>{
 const id='00000000-0000-0000-0000-000000000001';let stored={id,aud:'authenticated',role:'authenticated',email:'synthetic@example.test',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{nickname:'Keep me'}};const requests=[];
 const token=[{alg:'HS256',typ:'JWT'},{sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'synthetic-signature'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
 const fetchMock=async(input,init={})=>{const url=String(input);assert.equal(url,'https://preference-test.supabase.co/auth/v1/user');const method=init.method??'GET';requests.push({method,body:init.body?JSON.parse(init.body):null});if(method==='PUT'){const payload=JSON.parse(init.body);assert.deepEqual(Object.keys(payload).sort(),['code_challenge','code_challenge_method','data']);assert.equal(payload.code_challenge,null);assert.equal(payload.code_challenge_method,null);assert.deepEqual(Object.keys(payload.data),[key]);stored={...stored,user_metadata:{...stored.user_metadata,...payload.data}};}return new Response(JSON.stringify(stored),{status:200,headers:{'Content-Type':'application/json'}});};
 const make=()=>createClient('https://preference-test.supabase.co','synthetic-publishable-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:fetchMock}});
 const first=make(),second=make();await first.auth.setSession({access_token:token,refresh_token:'synthetic-refresh'});await second.auth.setSession({access_token:token,refresh_token:'synthetic-refresh'});
 assert.equal(await saveAccountEditorLayout(first.auth,id,'rows'), 'rows');
 const loaded=await second.auth.getUser();assert.equal(readAccountEditorLayout(loaded.data.user,id),'rows');assert.equal(loaded.data.user.user_metadata.nickname,'Keep me');assert.deepEqual(loaded.data.user.app_metadata,{provider:'email'});assert.equal(requests.filter(r=>r.method==='PUT').length,1);
});
