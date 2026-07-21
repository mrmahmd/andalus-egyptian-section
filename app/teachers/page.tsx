"use client";

import { useState } from "react";

const navigation = [
  ["Overview", "OV"],
  ["Weekly Plans", "WP"],
  ["My Classes", "CL"],
  ["My Subjects", "SB"],
  ["Calendar", "CA"],
];

const plans = [
  { day: "Sunday", className: "Grade 4 · A", course: "English", status: "Published", tone: "green" },
  { day: "Sunday", className: "Grade 4 · B", course: "English", status: "Draft", tone: "amber" },
  { day: "Monday", className: "Grade 4 · A", course: "Social Studies", status: "Needs content", tone: "gray" },
  { day: "Tuesday", className: "Grade 4 · B", course: "Social Studies", status: "Published", tone: "green" },
];

const courseOptions = [
  { value: "English OL - Connect Plus", label: "English OL · Connect Plus" },
  { value: "English OL - Hello", label: "English OL · Hello" },
  { value: "English OL - Hello Plus", label: "English OL · Hello Plus" },
  { value: "Discover", label: "Discover" },
  { value: "Arabic", label: "Arabic" },
  { value: "Islamic", label: "Islamic" },
  { value: "Math", label: "Math" },
  { value: "Science", label: "Science" },
  { value: "Social", label: "Social Studies" },
  { value: "ICT", label: "ICT" },
];

export default function TeachersDashboardPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [activeNav, setActiveNav] = useState("Overview");
  const [editorOpen, setEditorOpen] = useState(false);
  const [quizEnabled, setQuizEnabled] = useState(true);

  return (
    <main className="teacher-portal">
      <aside className="teacher-sidebar">
        <div className="teacher-brand">
          <img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" />
          <div><strong>ALANDALUS</strong><span>Teacher Workspace</span></div>
        </div>

        <div className="teacher-school-year"><span>Academic year</span><strong>2026–2027</strong></div>

        <nav className="teacher-nav" aria-label="Teacher workspace navigation">
          <p>Workspace</p>
          {navigation.map(([label, icon]) => (
            <button key={label} className={activeNav === label ? "active" : ""} onClick={() => setActiveNav(label)}>
              <span className="teacher-nav-icon">{icon}</span>{label}
              {label === "Weekly Plans" && <small>2</small>}
            </button>
          ))}
          <p>Account</p>
          <button><span className="teacher-nav-icon">PR</span>Profile & assignments</button>
          <button><span className="teacher-nav-icon">ST</span>Settings</button>
        </nav>

        <div className="teacher-help-card">
          <span>?</span><strong>Need help?</strong>
          <p>Contact the academic coordinator for account or assignment changes.</p>
          <button>Open support</button>
        </div>

        <div className="teacher-sidebar-profile">
          <span className="teacher-avatar">MF</span>
          <div><strong>Mr.Mohamed Farid</strong><small>Teacher</small></div>
          <button aria-label="Open profile menu">•••</button>
        </div>
      </aside>

      <section className="teacher-main">
        <header className="teacher-topbar">
          <div className="teacher-mobile-brand"><img src={`${basePath}/school-logo.jpeg`} alt="" /><strong>Teacher Workspace</strong></div>
          <label className="teacher-search"><span>⌕</span><input type="search" placeholder="Search plans, classes or subjects" /></label>
          <div className="teacher-top-actions">
            <span className="teacher-sync"><i /> All changes saved</span>
            <button className="teacher-icon-button" aria-label="Notifications">♢<b>3</b></button>
            <button className="teacher-profile-chip"><span className="teacher-avatar">MF</span><span><strong>Mr.Mohamed Farid</strong><small>English Teacher</small></span></button>
          </div>
        </header>

        <div className="teacher-content">
          <div className="teacher-page-heading">
            <div><p className="teacher-kicker">Thursday, 16 July</p><h1>Good evening, Mr. Mohamed.</h1><span>Here’s what is happening with your weekly plans.</span></div>
            <div className="teacher-heading-actions">
              <button className="teacher-primary-button" onClick={() => setEditorOpen(true)}><span>＋</span> Create weekly entry</button>
            </div>
          </div>

          <section className="teacher-stats" aria-label="Weekly plan summary">
            <article><span className="stat-icon navy">WP</span><div><small>This week’s entries</small><strong>12</strong><p><b>+4</b> since Monday</p></div></article>
            <article><span className="stat-icon magenta">PB</span><div><small>Published</small><strong>8</strong><p>Across 2 classes</p></div></article>
            <article><span className="stat-icon cyan">DR</span><div><small>Drafts</small><strong>3</strong><p>Continue editing</p></div></article>
            <article><span className="stat-icon amber">AT</span><div><small>Needs attention</small><strong>1</strong><p>Monday · Grade 4 A</p></div></article>
          </section>

          <div className="teacher-dashboard-grid">
            <section className="teacher-card teacher-plans-card">
              <div className="teacher-card-heading">
                <div><h2>This week’s plans</h2><p>20–24 September · Week 03</p></div>
                <div><button className="teacher-filter-button">All classes⌄</button><button className="teacher-more-button">•••</button></div>
              </div>
              <div className="teacher-plan-table-wrap">
                <table className="teacher-plan-table">
                  <thead><tr><th>Day</th><th>Class</th><th>Course</th><th>Status</th><th>Last updated</th><th /></tr></thead>
                  <tbody>
                    {plans.map((plan, index) => (
                      <tr key={`${plan.day}-${plan.className}-${plan.course}`}>
                        <td><span className="teacher-day-badge">{plan.day.slice(0, 3)}</span>{plan.day}</td>
                        <td><strong>{plan.className}</strong></td>
                        <td>{plan.course}</td>
                        <td><span className={`teacher-status ${plan.tone}`}><i />{plan.status}</span></td>
                        <td>{index === 0 ? "12 min ago" : index === 1 ? "1 hour ago" : "Yesterday"}</td>
                        <td><button aria-label={`Edit ${plan.course} for ${plan.className}`} onClick={() => setEditorOpen(true)}>Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="teacher-view-all">View all weekly plans <span>→</span></button>
            </section>

            <aside className="teacher-dashboard-side">
              <section className="teacher-card teacher-progress-card">
                <div className="teacher-card-heading"><div><h2>Weekly progress</h2><p>Your assigned entries</p></div><span className="teacher-progress-ring">75%<i /></span></div>
                <div className="teacher-progress-bar"><i /></div>
                <p><strong>9 of 12 entries completed</strong><span>3 entries are still waiting for content.</span></p>
                <button onClick={() => setEditorOpen(true)}>Continue planning <span>→</span></button>
              </section>

              <section className="teacher-card teacher-assignments-card">
                <div className="teacher-card-heading"><div><h2>My assignments</h2><p>Saved to your teacher profile</p></div><button>Manage</button></div>
                <div className="assignment-group"><small>Subjects</small><span><b>EN</b>English</span><span><b>SS</b>Social Studies</span></div>
                <div className="assignment-group"><small>Classes</small><div><span>Grade 4 · A</span><span>Grade 4 · B</span></div></div>
              </section>
            </aside>
          </div>
        </div>
      </section>

      {editorOpen && (
        <div className="teacher-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditorOpen(false)}>
          <section className="teacher-editor-modal" role="dialog" aria-modal="true" aria-labelledby="entry-title">
            <div className="teacher-modal-heading"><div><p>Weekly Plan · Week 03</p><h2 id="entry-title">Create weekly entry</h2></div><button aria-label="Close editor" onClick={() => setEditorOpen(false)}>×</button></div>
            <div className="teacher-editor-context"><span>Mr.Mohamed Farid</span><i />Your saved classes and subjects are ready to use.</div>
            <form onSubmit={(event) => { event.preventDefault(); setEditorOpen(false); }}>
              <div className="teacher-form-row">
                <label>Class<select defaultValue="Grade 4 · A"><option>Grade 4 · A</option><option>Grade 4 · B</option></select></label>
                <label>Subject programme<select defaultValue="English OL - Connect Plus">{courseOptions.map((course) => <option key={course.value} value={course.value}>{course.label}</option>)}</select></label>
                <label>Day<select defaultValue="Sunday"><option>Sunday</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option></select></label>
              </div>
              <label>Classwork<textarea rows={3} defaultValue="Unit 2: Amazing Animals — pages 18–19" /></label>
              <label>Homework<textarea rows={3} placeholder="Add homework or write No homework" /></label>
              <label>Classera notes<textarea rows={2} placeholder="Quiz, materials, upload instructions or reminders" /></label>
              <section className={`teacher-quiz-editor ${quizEnabled ? "active" : ""}`}>
                <div className="teacher-quiz-editor-heading">
                  <div><span>QA</span><div><strong>Add a quiz or assessment</strong><small>Published in a separate table under the weekly plan.</small></div></div>
                  <button className="teacher-switch" type="button" aria-pressed={quizEnabled} onClick={() => setQuizEnabled((current) => !current)}><i /></button>
                </div>
                {quizEnabled && (
                  <div className="teacher-quiz-fields">
                    <div className="teacher-form-row">
                      <label>Assessment type<select defaultValue="Quiz"><option>Quiz</option><option>Quick Check</option><option>Oral Assessment</option><option>Project</option></select></label>
                      <label>Quiz day<select defaultValue="Tuesday"><option>Sunday</option><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option></select></label>
                      <label>Course<input defaultValue="English" /></label>
                    </div>
                    <label>Quiz title<input defaultValue="Spelling Quiz" /></label>
                    <label>Study scope<textarea rows={2} defaultValue="animal · habitat · butterfly · grow · change" /></label>
                    <label>Notes for families<textarea rows={2} placeholder="Revision instructions, duration or materials" /></label>
                  </div>
                )}
              </section>
              <div className="teacher-editor-footer"><span>Changes in this prototype are not saved.</span><div><button type="button" className="teacher-secondary-button" onClick={() => setEditorOpen(false)}>Save as draft</button><button className="teacher-primary-button" type="submit">Publish entry</button></div></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
