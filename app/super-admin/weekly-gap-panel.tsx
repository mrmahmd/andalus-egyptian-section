"use client";

import { useState } from "react";
import type { GapGroup } from "../../lib/weekly-gap-report";
import { downloadGapPdf } from "../../lib/download-gap-pdf";
import "./weekly-gap-panel.css";

export default function WeeklyGapPanel({ kind, groups, arabic, weekNumber, weekRange, logoUrl, onClose }: { kind: "teachers" | "supervisors"; groups: GapGroup[]; arabic: boolean; weekNumber: number; weekRange: string; logoUrl: string; onClose: () => void }) {
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const title=kind==="teachers" ? arabic ? "تقرير نواقص المعلمين" : "Teacher gaps report" : arabic ? "تقرير الاعتمادات الناقصة" : "Pending approvals report";
  const columns=kind==="teachers" ? arabic ? ["اليوم","المادة","الحصص","المطلوب"] : ["Day","Subject","Periods","Action needed"] : arabic ? ["المعلم","الفصل","المواد المنتظرة","الإرسال / مدة الانتظار"] : ["Teacher","Class","Pending subjects","Sent / waiting"];
  const week=`${arabic ? "الأسبوع" : "Week"} ${weekNumber} · ${weekRange}`;
  const download=async()=>{setBusy(true);setError("");try{await downloadGapPdf({title,week,groups,columns,arabic,logoUrl,generatedAt:new Date().toLocaleString(arabic?"ar-EG":"en-GB",{timeZone:"Asia/Riyadh"})});}catch{setError(arabic?"تعذر تحميل التقرير. حاول مرة أخرى.":"Could not download the report. Please try again.");}finally{setBusy(false);}};
  return <section className="teacher-card weekly-gap-panel" dir={arabic?"rtl":"ltr"} aria-live="polite">
    <div className="weekly-gap-brand"><img src={logoUrl} alt={arabic?"شعار مدارس الأندلس":"AlAndalus school logo"}/><div><strong>{arabic?"مدارس الأندلس الأهلية":"AlAndalus Private Schools"}</strong><span>{arabic?"المسار المصري · متابعة الخطط الأسبوعية":"Egyptian Section · Weekly plan follow-up"}</span></div></div>
    <header><div><h2>{title}</h2><p>{week}</p></div><div className="weekly-gap-actions"><button type="button" disabled={busy||!groups.length} onClick={()=>void download()}>{arabic ? busy ? "جارٍ تجهيز PDF…" : "تحميل التقرير PDF" : busy ? "Preparing PDF…" : "Download report PDF"}</button><button type="button" className="weekly-gap-close" aria-label={arabic?"إغلاق التفاصيل":"Close details"} onClick={onClose}>×</button></div></header>
    <p className="weekly-gap-summary">{groups.length} {arabic ? kind==="teachers"?"معلمين لديهم نواقص":"مشرفين لديهم اعتمادات منتظرة" : kind==="teachers"?"teachers with gaps":"supervisors with pending approvals"} · {groups.reduce((sum,group)=>sum+group.count,0)} {arabic ? kind==="teachers"?"حصص تحتاج متابعة":"خطط تحتاج مراجعة" : kind==="teachers"?"lessons needing follow-up":"plans needing review"}</p>
    {error&&<p role="alert" className="weekly-gap-error">{error}</p>}
    {kind==="teachers"&&<p className="weekly-gap-legend">{arabic?"الأحمر: الخطة لم تُرسل · البرتقالي: حصة بلا محتوى أو خطة أُعيدت للتعديل. الحصة المكتوبة لا تُحسب مكتملة حتى تُرسل للمشرف.":"Red: not sent · Orange: missing Classwork or returned for changes. Written lessons count as complete once sent to the supervisor."}</p>}
    <div className="weekly-gap-groups">{groups.map(group=><article key={group.id} className="weekly-gap-person"><header><h3>{group.name}</h3><span>{group.count} {arabic?kind==="teachers"?"حصص تحتاج متابعة":"خطط تحتاج مراجعة":kind==="teachers"?"lessons to follow up":"plans to review"}</span></header>{group.blocks.map((block,index)=><section key={index}><h4>{block.title}</h4><div className="weekly-gap-table-wrap"><table><thead><tr>{columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>{block.rows.map((row,rowIndex)=><tr key={rowIndex} className={`weekly-gap-${row.tone}`}>{row.cells.map((cell,cellIndex)=><td key={cellIndex} data-label={columns[cellIndex]}>{cell}</td>)}</tr>)}</tbody></table></div></section>)}</article>)}</div>
    {!groups.length&&<p>{arabic?"لا توجد نواقص في الأسبوع المختار.":"No gaps in the selected week."}</p>}
  </section>;
}
