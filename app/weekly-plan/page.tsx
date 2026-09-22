"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabasePublicClient } from "../../lib/supabase/client";
import { formatAcademicWeekRange } from "../../lib/format-academic-week";

type PublishedPlan = { id: string; weekId: string; classId: string; grade: number; section: string; weekNumber: number; weekLabel: string; startsOn: string; endsOn: string };
type LiveLesson = { day_of_week: number; period_number: number; course: string; classwork: string; homework: string; notes: string };
type LiveQuiz = { course: string; date: string; details: string };
type LiveHoliday = { day_of_week: number; title: string; note: string | null };
type LiveDictation = { day: number; words: string[] };
type PublishedEntry = { day_of_week: number; period_number: number; classwork: string; homework: string; classera_notes: string };
type ParentTimetableSlot = {
  day_of_week: number;
  period_number: number;
  requires_weekly_plan_submission: boolean;
  subjects: { code: string; parent_plan_name: string; name_en: string; include_in_weekly_plan: boolean } | { code: string; parent_plan_name: string; name_en: string; include_in_weekly_plan: boolean }[] | null;
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const dictationNotePrefix = "__ENGLISH_DICTATION__";
const one = <T,>(value: T | T[] | null) => Array.isArray(value) ? value[0] ?? null : value;
const chunkWords = (words: string[], size = 4) => Array.from({ length: Math.ceil(words.length / size) }, (_, index) => words.slice(index * size, index * size + size));
const parseEnglishDictation = (value: string): LiveDictation | null => {
  if (!value.startsWith(dictationNotePrefix)) return null;
  try {
    const parsed = JSON.parse(value.slice(dictationNotePrefix.length)) as LiveDictation;
    return Number.isInteger(parsed.day) && parsed.day >= 0 && parsed.day <= 4 && Array.isArray(parsed.words)
      ? { day: parsed.day, words: parsed.words.map(String).map((word) => word.trim()).filter(Boolean) }
      : null;
  } catch {
    return null;
  }
};
const fixedLessonText: Record<string, { course: string; classwork: string }> = {
  quran: { course: "Quran", classwork: "المدرسة القرآنية - حفظ كتاب الله" },
  swimming: { course: "Swimming", classwork: "School swimming pool" },
  pe: { course: "PE", classwork: "School playground" },
};
const formatDates = (startsOn: string, endsOn: string) => formatAcademicWeekRange({ starts_on: startsOn, ends_on: endsOn });

export default function WeeklyPlanPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [grade, setGrade] = useState("Grade 1");
  const [classType, setClassType] = useState("Class A");
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [publishedPlans, setPublishedPlans] = useState<PublishedPlan[]>([]);
  const [liveLessons, setLiveLessons] = useState<LiveLesson[]>([]);
  const [liveQuizzes, setLiveQuizzes] = useState<LiveQuiz[]>([]);
  const [liveDictations, setLiveDictations] = useState<LiveDictation[]>([]);
  const [liveHolidays, setLiveHolidays] = useState<LiveHoliday[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingSelectedPlan, setLoadingSelectedPlan] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [selectedPlanError, setSelectedPlanError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isArabic, setIsArabic] = useState(false);

  useEffect(() => {
    const initialization = window.setTimeout(() => {
      setIsArabic(window.localStorage.getItem("andalus-language") === "ar");
      const requested = new URLSearchParams(window.location.search);
      const requestedGrade = requested.get("grade");
      const requestedSection = requested.get("section")?.toUpperCase();
      if (requestedGrade && /^(?:[1-9]|10)$/.test(requestedGrade)) setGrade(`Grade ${requestedGrade}`);
      if (requestedSection === "A" || requestedSection === "B") setClassType(`Class ${requestedSection}`);
    }, 0);
    return () => window.clearTimeout(initialization);
  }, []);

  const refreshPlans = useCallback(() => setRefreshVersion((current) => current + 1), []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshPlans();
    };
    window.addEventListener("focus", refreshPlans);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshPlans);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshPlans]);

  useEffect(() => {
    let cancelled = false;
    const loadPublishedPlans = async () => {
      setLoadingPlans(true);
      setPlansError("");
      try {
        const requested = new URLSearchParams(window.location.search);
        const requestedGrade = requested.get("grade");
        const requestedSection = requested.get("section")?.toUpperCase();
        const requestedWeek = Number(requested.get("week"));
        const supabase = getSupabasePublicClient();
        const { data, error } = await supabase
        .from("weekly_plans")
        .select("id, week_id, class_id, school_classes(grade, section), academic_weeks!inner(week_number, label, starts_on, ends_on, parent_portal_visible)")
        .eq("status", "published")
        .eq("academic_weeks.parent_portal_visible", true);
        if (error) throw error;
        const plans = ((data ?? []) as unknown as Record<string, unknown>[]).map((item) => {
          const schoolClass = one(item.school_classes as { grade: number; section: string } | { grade: number; section: string }[] | null);
          const week = one(item.academic_weeks as { week_number: number; label: string; starts_on: string; ends_on: string; parent_portal_visible: boolean } | { week_number: number; label: string; starts_on: string; ends_on: string; parent_portal_visible: boolean }[] | null);
          return schoolClass && week ? { id: String(item.id), weekId: String(item.week_id), classId: String(item.class_id), grade: schoolClass.grade, section: schoolClass.section, weekNumber: week.week_number, weekLabel: week.label, startsOn: week.starts_on, endsOn: week.ends_on } : null;
        }).filter((plan): plan is PublishedPlan => plan !== null).sort((a, b) => b.weekNumber - a.weekNumber);
        if (cancelled) return;
        setPublishedPlans(plans);
        setSelectedWeek((current) => {
          const requestedPlan = plans.find((plan) => plan.grade === Number(requestedGrade ?? 1) && plan.section === (requestedSection ?? "A") && plan.weekNumber === requestedWeek);
          if (requestedPlan) return requestedPlan.weekNumber;
          return plans.some((plan) => plan.weekNumber === current) ? current : null;
        });
      } catch (error) {
        if (cancelled) return;
        setPublishedPlans([]);
        setSelectedWeek(null);
        setPlansError(error instanceof Error ? error.message : "Published plans could not be loaded.");
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    };
    void loadPublishedPlans();
    return () => { cancelled = true; };
  }, [refreshVersion]);

  const plansForClass = useMemo(() => publishedPlans.filter((plan) => plan.grade === Number(grade.replace("Grade ", "")) && plan.section === classType.replace("Class ", "")), [classType, grade, publishedPlans]);
  const selectedPlan = plansForClass.find((plan) => plan.weekNumber === selectedWeek) ?? null;

  useEffect(() => {
    if (!selectedPlan) return;
    let cancelled = false;
    const loadLivePlan = async () => {
      setLoadingSelectedPlan(true);
      setSelectedPlanError("");
      try {
        const supabase = getSupabasePublicClient();
        const [planResult, holidayResult, timetableResult] = await Promise.all([
        supabase.from("weekly_plans")
        .select("plan_entries(day_of_week, period_number, classwork, homework, classera_notes, subjects(code, parent_plan_name)), plan_quizzes(quiz_date, details, subjects(parent_plan_name)), plan_notes(note_text)")
        .eq("id", selectedPlan.id).eq("status", "published").maybeSingle(),
        supabase.from("weekly_plan_holidays").select("day_of_week, title, note").eq("week_id", selectedPlan.weekId),
        supabase.from("timetable_slots").select("day_of_week, period_number, requires_weekly_plan_submission, subjects(code, parent_plan_name, name_en, include_in_weekly_plan)").eq("class_id", selectedPlan.classId).order("day_of_week").order("period_number"),
        ]);
        if (planResult.error) throw planResult.error;
        if (holidayResult.error) throw holidayResult.error;
        if (timetableResult.error) throw timetableResult.error;
        if (!planResult.data) throw new Error("This plan is no longer available to parents.");
        if (cancelled) return;
        const data = planResult.data;
        const holidayData = holidayResult.data;
        const timetableData = timetableResult.data;
      const entries = (data?.plan_entries ?? []) as unknown as PublishedEntry[];
      const holidayRows = (holidayData ?? []) as LiveHoliday[];
      const publishedEntryByPeriod = new Map(entries.map((entry) => [`${entry.day_of_week}-${entry.period_number}`, entry]));
      const lessonRows = ((timetableData ?? []) as unknown as ParentTimetableSlot[]).flatMap((slot) => {
        const subject = one(slot.subjects);
        if (!subject) return [];
        const fixed = fixedLessonText[subject.code];
        if (fixed) return [{ day_of_week: slot.day_of_week, period_number: slot.period_number, course: fixed.course, classwork: fixed.classwork, homework: "—", notes: "—" }];
        if (!slot.requires_weekly_plan_submission || !subject.include_in_weekly_plan) return [];
        const publishedEntry = publishedEntryByPeriod.get(`${slot.day_of_week}-${slot.period_number}`);
        return [{
          day_of_week: slot.day_of_week,
          period_number: slot.period_number,
          course: subject.parent_plan_name || subject.name_en || "Subject",
          classwork: publishedEntry?.classwork || "Plan not published",
          homework: publishedEntry?.homework || "—",
          notes: publishedEntry?.classera_notes || "—",
        }];
      });
      setLiveLessons(lessonRows.filter((lesson) => !holidayRows.some((holiday) => holiday.day_of_week === lesson.day_of_week)).concat(holidayRows.map((holiday) => ({ day_of_week: holiday.day_of_week, period_number: 0, course: holiday.title, classwork: holiday.note || "No classes today.", homework: "—", notes: "School-wide holiday" }))).sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number));
      const quizzes = (data?.plan_quizzes ?? []) as unknown as { quiz_date: string | null; details: string; subjects: { parent_plan_name: string } | { parent_plan_name: string }[] | null }[];
      setLiveQuizzes(quizzes.filter((quiz) => Boolean(quiz.details)).map((quiz) => ({ course: one(quiz.subjects)?.parent_plan_name ?? "Subject", date: quiz.quiz_date ?? "", details: quiz.details })));
      const dictations = ((data?.plan_notes ?? []) as unknown as { note_text: string }[])
        .map((note) => parseEnglishDictation(note.note_text))
        .filter((dictation): dictation is LiveDictation => Boolean(dictation))
        .sort((a, b) => a.day - b.day);
      setLiveDictations(dictations);
      setLiveHolidays((holidayData ?? []) as LiveHoliday[]);
      } catch (error) {
        if (cancelled) return;
        setLiveLessons([]);
        setLiveQuizzes([]);
        setLiveDictations([]);
        setLiveHolidays([]);
        setSelectedPlanError(error instanceof Error ? error.message : "The weekly plan could not be loaded.");
      } finally {
        if (!cancelled) setLoadingSelectedPlan(false);
      }
    };
    void loadLivePlan();
    return () => { cancelled = true; };
  }, [refreshVersion, selectedPlan]);

  const days = dayNames.map((day, dayIndex) => ({ day, lessons: liveLessons.filter((lesson) => lesson.day_of_week === dayIndex), holiday: liveHolidays.find((holiday) => holiday.day_of_week === dayIndex) ?? null })).filter((item) => item.lessons.length > 0 || item.holiday);
  const gradeLabel = (value: number) => isArabic ? `الصف ${value}` : `Grade ${value}`;
  const classLabel = (value: string) => isArabic ? `الشعبة ${value === "A" ? "أ" : "ب"}` : `Class ${value}`;
  const openPlan = (weekNumber: number) => {
    setSelectedWeek(weekNumber);
    window.setTimeout(() => document.getElementById("selected-plan")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return <main className="subpage plan-page">
    <header className="compact-header"><Link href="/" className="brand-lockup"><img src={`${basePath}/school-logo.png`} alt="AlAndalus Private Schools" /><span className="brand-copy"><strong>ALANDALUS PRIVATE SCHOOLS</strong><small>Egyptian Section</small></span></Link><nav><Link href="/">Home</Link><Link className="active" href="/weekly-plan">Weekly Plan</Link><Link href="/timetable">Timetable</Link></nav><Link className="button button-outline" href="/support">Technical Support</Link></header>
    <section className="plan-directory-hero"><div className="page-width"><p className="eyebrow">{isArabic ? "بوابة أولياء الأمور" : "FAMILY ACCESS"}</p><h1>{isArabic ? "مكتبة الخطط الأسبوعية" : "Weekly Plan Library"}</h1><span>{isArabic ? "اختر صف الطالب وشعبته لعرض الخطط الأسبوعية المعتمدة والمنشورة من المدرسة." : "Choose your child’s grade and class to see approved weekly plans published by the school."}</span></div></section>
    <section className="plan-directory page-width" aria-label="Weekly plan selector">
      <div className="plan-directory-heading"><div><span className="directory-icon">WP</span><div><p className="eyebrow">{isArabic ? "البحث عن الخطة" : "PLAN FINDER"}</p><h2>{isArabic ? "اختر صف وشعبة الطالب" : "Choose your child’s class"}</h2></div></div><p>{isArabic ? "تظهر هنا الخطط المعتمدة فقط، وتبقى الخطط السابقة متاحة لرجوع أولياء الأمور إليها." : "Only supervisor-approved plans are shown here. Previous plans remain available for families to revisit."}</p></div>
      <div className="plan-directory-filters"><label>{isArabic ? "الصف" : "Grade"}<select value={grade} onChange={(event) => { setGrade(event.target.value); setSelectedWeek(null); }}>{Array.from({ length: 10 }, (_, index) => <option key={index} value={`Grade ${index + 1}`}>{gradeLabel(index + 1)}</option>)}</select></label><label>{isArabic ? "الشعبة" : "Class"}<select value={classType} onChange={(event) => { setClassType(event.target.value); setSelectedWeek(null); }}><option value="Class A">{classLabel("A")}</option><option value="Class B">{classLabel("B")}</option></select></label><div className="plan-directory-selection"><small>{isArabic ? "الخطط المنشورة لـ" : "Published plans for"}</small><strong>{gradeLabel(Number(grade.replace("Grade ", "")))} · {classLabel(classType.replace("Class ", ""))}</strong></div></div>
      <div className="week-library"><div className="week-library-heading"><div><h2>{isArabic ? "الخطط الأسبوعية المتاحة" : "Available weekly plans"}</h2><p>{isArabic ? "العام الدراسي 2026–2027" : "Academic Year 2026–2027"}</p></div><div className="week-library-tools"><span>{isArabic ? `${plansForClass.length} خطط متاحة` : `${plansForClass.length} plan${plansForClass.length === 1 ? "" : "s"} available`}</span><button type="button" onClick={refreshPlans} disabled={loadingPlans}>{isArabic ? "تحديث الخطط" : "Refresh plans"}</button></div></div>
        {plansError ? <p className="parent-plan-error" role="alert">{isArabic ? "تعذر تحميل الخطط الآن. تأكد من الاتصال ثم اضغط «تحديث الخطط»." : "Plans could not be loaded. Check your connection, then select Refresh plans."}<small>{plansError}</small></p> : loadingPlans ? <p className="supervisor-review-empty">{isArabic ? "جارٍ تحميل الخطط المنشورة…" : "Loading published plans…"}</p> : plansForClass.length === 0 ? <p className="supervisor-review-empty">{isArabic ? "لا توجد خطط أسبوعية معتمدة ومنشورة لهذا الفصل حتى الآن." : "No approved weekly plans have been published for this class yet."}</p> : <div className="week-library-list">{plansForClass.map((plan) => <article className="week-library-item" key={plan.id}><span className="week-number">{String(plan.weekNumber).padStart(2, "0")}</span><div className="week-details"><strong>{isArabic ? `الأسبوع ${plan.weekNumber}` : `Week ${plan.weekNumber}`}</strong><small>{formatAcademicWeekRange({ starts_on: plan.startsOn, ends_on: plan.endsOn }, isArabic ? "ar-EG" : "en-GB")}</small></div><span className="week-status">{isArabic ? "متاح" : "Available"}</span><div className="week-actions"><button type="button" className="week-view-button" onClick={() => openPlan(plan.weekNumber)}>{isArabic ? "عرض" : "View"} <span>→</span></button><button type="button" className="week-download-button" onClick={() => { openPlan(plan.weekNumber); window.setTimeout(() => window.print(), 150); }}>{isArabic ? "طباعة / تحميل" : "Print / Download"}</button></div></article>)}</div>}</div>
    </section>
    <section id="selected-plan" className={`selected-plan-wrap ${selectedPlan ? "is-open" : ""}`} aria-hidden={!selectedPlan}>{selectedPlan && <><div className="plan-toolbar page-width"><div><p className="eyebrow">OFFICIAL WEEKLY PLAN</p><h1>{grade} · {classType}</h1><p>Week {selectedPlan.weekNumber} · {formatDates(selectedPlan.startsOn, selectedPlan.endsOn)}</p></div><div className="toolbar-actions"><button className="button button-outline" type="button" onClick={() => setSelectedWeek(null)}>Back to Plans</button><button className="button button-primary" type="button" onClick={() => window.print()}>Print / Save PDF</button></div></div>
      <section className="plan-paper page-width" aria-label="Weekly study plan"><div className="paper-header"><img src={`${basePath}/school-logo.png`} alt="AlAndalus Private Schools" /><div><strong>ALANDALUS PRIVATE SCHOOLS</strong><span>The Egyptian Section</span><h2>WEEKLY STUDY PLAN</h2></div></div><div className="paper-meta"><span><small>Class</small><strong>{grade} · {classType}</strong></span><span><small>Class Teacher</small><strong>To be confirmed</strong></span><span><small>Week No.</small><strong>{selectedPlan.weekNumber}</strong></span><span><small>Date</small><strong>{formatDates(selectedPlan.startsOn, selectedPlan.endsOn)}</strong></span></div>{selectedPlanError ? <p className="parent-plan-error" role="alert">The plan could not be refreshed. Please try again.<small>{selectedPlanError}</small></p> : loadingSelectedPlan ? <p className="supervisor-review-empty">Refreshing the published plan…</p> : <>{liveDictations.map((dictation, index) => <section className="parent-dictation-block" key={`${dictation.day}-${index}`}><h3>Vocabulary for Dictation on {dayNames[dictation.day]}</h3><table><tbody>{chunkWords(dictation.words).map((row, rowIndex) => <tr key={rowIndex}>{row.map((word) => <td key={word}>{word}</td>)}</tr>)}</tbody></table></section>)}<div className="table-wrap"><table className="weekly-table"><colgroup><col className="day-column" /><col className="course-column" /><col className="classwork-column" /><col className="homework-column" /><col className="classera-column" /></colgroup><thead><tr><th>Day</th><th>Course</th><th>Classwork</th><th>Homework</th><th>Classera Notes</th></tr></thead>{days.map(({ day, lessons }) => <tbody className="weekly-day-group" key={day}>{lessons.map((lesson, lessonIndex) => <tr key={`${day}-${lesson.period_number}`} className={lessonIndex === 0 ? "new-day" : ""}>{lessonIndex === 0 && <td className="day-cell" rowSpan={lessons.length}>{day}</td>}<td className="course-cell">{lesson.course}</td><td className={lesson.classwork === "Plan not published" ? "unpublished-plan" : ""}>{lesson.classwork || "—"}</td><td>{lesson.homework || "—"}</td><td>{lesson.notes || "—"}</td></tr>)}</tbody>)}</table>{days.length === 0 && <p className="supervisor-review-empty">This approved plan does not contain lesson entries yet.</p>}</div>{liveQuizzes.length > 0 && <div className="important-notes"><strong>Quizzes & Assessments</strong><div className="parent-plan-assessments">{liveQuizzes.map((quiz, index) => <p key={`${quiz.course}-${index}`}><strong>{quiz.course}{quiz.date ? ` · ${quiz.date}` : ""}</strong>{quiz.details}</p>)}</div></div>}</>}</section></>}</section>
  </main>;
}
