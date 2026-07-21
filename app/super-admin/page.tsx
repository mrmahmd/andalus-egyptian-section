"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AccountRole = "Teacher" | "Admin";
type AccountStatus = "Pending" | "Active" | "Rejected";

type ManagedAccount = {
  id: number;
  name: string;
  username: string;
  role: AccountRole;
  status: AccountStatus;
  requested: string;
  assignments: string;
  lastAction: string;
};

const initialAccounts: ManagedAccount[] = [
  { id: 1, name: "Ms. Sara Ahmed", username: "sara.ahmed", role: "Teacher", status: "Pending", requested: "12 min ago", assignments: "English OL · Grade 4 A, Grade 4 B", lastAction: "Awaiting approval" },
  { id: 2, name: "Mr. Ahmed Hassan", username: "ahmed.hassan", role: "Teacher", status: "Pending", requested: "38 min ago", assignments: "Science · Grade 5 A, Grade 5 B", lastAction: "Awaiting approval" },
  { id: 3, name: "Ms. Dina Tarek", username: "dina.tarek", role: "Admin", status: "Pending", requested: "1 hour ago", assignments: "Requested Admin Control Center access", lastAction: "Awaiting approval" },
  { id: 4, name: "Mr. Khaled Adel", username: "khaled.adel", role: "Teacher", status: "Pending", requested: "Yesterday", assignments: "Math · Grade 6 A, Grade 6 B", lastAction: "Awaiting approval" },
  { id: 5, name: "Mr.Mohamed Farid", username: "mohamed.farid", role: "Teacher", status: "Active", requested: "14 Jul 2026", assignments: "English OL · Grade 4 A, Grade 4 B", lastAction: "Approved by Super Admin" },
  { id: 6, name: "School Operations", username: "school.ops", role: "Admin", status: "Active", requested: "10 Jul 2026", assignments: "Admin Control Center", lastAction: "Approved by Super Admin" },
];

const subjects = ["Arabic", "Islamic", "English - Connect Plus", "English - Hello", "English - Hello Plus", "Discover", "Math", "Science", "Social", "ICT"];
const grades = Array.from({ length: 10 }, (_, index) => `Grade ${index + 1}`);

export default function SuperAdminPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [accounts, setAccounts] = useState(initialAccounts);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [reviewAccount, setReviewAccount] = useState<ManagedAccount | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState({ subject: "English OL", grade: "Grade 1", section: "A" });

  const openAccount = (account: ManagedAccount) => {
    setReviewAccount({ ...account });
    setAssignmentDraft({ subject: "English OL", grade: "Grade 1", section: "A" });
  };

  const addAssignment = () => {
    if (!reviewAccount) return;
    const assignment = `${assignmentDraft.subject} · ${assignmentDraft.grade} ${assignmentDraft.section}`;
    const assignments = reviewAccount.assignments ? reviewAccount.assignments.split(" | ") : [];
    if (!assignments.includes(assignment)) {
      setReviewAccount({ ...reviewAccount, assignments: [...assignments, assignment].join(" | ") });
    }
  };

  const removeAssignment = (assignment: string) => {
    if (!reviewAccount) return;
    setReviewAccount({ ...reviewAccount, assignments: reviewAccount.assignments.split(" | ").filter((item) => item !== assignment).join(" | ") });
  };

  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const haystack = `${account.name} ${account.username} ${account.assignments}`.toLowerCase();
    return haystack.includes(search.toLowerCase())
      && (roleFilter === "All Roles" || account.role === roleFilter)
      && (statusFilter === "All Statuses" || account.status === statusFilter);
  }), [accounts, search, roleFilter, statusFilter]);

  const pendingCount = accounts.filter((account) => account.status === "Pending").length;
  const activeCount = accounts.filter((account) => account.status === "Active").length;
  const adminCount = accounts.filter((account) => account.role === "Admin" && account.status === "Active").length;

  const approveAccount = () => {
    if (!reviewAccount) return;
    setAccounts((current) => current.map((account) => account.id === reviewAccount.id ? { ...reviewAccount, status: "Active", lastAction: "Approved just now" } : account));
    setReviewAccount(null);
  };

  const rejectAccount = () => {
    if (!reviewAccount) return;
    setAccounts((current) => current.map((account) => account.id === reviewAccount.id ? { ...account, status: "Rejected", lastAction: "Rejected just now" } : account));
    setReviewAccount(null);
  };

  const saveAccount = () => {
    if (!reviewAccount) return;
    setAccounts((current) => current.map((account) => account.id === reviewAccount.id ? { ...reviewAccount, lastAction: "Account settings updated just now" } : account));
    setReviewAccount(null);
  };

  return (
    <main className="teacher-portal super-admin-portal">
      <aside className="teacher-sidebar super-admin-sidebar">
        <div className="teacher-brand"><img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" /><div><strong>ALANDALUS</strong><span>Super Admin Control Center</span></div></div>
        <div className="teacher-school-year"><span>Academic year</span><strong>2026–2027</strong></div>
        <nav className="teacher-nav" aria-label="Super administrator navigation">
          <p>Super Administration</p>
          <button className="active"><span className="teacher-nav-icon">AP</span>Account Approvals<small>{pendingCount}</small></button>
          <button><span className="teacher-nav-icon">AC</span>All Accounts</button>
          <button><span className="teacher-nav-icon">RL</span>Roles & Permissions</button>
          <Link className="super-admin-nav-link" href="/admin"><span className="teacher-nav-icon">WP</span>Manage Public Plans</Link>
          <p>School System</p>
          <button><span className="teacher-nav-icon">CL</span>Classes & Subjects</button>
          <button><span className="teacher-nav-icon">LG</span>Activity Log</button>
          <button><span className="teacher-nav-icon">ST</span>System Settings</button>
        </nav>
        <div className="super-admin-permission-card"><span>SA</span><div><strong>Primary authority</strong><p>Approve accounts and control every school workspace.</p></div></div>
        <div className="teacher-sidebar-profile"><span className="teacher-avatar super-admin-avatar">SA</span><div><strong>Primary Super Admin</strong><small>Owner Account</small></div><button aria-label="Open profile menu">•••</button></div>
      </aside>

      <section className="teacher-main">
        <header className="teacher-topbar"><div className="teacher-mobile-brand"><img src={`${basePath}/school-logo.jpeg`} alt="" /><strong>Super Admin</strong></div><label className="teacher-search"><span>⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search names, usernames or assignments" /></label><div className="teacher-top-actions"><span className="teacher-sync"><i /> Access control active</span><button className="teacher-icon-button" aria-label="Notifications">♢<b>{pendingCount}</b></button><button className="teacher-profile-chip"><span className="teacher-avatar super-admin-avatar">SA</span><span><strong>Primary Super Admin</strong><small>Owner Account</small></span></button></div></header>

        <div className="teacher-content super-admin-content">
          <div className="teacher-page-heading"><div><p className="teacher-kicker">Primary authority</p><h1>Account Approvals</h1><span>Approve teachers and admins before they can enter their own dashboard.</span></div><Link className="teacher-primary-button super-admin-plans-link" href="/admin">Manage public weekly plans <span>→</span></Link></div>

          <section className="teacher-stats" aria-label="Account approval summary">
            <article><span className="stat-icon magenta">PN</span><div><small>Pending approval</small><strong>{pendingCount}</strong><p>Waiting for your decision</p></div></article>
            <article><span className="stat-icon cyan">AC</span><div><small>Active accounts</small><strong>{activeCount}</strong><p>Can access their workspace</p></div></article>
            <article><span className="stat-icon navy">AD</span><div><small>Active admins</small><strong>{adminCount}</strong><p>Admin Control Center access</p></div></article>
            <article><span className="stat-icon amber">SA</span><div><small>Super Admin</small><strong>1</strong><p>Primary owner account</p></div></article>
          </section>

          <section className="teacher-card super-admin-accounts-card">
            <div className="super-admin-toolbar">
              <div><h2>Account request directory</h2><p>{filteredAccounts.length} accounts shown</p></div>
              <label className="super-admin-mobile-search">Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or username" /></label>
              <div className="super-admin-filters"><label>Role<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>All Roles</option><option>Teacher</option><option>Admin</option></select></label><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Pending</option><option>Active</option><option>Rejected</option><option>All Statuses</option></select></label></div>
            </div>
            <div className="super-admin-table-wrap"><table className="super-admin-table"><thead><tr><th>Account</th><th>Requested Role</th><th>Classes & Subjects</th><th>Requested</th><th>Status</th><th>Last Action</th><th>Actions</th></tr></thead><tbody>
              {filteredAccounts.map((account) => (
                <tr key={account.id}><td><div className="super-account-name"><span>{account.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><div><strong>{account.name}</strong><small>@{account.username}</small></div></div></td><td><span className={`super-role ${account.role.toLowerCase()}`}>{account.role === "Teacher" ? "TC" : "AD"}{account.role}</span></td><td>{account.assignments}</td><td>{account.requested}</td><td><span className={`super-account-status ${account.status.toLowerCase()}`}><i />{account.status}</span></td><td>{account.lastAction}</td><td><div className="super-row-actions">{account.status === "Pending" ? <button className="review" onClick={() => openAccount(account)}>Review</button> : <><button className="manage" onClick={() => openAccount(account)}>Manage</button><Link href={account.role === "Admin" ? "/admin" : "/teachers"}>Open workspace</Link></>}</div></td></tr>
              ))}
              {filteredAccounts.length === 0 && <tr><td className="super-empty" colSpan={7}>No accounts match the selected filters.</td></tr>}
            </tbody></table></div>
          </section>
        </div>
      </section>

      {reviewAccount && (
        <div className="teacher-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setReviewAccount(null)}>
          <section className="teacher-editor-modal super-review-modal" role="dialog" aria-modal="true" aria-labelledby="review-account-title">
            <div className="teacher-modal-heading"><div><p>{reviewAccount.status === "Pending" ? "Super Admin approval" : "Super Admin account management"}</p><h2 id="review-account-title">{reviewAccount.status === "Pending" ? "Review account request" : "Manage teacher account"}</h2></div><button aria-label="Close review" onClick={() => setReviewAccount(null)}>×</button></div>
            <div className="super-review-profile"><span>{reviewAccount.name.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><div><strong>{reviewAccount.name}</strong><small>@{reviewAccount.username} · Requested {reviewAccount.requested}</small></div></div>
            <form onSubmit={(event) => { event.preventDefault(); reviewAccount.status === "Pending" ? approveAccount() : saveAccount(); }}>
              <div className="super-review-grid"><div><small>Requested role</small><strong>{reviewAccount.role}</strong></div><div><small>Workspace after approval</small><strong>{reviewAccount.role === "Admin" ? "Admin Control Center" : "Teacher Workspace"}</strong></div></div>
              <label>Account Role<select value={reviewAccount.role} onChange={(event) => setReviewAccount({ ...reviewAccount, role: event.target.value as AccountRole })}><option>Teacher</option><option>Admin</option></select></label>
              {reviewAccount.role === "Teacher" ? <div className="super-assignment-manager"><label>Teacher Classes & Subjects</label><div className="super-assignment-picker"><label>Subject<select value={assignmentDraft.subject} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, subject: event.target.value })}>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label><label>Grade<select value={assignmentDraft.grade} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, grade: event.target.value })}>{grades.map((grade) => <option key={grade}>{grade}</option>)}</select></label><label>Class<select value={assignmentDraft.section} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, section: event.target.value })}><option>A</option><option>B</option></select></label><button type="button" className="teacher-secondary-button" onClick={addAssignment}>Add assignment</button></div><div className="super-assignment-list">{reviewAccount.assignments.split(" | ").filter(Boolean).map((assignment) => <span key={assignment}>{assignment}<button type="button" aria-label={`Remove ${assignment}`} onClick={() => removeAssignment(assignment)}>×</button></span>)}</div><p className="super-assignment-help">Choose a subject, grade and class, then add it. Repeat for every class the teacher teaches.</p></div> : <label>Admin Access Scope<textarea rows={3} value={reviewAccount.assignments} onChange={(event) => setReviewAccount({ ...reviewAccount, assignments: event.target.value })} /></label>}
              <div className="super-review-note"><span>SA</span><p>{reviewAccount.status === "Pending" ? "Approving this account activates login access and sends the user to the correct dashboard based on the assigned role." : "Saving these changes updates the teacher’s permitted classes and subjects for the next login."}</p></div>
              <div className="teacher-editor-footer">{reviewAccount.status === "Pending" ? <button type="button" className="super-reject-button" onClick={rejectAccount}>Reject request</button> : <span>Only you can change this teacher’s classes and subjects.</span>}<div><button type="button" className="teacher-secondary-button" onClick={() => setReviewAccount(null)}>Cancel</button><button type="submit" className="teacher-primary-button">{reviewAccount.status === "Pending" ? "Approve account" : "Save account changes"}</button></div></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
