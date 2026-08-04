"use client";

import Link from "next/link";
import { useState } from "react";

const weeks = [
  { value: "01", label: "Week 1 · 6–10 September" },
  { value: "02", label: "Week 2 · 13–17 September" },
  { value: "03", label: "Week 3 · 20–24 September" },
  { value: "04", label: "Week 4 · 27 September–1 October" },
];

export default function HomePlanFinder() {
  const [grade, setGrade] = useState("4");
  const [section, setSection] = useState("A");
  const [week, setWeek] = useState("01");
  const planUrl = `/weekly-plan/?grade=${grade}&section=${section}&week=${week}`;

  return (
    <section id="plan-finder" className="finder-shell page-width" aria-label="Find your weekly plan" data-reveal>
      <div className="finder-heading"><span className="finder-icon">W</span><div><p className="eyebrow">Weekly planner</p><h2>Find your class plan</h2></div></div>
      <div className="finder-fields">
        <label><span>Grade</span><select value={grade} onChange={(event) => setGrade(event.target.value)}>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>Grade {index + 1}</option>)}</select></label>
        <label><span>Class</span><select value={section} onChange={(event) => setSection(event.target.value)}><option value="A">Class A</option><option value="B">Class B</option></select></label>
        <label className="week-field"><span>School week</span><select value={week} onChange={(event) => setWeek(event.target.value)}>{weeks.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <Link href={planUrl} className="button button-primary finder-button">View plan <span>→</span></Link>
      </div>
    </section>
  );
}
