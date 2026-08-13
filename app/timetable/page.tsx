"use client";

import Link from "next/link";
import { useState } from "react";
import timetableSource from "../data/class-timetables.json";

const dayOrder = ["sunday", "monday", "tuesday", "wednesday", "thursday"];
const dayLabels: Record<string, string> = { sunday: "Sunday", monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday" };
const subjectLabels: Record<string, string> = {
  OL: "English", AL: "English", Maths: "Mathematics", Science: "Science", "INT Science": "Integrated Science",
  عربي: "Arabic", دين: "Islamic Studies", قرأن: "Quran", دراسات: "Social Studies", تاريخ: "History", وطنية: "National Studies",
  فنية: "Art", بدنية: "Physical Education", سباحة: "Swimming", ICT: "ICT", Computer: "Computer", AI: "AI", French: "French",
  Discover: "Discover", فلسفة: "Philosophy", "خ/م": "خ/م", "مهارات مهنية": "Vocational Skills", مم: "Vocational Skills"
};

export default function TimetablePage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const classes = Object.values(timetableSource.classes) as Array<{ classId: string; className: string; grade: number; section: string; schedule: Record<string, { dayLabel: string; periods: { period: number; subject: string }[] }> }>;
  const [selectedClassId, setSelectedClassId] = useState("grade-1-a");
  const selectedClass = classes.find((entry) => entry.classId === selectedClassId) ?? classes[0];
  const gradeOptions = [...new Set(classes.map((entry) => entry.grade))].sort((a, b) => a - b);
  const selectedGrade = selectedClass?.grade ?? 4;
  const sectionOptions = classes.filter((entry) => entry.grade === selectedGrade);
  const timetable = dayOrder.map((day) => ({ day: dayLabels[day], lessons: (selectedClass?.schedule?.[day]?.periods ?? []).slice().sort((a, b) => a.period - b.period) }));

  return <main className="subpage timetable-page">
    <header className="compact-header"><Link href="/" className="brand-lockup"><img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" /><span className="brand-copy"><strong>ALANDALUS PRIVATE SCHOOLS</strong><small>Egyptian Section</small></span></Link><nav><Link href="/">Home</Link><Link href="/weekly-plan">Weekly Plan</Link><Link className="active" href="/timetable">Timetable</Link></nav><Link className="button button-outline" href="/support">Technical Support</Link></header>
    <section className="timetable-hero"><div className="page-width"><p className="eyebrow">FAMILY ACCESS</p><h1>Class Timetable</h1><p>Choose your child&apos;s grade and class to see the official lesson order for the week.</p></div></section>
    <section className="timetable-directory page-width"><div className="timetable-controls"><label>Grade<select value={selectedGrade} onChange={(event) => { const next = classes.find((entry) => entry.grade === Number(event.target.value)); if (next) setSelectedClassId(next.classId); }}>{gradeOptions.map((value) => <option key={value} value={value}>Grade {value}</option>)}</select></label><label>Class<select value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>{sectionOptions.map((entry) => <option key={entry.classId} value={entry.classId}>{entry.className}</option>)}</select></label><div><small>Viewing timetable for</small><strong>{selectedClass?.className}</strong></div></div>
      <div className="timetable-heading"><div><span>TT</span><div><p className="eyebrow">WEEKLY LESSON ORDER</p><h2>{selectedClass?.className}</h2></div></div></div>
      <div className="timetable-grid">{timetable.map(({ day, lessons }) => <article className="timetable-day" key={day}><header><span>{day.slice(0, 3).toUpperCase()}</span><h3>{day}</h3><small>{lessons.length} lessons</small></header><ol>{lessons.map((lesson) => <li key={`${day}-${lesson.period}`}><b>{String(lesson.period).padStart(2, "0")}</b><span>{subjectLabels[lesson.subject] ?? lesson.subject}</span></li>)}</ol></article>)}</div>
    </section>
  </main>;
}
