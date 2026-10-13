"use client";

import { useEffect, useRef, useState } from "react";
import { type CopyFields, type EditorLesson, type LessonDraft, editorLessonProgress } from "../../lib/weekly-editor-tools";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const arabicDays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
export function lessonLabel(slot: EditorLesson, arabic: boolean) {
  return `${(arabic ? arabicDays : days)[slot.day_of_week]} · ${arabic ? "الحصة" : "Period"} ${slot.period_number}`;
}

export function EditorProgressTools({ slots, drafts, arabic, missingOnly, onMissingOnly, onNextMissing, hydrated }: {
  slots: EditorLesson[]; drafts: Record<string, LessonDraft>; arabic: boolean; missingOnly: boolean;
  onMissingOnly: (value: boolean) => void; onNextMissing: () => void; hydrated: boolean;
}) {
  const progress = editorLessonProgress(slots, drafts);
  return <section className="editor-progress-tools" aria-label={arabic ? "إنجاز كتابة الخطة" : "Plan writing progress"} dir={arabic ? "rtl" : "ltr"}>
    <div className="editor-progress-summary"><div><strong>{arabic ? "إنجاز كتابة الخطة" : "Plan writing progress"}</strong><span>{hydrated ? arabic ? `كتبت ${progress.completed} من ${progress.total} حصص` : `${progress.completed} of ${progress.total} lessons written` : arabic ? "جارٍ تحميل الحصص…" : "Loading lessons…"}</span></div><b>{hydrated ? `${progress.percent}%` : "—"}</b></div>
    <div className="editor-progress-track" role="progressbar" aria-label={arabic ? "الحصص المكتوبة" : "Written lessons"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={hydrated ? progress.percent : 0}><i style={{width: `${hydrated ? progress.percent : 0}%`}} /></div>
    <small>{arabic ? "المؤشر للكتابة داخل المحرر، وليس تأكيدًا للحفظ أو الإرسال. يحتسب عمل الحصة فقط، دون حصص الاختبار والإجازات." : "Writing progress, not a save or submission confirmation. Only Classwork counts; exam and holiday lessons are excluded."}</small>
    <div className="editor-progress-actions"><button type="button" className={missingOnly ? "active" : ""} aria-pressed={missingOnly} disabled={!hydrated} onClick={() => onMissingOnly(!missingOnly)}>{missingOnly ? arabic ? "عرض كل الحصص" : "Show all lessons" : arabic ? "عرض الحصص الناقصة فقط" : "Show missing lessons only"}<span>{hydrated ? progress.missing.length : "—"}</span></button><button type="button" disabled={!hydrated || !progress.missing.length} onClick={onNextMissing}>{arabic ? "انتقل للحصة الناقصة التالية" : "Next missing lesson"} ↓</button></div>
  </section>;
}

type CopyOutcome = { status: "invalid" | "copied" | "blocked" } | { status: "conflict"; targetIds: string[]; confirmationToken: string };
export function LessonCopyDialog({ source, targets, arabic, subject, busy, onClose, onApply }: {
  source: EditorLesson; targets: EditorLesson[]; arabic: boolean; subject: string; busy: boolean; onClose: () => void;
  onApply: (ids: string[], fields: CopyFields, overwriteToken: string) => CopyOutcome;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [fields, setFields] = useState<CopyFields>({classwork:true,homework:false,classeraNotes:false});
  const [conflict, setConflict] = useState<{targetIds:string[]; confirmationToken:string} | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { previous?.focus(); };
  }, []);
  const apply = () => {
    if (busy) return;
    const result = onApply(ids, fields, conflict?.confirmationToken ?? "");
    if (result.status === "conflict") { setConflict(result); setError(""); }
    else if (result.status === "invalid") setError(arabic ? "اختر حصة مستهدفة وخانات تحتوي على كتابة في الحصة المصدر." : "Choose a target lesson and fields containing writing in the source lesson.");
    else if (result.status === "blocked") setError(arabic ? "النسخ غير متاح في حالة الخطة الحالية. لم تتغير أي كتابة." : "Copying is unavailable in the current plan state. No writing was changed.");
  };
  const resetWarning = () => { setConflict(null); setError(""); };
  return <div className="lesson-copy-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialog} className="lesson-copy-dialog" role="dialog" aria-modal="true" aria-labelledby="lesson-copy-title" dir={arabic ? "rtl" : "ltr"} onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      if (event.key === "Tab") {
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));
        const first = controls[0], last = controls[controls.length-1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <header><div><small>{subject} · {lessonLabel(source,arabic)}</small><h3 id="lesson-copy-title">{arabic ? "نسخ هذه الحصة" : "Copy this lesson"}</h3></div><button type="button" aria-label={arabic ? "إغلاق نسخ الحصة" : "Close lesson copy"} onClick={onClose}>×</button></header>
      <p>{arabic ? "داخل نفس الفصل والأسبوع، لحصص نفس المادة فقط. الخانات غير المختارة لا تتغير، والنسخ لا يرسل الخطة أو يعتمدها." : "Within this class and week, to the same subject only. Unselected fields stay unchanged. Copying does not submit or approve the plan."}</p>
      <fieldset><legend>{arabic ? "ما الذي تريد نسخه؟" : "What should be copied?"}</legend>{(["classwork","homework","classeraNotes"] as const).map((field,index) => <label key={field}><input type="checkbox" checked={fields[field]} onChange={(event) => { setFields({...fields,[field]:event.target.checked}); resetWarning(); }} />{(arabic ? ["عمل الحصة","الواجب المنزلي","ملاحظات كلاسيرا"] : ["Classwork","Homework","Classera notes"])[index]}</label>)}</fieldset>
      <fieldset className="lesson-copy-targets"><legend>{arabic ? "اختر الحصص المستهدفة" : "Choose target lessons"}</legend>{targets.map((slot) => <label key={slot.id}><input type="checkbox" checked={ids.includes(slot.id)} onChange={(event) => { setIds(event.target.checked ? [...ids,slot.id] : ids.filter(id=>id!==slot.id)); resetWarning(); }} />{lessonLabel(slot,arabic)}</label>)}{!targets.length && <p>{arabic ? "لا توجد حصص أخرى قابلة للنسخ لنفس المادة." : "No other writable lessons of this subject are available."}</p>}</fieldset>
      {conflict && <div className="lesson-copy-warning" role="alert"><strong>{arabic ? "تنبيه: توجد كتابة سيتم استبدالها في الخانات المختارة" : "Warning: selected fields already contain writing that will be replaced"}</strong><ul>{targets.filter(slot=>conflict.targetIds.includes(slot.id)).map(slot=><li key={slot.id}>{lessonLabel(slot,arabic)}</li>)}</ul><p>{arabic ? "راجع الحصص، ثم أكد الاستبدال أو ارجع لاختيار حصص أخرى." : "Review these lessons, then confirm replacement or choose other targets."}</p></div>}
      {error && <p className="lesson-copy-warning" role="alert">{error}</p>}
      <footer><button type="button" onClick={onClose}>{arabic ? "إلغاء" : "Cancel"}</button><button type="button" className={conflict ? "replace" : "apply"} disabled={busy || !ids.length || !Object.values(fields).some(Boolean)} onClick={apply}>{busy ? arabic ? "جارٍ الحفظ…" : "Saving…" : conflict ? arabic ? "تأكيد استبدال الخانات المختارة" : "Confirm selected-field replacement" : arabic ? "نسخ إلى الحصص المختارة" : "Copy to selected lessons"}</button></footer>
    </section>
  </div>;
}
