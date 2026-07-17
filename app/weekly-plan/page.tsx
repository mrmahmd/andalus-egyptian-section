"use client";

import Link from "next/link";
import { useState } from "react";

const weeks = [
  { number: "01", dates: "6–10 September 2026", status: "Available" },
  { number: "02", dates: "13–17 September 2026", status: "Available" },
  { number: "03", dates: "20–24 September 2026", status: "Latest" },
  { number: "04", dates: "27 September–1 October 2026", status: "Available" },
  { number: "05", dates: "4–8 October 2026", status: "Coming soon" },
  { number: "06", dates: "11–15 October 2026", status: "Coming soon" },
];

const days = [
  { day: "Sunday", lessons: [["English", "Unit 2: Amazing Animals — pages 18–19", "Workbook page 9", "Bring the English reader"], ["Mathematics", "Multiplication facts: ×2 and ×5", "Complete worksheet 2A", "Quiz on Tuesday"], ["Science", "The life cycle of a butterfly", "Draw and label a life cycle", "Bring coloured pencils"]] },
  { day: "Monday", lessons: [["Arabic", "Subject and object practice", "Complete the book activity", "—"], ["Social Studies", "Egyptian landmarks map activity", "Research one landmark", "Upload to Classera"]] },
  { day: "Tuesday", lessons: [["English", "Spelling and guided writing", "Write five sentences", "Spelling quiz today"], ["Mathematics", "Two-step word problems", "Workbook page 12", "—"]] },
  { day: "Wednesday", lessons: [["Religion", "Good manners and daily behaviour", "Memorise the lesson", "—"], ["ICT", "Safe internet use", "Complete online task", "Computer lab"]] },
  { day: "Thursday", lessons: [["Science", "Unit review and assessment", "Prepare for next week", "Have a lovely weekend"]] },
];

const quizzes = [
  { day: "Tuesday", course: "English", assessment: "Spelling Quiz", scope: "animal · habitat · butterfly · grow · change", notes: "Revise the spelling list on Classera" },
  { day: "Wednesday", course: "Mathematics", assessment: "Quick Check", scope: "Multiplication facts ×2 and ×5", notes: "10-minute classroom assessment" },
];

export default function WeeklyPlanPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [grade, setGrade] = useState("Grade 4");
  const [classType, setClassType] = useState("Class A");
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const selectedWeekData = weeks.find((week) => week.number === selectedWeek) ?? weeks[2];

  const openPlan = (week: string) => {
    setSelectedWeek(week);
    window.setTimeout(() => document.getElementById("selected-plan")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return <main className="subpage plan-page">
    <header className="compact-header"><Link href="/" className="brand-lockup"><img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" /><span className="brand-copy"><strong>ALANDALUS PRIVATE SCHOOLS</strong><small>Egyptian Section</small></span></Link><nav><Link href="/">Home</Link><Link className="active" href="/weekly-plan">Weekly Plan</Link></nav><Link className="button button-outline" href="/support">Technical Support</Link></header>

    <section className="plan-directory-hero"><div className="page-width"><p className="eyebrow">FAMILY ACCESS</p><h1>Weekly Plan Library</h1><span>Select a class to view every weekly plan published by the school.</span></div></section>

    <section className="plan-directory page-width" aria-label="Weekly plan selector">
      <div className="plan-directory-heading"><div><span className="directory-icon">WP</span><div><p className="eyebrow">PLAN FINDER</p><h2>Choose your child’s class</h2></div></div><p>Plans remain available here for families to revisit whenever needed.</p></div>
      <div className="plan-directory-filters"><label>Grade<select value={grade} onChange={(event) => setGrade(event.target.value)}>{Array.from({ length: 10 }, (_, index) => <option key={index}>Grade {index + 1}</option>)}</select></label><label>Class<select value={classType} onChange={(event) => setClassType(event.target.value)}><option>Class A</option><option>Class B</option></select></label><div className="plan-directory-selection"><small>Showing plans for</small><strong>{grade} · {classType}</strong></div></div>
      <div className="week-library"><div className="week-library-heading"><div><h2>Available weekly plans</h2><p>Academic Year 2026–2027</p></div><span>{weeks.filter((week) => week.status !== "Coming soon").length} plans available</span></div><div className="week-library-list">{weeks.map((week) => <article className={`week-library-item ${week.status === "Coming soon" ? "upcoming" : ""}`} key={week.number}><span className="week-number">{week.number}</span><div className="week-details"><strong>Week {week.number}</strong><small>{week.dates}</small></div><span className={`week-status ${week.status.toLowerCase().replace(" ", "-")}`}>{week.status}</span><div className="week-actions"><button type="button" className="week-view-button" disabled={week.status === "Coming soon"} onClick={() => openPlan(week.number)}>View <span>→</span></button><button type="button" className="week-download-button" disabled={week.status === "Coming soon"} onClick={() => { setSelectedWeek(week.number); window.setTimeout(() => window.print(), 0); }}>Print / Download</button></div></article>)}</div></div>
    </section>

    <section id="selected-plan" className={`selected-plan-wrap ${selectedWeek ? "is-open" : ""}`} aria-hidden={!selectedWeek}><div className="plan-toolbar page-width"><div><p className="eyebrow">OFFICIAL WEEKLY PLAN</p><h1>{grade} · {classType}</h1><p>Week {selectedWeekData.number} · {selectedWeekData.dates}</p></div><div className="toolbar-actions"><button className="button button-outline" type="button" onClick={() => setSelectedWeek(null)}>Back to Plans</button><button className="button button-primary" type="button" onClick={() => window.print()}>Print / Save PDF</button></div></div>
      <section className="plan-paper page-width" aria-label="Weekly study plan"><div className="paper-header"><img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" /><div><strong>ALANDALUS PRIVATE SCHOOLS</strong><span>The Egyptian Section</span><h2>WEEKLY STUDY PLAN</h2></div></div><div className="paper-meta"><span><small>Class</small><strong>{grade.replace("Class", "")} · {classType.replace("Class ", "")}</strong></span><span><small>Class Teacher</small><strong>Mr.Mohamed Farid</strong></span><span><small>Week No.</small><strong>{selectedWeekData.number}</strong></span><span><small>Date</small><strong>{selectedWeekData.dates}</strong></span></div><div className="table-wrap"><table className="weekly-table"><thead><tr><th>Day</th><th>Course</th><th>Classwork</th><th>Homework</th><th>Classera Notes</th></tr></thead>{days.map(({ day, lessons }) => <tbody className="weekly-day-group" key={day}>{lessons.map((lesson, lessonIndex) => <tr key={`${day}-${lesson[0]}`} className={lessonIndex === 0 ? "new-day" : ""}>{lessonIndex === 0 && <td className="day-cell" rowSpan={lessons.length}>{day}</td>}<td className="course-cell">{lesson[0]}</td><td>{lesson[1]}</td><td>{lesson[2]}</td><td>{lesson[3]}</td></tr>)}</tbody>)}</table></div><section className="quiz-schedule" aria-labelledby="quiz-schedule-title"><div className="quiz-schedule-heading"><div><span>QA</span><div><small>Weekly assessment schedule</small><h3 id="quiz-schedule-title">QUIZZES &amp; ASSESSMENTS</h3></div></div><p>{quizzes.length} scheduled this week</p></div><div className="table-wrap quiz-table-wrap"><table className="quiz-table"><thead><tr><th>Day</th><th>Course</th><th>Quiz / Assessment</th><th>Study Scope</th><th>Notes</th></tr></thead><tbody>{quizzes.map((quiz) => <tr key={`${quiz.day}-${quiz.course}`}><td className="quiz-day-cell">{quiz.day}</td><td className="course-cell">{quiz.course}</td><td><strong>{quiz.assessment}</strong></td><td>{quiz.scope}</td><td>{quiz.notes}</td></tr>)}</tbody></table></div></section><div className="important-notes"><strong>Important Notes</strong><p>English spelling: animal · habitat · butterfly · grow · change &nbsp; | &nbsp; Mathematics quiz on Tuesday.</p></div></section>
    </section>
  </main>;
}
