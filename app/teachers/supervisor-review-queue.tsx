"use client";

import { useEffect, useRef, useState } from "react";
import "./supervisor-review-queue.css";

type Entry = { day: string; period: number; subject: string; classwork: string; homework: string; notes: string };
export type QueuePlan = {
  key: string; teacherId: string; teacherName: string; className: string;
  status: string; note: string; entries: Entry[];
  quizzes: { subject: string; date: string; details: string }[];
  dictations: { day: string; words: string[] }[];
  missingLessons: Entry[];
};
export type TeacherCompletion = { id: string; name: string; required: number; missingClasses: string[]; waiting: number; returnedClasses: string[] };
const days: Record<string, string> = { Sunday: "الأحد", Monday: "الاثنين", Tuesday: "الثلاثاء", Wednesday: "الأربعاء", Thursday: "الخميس" };

export default function SupervisorReviewQueue({ plans, teachers, arabic, open, saving, onReview, onApprove }: {
  plans: QueuePlan[]; teachers: TeacherCompletion[]; arabic: boolean; open: boolean; saving: boolean;
  onReview: (key: string, note: string) => Promise<void>;
  onApprove: (keys: string[]) => Promise<void>;
}) {
  const [filter, setFilter] = useState("submitted");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteError, setNoteError] = useState("");
  const [completionFilter, setCompletionFilter] = useState("all");
  const dialog = useRef<HTMLElement>(null);
  const confirmationOpen = confirmation.length > 0;
  useEffect(() => {
    if (!confirmationOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmation([]);
      if (event.key === "Tab" && buttons?.length) {
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [confirmationOpen]);
  const text = (ar: string, en: string) => arabic ? ar : en;
  const pending = plans.filter((plan) => plan.status === "submitted");
  const selectedPlans = pending.filter((plan) => selected.includes(plan.key));
  const confirmationPlans = pending.filter((plan) => confirmation.includes(plan.key));
  const visible = plans.filter((plan) => filter === "all" || plan.status === filter);
  const grouped = Array.from(new Map(visible.map((plan) => [plan.teacherId, plan.teacherName])).entries());
  const missingTeachers = teachers.filter((teacher) => teacher.missingClasses.length || teacher.returnedClasses.length);
  const label = (status: string) => status === "submitted" ? text("بانتظار اعتمادك", "Awaiting your approval") : status === "approved" ? text("معتمدة", "Approved") : text("مُعادة للتعديل", "Returned for changes");
  return <div className="review-queue" dir={arabic ? "rtl" : "ltr"}>
    <section className="review-completion">
      <header><div><h3>{text("متابعة إنجاز المعلمين", "Teacher completion")}</h3><p>{text("ملخص الأسبوع لكل معلم مرة واحدة. الإرسال مكتمل لا يعني أن الخطة نُشرت بعد.", "One weekly summary per teacher. All plans submitted does not mean they are published yet.")}</p></div><strong>{text(`${missingTeachers.length} معلم يحتاج متابعة`, `${missingTeachers.length} teachers need follow-up`)}</strong></header>
      <div className="review-completion-filters">{["all", "missing", "complete"].map((value) => <button type="button" key={value} aria-pressed={completionFilter === value} onClick={() => setCompletionFilter(value)}>{value === "all" ? text("كل المعلمين", "All teachers") : value === "missing" ? text("ناقص / يحتاج تعديل", "Missing / needs changes") : text("مكتمل الإرسال", "All plans submitted")}</button>)}</div>
      <div className="review-completion-grid">{teachers.filter((teacher) => completionFilter === "all" || (completionFilter === "missing" ? teacher.missingClasses.length || teacher.returnedClasses.length : !teacher.missingClasses.length && !teacher.returnedClasses.length)).map((teacher) => <article key={teacher.id} className={teacher.missingClasses.length || teacher.returnedClasses.length ? "needs-followup" : "complete"}>
        <div className="review-completion-title"><h4>{teacher.name}</h4><strong>{!teacher.required ? text("بلا حصص", "No lessons") : teacher.missingClasses.length ? text("ناقص", "Incomplete") : teacher.returnedClasses.length ? text("يحتاج تعديل", "Needs changes") : text("مكتمل", "Complete")}</strong></div>
        {(teacher.missingClasses.length > 0 || teacher.returnedClasses.length > 0) && <div className="review-completion-counts">{teacher.missingClasses.length > 0 && <span>{text(`لم يُرسل: ${teacher.missingClasses.length}`, `Not submitted: ${teacher.missingClasses.length}`)}</span>}{teacher.returnedClasses.length > 0 && <span>{text(`يحتاج تعديل: ${teacher.returnedClasses.length}`, `Needs changes: ${teacher.returnedClasses.length}`)}</span>}</div>}
        {(() => {
          const classes = [...new Set([...teacher.missingClasses, ...teacher.returnedClasses])];
          const chip = (className: string) => {
            const status = [teacher.missingClasses.includes(className) ? text("لم يُرسل", "Not submitted") : "", teacher.returnedClasses.includes(className) ? text("مطلوب تعديل", "Changes needed") : ""].filter(Boolean).join(" / ");
            return <span className="review-completion-chip" key={className} title={`${className} — ${status}`} aria-label={`${className} — ${status}`}><bdi dir="ltr">{className.replace(/^Grade\s+(\d+)\s*·\s*(.+)$/, "$1$2")}</bdi>{teacher.returnedClasses.includes(className) && <span aria-hidden="true"> ↺</span>}</span>;
          };
          return classes.length > 0 && <><div className="review-completion-chips">{classes.slice(0, 3).map(chip)}</div>{classes.length > 3 && <details className="review-completion-more"><summary>{text(`عرض ${classes.length - 3} فصول أخرى`, `Show ${classes.length - 3} more classes`)}</summary><div className="review-completion-chips">{classes.slice(3).map(chip)}</div></details>}</>;
        })()}
        {teacher.waiting > 0 && <small>{text(`${teacher.waiting} فصل بانتظار اعتمادك`, `${teacher.waiting} classes awaiting your approval`)}</small>}
      </article>)}</div>
      {!teachers.length && <p>{text("لا يوجد معلمون مكلفون ضمن نطاق إشرافك.", "No assigned teachers in your supervision scope.")}</p>}
    </section>
    <div className="review-status-filters">{["submitted", "approved", "changes_requested", "all"].map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}><strong>{plans.filter((plan) => value === "all" || plan.status === value).length}</strong>{value === "all" ? text("كل الخطط", "All plans") : label(value)}</button>)}</div>
    <div className="review-selection-bar"><span>{text(`تم تحديد ${selectedPlans.length} خطة`, `${selectedPlans.length} plans selected`)}</span><button type="button" className="teacher-primary-button" disabled={saving || !open || !selectedPlans.length} onClick={() => setConfirmation(selectedPlans.map((plan) => plan.key))}>{text("اعتماد الخطط المحددة", "Approve selected plans")}</button></div>
    <div id="supervisor-review-results" className="review-teachers">{grouped.map(([id, name]) => <section key={id} className="review-teacher"><header><h3>{name}</h3><span>{text(`${visible.filter((plan) => plan.teacherId === id).length} خطة`, `${visible.filter((plan) => plan.teacherId === id).length} plans`)}</span></header>{visible.filter((plan) => plan.teacherId === id).map((plan) => <article key={plan.key} className="review-class">
      {plan.status === "submitted" && <label className="review-select"><input type="checkbox" disabled={saving || !open} checked={selectedPlans.some((item) => item.key === plan.key)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, plan.key] : current.filter((key) => key !== plan.key))} />{text("تحديد للاعتماد", "Select for approval")}</label>}
      <details><summary><strong>{plan.className}</strong><span className={`review-state ${plan.status}`}>{label(plan.status)}</span><span>{text("عرض الحصص والمراجعة", "View lessons & review")} ▾</span></summary>
        {(plan.missingLessons.length > 0 || plan.entries.some((entry) => !entry.classwork.trim())) && <p className="review-missing-alert">{text(`${plan.missingLessons.length + plan.entries.filter((entry) => !entry.classwork.trim()).length} حصص بلا محتوى: راجعها قبل الاعتماد.`, `${plan.missingLessons.length + plan.entries.filter((entry) => !entry.classwork.trim()).length} lessons have no content. Review before approving.`)}</p>}
        <div className="review-table-wrap"><table><thead><tr>{[text("اليوم / الحصة", "Day / period"), text("المادة", "Subject"), text("عمل الحصة", "Classwork"), text("الواجب", "Homework"), "Classera"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{[...plan.entries, ...plan.missingLessons].sort((a,b) => Object.keys(days).indexOf(a.day) - Object.keys(days).indexOf(b.day) || a.period - b.period).map((entry, index) => <tr key={`${entry.subject}-${entry.day}-${entry.period}-${index}`} className={!entry.classwork.trim() ? "missing" : ""}><td>{arabic ? days[entry.day] ?? entry.day : entry.day}<br /><b>{text("الحصة", "Period")} {entry.period}</b></td><td>{entry.subject}</td><td>{entry.classwork || text("المحتوى غير مكتوب", "Content not written")}</td><td>{entry.homework || "—"}</td><td>{entry.notes || "—"}</td></tr>)}</tbody></table></div>
        {plan.quizzes.map((quiz,index) => <p className="review-extra" key={index}><b>{quiz.subject} · {quiz.date}</b><br />{quiz.details}</p>)}
        {plan.dictations.map((dictation,index) => <p className="review-extra" key={index}><b>Vocabulary for Dictation on {dictation.day}</b><br />{dictation.words.join(" · ")}</p>)}
        {plan.status === "submitted" ? <div className="review-decision"><label>{text("ملاحظة المراجعة · مطلوبة للإرجاع", "Review note · required for returning")}<textarea rows={3} disabled={saving || !open} value={notes[plan.key] ?? plan.note} onChange={(event) => { setNotes((current) => ({...current, [plan.key]: event.target.value})); setNoteError(""); }} /></label>{noteError === plan.key && <p role="alert">{text("اكتب التعديلات المطلوبة أولًا.", "Write the required changes first.")}</p>}<div><button type="button" className="teacher-secondary-button" disabled={saving || !open} onClick={() => { const note = (notes[plan.key] ?? plan.note).trim(); if (!note) {setNoteError(plan.key); return;} void onReview(plan.key, note); }}>{text("إرجاع للتعديل", "Return for changes")}</button><button type="button" className="teacher-primary-button" disabled={saving || !open} onClick={() => setConfirmation([plan.key])}>{text("اعتماد هذه الخطة", "Approve this plan")}</button></div></div> : <p className="review-extra">{plan.status === "changes_requested" ? plan.note : text("تم اعتماد هذه الخطة. ظهورها لولي الأمر يتبع شروط النشر وإتاحة الأسبوع.", "This plan is approved. Parent visibility follows publication and week visibility rules.")}</p>}
      </details>
    </article>)}</section>)}</div>
    {!visible.length && <p className="supervisor-review-empty">{text("لا توجد خطط بهذه الحالة ضمن الاختيار الحالي.", "No plans with this status match your selection.")}</p>}
    {confirmation.length > 0 && <div className="weekly-send-confirmation-backdrop"><section ref={dialog} className="weekly-send-confirmation review-confirmation" role="dialog" aria-modal="true" aria-labelledby="selected-approval-title"><h3 id="selected-approval-title">{text("تأكيد اعتماد الخطط المحددة", "Confirm selected approvals")}</h3><p>{text("سيتم اعتماد المواد المرسلة في الخطط التالية فقط. المواد المُعادة تظل بحاجة لتعديل:", "Only the submitted subjects in the following plans will be approved. Returned subjects still need changes:")}</p><ul>{confirmationPlans.map((plan) => <li key={plan.key}><b>{plan.teacherName}</b> · {plan.className}{(plan.missingLessons.length > 0 || plan.entries.some((entry) => !entry.classwork.trim())) && <strong> — {text("توجد حصص ناقصة", "Missing lessons")}</strong>}</li>)}</ul><div><button type="button" className="teacher-secondary-button" onClick={() => setConfirmation([])}>{text("إلغاء", "Cancel")}</button><button type="button" className="teacher-primary-button" disabled={saving || !open || !confirmationPlans.length} onClick={() => { const keys = confirmationPlans.map((plan) => plan.key); setConfirmation([]); void onApprove(keys).then(() => setSelected([])); }}>{text("تأكيد الاعتماد", "Confirm approval")}</button></div></section></div>}
  </div>;
}
