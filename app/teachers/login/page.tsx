"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";

type AccountType = "teacher" | "admin";
type StaffRecord = {
  id: string;
  full_name: string;
  account_kind: AccountType;
  administrative_role: string | null;
  department_id: string | null;
  department_name: string;
};

function accountEmail(username: string) {
  return `${username.trim().toLowerCase()}@staff.alandalus.school`;
}

function validUsername(username: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username);
}

export default function TeacherLoginPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [accountType, setAccountType] = useState<AccountType>("teacher");
  const [directory, setDirectory] = useState<StaffRecord[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"error" | "success" | "info">("info");

  useEffect(() => {
    let active = true;
    async function loadDirectory() {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("staff_directory")
          .select("id, full_name, account_kind, administrative_role, department_id, departments(name_en)")
          .eq("is_active", true)
          .order("full_name");

        if (error) throw error;
        if (!active) return;
        const records = (data ?? []).map((item: Record<string, unknown>) => {
          const department = item.departments as { name_en?: string } | { name_en?: string }[] | null;
          const departmentName = Array.isArray(department) ? department[0]?.name_en : department?.name_en;
          return {
            id: String(item.id),
            full_name: String(item.full_name),
            account_kind: item.account_kind as AccountType,
            administrative_role: item.administrative_role ? String(item.administrative_role) : null,
            department_id: item.department_id ? String(item.department_id) : null,
            department_name: departmentName ?? "School Administration",
          };
        });
        setDirectory(records);
      } catch {
        if (!active) return;
        setMessage("The account directory is not ready yet. Complete the Supabase database setup, then refresh this page.");
        setMessageTone("error");
      } finally {
        if (active) setLoadingDirectory(false);
      }
    }
    loadDirectory();
    return () => { active = false; };
  }, []);

  const departments = useMemo(() => {
    const teacherRecords = directory.filter((staff) => staff.account_kind === "teacher" && staff.department_id);
    return Array.from(new Map(teacherRecords.map((staff) => [staff.department_id as string, staff.department_name])).entries());
  }, [directory]);

  const availableStaff = useMemo(() => directory.filter((staff) => {
    if (staff.account_kind !== accountType) return false;
    if (accountType === "teacher" && departmentId) return staff.department_id === departmentId;
    return true;
  }), [accountType, departmentId, directory]);

  useEffect(() => {
    if (accountType === "teacher" && !departmentId && departments[0]) setDepartmentId(departments[0][0]);
  }, [accountType, departmentId, departments]);

  useEffect(() => {
    if (!availableStaff.some((staff) => staff.id === staffId)) setStaffId(availableStaff[0]?.id ?? "");
  }, [availableStaff, staffId]);

  function showMessage(text: string, tone: "error" | "success" | "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (!validUsername(cleanUsername)) {
      showMessage("Username must be 3–32 characters using English letters, numbers, dots, dashes or underscores.", "error");
      return;
    }
    if (password.length < 8) {
      showMessage("Password must contain at least 8 characters.", "error");
      return;
    }
    if (mode === "create" && !staffId) {
      showMessage("Choose your name from the approved school directory.", "error");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "create") {
        const selectedStaff = directory.find((staff) => staff.id === staffId);
        if (!selectedStaff || selectedStaff.account_kind !== accountType) throw new Error("The selected staff record is invalid.");

        const { data, error } = await supabase.auth.signUp({
          email: accountEmail(cleanUsername),
          password,
          options: { data: { display_name: selectedStaff.full_name } },
        });
        if (error) throw error;
        if (!data.user) throw new Error("The account could not be created.");
        if (!data.session) {
          throw new Error("Email confirmation is enabled in Supabase. Disable Confirm email for staff username accounts, then try again.");
        }

        const { error: requestError } = await supabase.from("registration_requests").insert({
          user_id: data.user.id,
          staff_id: selectedStaff.id,
          username: cleanUsername,
        });
        if (requestError) throw requestError;

        await supabase.auth.signOut();
        setPassword("");
        setMode("signin");
        showMessage("Your account request was created successfully. You can sign in after the Super Admin approves it.", "success");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: accountEmail(cleanUsername),
        password,
      });
      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      if (!profile || profile.status !== "active") {
        const { data: request } = await supabase
          .from("registration_requests")
          .select("status, review_note")
          .eq("user_id", data.user.id)
          .maybeSingle();
        await supabase.auth.signOut();
        if (request?.status === "rejected") {
          showMessage(request.review_note || "This account request was not approved. Please contact the school administration.", "error");
        } else {
          showMessage("Your account is still waiting for Super Admin approval.", "info");
        }
        return;
      }

      const destination = profile.role === "super_admin" ? "/super-admin/" : profile.role === "admin" ? "/admin/" : "/teachers/";
      window.location.assign(`${basePath}${destination}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      showMessage(text, "error");
    } finally {
      setSubmitting(false);
    }
  }

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
          <div className="teacher-auth-tabs" role="tablist" aria-label="School account access">
            <button type="button" role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setMessage(""); }}>Sign In</button>
            <button type="button" role="tab" aria-selected={mode === "create"} className={mode === "create" ? "active" : ""} onClick={() => { setMode("create"); setMessage(""); }}>Create New Account</button>
          </div>

          <div className="teacher-auth-heading">
            <span>{mode === "signin" ? "Welcome back" : "Join the workspace"}</span>
            <h2>{mode === "signin" ? "Sign in to your school account" : "Create your school account"}</h2>
            <p>{mode === "signin" ? "Your approved account will open the correct dashboard automatically." : "Choose your registered school name, then create only a username and password."}</p>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "create" && (
              <fieldset className="teacher-auth-account-type">
                <legend>Account Type</legend>
                <div>
                  <button type="button" aria-pressed={accountType === "teacher"} onClick={() => { setAccountType("teacher"); setStaffId(""); }}><span>TC</span><b>Teacher</b><small>Create weekly plans for assigned classes.</small><i>{accountType === "teacher" ? "✓" : ""}</i></button>
                  <button type="button" aria-pressed={accountType === "admin"} onClick={() => { setAccountType("admin"); setStaffId(""); }}><span>AD</span><b>Admin</b><small>Review the teachers in your assigned scope.</small><i>{accountType === "admin" ? "✓" : ""}</i></button>
                </div>
              </fieldset>
            )}

            {mode === "create" && accountType === "teacher" && (
              <>
                <label>Teaching Department
                  <select value={departmentId} disabled={loadingDirectory} onChange={(event) => { setDepartmentId(event.target.value); setStaffId(""); }}>
                    {departments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                </label>
                <label>Teacher Name
                  <select value={staffId} disabled={loadingDirectory || availableStaff.length === 0} onChange={(event) => setStaffId(event.target.value)}>
                    {availableStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.full_name}</option>)}
                  </select>
                </label>
              </>
            )}

            {mode === "create" && accountType === "admin" && (
              <section className="teacher-auth-admin-role" aria-labelledby="admin-name-title">
                <label id="admin-name-title">Admin Name
                  <select value={staffId} disabled={loadingDirectory || availableStaff.length === 0} onChange={(event) => setStaffId(event.target.value)}>
                    {availableStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.full_name}</option>)}
                  </select>
                </label>
                <p><span>AD</span><strong>{directory.find((staff) => staff.id === staffId)?.administrative_role ?? "Assigned school role"}</strong><small>Your role is assigned by the school and cannot be changed from this form.</small></p>
              </section>
            )}

            <label>Username<input type="text" name="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="English letters and numbers only" autoComplete="username" /></label>
            <label>Password<input type="password" name="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} /></label>

            {mode === "signin" && (
              <div className="teacher-auth-options"><label><input type="checkbox" />Remember me</label><button type="button" disabled title="Password recovery will be enabled later">Forgot password?</button></div>
            )}

            {message && <p className={`teacher-auth-status ${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{message}</p>}

            <button className="teacher-auth-submit" type="submit" disabled={submitting || (mode === "create" && loadingDirectory)}>
              {submitting ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}<span>→</span>
            </button>
          </form>

          <p className="teacher-auth-notice"><span>i</span>{mode === "signin" ? "Use your approved school account to access the workspace." : "New accounts remain pending until the Super Admin activates them and assigns classes and subjects."}</p>
          <div className="teacher-auth-switch-copy">
            {mode === "signin" ? "First time here?" : "Already have an account?"}
            <button type="button" onClick={() => { setMode(mode === "signin" ? "create" : "signin"); setMessage(""); }}>{mode === "signin" ? "Create New Account" : "Sign In"}</button>
          </div>
        </div>
      </section>
    </main>
  );
}

