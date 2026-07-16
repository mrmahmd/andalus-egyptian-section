"use client";

import Link from "next/link";
import { useState } from "react";

const gradeOptions = Array.from({ length: 10 }, (_, index) => `Grade ${index + 1}`);

const subjectOptions = ["Arabic", "Islamic", "English OL", "English AL", "Math", "Science", "Social", "ICT"];

export default function TeacherLoginPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [accountType, setAccountType] = useState<"teacher" | "admin">("teacher");
  const [grade, setGrade] = useState(gradeOptions[0]);
  const [classType, setClassType] = useState("A");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const addClass = () => {
    const className = `${grade} · ${classType}`;
    setSelectedClasses((current) => current.includes(className) ? current : [...current, className]);
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((current) =>
      current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject],
    );
  };

  return (
    <main className="teacher-auth-page">
      <section className="teacher-auth-brand-panel">
        <div className="teacher-auth-brand">
          <img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" />
          <div><strong>ALANDALUS</strong><span>PRIVATE SCHOOLS</span><small>Egyptian Section</small></div>
        </div>

        <div className="teacher-auth-intro">
          <p>Teacher Workspace</p>
          <h1>Plan the week.<br />Keep every family informed.</h1>
          <span>A focused workspace for publishing classwork, homework, Classera notes and weekly assessments.</span>
        </div>

        <div className="teacher-auth-features">
          <span><i>01</i><b>One weekly plan</b><small>All daily entries stay organised in one clear view.</small></span>
          <span><i>02</i><b>Ready for families</b><small>Published plans appear instantly on the parent-facing page.</small></span>
          <span><i>03</i><b>Print &amp; PDF</b><small>The same design stays clean when printed or saved.</small></span>
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
            <h2>{mode === "signin" ? "Sign in to your account" : "Create your teacher account"}</h2>
            <p>{mode === "signin" ? "Enter your details to continue to the teacher dashboard." : "Add your account details, teaching classes and subjects."}</p>
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
            <label>Username<input type="text" name="username" placeholder="Enter your username" autoComplete="username" /></label>
            <label>Password<input type="password" name="password" placeholder="Enter your password" autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>

            {mode === "create" && accountType === "teacher" && (
              <section className="teacher-auth-assignments" aria-labelledby="teaching-assignments-title">
                <div className="teacher-auth-assignment-heading">
                  <span>TA</span>
                  <div><strong id="teaching-assignments-title">Teaching Assignments</strong><small>Select every class and subject you teach.</small></div>
                </div>

                <div className="teacher-auth-class-picker">
                  <label>Grade<select value={grade} onChange={(event) => setGrade(event.target.value)}>{gradeOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
                  <label>Class<select value={classType} onChange={(event) => setClassType(event.target.value)}><option value="A">Class A</option><option value="B">Class B</option></select></label>
                  <button type="button" onClick={addClass}>＋ Add Class</button>
                </div>

                <div className="teacher-auth-selected-classes" aria-live="polite">
                  {selectedClasses.length === 0 ? <small>No classes added yet.</small> : selectedClasses.map((className) => (
                    <button key={className} type="button" onClick={() => setSelectedClasses((current) => current.filter((item) => item !== className))}>{className}<span>×</span></button>
                  ))}
                </div>

                <fieldset className="teacher-auth-subjects">
                  <legend>Subjects</legend>
                  <div>{subjectOptions.map((subject) => (
                    <button key={subject} type="button" aria-pressed={selectedSubjects.includes(subject)} onClick={() => toggleSubject(subject)}><span>{subject.slice(0, 2).toUpperCase()}</span>{subject}<i>{selectedSubjects.includes(subject) ? "✓" : "+"}</i></button>
                  ))}</div>
                </fieldset>
              </section>
            )}

            {mode === "create" && accountType === "admin" && (
              <p className="teacher-auth-admin-note"><span>AD</span><strong>Administrator access</strong><small>This account type requires school management approval before activation.</small></p>
            )}

            {mode === "signin" && (
              <div className="teacher-auth-options"><label><input type="checkbox" />Remember me</label><button type="button">Forgot password?</button></div>
            )}

            <Link className="teacher-auth-submit" href="/teachers">
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
