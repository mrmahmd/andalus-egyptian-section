"use client";

import Link from "next/link";
import { useState } from "react";

const timetable = [
  { day: "Sunday", lessons: ["Arabic", "Islamic", "English OL", "English AL", "Math", "Science", "Social", "ICT"] },
  { day: "Monday", lessons: ["English OL", "Math", "Arabic", "Science", "ICT", "Islamic", "Social", "English AL"] },
  { day: "Tuesday", lessons: ["Math", "Arabic", "English AL", "Science", "Social", "English OL", "ICT", "Islamic"] },
  { day: "Wednesday", lessons: ["Science", "English OL", "Math", "Arabic", "Islamic", "ICT", "English AL", "Social"] },
  { day: "Thursday", lessons: ["Arabic", "Math", "Science", "English OL", "Social", "Islamic", "ICT", "English AL"] },
];

export default function TimetablePage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [grade, setGrade] = useState("Grade 4");
  const [classType, setClassType] = useState("Class A");

  return <main className="subpage timetable-page">
    <header className="compact-header"><Link href="/" className="brand-lockup"><img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" /><span className="brand-copy"><strong>ALANDALUS PRIVATE SCHOOLS</strong><small>Egyptian Section</small></span></Link><nav><Link href="/">Home</Link><Link href="/weekly-plan">Weekly Plan</Link><Link className="active" href="/timetable">Timetable</Link></nav><Link className="button button-outline" href="/support">Technical Support</Link></header>
    <section className="timetable-hero"><div className="page-width"><p className="eyebrow">FAMILY ACCESS</p><h1>Class Timetable</h1><p>Choose your child&apos;s grade and class to see the official lesson order for the week.</p></div></section>
    <section className="timetable-directory page-width"><div className="timetable-controls"><label>Grade<select value={grade} onChange={(event) => setGrade(event.target.value)}>{Array.from({ length: 10 }, (_, index) => <option key={index}>Grade {index + 1}</option>)}</select></label><label>Class<select value={classType} onChange={(event) => setClassType(event.target.value)}><option>Class A</option><option>Class B</option></select></label><div><small>Viewing timetable for</small><strong>{grade} · {classType}</strong></div></div>
      <div className="timetable-heading"><div><span>TT</span><div><p className="eyebrow">WEEKLY LESSON ORDER</p><h2>{grade} · {classType}</h2></div></div><p>This order will later organise published weekly-plan subjects automatically.</p></div>
      <div className="timetable-grid">{timetable.map(({ day, lessons }) => <article className="timetable-day" key={day}><header><span>{day.slice(0, 3).toUpperCase()}</span><h3>{day}</h3><small>{lessons.length} lessons</small></header><ol>{lessons.map((subject, index) => <li key={`${day}-${subject}`}><b>{String(index + 1).padStart(2, "0")}</b><span>{subject}</span></li>)}</ol></article>)}</div>
      <div className="timetable-note"><strong>How this helps</strong><p>When the live system is connected, this timetable decides which subjects appear in each day&apos;s weekly plan and their exact order.</p></div>
    </section>
  </main>;
}
