"use client";

import Link from "next/link";
import { useState } from "react";

const departmentOptions = ["English Department", "Arabic & Social Studies Department", "Math & Science Department"];
const teacherDirectory: Record<string, string[]> = {
  "English Department": ["محمود حلمي", "محمد بدر", "محمد فريد", "عمرو رزق", "محمد عبد الحميد", "محمود السكري"],
  "Arabic & Social Studies Department": ["محمد سيد بكر", "محمد حمد", "محمد سعيد", "محمد شعبان", "ماجد موسى", "محمد عثمان", "أحمد سالم", "أحمد حسن", "محمد فودة", "عصام الجزار", "وائل شكري"],
  "Math & Science Department": ["جمال عبد الرحيم", "أحمد عدس", "ممدوح بهجت", "عبد الناصر خليل", "عمر أبو شادي", "وائل أبو العلا"],
};
const adminDirectory = [
  { name: "محمود حلمي", role: "English Supervisor" },
  { name: "محمد عثمان", role: "Arabic Supervisor" },
  { name: "جمال عبد الرحيم", role: "Math & Science Supervisor" },
  { name: "همام عبد المنعم", role: "Vice Principal" },
  { name: "خالد سعد الدين", role: "Vice Principal" },
  { name: "أحمد حجازي", role: "Vice Principal" },
];
const unassignedTeachers = ["محمود مدكور", "محمد سمير", "علي بدير", "أحمد حجي", "محمد معوض", "محمود مرسي"];
const gradeOptions = Array.from({ length: 10 }, (_, index) => `Grade ${index + 1}`);
const subjectOptions = ["Arabic", "Islamic", "English - Connect Plus", "English - Hello", "English - Hello Plus", "Discover", "Math", "Science", "Social", "ICT", "PE", "Swimming"];
const adminRoleOptions = ["Administrative", "English Supervisor", "Arabic Supervisor", "Math & Science Supervisor", "Vice Principal"] as const;

export default function TeacherLoginPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [accountType, setAccountType] = useState<"teacher" | "admin">("teacher");
  const [teacherDepartment, setTeacherDepartment] = useState(departmentOptions[0]);
  const [teacherName, setTeacherName] = useState(teacherDirectory[departmentOptions[0]][0]);
  const [adminPosition, setAdminPosition] = useState<(typeof adminRoleOptions)[number]>("Administrative");
  const [adminName, setAdminName] = useState(adminDirectory[0].name);
  const [draftSubject, setDraftSubject] = useState("English - Connect Plus");
  const [draftGrade, setDraftGrade] = useState("Grade 1");
  const [draftClassType, setDraftClassType] = useState<"A" | "B">("A");
  const [teachingAssignments, setTeachingAssignments] = useState<{ id: number; subject: string; grade: string; classType: "A" | "B" }[]>([]);
  const [assignmentError, setAssignmentError] = useState("");

  const addAssignment = () => {
    const exists = teachingAssignments.some((item) => item.subject === draftSubject && item.grade === draftGrade && item.classType === draftClassType);
    if (exists) { setAssignmentError("This subject and class assignment has already been added."); return; }
    setTeachingAssignments((current) => [...current, { id: Math.max(...current.map((item) => item.id), 0) + 1, subject: draftSubject, grade: draftGrade, classType: draftClassType }]);
    setAssignmentError("");
  };
  return (
    <main className="teacher-auth-page">
      <section className="teacher-auth-brand-panel">
        <div className="teacher-auth-brand">
          <img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" />
          <div><strong>ALANDALUS</strong><span>PRIVATE SCHOOLS</span><small>Egyptian Section</small></div>
        </div>

        <div className="teacher-auth-intro">
          <p>School Staff Portal</p>
          <h1>One secure sign in.<br />Every workspace.</h1>
          <span>Teachers and administrators enter from one portal and continue to their correct workspace.</span>
        </div>

        <div className="teacher-auth-features">
          <span><i>01</i><b>One portal</b><small>Every school account begins from this single sign-in page.</small></span>
          <span><i>02</i><b>Role-based access</b><small>Your approved account opens only the workspace assigned to you.</small></span>
          <span><i>03</i><b>Ready for families</b><small>Published plans appear on the parent-facing page.</small></span>
        </div>

        <p className="teacher-auth-credit">AlAndalus Private Schools · Egyptian Section</p>
      </section>

      <section className="teacher-auth-form-panel">
        <div className="teacher-auth-mobile-brand">
          <img src={`${basePath}/school-logo.jpeg`} alt="" />
          <span><strong>ALANDALUS</strong><small>Teacher Workspace</small></span>
        </div>

        <div className={`teacher-auth-card ${mode === "create" ? "create-mode" : ""}`}>
          <div className="teacher-auth-tabs" role="tablist" aria-label="Teacher account access">
            <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")}>Sign In</button>
            <button type="button" role="tab" aria-selected={mode === "create"} className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>Create New Account</button>
          </div>

          <div className="teacher-auth-heading">
            <span>{mode === "signin" ? "Welcome back" : "Join the workspace"}</span>
            <h2>{mode === "signin" ? "Sign in to your school account" : "Create your school account"}</h2>
            <p>{mode === "signin" ? "Your approved account will open the correct dashboard automatically." : "Add your account details, teaching classes and subjects."}</p>
          </div>

          <form onSubmit={(event) => event.preventDefault()}>
            {mode === "create" && (
              <label>Full Name<input type="text" name="fullName" placeholder="e.g. Mohamed Farid" autoComplete="name" /></label>
            )}
            {mode === "create" && (
              <fieldset className="teacher-auth-account-type">
                <legend>Account Type</legend>
                <div>
                  <button type="button" aria-pressed={accountType === "teacher"} onClick={() => setAccountType("teacher")}><span>TC</span><b>Teacher</b><small>Create and publish weekly plans.</small><i>{accountType === "teacher" ? "✓" : ""}</i></button>
                  <button type="button" aria-pressed={accountType === "admin"} onClick={() => setAccountType("admin")}><span>AD</span><b>Admin</b><small>Manage accounts and school plans.</small><i>{accountType === "admin" ? "✓" : ""}</i></button>
                </div>
              </fieldset>
            )}
            {mode === "create" && accountType === "teacher" && (
              <>
                <label>Teaching Department<select value={teacherDepartment} onChange={(event) => { const department = event.target.value; setTeacherDepartment(department); setTeacherName(teacherDirectory[department][0]); }}>{departmentOptions.map((department) => <option key={department}>{department}</option>)}</select></label>
                <label>Teacher Name<select value={teacherName} onChange={(event) => setTeacherName(event.target.value)}>{teacherDirectory[teacherDepartment].map((name) => <option key={name}>{name}</option>)}</select></label>
              </>
            )}
            {mode === "create" && accountType === "admin" && (
              <section className="teacher-auth-admin-role" aria-labelledby="admin-role-title">
                <label id="admin-role-title">Admin Name<select value={adminName} onChange={(event) => { const name = event.target.value; setAdminName(name); setAdminPosition(adminDirectory.find((admin) => admin.name === name)?.role as (typeof adminRoleOptions)[number]); }}>{adminDirectory.map((admin) => <option key={admin.name}>{admin.name}</option>)}</select></label>
                <p><span>AD</span><strong>{adminPosition}</strong><small>Your role is assigned by the school and cannot be changed from this form.</small></p>
              </section>
            )}
            <label>Username<input type="text" name="username" placeholder="Enter your username" autoComplete="username" /></label>
            <label>Password<input type="password" name="password" placeholder="Enter your password" autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>

            {false && mode === "create" && accountType === "teacher" && (
              <section className="teacher-auth-assignments" aria-labelledby="teaching-assignments-title">
                <div className="teacher-auth-assignment-heading">
                  <span>TA</span>
                  <div><strong id="teaching-assignments-title">Teaching Assignments</strong><small>Choose a subject and class, then add another assignment when needed.</small></div>
                </div>

                <div className="teacher-auth-assignment-builder">
                  <label>Subject<select value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)}>{subjectOptions.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
                  <label>Grade<select value={draftGrade} onChange={(event) => setDraftGrade(event.target.value)}>{gradeOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
                  <label>Class<select value={draftClassType} onChange={(event) => setDraftClassType(event.target.value as "A" | "B")}><option value="A">Class A</option><option value="B">Class B</option></select></label>
                  <button type="button" onClick={addAssignment}>＋ {teachingAssignments.length === 0 ? "Add Assignment" : "Add Another Assignment"}</button>
                </div>
                {assignmentError && <p className="teacher-auth-assignment-error" role="alert">{assignmentError}</p>}

                <div className="teacher-auth-assignment-summary" aria-live="polite">
                  {teachingAssignments.length === 0 ? (
                    <p><span>01</span><strong>No assignments added yet</strong><small>Choose the first subject and class above, then press Add Assignment.</small></p>
                  ) : teachingAssignments.map((assignment, index) => (
                    <article key={assignment.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><strong>{assignment.subject}</strong><small>{assignment.grade} · Class {assignment.classType}</small></div>
                      <button type="button" aria-label={`Remove ${assignment.subject} for ${assignment.grade} Class ${assignment.classType}`} onClick={() => setTeachingAssignments((current) => current.filter((item) => item.id !== assignment.id))}>×</button>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {mode === "create" && accountType === "admin" && (
              <p className="teacher-auth-admin-note"><span>AD</span><strong>Administrator access</strong><small>This account type requires school management approval before activation.</small></p>
            )}

            {mode === "signin" && (
              <div className="teacher-auth-options"><label><input type="checkbox" />Remember me</label><button type="button">Forgot password?</button></div>
            )}

            <Link className="teacher-auth-submit" href={mode === "create" && accountType === "admin" ? "/admin" : "/teachers"}>
              {mode === "signin" ? "Sign In" : "Create Account"}<span>→</span>
            </Link>
          </form>

          <p className="teacher-auth-notice"><span>i</span>{mode === "signin" ? "Use your approved school account to access the workspace." : "New accounts will be activated after administrator approval."}</p>
          <div className="teacher-auth-switch-copy">
            {mode === "signin" ? "First time here?" : "Already have an account?"}
            <button type="button" onClick={() => setMode(mode === "signin" ? "create" : "signin")}>{mode === "signin" ? "Create New Account" : "Sign In"}</button>
          </div>
        </div>
      </section>
    </main>
  );
}
