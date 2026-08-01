"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type AccountRole = "Teacher" | "Admin";
type AccountStatus = "Not Registered" | "Pending" | "Active" | "Suspended" | "Rejected";

type AssignmentItem = {
  id?: string;
  subjectId: string;
  classId: string;
  label: string;
};

type ManagedAccount = {
  id: string;
  staffId: string;
  userId: string | null;
  requestId: string | null;
  name: string;
  username: string;
  role: AccountRole;
  status: AccountStatus;
  requested: string;
  department: string;
  administrativeRole: string | null;
  assignments: AssignmentItem[];
  assignmentSummary: string;
  lastAction: string;
};

type SubjectOption = {
  id: string;
  name_en: string;
  minimum_grade: number;
  maximum_grade: number;
};

type ClassOption = {
  id: string;
  grade: number;
  section: string;
};

function singleRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
}

export default function SuperAdminPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [currentAdminName, setCurrentAdminName] = useState("Mohamed Farid");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [reviewAccount, setReviewAccount] = useState<ManagedAccount | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState({ subjectId: "", classId: "" });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        window.location.assign(`${basePath}/teachers/login/`);
        return;
      }

      const { data: ownerProfile, error: ownerError } = await supabase
        .from("profiles")
        .select("user_id, display_name, role, status")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (ownerError || !ownerProfile || ownerProfile.role !== "super_admin" || ownerProfile.status !== "active") {
        await supabase.auth.signOut();
        window.location.assign(`${basePath}/teachers/login/`);
        return;
      }

      setCurrentAdminId(userData.user.id);
      setCurrentAdminName(ownerProfile.display_name || "Mohamed Farid");

      const [directoryResult, requestsResult, profilesResult, assignmentsResult, subjectsResult, classesResult] = await Promise.all([
        supabase.from("staff_directory").select("id, full_name, account_kind, administrative_role, department_id, departments(name_en)").eq("is_active", true).order("full_name"),
        supabase.from("registration_requests").select("id, user_id, staff_id, username, status, requested_at, reviewed_at").order("requested_at", { ascending: false }),
        supabase.from("profiles").select("user_id, staff_id, username, display_name, role, status, approved_at, updated_at"),
        supabase.from("teacher_assignments").select("id, teacher_id, class_id, subject_id, school_classes(grade, section), subjects(name_en)"),
        supabase.from("subjects").select("id, name_en, minimum_grade, maximum_grade").eq("is_active", true).eq("include_in_weekly_plan", true).order("name_en"),
        supabase.from("school_classes").select("id, grade, section").eq("is_active", true).order("grade").order("section"),
      ]);

      const firstError = [directoryResult.error, requestsResult.error, profilesResult.error, assignmentsResult.error, subjectsResult.error, classesResult.error].find(Boolean);
      if (firstError) throw firstError;

      const requestsByStaff = new Map<string, Record<string, unknown>>();
      for (const request of requestsResult.data ?? []) {
        const staffId = String(request.staff_id);
        if (!requestsByStaff.has(staffId)) requestsByStaff.set(staffId, request as Record<string, unknown>);
      }
      const profilesByStaff = new Map((profilesResult.data ?? []).filter((profile) => profile.staff_id).map((profile) => [String(profile.staff_id), profile]));
      const assignmentsByTeacher = new Map<string, AssignmentItem[]>();

      for (const assignment of assignmentsResult.data ?? []) {
        const schoolClass = singleRelation(assignment.school_classes as { grade: number; section: string } | { grade: number; section: string }[] | null);
        const subject = singleRelation(assignment.subjects as { name_en: string } | { name_en: string }[] | null);
        const teacherId = String(assignment.teacher_id);
        const teacherAssignments = assignmentsByTeacher.get(teacherId) ?? [];
        teacherAssignments.push({
          id: String(assignment.id),
          subjectId: String(assignment.subject_id),
          classId: String(assignment.class_id),
          label: `${subject?.name_en ?? "Subject"} · Grade ${schoolClass?.grade ?? "—"} ${schoolClass?.section ?? ""}`,
        });
        assignmentsByTeacher.set(teacherId, teacherAssignments);
      }

      const realAccounts: ManagedAccount[] = (directoryResult.data ?? []).map((staff) => {
        const staffId = String(staff.id);
        const profile = profilesByStaff.get(staffId);
        const request = requestsByStaff.get(staffId);
        const departmentRelation = singleRelation(staff.departments as { name_en: string } | { name_en: string }[] | null);
        const role: AccountRole = staff.account_kind === "admin" ? "Admin" : "Teacher";
        const userId = profile?.user_id ? String(profile.user_id) : request?.user_id ? String(request.user_id) : null;
        const assignmentItems = profile?.user_id ? assignmentsByTeacher.get(String(profile.user_id)) ?? [] : [];
        let status: AccountStatus = "Not Registered";
        if (profile) status = profile.status === "suspended" ? "Suspended" : "Active";
        else if (request?.status === "pending") status = "Pending";
        else if (request?.status === "rejected") status = "Rejected";

        const administrativeRole = staff.administrative_role ? String(staff.administrative_role) : null;
        const department = departmentRelation?.name_en ?? "School Administration";
        const assignmentSummary = role === "Admin"
          ? administrativeRole ?? department
          : assignmentItems.length > 0
            ? assignmentItems.map((item) => item.label).join(" | ")
            : status === "Active" || status === "Suspended" ? "No classes assigned yet" : "Assigned after account activation";

        const lastAction = status === "Pending" ? "Waiting for Super Admin review"
          : status === "Rejected" ? `Rejected ${formatDate(request?.reviewed_at as string | null)}`
            : status === "Active" ? `Approved ${formatDate(profile?.approved_at)}`
              : status === "Suspended" ? `Suspended · updated ${formatDate(profile?.updated_at)}`
                : "No account request submitted";

        return {
          id: staffId,
          staffId,
          userId,
          requestId: request?.id ? String(request.id) : null,
          name: String(staff.full_name),
          username: profile?.username ? String(profile.username) : request?.username ? String(request.username) : "Not registered",
          role,
          status,
          requested: formatDate(request?.requested_at as string | null),
          department,
          administrativeRole,
          assignments: assignmentItems,
          assignmentSummary,
          lastAction,
        };
      });

      setAccounts(realAccounts);
      setSubjects((subjectsResult.data ?? []) as SubjectOption[]);
      setClasses((classesResult.data ?? []) as ClassOption[]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The real school account directory could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboard(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const openAccount = (account: ManagedAccount) => {
    setErrorMessage("");
    setSuccessMessage("");
    setReviewAccount({ ...account, assignments: account.assignments.map((assignment) => ({ ...assignment })) });
    const firstClass = classes[0];
    const firstSubject = subjects.find((subject) => firstClass && firstClass.grade >= subject.minimum_grade && firstClass.grade <= subject.maximum_grade) ?? subjects[0];
    setAssignmentDraft({ classId: firstClass?.id ?? "", subjectId: firstSubject?.id ?? "" });
  };

  const addAssignment = () => {
    if (!reviewAccount || !assignmentDraft.classId || !assignmentDraft.subjectId) return;
    const schoolClass = classes.find((item) => item.id === assignmentDraft.classId);
    const subject = subjects.find((item) => item.id === assignmentDraft.subjectId);
    if (!schoolClass || !subject) return;
    if (schoolClass.grade < subject.minimum_grade || schoolClass.grade > subject.maximum_grade) {
      setErrorMessage(`${subject.name_en} is not available for Grade ${schoolClass.grade}.`);
      return;
    }
    if (reviewAccount.assignments.some((item) => item.classId === schoolClass.id && item.subjectId === subject.id)) return;
    setReviewAccount({
      ...reviewAccount,
      assignments: [...reviewAccount.assignments, { classId: schoolClass.id, subjectId: subject.id, label: `${subject.name_en} · Grade ${schoolClass.grade} ${schoolClass.section}` }],
    });
  };

  const removeAssignment = (index: number) => {
    if (!reviewAccount) return;
    setReviewAccount({ ...reviewAccount, assignments: reviewAccount.assignments.filter((_, itemIndex) => itemIndex !== index) });
  };

  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const haystack = `${account.name} ${account.username} ${account.department} ${account.assignmentSummary}`.toLowerCase();
    return haystack.includes(search.toLowerCase())
      && (roleFilter === "All Roles" || account.role === roleFilter)
      && (statusFilter === "All Statuses" || account.status === statusFilter);
  }), [accounts, search, roleFilter, statusFilter]);

  const pendingCount = accounts.filter((account) => account.status === "Pending").length;
  const activeCount = accounts.filter((account) => account.status === "Active").length;
  const notRegisteredCount = accounts.filter((account) => account.status === "Not Registered").length;
  const adminCount = accounts.filter((account) => account.role === "Admin" && account.status === "Active").length;

  const reviewRequest = async (status: "approved" | "rejected") => {
    if (!reviewAccount?.requestId || !currentAdminId) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("registration_requests").update({
        status,
        reviewed_by: currentAdminId,
        reviewed_at: new Date().toISOString(),
        review_note: status === "rejected" ? "Rejected by Super Admin" : null,
      }).eq("id", reviewAccount.requestId);
      if (error) throw error;
      setReviewAccount(null);
      setSuccessMessage(status === "approved" ? "Account approved and activated successfully." : "Account request rejected.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The account request could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  const saveAssignments = async () => {
    if (!reviewAccount?.userId || reviewAccount.role !== "Teacher") return;
    setBusy(true);
    setErrorMessage("");
    try {
      const original = accounts.find((account) => account.id === reviewAccount.id);
      const keptIds = new Set(reviewAccount.assignments.flatMap((assignment) => assignment.id ? [assignment.id] : []));
      const removedIds = (original?.assignments ?? []).flatMap((assignment) => assignment.id && !keptIds.has(assignment.id) ? [assignment.id] : []);
      const newAssignments = reviewAccount.assignments.filter((assignment) => !assignment.id).map((assignment) => ({
        teacher_id: reviewAccount.userId,
        class_id: assignment.classId,
        subject_id: assignment.subjectId,
        assigned_by: currentAdminId,
      }));
      const supabase = getSupabaseBrowserClient();
      if (removedIds.length > 0) {
        const { error } = await supabase.from("teacher_assignments").delete().in("id", removedIds);
        if (error) throw error;
      }
      if (newAssignments.length > 0) {
        const { error } = await supabase.from("teacher_assignments").insert(newAssignments);
        if (error) throw error;
      }
      setReviewAccount(null);
      setSuccessMessage("Teacher classes and subjects saved successfully.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Teacher assignments could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const toggleAccountStatus = async () => {
    if (!reviewAccount?.userId) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const nextStatus = reviewAccount.status === "Suspended" ? "active" : "suspended";
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("profiles").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("user_id", reviewAccount.userId);
      if (error) throw error;
      setReviewAccount(null);
      setSuccessMessage(nextStatus === "active" ? "Account reactivated successfully." : "Account suspended successfully.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The account status could not be changed.");
    } finally {
      setBusy(false);
    }
  };

  const selectedClass = classes.find((item) => item.id === assignmentDraft.classId);
  const compatibleSubjects = subjects.filter((subject) => !selectedClass || (selectedClass.grade >= subject.minimum_grade && selectedClass.grade <= subject.maximum_grade));

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
        <div className="teacher-sidebar-profile"><span className="teacher-avatar super-admin-avatar">MF</span><div><strong>{currentAdminName}</strong><small>Super Admin</small></div><button aria-label="Open profile menu">•••</button></div>
      </aside>

      <section className="teacher-main">
        <header className="teacher-topbar"><div className="teacher-mobile-brand"><img src={`${basePath}/school-logo.jpeg`} alt="" /><strong>Super Admin</strong></div><label className="teacher-search"><span>⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search real staff names or assignments" /></label><div className="teacher-top-actions"><span className="teacher-sync"><i /> Supabase connected</span><button className="teacher-icon-button" aria-label="Notifications">◇<b>{pendingCount}</b></button><button className="teacher-profile-chip"><span className="teacher-avatar super-admin-avatar">MF</span><span><strong>{currentAdminName}</strong><small>Super Admin</small></span></button></div></header>

        <div className="teacher-content super-admin-content">
          <div className="teacher-page-heading"><div><p className="teacher-kicker">Live school directory</p><h1>Account Approvals</h1><span>Real teachers and administrators loaded securely from the school database.</span></div><Link className="teacher-primary-button super-admin-plans-link" href="/admin">Manage public weekly plans <span>→</span></Link></div>

          {errorMessage && <p className="super-admin-live-message error" role="alert">{errorMessage}</p>}
          {successMessage && <p className="super-admin-live-message success" role="status">{successMessage}</p>}

          <section className="teacher-stats" aria-label="Account approval summary">
            <article><span className="stat-icon magenta">PN</span><div><small>Pending approval</small><strong>{pendingCount}</strong><p>Waiting for your decision</p></div></article>
            <article><span className="stat-icon cyan">AC</span><div><small>Active accounts</small><strong>{activeCount}</strong><p>Can access their workspace</p></div></article>
            <article><span className="stat-icon navy">NR</span><div><small>Not registered</small><strong>{notRegisteredCount}</strong><p>Listed staff without accounts</p></div></article>
            <article><span className="stat-icon amber">AD</span><div><small>Active admins</small><strong>{adminCount}</strong><p>Admin Control Center access</p></div></article>
          </section>

          <section className="teacher-card super-admin-accounts-card">
            <div className="super-admin-toolbar">
              <div><h2>Real school staff directory</h2><p>{loading ? "Loading accounts from Supabase…" : `${filteredAccounts.length} of ${accounts.length} staff members shown`}</p></div>
              <label className="super-admin-mobile-search">Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or username" /></label>
              <div className="super-admin-filters"><label>Role<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>All Roles</option><option>Teacher</option><option>Admin</option></select></label><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All Statuses</option><option>Pending</option><option>Active</option><option>Suspended</option><option>Rejected</option><option>Not Registered</option></select></label></div>
            </div>
            <div className="super-admin-table-wrap"><table className="super-admin-table"><thead><tr><th>School Staff</th><th>Role</th><th>Department / Assignments</th><th>Requested</th><th>Status</th><th>Last Action</th><th>Actions</th></tr></thead><tbody>
              {loading && <tr><td className="super-empty" colSpan={7}>Loading the real school directory…</td></tr>}
              {!loading && filteredAccounts.map((account) => (
                <tr key={account.id}><td><div className="super-account-name"><span>{initials(account.name)}</span><div><strong>{account.name}</strong><small>{account.username === "Not registered" ? account.department : `@${account.username}`}</small></div></div></td><td><span className={`super-role ${account.role.toLowerCase()}`}>{account.role === "Teacher" ? "TC · Teacher" : "AD · Admin"}</span></td><td>{account.assignmentSummary}</td><td>{account.requested}</td><td><span className={`super-account-status ${account.status.toLowerCase().replace(" ", "-")}`}><i />{account.status}</span></td><td>{account.lastAction}</td><td><div className="super-row-actions">
                  {account.status === "Pending" || account.status === "Rejected" ? <button className="review" onClick={() => openAccount(account)}>Review</button> : null}
                  {account.status === "Active" || account.status === "Suspended" ? <><button className="manage" onClick={() => openAccount(account)}>Manage</button><Link href={account.role === "Admin" ? "/admin" : "/teachers"}>Open workspace</Link></> : null}
                  {account.status === "Not Registered" ? <span className="super-waiting-registration">Waiting for registration</span> : null}
                </div></td></tr>
              ))}
              {!loading && filteredAccounts.length === 0 && <tr><td className="super-empty" colSpan={7}>No real staff accounts match the selected filters.</td></tr>}
            </tbody></table></div>
          </section>
        </div>
      </section>

      {reviewAccount && (
        <div className="teacher-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && setReviewAccount(null)}>
          <section className="teacher-editor-modal super-review-modal" role="dialog" aria-modal="true" aria-labelledby="review-account-title">
            <div className="teacher-modal-heading"><div><p>{reviewAccount.status === "Pending" || reviewAccount.status === "Rejected" ? "Super Admin approval" : "Live account management"}</p><h2 id="review-account-title">{reviewAccount.status === "Pending" || reviewAccount.status === "Rejected" ? "Review account request" : "Manage real staff account"}</h2></div><button disabled={busy} aria-label="Close review" onClick={() => setReviewAccount(null)}>×</button></div>
            <div className="super-review-profile"><span>{initials(reviewAccount.name)}</span><div><strong>{reviewAccount.name}</strong><small>{reviewAccount.username === "Not registered" ? reviewAccount.department : `@${reviewAccount.username}`} · {reviewAccount.status}</small></div></div>
            <form onSubmit={(event) => { event.preventDefault(); if (reviewAccount.status === "Pending" || reviewAccount.status === "Rejected") void reviewRequest("approved"); else if (reviewAccount.role === "Teacher") void saveAssignments(); else setReviewAccount(null); }}>
              <div className="super-review-grid"><div><small>School role</small><strong>{reviewAccount.administrativeRole ?? reviewAccount.role}</strong></div><div><small>Department</small><strong>{reviewAccount.department}</strong></div></div>

              {(reviewAccount.status === "Pending" || reviewAccount.status === "Rejected") && <div className="super-review-note"><span>SA</span><p>Approving this request creates the real active profile and sends this user to the correct dashboard. The account role comes from the approved school directory and cannot be changed by the applicant.</p></div>}

              {(reviewAccount.status === "Active" || reviewAccount.status === "Suspended") && reviewAccount.role === "Teacher" && <div className="super-assignment-manager"><label>Teacher Classes & Subjects</label><div className="super-assignment-picker"><label>Class<select value={assignmentDraft.classId} onChange={(event) => { const classId = event.target.value; const schoolClass = classes.find((item) => item.id === classId); const firstCompatible = subjects.find((subject) => schoolClass && schoolClass.grade >= subject.minimum_grade && schoolClass.grade <= subject.maximum_grade); setAssignmentDraft({ classId, subjectId: firstCompatible?.id ?? "" }); }}>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>Grade {schoolClass.grade} {schoolClass.section}</option>)}</select></label><label>Subject<select value={assignmentDraft.subjectId} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, subjectId: event.target.value })}>{compatibleSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name_en}</option>)}</select></label><button type="button" className="teacher-secondary-button" onClick={addAssignment}>Add assignment</button></div><div className="super-assignment-list">{reviewAccount.assignments.map((assignment, index) => <span key={`${assignment.id ?? "new"}-${assignment.classId}-${assignment.subjectId}`}>{assignment.label}<button type="button" aria-label={`Remove ${assignment.label}`} onClick={() => removeAssignment(index)}>×</button></span>)}{reviewAccount.assignments.length === 0 && <small>No classes or subjects assigned yet.</small>}</div><p className="super-assignment-help">Assignments are saved to Supabase and control which weekly plans this teacher can edit.</p></div>}

              {(reviewAccount.status === "Active" || reviewAccount.status === "Suspended") && reviewAccount.role === "Admin" && <div className="super-review-note"><span>AD</span><p>{reviewAccount.administrativeRole ?? "Administrator"} · {reviewAccount.department}. Admin scope is assigned from the approved school directory.</p></div>}

              <div className="teacher-editor-footer">
                {reviewAccount.status === "Pending" || reviewAccount.status === "Rejected" ? <button disabled={busy || reviewAccount.status === "Rejected"} type="button" className="super-reject-button" onClick={() => void reviewRequest("rejected")}>Reject request</button> : <button disabled={busy} type="button" className="super-reject-button" onClick={() => void toggleAccountStatus()}>{reviewAccount.status === "Suspended" ? "Reactivate account" : "Suspend account"}</button>}
                <div><button disabled={busy} type="button" className="teacher-secondary-button" onClick={() => setReviewAccount(null)}>Cancel</button><button disabled={busy} type="submit" className="teacher-primary-button">{busy ? "Saving…" : reviewAccount.status === "Pending" || reviewAccount.status === "Rejected" ? "Approve account" : reviewAccount.role === "Teacher" ? "Save assignments" : "Close"}</button></div>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
