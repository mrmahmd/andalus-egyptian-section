"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type PublishedPlan = { id: string; weekId: string; grade: number; section: string; weekNumber: number; weekLabel: string; startsOn: string; endsOn: string };
type LiveLesson = { day_of_week: number; period_number: number; course: string; classwork: string; homework: string; notes: string };
type LiveQuiz = { course: string; date: string; details: string };
type LiveHoliday = { day_of_week: number; title: string; note: string | null };

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const one = <T,>(value: T | T[] | null) => Array.isArray(value) ? value[0] ?? null : value;
const formatDates = (startsOn: string, endsOn: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${startsOn}T00:00:00`)) + " – " + new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${endsOn}T00:00:00`));

export default function WeeklyPlanPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [grade, setGrade] = useState("Grade 4");
  const [classType, setClassType] = useState("Class A");
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [publishedPlans, setPublishedPlans] = useState<PublishedPlan[]>([]);
  const [liveLessons, setLiveLessons] = useState<LiveLesson[]>([]);
  const [liveQuizzes, setLiveQuizzes] = useState<LiveQuiz[]>([]);
  const [liveFamilyNotes, setLiveFamilyNotes] = useState<string[]>([]);
  const [liveHolidays, setLiveHolidays] = useState<LiveHoliday[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [isArabic, setIsArabic] = useState(false);

  useEffect(() => {
    setIsArabic(window.localStorage.getItem("andalus-language") === "ar");
    const requested = new URLSearchParams(window.location.search);
    const requestedGrade = requested.get("grade");
    const requestedSection = requested.get("section")?.toUpperCase();
    const requestedWeek = Number(requested.get("week"));
    if (requestedGrade && /^(?:[1-9]|10)$/.test(requestedGrade)) setGrade(`Grade ${requestedGrade}`);
    if (requestedSection === "A" || requestedSection === "B") setClassType(`Class ${requestedSection}`);

    const loadPublishedPlans = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase
        .from("weekly_plans")
        .select("id, week_id, school_classes(grade, section), academic_weeks(week_number, label, starts_on, ends_on)")
        .eq("status", "published");
      const plans = ((data ?? []) as unknown as Record<string, unknown>[]).map((item) => {
        const schoolClass = one(item.school_classes as { grade: number; section: string } | { grade: number; section: string }[] | null);
        const week = one(item.academic_weeks as { week_number: number; label: string; starts_on: string; ends_on: string } | { week_number: number; label: string; starts_on: string; ends_on: string }[] | null);
        return schoolClass && week ? { id: String(item.id), weekId: String(item.week_id), grade: schoolClass.grade, section: schoolClass.section, weekNumber: week.week_number, weekLabel: week.label, startsOn: week.starts_on, endsOn: week.ends_on } : null;
      }).filter((plan): plan is PublishedPlan => plan !== null).sort((a, b) => b.weekNumber - a.weekNumber);
      setPublishedPlans(plans);
      setLoadingPlans(false);
      const target = plans.find((plan) => plan.grade === Number(requestedGrade ?? 4) && plan.section === (requestedSection ?? "A") && plan.weekNumber === requestedWeek);
      if (target) setSelectedWeek(target.weekNumber);
    };
    void loadPublishedPlans();
  }, []);

  const plansForClass = useMemo(() => publishedPlans.filter((plan) => plan.grade === Number(grade.replace("Grade ", "")) && plan.section === classType.replace("Class ", "")), [classType, grade, publishedPlans]);
  const selectedPlan = plansForClass.find((plan) => plan.weekNumber === selectedWeek) ?? null;

  useEffect(() => {
    if (!selectedPlan) {
      setLiveLessons([]);
      setLiveQuizzes([]);
      setLiveFamilyNotes([]);
      setLiveHolidays([]);
      return;
    }
    const loadLivePlan = async () => {
      const supabase = getSupabaseBrowserClient();
      const [{ data }, { data: holidayData }] = await Promise.all([
        supabase.from("weekly_plans")
        .select("plan_entries(day_of_week, period_number, classwork, homework, classera_notes, subjects(parent_plan_name)), plan_quizzes(quiz_date, details, subjects(parent_plan_name)), plan_notes(note_text)")
        .eq("id", selectedPlan.id).eq("status", "published").maybeSingle(),
        supabase.from("weekly_plan_holidays").select("day_of_week, title, note").eq("week_id", selectedPlan.weekId),
      ]);
      const entries = (data?.plan_entries ?? []) as unknown as { day_of_week: number; period_number: number; classwork: string; homework: string; classera_notes: string; subjects: { parent_plan_name: string } | { parent_plan_name: string }[] | null }[];
      const holidayRows = (holidayData ?? []) as LiveHoliday[];
      const lessonRows = entries.map((entry) => ({ day_of_week: entry.day_of_week, period_number: entry.period_number, course: one(entry.subjects)?.parent_plan_name ?? "Subject", classwork: entry.classwork, homework: entry.homework, notes: entry.classera_notes }));
      setLiveLessons([...lessonRows.filter((lesson) => !holidayRows.some((holiday) => holiday.day_of_week === lesson.day_of_week)), ...holidayRows.map((holiday) => ({ day_of_week: holiday.day_of_week, period_number: 0, course: holiday.title, classwork: holiday.note || "No classes today.", homework: "—", notes: "School-wide holiday" }))].sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number));
      const quizzes = (data?.plan_quizzes ?? []) as unknown as { quiz_date: string | null; details: string; subjects: { parent_plan_name: string } | { parent_plan_name: string }[] | null }[];
      setLiveQuizzes(quizzes.filter((quiz) => Boolean(quiz.details)).map((quiz) => ({ course: one(quiz.subjects)?.parent_plan_name ?? "Subject", date: quiz.quiz_date ?? "", details: quiz.details })));
      const familyNotes = (data?.plan_notes ?? []) as unknown as { note_text: string }[];
      setLiveFamilyNotes(familyNotes.map((note) => note.note_text).filter(Boolean));
      setLiveHolidays((holidayData ?? []) as LiveHoliday[]);
    };
    void loadLivePlan();
  }, [selectedPlan]);

  const days = dayNames.map((day, dayIndex) => ({ day, lessons: liveLessons.filter((lesson) => lesson.day_of_week === dayIndex), holiday: liveHolidays.find((holiday) => holiday.day_of_week === dayIndex) ?? null })).filter((item) => item.lessons.length > 0 || item.holiday);
  const gradeLabel = (value: number) => isArabic ? `الصف ${value}` : `Grade ${value}`;
  const classLabel = (value: string) => isArabic ? `الشعبة ${value === "A" ? "أ" : "ب"}` : `Class ${value}`;
  const openPlan = (weekNumber: number) => {
    setSelectedWeek(weekNumber);
    window.setTimeout(() => document.getElementById("selected-plan")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return <main className="subpage plan-page">
    <header className="compact-header"><Link href="/" className="brand-lockup"><img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" /><span className="brand-copy"><strong>ALANDALUS PRIVATE SCHOOLS</strong><small>Egyptian Section</small></span></Link><nav><Link href="/">Home</Link><Link className="active" href="/weekly-plan">Weekly Plan</Link><Link href="/timetable">Timetable</Link></nav><Link className="button button-outline" href="/support">Technical Support</Link></header>
    <section className="plan-directory-hero"><div className="page-width"><p className="eyebrow">{isArabic ? "بوابة أولياء الأمور" : "FAMILY ACCESS"}</p><h1>{isArabic ? "مكتبة الخطط الأسبوعية" : "Weekly Plan Library"}</h1><span>{isArabic ? "اختر صف الطالب وشعبته لعرض الخطط الأسبوعية المعتمدة والمنشورة من المدرسة." : "Choose your child’s grade and class to see approved weekly plans published by the school."}</span></div></section>
    <section className="plan-directory page-width" aria-label="Weekly plan selector">
      <div className="plan-directory-heading"><div><span className="directory-icon">WP</span><div><p className="eyebrow">{isArabic ? "البحث عن الخطة" : "PLAN FINDER"}</p><h2>{isArabic ? "اختر صف وشعبة الطالب" : "Choose your child’s class"}</h2></div></div><p>{isArabic ? "تظهر هنا الخطط المعتمدة فقط، وتبقى الخطط السابقة متاحة لرجوع أولياء الأمور إليها." : "Only supervisor-approved plans are shown here. Previous plans remain available for families to revisit."}</p></div>
      <div className="plan-directory-filters"><label>{isArabic ? "الصف" : "Grade"}<select value={grade} onChange={(event) => { setGrade(event.target.value); setSelectedWeek(null); }}>{Array.from({ length: 10 }, (_, index) => <option key={index} value={`Grade ${index + 1}`}>{gradeLabel(index + 1)}</option>)}</select></label><label>{isArabic ? "الشعبة" : "Class"}<select value={classType} onChange={(event) => { setClassType(event.target.value); setSelectedWeek(null); }}><option value="Class A">{classLabel("A")}</option><option value="Class B">{classLabel("B")}</option></select></label><div className="plan-directory-selection"><small>{isArabic ? "الخطط المنشورة لـ" : "Published plans for"}</small><strong>{gradeLabel(Number(grade.replace("Grade ", "")))} · {classLabel(classType.replace("Class ", ""))}</strong></div></div>
      <div className="week-library"><div className="week-library-heading"><div><h2>{isArabic ? "الخطط الأسبوعية المتاحة" : "Available weekly plans"}</h2><p>{isArabic ? "العام الدراسي 2026–2027" : "Academic Year 2026–2027"}</p></div><span>{isArabic ? `${plansForClass.length} خطط متاحة` : `${plansForClass.length} plan${plansForClass.length === 1 ? "" : "s"} available`}</span></div>
        {loadingPlans ? <p className="supervisor-review-empty">{isArabic ? "جارٍ تحميل الخطط المنشورة…" : "Loading published plans…"}</p> : plansForClass.length === 0 ? <p className="supervisor-review-empty">{isArabic ? "لا توجد خطط أسبوعية معتمدة ومنشورة لهذا الفصل حتى الآن." : "No approved weekly plans have been published for this class yet."}</p> : <div className="week-library-list">{plansForClass.map((plan) => <article className="week-library-item" key={plan.id}><span className="week-number">{String(plan.weekNumber).padStart(2, "0")}</span><div className="week-details"><strong>{isArabic ? `الأسبوع ${plan.weekNumber}` : `Week ${plan.weekNumber}`}</strong><small>{plan.weekLabel || formatDates(plan.startsOn, plan.endsOn)}</small></div><span className="week-status">{isArabic ? "متاح" : "Available"}</span><div className="week-actions"><button type="button" className="week-view-button" onClick={() => openPlan(plan.weekNumber)}>{isArabic ? "عرض" : "View"} <span>→</span></button><button type="button" className="week-download-button" onClick={() => { openPlan(plan.weekNumber); window.setTimeout(() => window.print(), 150); }}>{isArabic ? "طباعة / تحميل" : "Print / Download"}</button></div></article>)}</div>}</div>
    </section>
    <section id="selected-plan" className={`selected-plan-wrap ${selectedPlan ? "is-open" : ""}`} aria-hidden={!selectedPlan}>{selectedPlan && <><div className="plan-toolbar page-width"><div><p className="eyebrow">OFFICIAL WEEKLY PLAN</p><h1>{grade} · {classType}</h1><p>Week {selectedPlan.weekNumber} · {selectedPlan.weekLabel || formatDates(selectedPlan.startsOn, selectedPlan.endsOn)}</p></div><div className="toolbar-actions"><button className="button button-outline" type="button" onClick={() => setSelectedWeek(null)}>Back to Plans</button><button className="button button-primary" type="button" onClick={() => window.print()}>Print / Save PDF</button></div></div>
      <section className="plan-paper page-width" aria-label="Weekly study plan"><div className="paper-header"><img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" /><div><strong>ALANDALUS PRIVATE SCHOOLS</strong><span>The Egyptian Section</span><h2>WEEKLY STUDY PLAN</h2></div></div><div className="paper-meta"><span><small>Class</small><strong>{grade} · {classType}</strong></span><span><small>Class Teacher</small><strong>To be confirmed</strong></span><span><small>Week No.</small><strong>{selectedPlan.weekNumber}</strong></span><span><small>Date</small><strong>{selectedPlan.weekLabel || formatDates(selectedPlan.startsOn, selectedPlan.endsOn)}</strong></span></div><div className="table-wrap"><table className="weekly-table"><thead><tr><th>Day</th><th>Course</th><th>Classwork</th><th>Homework</th><th>Classera Notes</th></tr></thead>{days.map(({ day, lessons }) => <tbody className="weekly-day-group" key={day}>{lessons.map((lesson, lessonIndex) => <tr key={`${day}-${lesson.period_number}`} className={lessonIndex === 0 ? "new-day" : ""}>{lessonIndex === 0 && <td className="day-cell" rowSpan={lessons.length}>{day}</td>}<td className="course-cell">{lesson.course}</td><td>{lesson.classwork || "—"}</td><td>{lesson.homework || "—"}</td><td>{lesson.notes || "—"}</td></tr>)}</tbody>)}</table>{days.length === 0 && <p className="supervisor-review-empty">This approved plan does not contain lesson entries yet.</p>}</div><div className="important-notes"><strong>Important Notes</strong>{liveQuizzes.length > 0 && <div className="parent-plan-assessments"><b>Quizzes & Assessments</b>{liveQuizzes.map((quiz, index) => <p key={`${quiz.course}-${index}`}><strong>{quiz.course}{quiz.date ? ` · ${quiz.date}` : ""}</strong>{quiz.details}</p>)}</div>}{liveFamilyNotes.length > 0 && <div className="parent-plan-family-notes"><b>Weekly Notes for Families</b>{liveFamilyNotes.map((note, index) => <p key={`${note}-${index}`}>{note}</p>)}</div>}{liveQuizzes.length === 0 && liveFamilyNotes.length === 0 && <p>Notes and assessment details will appear here when they are added and approved by the school.</p>}</div></section></>}</section>
  </main>;
}
