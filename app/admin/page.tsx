"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AdminPlan = {
  id: number;
  week: string;
  grade: string;
  classType: "A" | "B";
  subject: string;
  teacher: string;
  status: "Published" | "Draft" | "Needs Review";
  updated: string;
  classwork: string;
  homework: string;
  notes: string;
};

const initialPlans: AdminPlan[] = [
  { id: 1, week: "Week 03", grade: "Grade 4", classType: "A", subject: "English OL", teacher: "Mr.Mohamed Farid", status: "Published", updated: "12 min ago", classwork: "Unit 2: Amazing Animals — pages 18–19", homework: "Workbook page 9", notes: "Bring the English reader" },
  { id: 2, week: "Week 03", grade: "Grade 4", classType: "B", subject: "English OL", teacher: "Ms. Sara Ahmed", status: "Draft", updated: "1 hour ago", classwork: "Guided reading and vocabulary", homework: "Complete worksheet 2", notes: "Upload to Classera" },
  { id: 3, week: "Week 03", grade: "Grade 5", classType: "A", subject: "Science", teacher: "Mr. Ahmed Hassan", status: "Published", updated: "2 hours ago", classwork: "Food chains and ecosystems", homework: "Draw a food chain", notes: "Bring coloured pencils" },
  { id: 4, week: "Week 03", grade: "Grade 2", classType: "A", subject: "Arabic", teacher: "Ms. Mona Ali", status: "Needs Review", updated: "Yesterday", classwork: "Reading and sentence building", homework: "Book activity page 14", notes: "Spelling list attached" },
  { id: 5, week: "Week 03", grade: "Grade 6", classType: "B", subject: "Math", teacher: "Mr. Khaled Adel", status: "Published", updated: "Yesterday", classwork: "Fractions and mixed numbers", homework: "Worksheet 4B", notes: "Quiz on Wednesday" },
  { id: 6, week: "Week 03", grade: "Grade 10", classType: "A", subject: "ICT", teacher: "Mr. Omar Samy", status: "Draft", updated: "Yesterday", classwork: "Database fundamentals", homework: "Complete online task", notes: "Computer lab" },
  { id: 7, week: "Week 03", grade: "Grade 3", classType: "B", subject: "Islamic", teacher: "Mr. Mahmoud Ali", status: "Published", updated: "2 days ago", classwork: "Good manners and daily behaviour", homework: "Memorise the lesson", notes: "Oral assessment" },
  { id: 8, week: "Week 03", grade: "Grade 8", classType: "A", subject: "Social", teacher: "Ms. Dina Tarek", status: "Needs Review", updated: "2 days ago", classwork: "Egyptian geography", homework: "Research one governorate", notes: "Add map attachment" },
];

const subjects = ["Arabic", "Islamic", "English OL", "English AL", "Math", "Science", "Social", "ICT"];
const grades = Array.from({ length: 10 }, (_, index) => `Grade ${index + 1}`);

export default function AdminDashboardPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [plans, setPlans] = useState(initialPlans);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("All Grades");
  const [classFilter, setClassFilter] = useState("All Classes");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [deletePlan, setDeletePlan] = useState<AdminPlan | null>(null);

  const filteredPlans = useMemo(() => plans.filter((plan) => {
    const haystack = `${plan.grade} ${plan.classType} ${plan.subject} ${plan.teacher} ${plan.week}`.toLowerCase();
    return haystack.includes(search.toLowerCase())
      && (gradeFilter === "All Grades" || plan.grade === gradeFilter)
      && (classFilter === "All Classes" || plan.classType === classFilter)
      && (statusFilter === "All Statuses" || plan.status === statusFilter);
  }), [plans, search, gradeFilter, classFilter, statusFilter]);

  const savePlan = () => {
    if (!editingPlan) return;
    setPlans((current) => current.map((plan) => plan.id === editingPlan.id ? { ...editingPlan, updated: "Just now" } : plan));
    setEditingPlan(null);
  };

  return (
    <main className="teacher-portal admin-portal">
      <aside className="teacher-sidebar admin-sidebar">
        <div className="teacher-brand">
          <img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" />
          <div><strong>ALANDALUS</strong><span>Admin Control Center</span></div>
        </div>
        <div className="teacher-school-year"><span>Academic year</span><strong>2026–2027</strong></div>

        <nav className="teacher-nav" aria-label="Admin navigation">
          <p>Administration</p>
          <button className="active"><span className="teacher-nav-icon">WP</span>All Weekly Plans<small>{plans.length}</small></button>
          <button><span className="teacher-nav-icon">TC</span>Teacher Accounts</button>
          <button><span className="teacher-nav-icon">CL</span>Classes & Subjects</button>
          <button><span className="teacher-nav-icon">AP</span>Account Approvals<small>3</small></button>
          <p>System</p>
          <button><span className="teacher-nav-icon">LG</span>Activity Log</button>
          <button><span className="teacher-nav-icon">ST</span>Settings</button>
        </nav>

        <div className="admin-permission-card"><span>AD</span><div><strong>Full administrator access</strong><p>View, edit and delete any weekly plan.</p></div></div>
        <div className="teacher-sidebar-profile"><span className="teacher-avatar admin-avatar">AD</span><div><strong>School Administrator</strong><small>Admin Account</small></div><button aria-label="Open profile menu">•••</button></div>
      </aside>

      <section className="teacher-main">
        <header className="teacher-topbar">
          <div className="teacher-mobile-brand"><img src={`${basePath}/school-logo.jpeg`} alt="" /><strong>Admin Control Center</strong></div>
          <label className="teacher-search"><span>⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search plans, teachers or subjects" /></label>
          <div className="teacher-top-actions"><span className="teacher-sync"><i /> System online</span><button className="teacher-icon-button" aria-label="Notifications">♢<b>3</b></button><button className="teacher-profile-chip"><span className="teacher-avatar admin-avatar">AD</span><span><strong>School Administrator</strong><small>Full Access</small></span></button></div>
        </header>

        <div className="teacher-content admin-content">
          <div className="teacher-page-heading">
            <div><p className="teacher-kicker">Administration workspace</p><h1>All Weekly Plans</h1><span>Review and manage every published plan, draft and teacher submission.</span></div>
            <Link className="teacher-primary-button admin-preview-link" href="/weekly-plan">Open public plan <span>→</span></Link>
          </div>

          <section className="teacher-stats" aria-label="Weekly plan administration summary">
            <article><span className="stat-icon navy">ALL</span><div><small>Total plans</small><strong>{plans.length}</strong><p>Across all grades</p></div></article>
            <article><span className="stat-icon magenta">PB</span><div><small>Published</small><strong>{plans.filter((plan) => plan.status === "Published").length}</strong><p>Visible to families</p></div></article>
            <article><span className="stat-icon cyan">DR</span><div><small>Drafts</small><strong>{plans.filter((plan) => plan.status === "Draft").length}</strong><p>Not yet published</p></div></article>
            <article><span className="stat-icon amber">RV</span><div><small>Needs review</small><strong>{plans.filter((plan) => plan.status === "Needs Review").length}</strong><p>Administrator attention</p></div></article>
          </section>

          <section className="teacher-card admin-plans-card">
            <div className="admin-plan-toolbar">
              <div><h2>Weekly plan directory</h2><p>{filteredPlans.length} plans shown</p></div>
              <label className="admin-mobile-search">Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Teacher, subject or class" /></label>
              <div className="admin-filters">
                <label>Grade<select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}><option>All Grades</option>{grades.map((grade) => <option key={grade}>{grade}</option>)}</select></label>
                <label>Class<select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option>All Classes</option><option value="A">Class A</option><option value="B">Class B</option></select></label>
                <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All Statuses</option><option>Published</option><option>Draft</option><option>Needs Review</option></select></label>
              </div>
            </div>

            <div className="admin-plan-table-wrap">
              <table className="admin-plan-table">
                <thead><tr><th>Week</th><th>Class</th><th>Subject</th><th>Teacher</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td><strong>{plan.week}</strong></td>
                      <td><span className="admin-class-badge">{plan.grade} · {plan.classType}</span></td>
                      <td><strong>{plan.subject}</strong></td>
                      <td>{plan.teacher}</td>
                      <td><span className={`admin-status ${plan.status === "Published" ? "published" : plan.status === "Draft" ? "draft" : "review"}`}><i />{plan.status}</span></td>
                      <td>{plan.updated}</td>
                      <td><div className="admin-row-actions"><Link href="/weekly-plan">View</Link><button className="edit" onClick={() => setEditingPlan({ ...plan })}>Edit</button><button className="delete" onClick={() => setDeletePlan(plan)}>Delete</button></div></td>
                    </tr>
                  ))}
                  {filteredPlans.length === 0 && <tr><td className="admin-empty" colSpan={7}>No plans match the selected filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      {editingPlan && (
        <div className="teacher-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditingPlan(null)}>
          <section className="teacher-editor-modal admin-edit-modal" role="dialog" aria-modal="true" aria-labelledby="admin-edit-title">
            <div className="teacher-modal-heading"><div><p>Administrator edit mode</p><h2 id="admin-edit-title">Edit weekly plan</h2></div><button aria-label="Close editor" onClick={() => setEditingPlan(null)}>×</button></div>
            <div className="admin-access-banner"><span>AD</span><div><strong>Full edit access</strong><small>Your changes will replace the teacher submission.</small></div></div>
            <form onSubmit={(event) => { event.preventDefault(); savePlan(); }}>
              <div className="teacher-form-row">
                <label>Grade<select value={editingPlan.grade} onChange={(event) => setEditingPlan({ ...editingPlan, grade: event.target.value })}>{grades.map((grade) => <option key={grade}>{grade}</option>)}</select></label>
                <label>Class<select value={editingPlan.classType} onChange={(event) => setEditingPlan({ ...editingPlan, classType: event.target.value as "A" | "B" })}><option value="A">Class A</option><option value="B">Class B</option></select></label>
                <label>Subject<select value={editingPlan.subject} onChange={(event) => setEditingPlan({ ...editingPlan, subject: event.target.value })}>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
              </div>
              <div className="teacher-form-row admin-form-row-two"><label>Teacher<input value={editingPlan.teacher} onChange={(event) => setEditingPlan({ ...editingPlan, teacher: event.target.value })} /></label><label>Status<select value={editingPlan.status} onChange={(event) => setEditingPlan({ ...editingPlan, status: event.target.value as AdminPlan["status"] })}><option>Published</option><option>Draft</option><option>Needs Review</option></select></label></div>
              <label>Classwork<textarea rows={3} value={editingPlan.classwork} onChange={(event) => setEditingPlan({ ...editingPlan, classwork: event.target.value })} /></label>
              <label>Homework<textarea rows={3} value={editingPlan.homework} onChange={(event) => setEditingPlan({ ...editingPlan, homework: event.target.value })} /></label>
              <label>Classera Notes<textarea rows={2} value={editingPlan.notes} onChange={(event) => setEditingPlan({ ...editingPlan, notes: event.target.value })} /></label>
              <div className="teacher-editor-footer"><span>Admin changes are tracked in the activity log.</span><div><button type="button" className="teacher-secondary-button" onClick={() => setEditingPlan(null)}>Cancel</button><button type="submit" className="teacher-primary-button">Save changes</button></div></div>
            </form>
          </section>
        </div>
      )}

      {deletePlan && (
        <div className="teacher-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDeletePlan(null)}>
          <section className="admin-delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-plan-title">
            <span className="admin-delete-icon">!</span>
            <h2 id="delete-plan-title">Delete this weekly plan?</h2>
            <p><strong>{deletePlan.subject}</strong> for {deletePlan.grade} · Class {deletePlan.classType} will be removed from the admin directory.</p>
            <small>This action will require administrator confirmation in the live system.</small>
            <div><button className="teacher-secondary-button" onClick={() => setDeletePlan(null)}>Cancel</button><button className="admin-danger-button" onClick={() => { setPlans((current) => current.filter((plan) => plan.id !== deletePlan.id)); setDeletePlan(null); }}>Delete plan</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
