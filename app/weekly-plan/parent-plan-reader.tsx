"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isOctoberExam } from "../../lib/october-exam";
import { parentReaderDays, readParentReaderSize, rememberParentReaderSize, selectedReaderDay, type ParentReaderSize } from "../../lib/parent-plan-reader";
import "./parent-plan-reader.css";
import { PlanHolidayLabel } from "./plan-holiday";

type ReaderLesson = { day_of_week: number; period_number: number; course: string; classwork: string; homework: string; notes: string };
export type ReaderDay = { day: string; lessons: ReaderLesson[]; holiday?: { title: string } | null };
const arabicDays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

/** The approved full-week table is passed unchanged as children and always remains in the DOM. */
export default function ParentPlanReader({ days, grade, weekNumber, arabic, children }: {
  days: ReaderDay[]; grade: number; weekNumber: number; arabic: boolean; children: ReactNode;
}) {
  const [day, setDay] = useState<string | null>(null);
  const [size, setSize] = useState<ParentReaderSize>("normal");
  const selected = selectedReaderDay(day, days.map((item) => item.day));
  useEffect(() => {
    const timer = window.setTimeout(() => setSize(readParentReaderSize(() => window.localStorage)), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const chooseSize = (value: ParentReaderSize) => { setSize(value); rememberParentReaderSize(() => window.localStorage, value); };
  return <div className="parent-plan-reader" data-reader-day={selected ?? "all"} data-reader-size={size} dir="ltr">
    {days.length > 0 && <div className="parent-reader-controls" dir={arabic ? "rtl" : "ltr"}>
      <nav className="parent-reader-day-controls" aria-label={arabic ? "عرض الخطة حسب اليوم" : "View plan by day"}>
        <button type="button" className={selected === null ? "active" : ""} aria-pressed={selected === null} onClick={() => setDay(null)}>{arabic ? "الأسبوع كاملًا" : "Full week"}</button>
        {days.map((item) => <button type="button" key={item.day} className={selected === item.day ? "active" : ""} aria-pressed={selected === item.day} onClick={() => setDay(item.day)}>{arabic ? arabicDays[parentReaderDays.indexOf(item.day as typeof parentReaderDays[number])] ?? item.day : item.day}</button>)}
      </nav>
      <div className="parent-reader-size-controls" role="group" aria-label={arabic ? "حجم خط الخطة على الشاشة" : "Plan text size on screen"}><span>{arabic ? "حجم الخط" : "Text size"}</span>{(["normal","large","larger"] as const).map((value,index) => <button key={value} type="button" className={size === value ? "active" : ""} aria-pressed={size === value} onClick={() => chooseSize(value)}>{(arabic ? ["عادي","متوسط","كبير"] : ["Normal","Medium","Large"])[index]}</button>)}</div>
      <p>{arabic ? "اختيار اليوم وتكبير الخط للقراءة على الشاشة فقط. الطباعة تعرض الأسبوع كاملًا بالتنسيق المعتمد." : "Day selection and text size affect screen reading only. Printing includes the full week in the approved layout."}</p>
    </div>}
    {children}
    <div className="parent-reader-cards" aria-label="Weekly lessons" dir="ltr">
      {days.map((item) => <section key={item.day} data-reader-day={item.day} className={`parent-reader-card-day reader-day-${parentReaderDays.indexOf(item.day as typeof parentReaderDays[number])}`}>
        <h3>{item.day}</h3>
        {item.holiday ? <div className="parent-holiday-card" aria-label={`${item.day} school holiday`}><PlanHolidayLabel title={item.holiday.title} /></div> : <>
        {item.lessons.map((lesson) => {
          const exam = isOctoberExam(weekNumber, lesson.period_number, lesson.day_of_week, grade);
          return <article className={`parent-reader-lesson ${exam ? "is-exam" : lesson.classwork === "Plan not published" ? "is-unpublished" : ""}`} key={`${item.day}-${lesson.period_number}`}>
            <header><strong>{lesson.course}</strong></header>
            <div className="reader-field reader-classwork"><h4>Classwork</h4><p>{lesson.classwork || "—"}</p></div>
            <div className="reader-field reader-homework"><h4>Homework</h4><p>{lesson.homework || "—"}</p></div>
            <div className="reader-field reader-notes"><h4>Classera Notes</h4><p>{lesson.notes || "—"}</p></div>
          </article>;
        })}</>}
      </section>)}
    </div>
  </div>;
}
