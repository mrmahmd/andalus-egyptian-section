"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { formatAcademicWeekRange } from "../../lib/format-academic-week";

type Week = { id: string; week_number: number; starts_on: string; ends_on: string };
type Assignment = { classId: string; subjectId: string; subject: string; grade: number; section: string };
type Quiz = { id: string; class_id: string; week_id: string; day_of_week: number; programme: string; content: string };
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const arabicDays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

function errorText(error: unknown) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message : "The quiz could not be saved.";
}

export default function FaridQuizzesPanel({ weeks, assignments, teacherId, initialWeekId, arabic, contextWeekId, contextClassId, embedded = false, readOnly = false }: {
  weeks: Week[]; assignments: Assignment[]; teacherId: string; initialWeekId: string; arabic: boolean;
  contextWeekId?: string; contextClassId?: string; embedded?: boolean; readOnly?: boolean;
}) {
  const englishClasses = useMemo(() => Array.from(new Map(assignments.filter((item) => ["English AL", "English OL"].includes(item.subject)).map((item) => [item.classId, item])).values()), [assignments]);
  const [weekId, setWeekId] = useState(initialWeekId);
  const [classId, setClassId] = useState("");
  const [day, setDay] = useState(0);
  const [programme, setProgramme] = useState("English OL");
  const [content, setContent] = useState("");
  const [items, setItems] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const loadRequest = useRef(0);
  const selectedWeekId = contextWeekId ?? weekId;
  const selectedClassId = contextClassId ?? classId;

  useEffect(() => { if (!weekId && initialWeekId) setWeekId(initialWeekId); }, [initialWeekId, weekId]);
  useEffect(() => { if (!englishClasses.some((item) => item.classId === classId)) setClassId(englishClasses[0]?.classId ?? ""); }, [classId, englishClasses]);
  useEffect(() => {
    const requiredSubject = programme === "English OL" ? "English OL" : "English AL";
    if (!assignments.some((item) => item.classId === selectedClassId && item.subject === requiredSubject)) {
      setProgramme(assignments.some((item) => item.classId === selectedClassId && item.subject === "English OL") ? "English OL" : "Connect Plus");
    }
  }, [assignments, selectedClassId, programme]);

  const loadItems = useCallback(async () => {
    const request = ++loadRequest.current;
    if (!teacherId || !selectedWeekId || !selectedClassId) { setItems([]); return; }
    setItems([]);
    setLoading(true);
    try {
      const { data, error } = await getSupabaseBrowserClient().from("farid_weekly_quizzes")
        .select("id, class_id, week_id, day_of_week, programme, content")
        .eq("teacher_id", teacherId).eq("week_id", selectedWeekId).eq("class_id", selectedClassId)
        .order("day_of_week").order("programme");
      if (error) throw error;
      if (request !== loadRequest.current) return;
      setItems((data ?? []) as Quiz[]);
    } catch (error) { if (request === loadRequest.current) setFeedback(errorText(error)); }
    finally { if (request === loadRequest.current) setLoading(false); }
  }, [teacherId, selectedWeekId, selectedClassId]);

  useEffect(() => {
    setFeedback("");
    void loadItems();
    return () => { loadRequest.current += 1; };
  }, [loadItems]);
  useEffect(() => {
    setContent(items.find((item) => item.day_of_week === day && item.programme === programme)?.content ?? "");
  }, [items, day, programme]);

  const selectedClass = englishClasses.find((item) => item.classId === selectedClassId);
  const selectedSubject = assignments.find((item) => item.classId === selectedClassId && item.subject === (programme === "English OL" ? "English OL" : "English AL"));
  const selectedWeek = weeks.find((item) => item.id === selectedWeekId);
  const quizDate = (dayIndex: number) => {
    if (!selectedWeek) return "";
    const date = new Date(`${selectedWeek.starts_on}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + dayIndex);
    return new Intl.DateTimeFormat(arabic ? "ar-EG" : "en-GB", { day: "numeric", month: "short" }).format(date);
  };
  const save = async () => {
    if (readOnly) return;
    if (!selectedClass || !selectedSubject || !selectedWeek || !teacherId || !content.trim()) {
      setFeedback(arabic ? "اختر الأسبوع والفصل واكتب محتوى الاختبار." : "Choose a week and class, then enter quiz content.");
      return;
    }
    setBusy(true); setFeedback("");
    try {
      const { error } = await getSupabaseBrowserClient().from("farid_weekly_quizzes").upsert({
        week_id: selectedWeekId, class_id: selectedClassId, teacher_id: teacherId, subject_id: selectedSubject.subjectId,
        day_of_week: day, programme, content: content.trim(), updated_at: new Date().toISOString(),
      }, { onConflict: "week_id,class_id,teacher_id,day_of_week,programme" });
      if (error) throw error;
      await loadItems();
      setFeedback(arabic ? "تم حفظ الاختبار. سيظهر فوق الخطة بعد اعتماد المادة ونشر خطة الفصل." : "Quiz saved. It will appear above the plan after your subject is approved and the class plan is published.");
    } catch (error) { setFeedback(errorText(error)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (readOnly) return;
    const current = items.find((item) => item.day_of_week === day && item.programme === programme);
    if (!current || !window.confirm(arabic ? "حذف هذا الاختبار؟" : "Delete this quiz?")) return;
    setBusy(true); setFeedback("");
    try {
      const { error } = await getSupabaseBrowserClient().from("farid_weekly_quizzes")
        .delete().eq("id", current.id).eq("teacher_id", teacherId);
      if (error) throw error;
      await loadItems();
      setFeedback(arabic ? "تم حذف الاختبار." : "Quiz deleted.");
    } catch (error) { setFeedback(errorText(error)); }
    finally { setBusy(false); }
  };

  return <section className={`teacher-card farid-teacher-quizzes ${embedded ? "is-embedded" : ""}`} dir={arabic ? "rtl" : "ltr"}>
    <div className="farid-feature-head"><span className="farid-feature-icon">Q</span><div><small>{arabic ? "قسم مخصص لمحمد فريد" : "MOHAMED FARID · QUIZZES"}</small><h2>{arabic ? "اختبارات الخطة الأسبوعية" : "Weekly plan quizzes"}</h2><p>{arabic ? "حدد يوم الاختبار والبرنامج واكتب المحتوى. احفظ الاختبار من الزر الخاص به؛ لا يكفي حفظ مسودة الحصص." : "Choose the quiz day and programme, then save the quiz separately from your lesson draft."}</p></div></div>
    <div className="farid-feature-grid">
      {!embedded && <label>{arabic ? "الأسبوع" : "Week"}<select value={weekId} onChange={(event) => setWeekId(event.target.value)}>{weeks.map((week) => <option key={week.id} value={week.id}>{arabic ? `الأسبوع ${week.week_number}` : `Week ${week.week_number}`} · {formatAcademicWeekRange(week, arabic ? "ar-EG" : "en-GB")}</option>)}</select></label>}
      {!embedded && <label>{arabic ? "الفصل" : "Class"}<select value={classId} onChange={(event) => setClassId(event.target.value)}>{englishClasses.map((item) => <option key={item.classId} value={item.classId}>{arabic ? `الصف ${item.grade} · الشعبة ${item.section}` : `Grade ${item.grade} · Class ${item.section}`}</option>)}</select></label>}
      {embedded && <div className="farid-feature-context">{arabic ? `الأسبوع ${selectedWeek?.week_number ?? "—"} · الصف ${selectedClass?.grade ?? "—"} · الشعبة ${selectedClass?.section ?? "—"}` : `Week ${selectedWeek?.week_number ?? "—"} · Grade ${selectedClass?.grade ?? "—"} · Class ${selectedClass?.section ?? "—"}`}</div>}
      <label>{arabic ? "يوم الاختبار" : "Quiz day"}<select value={day} onChange={(event) => setDay(Number(event.target.value))}>{dayNames.map((name, index) => <option key={name} value={index}>{arabic ? arabicDays[index] : name} · {quizDate(index)}</option>)}</select></label>
      <label>{arabic ? "المادة / البرنامج" : "Subject / programme"}<select value={programme} onChange={(event) => setProgramme(event.target.value)} translate="no" lang="en" dir="ltr"><option value="English OL" disabled={!assignments.some((item) => item.classId === selectedClassId && item.subject === "English OL")}>English OL</option><option value="Connect Plus" disabled={!assignments.some((item) => item.classId === selectedClassId && item.subject === "English AL")}>Connect Plus</option></select></label>
      <label className="farid-feature-wide">{arabic ? "محتوى الاختبار" : "Quiz content"}<textarea rows={4} maxLength={2500} value={content} onChange={(event) => setContent(event.target.value)} placeholder={arabic ? "اكتب ما سيُختبر فيه الطلاب" : "Enter the quiz content"} /></label>
    </div>
    {!readOnly && <div className="farid-feature-actions"><button type="button" className="teacher-primary-button" disabled={busy || loading || !selectedClass} onClick={() => void save()}>{busy ? arabic ? "جارٍ الحفظ…" : "Saving…" : arabic ? "حفظ الاختبار" : "Save quiz"}</button>{items.some((item) => item.day_of_week === day && item.programme === programme) && <button type="button" className="farid-feature-remove" disabled={busy} onClick={() => void remove()}>{arabic ? "حذف الاختبار" : "Delete quiz"}</button>}</div>}
    {feedback && <p className="farid-feature-feedback" role="status">{feedback}</p>}
    <div className="farid-feature-list"><h3>{arabic ? "اختبارات الفصل في هذا الأسبوع" : "This class’s quizzes"}</h3>{items.length ? items.map((item) => <article key={item.id}><strong>{arabic ? arabicDays[item.day_of_week] : dayNames[item.day_of_week]} · {quizDate(item.day_of_week)}</strong><b translate="no" lang="en" dir="ltr">{item.programme}</b><p>{item.content}</p></article>) : <p>{loading ? arabic ? "جارٍ تحميل الاختبارات…" : "Loading quizzes…" : arabic ? "لا توجد اختبارات مسجلة لهذا الفصل والأسبوع." : "No quizzes for this class and week."}</p>}</div>
  </section>;
}
