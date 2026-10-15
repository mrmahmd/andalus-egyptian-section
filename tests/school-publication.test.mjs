import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import ts from "typescript";
import {classApprovalState,classApprovalLabel,schoolPublicationSummary,schoolPublicationCandidates,publishSchoolTargets} from "../lib/school-publication.ts";
const plan=(id,overrides={})=>({id,weekId:"week7",classId:id,status:"draft",manualPublicationOverride:false,...overrides});
const sub=(id,teacherId="teacher",status="approved",subjectId="english")=>({weeklyPlanId:id,teacherId,subjectId,status});
const entry=(id,teacherId="teacher",overrides={})=>({weeklyPlanId:id,teacherId,subjectId:"english",hasContent:true,...overrides});
const requirements=[{teacherId:"teacher",subjectId:"english"},{teacherId:"second",subjectId:"arabic"}];

test("approval reflects actual required subject approvals, not visibility, publication, or lesson gaps",()=>{
  assert.equal(classApprovalState(undefined,requirements,[]),"not_started");
  assert.equal(classApprovalState("p",requirements,[]),"draft");
  assert.equal(classApprovalState("p",requirements,[sub("p","teacher","submitted")]),"submitted");
  assert.equal(classApprovalState("p",requirements,[sub("p","teacher","changes_requested")]),"changes_requested");
  assert.equal(classApprovalState("p",requirements,[sub("p")]),"partial");
  assert.equal(classApprovalState("p",[...requirements,requirements[0]],[sub("p"),sub("p","second","approved","arabic")]),"approved");
  assert.equal(classApprovalState("p",requirements,[sub("other"),sub("p","stranger")]),"draft");
  assert.equal(classApprovalLabel("approved",true),"معتمدة");
  assert.equal(classApprovalLabel("partial",false),"Partially approved");
});
test("shared publication rate counts published classes, unaffected by hidden weeks, missing periods or overrides",()=>{
  const plans=[plan("a",{status:"published"}),plan("b",{status:"published",manualPublicationOverride:true}),plan("c"),plan("other",{weekId:"week6",status:"published"}),plan("removed",{status:"published"})];
  assert.deepEqual(schoolPublicationSummary(plans,["a","b","c"],"week7"),{published:2,total:3,percent:67});
  assert.deepEqual(schoolPublicationSummary(plans.map(p=>({...p,parent_portal_visible:false})),["a","b","c"],"week7"),{published:2,total:3,percent:67});
  assert.deepEqual(schoolPublicationSummary([...plans,plans[0]],["a","a","b","c"],"week7"),{published:2,total:3,percent:67});
  assert.equal(schoolPublicationSummary(plans,[],"week7").percent,0);
});
test("late submitted content inside an already published class is included, already-public teachers excluded",()=>{
  const plans=[plan("new"),plan("late",{status:"published"}),plan("manual",{status:"published",manualPublicationOverride:true}),plan("teacher-exception",{status:"published"}),plan("normal",{status:"published"})];
  const submissions=plans.map(p=>sub(p.id,"teacher",p.id==="normal"?"approved":"submitted"));
  const entries=plans.map(p=>entry(p.id));
  assert.deepEqual(schoolPublicationCandidates(plans,"week7",entries,submissions,[{planId:"teacher-exception",teacherId:"teacher"}]).map(p=>p.id),["new","late"]);
});
test("private drafts, returned plans, empty lessons, archived plans and other weeks cannot enter bulk targets",()=>{
  const plans=[plan("draft"),plan("returned"),plan("empty"),plan("archived",{status:"archived"}),plan("other",{weekId:"week6"}),plan("no-submission")];
  assert.deepEqual(schoolPublicationCandidates(plans,"week7",plans.map(p=>entry(p.id,"teacher",{hasContent:p.id!=="empty"})),[sub("draft","teacher","draft"),sub("returned","teacher","changes_requested"),sub("empty"),sub("archived"),sub("other")],[]),[]);
});
test("sent subject cannot expose another subject draft and never changes source data",()=>{
  const plans=[plan("p")], entries=[entry("p"),entry("p","teacher",{subjectId:"arabic"})], submissions=[sub("p"),sub("p","teacher","draft","arabic")];
  const before=structuredClone({plans,entries,submissions});
  assert.equal(schoolPublicationCandidates(plans,"week7",entries,submissions,[]).length,1);
  assert.deepEqual({plans,entries,submissions},before);
});
test("success requires verified published state, expected week and saved override after RPC",async()=>{
  const targets=[{id:"p",label:"4A"},{id:"p",label:"4A"}];let calls=0;
  const result=await publishSchoolTargets(targets,"week7",async()=>{calls++;return true;},async()=>({weekId:"week7",status:"published",manualPublicationOverride:true}));
  assert.equal(calls,1);assert.deepEqual(result,{published:["4A"],failed:[],uncertain:[]});
  for(const saved of [null,{weekId:"week6",status:"published",manualPublicationOverride:true},{weekId:"week7",status:"draft",manualPublicationOverride:true},{weekId:"week7",status:"published",manualPublicationOverride:false}]){
    assert.deepEqual(await publishSchoolTargets(targets,"week7",async()=>true,async()=>saved),{published:[],failed:[],uncertain:["4A"]});
  }
});
test("partial failures and uncertain network/save reads never report a false all-success",async()=>{
  const targets=["ok","failed","network","read-error"].map(id=>({id,label:id}));
  const result=await publishSchoolTargets(targets,"week7",async id=>{if(id==="network")throw Error();return id!=="failed";},async id=>{if(id==="read-error")throw Error();return{weekId:"week7",status:"published",manualPublicationOverride:true};});
  assert.deepEqual(result.published,["ok"]);assert.deepEqual(result.failed,["failed"]);assert.deepEqual(result.uncertain.sort(),["network","read-error"]);
});
test("publication preserves submission decisions and missing lesson contents in isolated state",async()=>{
  const data={plan:plan("p"),submissions:[sub("p","teacher","submitted")],entries:[entry("p"),entry("p","second",{hasContent:false})]};
  const before=structuredClone(data);
  await publishSchoolTargets([{id:"p",label:"4A"}],"week7",async()=>{data.plan.status="published";data.plan.manualPublicationOverride=true;return true;},async()=>data.plan);
  assert.deepEqual(data.submissions,before.submissions);assert.deepEqual(data.entries,before.entries);
});
test("actual integration uses fresh preflight, frozen selected-week targets and separate family visibility without altering downloaded report",async()=>{
  const page=await readFile(new URL("../app/super-admin/page.tsx",import.meta.url),"utf8");
  const report=source=>source.slice(source.indexOf("    if (!reportPending || loading || !selectedPlanWeek)"),source.indexOf("  const openAchievementReport"));
  // Frozen after comparing against the pre-change report; works in shallow CI checkouts too.
  assert.equal(createHash("sha256").update(report(page).replace(/\r\n/g,"\n")).digest("hex"),"3015c74b600b33c39877024415f9b6eb9ed0b68ccce9079dd39413a310bf7c5c");
  assert.match(page,/const schoolWeeklyPublicationPercent = publicationSummary.percent/);
  assert.equal((page.match(/>\{schoolWeeklyPublicationPercent\}%<\//g)||[]).length,2);
  assert.doesNotMatch(page,/plan\?\.status === "published" && selectedPlanWeek\?\.parent_portal_visible/);
  assert.doesNotMatch(page,/Awaiting remaining approvals|This teacher\x27s plan is visible to families/);
  assert.match(page,/classApprovalLabel\(coverage.approvalState/);
  assert.match(page,/مخفية عن ولي الأمر/);
  assert.match(page,/if \(!await loadDashboard\(\)\)/);
  assert.match(page,/bulkPublishScope.weekId !== selectedPlanWeekId/);
  assert.match(page,/publicationInFlight.current = true/);
  assert.match(page,/select\("week_id,status,manual_publication_override"\)/);
  const action=page.slice(page.indexOf("  const publishAllSchoolPlans"),page.indexOf("  const reviewRequest"));
  assert.doesNotMatch(action,/review_plan_submission|\.update\(|parent_portal_visible:/);
  assert.match(page,/schoolPublicationCandidates\(weeklyPlans, selectedPlanWeekId, eligibleEntries/);
});
test("actual result dialog renders verified counts and uncertainty, closes safely, and supports Arabic",async()=>{
  const require=createRequire(import.meta.url);
  const source=await readFile(new URL("../app/super-admin/school-publication-dialog.tsx",import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module={exports:{}};new Function("require","module","exports",compiled)(require,module,module.exports);
  let closed=0;const tree=module.exports.default({notice:{tone:"error",title:"نتيجة النشر",message:"تم نشر 1 خطة",details:["تعذر التأكد: 4B"]},onClose(){closed++;}});
  const nodes=t=>!t||typeof t!=="object"?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];
  const dialog=nodes(tree).find(n=>n.props?.role==="alertdialog");assert.equal(dialog.props.dir,"rtl");
  assert.ok(nodes(dialog).some(n=>n.type==="li"));
  nodes(dialog).find(n=>n.type==="button").props.onClick();assert.equal(closed,1);
});
