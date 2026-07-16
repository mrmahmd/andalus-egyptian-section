"use client";

import Link from "next/link";

const rows = [
  ["Sunday", "English", "Unit 2: Amazing Animals — pages 18–19", "Workbook page 9", "Bring the English reader"],
  ["", "Mathematics", "Multiplication facts: ×2 and ×5", "Complete worksheet 2A", "Quiz on Tuesday"],
  ["", "Science", "The life cycle of a butterfly", "Draw and label a life cycle", "Bring coloured pencils"],
  ["Monday", "Arabic", "Subject and object practice", "Complete the book activity", "—"],
  ["", "Social Studies", "Egyptian landmarks map activity", "Research one landmark", "Upload to Classera"],
  ["Tuesday", "English", "Spelling and guided writing", "Write five sentences", "Spelling quiz today"],
  ["", "Mathematics", "Two-step word problems", "Workbook page 12", "—"],
  ["Wednesday", "Religion", "Good manners and daily behaviour", "Memorise the lesson", "—"],
  ["", "ICT", "Safe internet use", "Complete online task", "Computer lab"],
  ["Thursday", "Science", "Unit review and assessment", "Prepare for next week", "Have a lovely weekend"],
];

export default function WeeklyPlanPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <main className="subpage plan-page">
      <header className="compact-header">
        <Link href="/" className="brand-lockup">
          <img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" />
          <span className="brand-copy"><strong>ALANDALUS PRIVATE SCHOOLS</strong><small>Egyptian Section</small></span>
        </Link>
        <nav><Link href="/">Home</Link><Link className="active" href="/weekly-plan">Weekly Plan</Link></nav>
        <Link className="button button-outline" href="/#plan-finder">Change class</Link>
      </header>

      <section className="plan-toolbar page-width">
        <div>
          <p className="eyebrow">Official weekly plan</p>
          <h1>Grade 4 · Class A</h1>
          <p>Week 3 · 20–24 September 2026</p>
        </div>
        <div className="toolbar-actions">
          <Link className="button button-outline" href="/">Change class</Link>
          <button className="button button-primary" type="button" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </section>

      <section className="plan-paper page-width" aria-label="Weekly study plan">
        <div className="paper-header">
          <img src={`${basePath}/school-logo.jpeg`} alt="" />
          <div><strong>ALANDALUS PRIVATE SCHOOLS</strong><span>The Egyptian Section</span><h2>WEEKLY STUDY PLAN</h2></div>
          <img src={`${basePath}/school-logo.jpeg`} alt="" />
        </div>
        <div className="paper-meta">
          <span><small>Class</small><strong>Grade 4 · A</strong></span>
          <span><small>Class Teacher</small><strong>Ms. Sara Ahmed</strong></span>
          <span><small>Week No.</small><strong>03</strong></span>
          <span><small>Date</small><strong>20–24 Sep 2026</strong></span>
        </div>
        <div className="table-wrap">
          <table className="weekly-table">
            <thead><tr><th>Day</th><th>Course</th><th>Classwork</th><th>Homework</th><th>Classera Notes</th></tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row[0]}-${row[1]}`} className={row[0] ? "new-day" : ""}>
                  <td className="day-cell">{row[0]}</td><td className="course-cell">{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td>{row[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="important-notes"><strong>Important Notes</strong><p>English spelling: animal · habitat · butterfly · grow · change &nbsp; | &nbsp; Mathematics quiz on Tuesday.</p></div>
      </section>
    </main>
  );
}
