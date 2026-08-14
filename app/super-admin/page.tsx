"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type AccountRole = "Teacher" | "Admin";
type AccountStatus = "Not Registered" | "Pending" | "Active" | "Suspended" | "Rejected";
type DashboardSection = "approvals" | "accounts" | "roles" | "plans" | "holidays" | "classes" | "activity" | "settings";

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

type ManagedPlan = {
  id: string;
  weekId: string;
  classId: string;
  week: string;
  className: string;
  classTeacher: string;
  status: "draft" | "published" | "archived";
  manualPublicationOverride: boolean;
  entries: number;
  updated: string;
};

type AcademicWeekOption = { id: string; week_number: number; label: string; starts_on: string; ends_on: string; is_current: boolean };
type SchoolHoliday = { id: string; week_id: string; day_of_week: number; title: string; note: string | null };
type EditableEntry = { id: string; day_of_week: number; period_number: number; course: string; classwork: string; homework: string; classeraNotes: string };
type EditablePlan = { id: string; className: string; week: string; entries: EditableEntry[] };

const holidayDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

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
  const [weeklyPlans, setWeeklyPlans] = useState<ManagedPlan[]>([]);
  const [academicWeeks, setAcademicWeeks] = useState<AcademicWeekOption[]>([]);
  const [schoolHolidays, setSchoolHolidays] = useState<SchoolHoliday[]>([]);
  const [selectedPlanWeekId, setSelectedPlanWeekId] = useState("");
  const [selectedHolidayWeekId, setSelectedHolidayWeekId] = useState("");
  const [holidayDraft, setHolidayDraft] = useState({ dayOfWeek: "0", title: "Official Holiday", note: "" });
  const [editingPlan, setEditingPlan] = useState<EditablePlan | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [currentAdminName, setCurrentAdminName] = useState("Mohamed Farid");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [activeSection, setActiveSection] = useState<DashboardSection>("accounts");
  const [reviewAccount, setReviewAccount] = useState<ManagedAccount | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState({ subjectId: "", classId: "" });
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [passwordResetMessage, setPasswordResetMessage] = useState("");
  const [passwordResetTone, setPasswordResetTone] = useState<"success" | "error" | "info">("info");
  const [weeklyPlanCreationOpen, setWeeklyPlanCreationOpen] = useState(true);
  const [teacherPlanAccess, setTeacherPlanAccess] = useState<Record<string, boolean>>({});

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

      const [directoryResult, requestsResult, profilesResult, assignmentsResult, subjectsResult, classesResult, plansResult, accessResult, teacherAccessResult, weeksResult, holidaysResult] = await Promise.all([
        supabase.from("staff_directory").select("id, full_name, account_kind, administrative_role, department_id, departments(name_en)").eq("is_active", true).order("full_name"),
        supabase.from("registration_requests").select("id, user_id, staff_id, username, status, requested_at, reviewed_at").order("requested_at", { ascending: false }),
        supabase.from("profiles").select("user_id, staff_id, username, display_name, role, status, approved_at, updated_at"),
        supabase.from("teacher_assignments").select("id, teacher_id, class_id, subject_id, school_classes(grade, section), subjects(name_en)"),
        supabase.from("subjects").select("id, name_en, minimum_grade, maximum_grade").eq("is_active", true).eq("include_in_weekly_plan", true).order("name_en"),
        supabase.from("school_classes").select("id, grade, section").eq("is_active", true).order("grade").order("section"),
        supabase.from("weekly_plans").select("id, class_id, week_id, class_teacher_name, status, manual_publication_override, updated_at, school_classes(grade, section), academic_weeks(week_number, label), plan_entries(count)").order("updated_at", { ascending: false }),
        supabase.from("weekly_plan_access_control").select("is_open").eq("id", 1).maybeSingle(),
        supabase.from("weekly_plan_teacher_access").select("teacher_id, is_open"),
        supabase.from("academic_weeks").select("id, week_number, label, starts_on, ends_on, is_current").order("week_number"),
        supabase.from("weekly_plan_holidays").select("id, week_id, day_of_week, title, note").order("day_of_week"),
      ]);

      const firstError = [directoryResult.error, requestsResult.error, profilesResult.error, assignmentsResult.error, subjectsResult.error, classesResult.error, plansResult.error, weeksResult.error, holidaysResult.error].find(Boolean);
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
      setWeeklyPlanCreationOpen(accessResult.data?.is_open ?? true);
      setTeacherPlanAccess(Object.fromEntries((teacherAccessResult.data ?? []).map((row) => [String(row.teacher_id), Boolean(row.is_open)])));
      setSubjects((subjectsResult.data ?? []) as SubjectOption[]);
      setClasses((classesResult.data ?? []) as ClassOption[]);
      const loadedWeeks = (weeksResult.data ?? []) as AcademicWeekOption[];
      setAcademicWeeks(loadedWeeks);
      setSchoolHolidays((holidaysResult.data ?? []) as SchoolHoliday[]);
      setSelectedPlanWeekId((value) => value || loadedWeeks.find((week) => week.is_current)?.id || loadedWeeks[0]?.id || "");
      setSelectedHolidayWeekId((value) => value || loadedWeeks.find((week) => week.is_current)?.id || loadedWeeks[0]?.id || "");
      setWeeklyPlans((plansResult.data ?? []).map((plan) => {
        const schoolClass = singleRelation(plan.school_classes as { grade: number; section: string } | { grade: number; section: string }[] | null);
        const week = singleRelation(plan.academic_weeks as { week_number: number; label: string } | { week_number: number; label: string }[] | null);
        const entryCount = singleRelation(plan.plan_entries as { count: number } | { count: number }[] | null);
        return {
          id: String(plan.id),
          weekId: String(plan.week_id),
          classId: String(plan.class_id),
          week: week?.label ?? `Week ${week?.week_number ?? "—"}`,
          className: `Grade ${schoolClass?.grade ?? "—"} ${schoolClass?.section ?? ""}`,
          classTeacher: String(plan.class_teacher_name),
          status: plan.status as ManagedPlan["status"],
          manualPublicationOverride: Boolean(plan.manual_publication_override),
          entries: Number(entryCount?.count ?? 0),
          updated: formatDate(plan.updated_at),
        };
      }));
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
    setTemporaryPassword("");
    setPasswordResetMessage("");
    const firstClass = classes[0];
    const firstSubject = subjects.find((subject) => firstClass && firstClass.grade >= subject.minimum_grade && firstClass.grade <= subject.maximum_grade) ?? subjects[0];
    setAssignmentDraft({ classId: firstClass?.id ?? "", subjectId: firstSubject?.id ?? "" });
  };

  const resetAccountPassword = async () => {
    if (!reviewAccount?.userId) return;
    if (temporaryPassword.length < 8) {
      setPasswordResetTone("error");
      setPasswordResetMessage("Use a temporary password with at least 8 characters.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    setSuccessMessage("");
    setPasswordResetTone("info");
    setPasswordResetMessage("Updating the staff password securely…");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.functions.invoke("reset-staff-password", {
        body: { targetUserId: reviewAccount.userId, password: temporaryPassword },
      });
      if (error) throw error;
      setTemporaryPassword("");
      setPasswordResetTone("success");
      setPasswordResetMessage("Temporary password updated successfully. Share it privately with the staff member.");
      setSuccessMessage(`A temporary password was set for ${reviewAccount.name}. Share it privately with the staff member.`);
    } catch (error) {
      const response = (error as { context?: Response }).context;
      const detail = response ? await response.json().catch(() => null) : null;
      const text = detail && typeof detail.error === "string" ? detail.error : error instanceof Error ? error.message : "The password could not be reset.";
      setPasswordResetTone("error");
      setPasswordResetMessage(text);
      setErrorMessage(text);
    } finally {
      setBusy(false);
    }
  };

  const addAssignment = async () => {
    if (!reviewAccount?.userId || !currentAdminId || !assignmentDraft.classId || !assignmentDraft.subjectId) return;
    const schoolClass = classes.find((item) => item.id === assignmentDraft.classId);
    const subject = subjects.find((item) => item.id === assignmentDraft.subjectId);
    if (!schoolClass || !subject) return;
    if (schoolClass.grade < subject.minimum_grade || schoolClass.grade > subject.maximum_grade) {
      setErrorMessage(`${subject.name_en} is not available for Grade ${schoolClass.grade}.`);
      return;
    }
    if (reviewAccount.assignments.some((item) => item.classId === schoolClass.id && item.subjectId === subject.id)) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("teacher_assignments").insert({
        teacher_id: reviewAccount.userId,
        class_id: schoolClass.id,
        subject_id: subject.id,
        assigned_by: currentAdminId,
      }).select("id").single();
      if (error) throw error;
      const savedAssignment = { id: String(data.id), classId: schoolClass.id, subjectId: subject.id, label: `${subject.name_en} · Grade ${schoolClass.grade} ${schoolClass.section}` };
      setReviewAccount({ ...reviewAccount, assignments: [...reviewAccount.assignments, savedAssignment] });
      setSuccessMessage(`${savedAssignment.label} saved immediately.`);
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The teacher assignment could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const removeAssignment = async (index: number) => {
    if (!reviewAccount) return;
    const assignment = reviewAccount.assignments[index];
    if (!assignment) return;
    setBusy(true);
    setErrorMessage("");
    try {
      if (assignment.id) {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.from("teacher_assignments").delete().eq("id", assignment.id);
        if (error) throw error;
      }
      setReviewAccount({ ...reviewAccount, assignments: reviewAccount.assignments.filter((_, itemIndex) => itemIndex !== index) });
      setSuccessMessage(`${assignment.label} removed immediately.`);
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The teacher assignment could not be removed.");
    } finally {
      setBusy(false);
    }
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
  const tableAccounts = activeSection === "approvals"
    ? filteredAccounts.filter((account) => account.status === "Pending" || account.status === "Rejected")
    : filteredAccounts;
  const sectionCopy: Record<DashboardSection, { kicker: string; title: string; description: string }> = {
    approvals: { kicker: "Super Administration", title: "Account Approvals", description: "Review new teacher and administrator account requests." },
    accounts: { kicker: "Live school directory", title: "All Accounts", description: "Real teachers and administrators loaded securely from the school database." },
    roles: { kicker: "Access control", title: "Roles & Permissions", description: "See exactly what each school role is allowed to manage." },
    plans: { kicker: "Weekly-plan control", title: "Manage Public Plans", description: "Review and control the real weekly plans stored in the school database." },
    holidays: { kicker: "School calendar", title: "School-wide Holidays", description: "Mark a day as an official holiday for every class in one school week." },
    classes: { kicker: "School structure", title: "Classes & Subjects", description: "Live classes and weekly-plan subjects available for teacher assignments." },
    activity: { kicker: "Account history", title: "Activity Log", description: "Recent account registration, approval and access activity." },
    settings: { kicker: "Platform status", title: "System Settings", description: "Review the active platform configuration and connected services." },
  };
  const currentSection = sectionCopy[activeSection];

  const openSection = (section: DashboardSection) => {
    setActiveSection(section);
    setSearch("");
    setRoleFilter("All Roles");
    setStatusFilter("All Statuses");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const plansForSelectedWeek = useMemo(() => weeklyPlans.filter((plan) => plan.weekId === selectedPlanWeekId), [selectedPlanWeekId, weeklyPlans]);
  const holidaysForSelectedWeek = useMemo(() => schoolHolidays.filter((holiday) => holiday.week_id === selectedHolidayWeekId), [schoolHolidays, selectedHolidayWeekId]);

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

  const setPlanPublicationOverride = async (plan: ManagedPlan, shouldPublish: boolean) => {
    setBusy(true);
    setErrorMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("set_weekly_plan_publication_override", {
        target_plan_id: plan.id,
        should_publish: shouldPublish,
      });
      if (error) throw error;
      if (!data) throw new Error("The publication override was not applied.");
      setSuccessMessage(shouldPublish
        ? `${plan.className} was published by Super Admin override.`
        : `${plan.className} returned to the normal supervisor approval workflow.`);
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The publication override could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  const removeWeeklyPlan = async (plan: ManagedPlan) => {
    const confirmed = window.confirm(
      `Permanently delete ${plan.className} — ${plan.week}?\n\nThis removes the plan, lesson entries, quizzes, notes, and review submissions for this class and week. Staff accounts, assignments, and the timetable will not be affected.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setErrorMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("weekly_plans").delete().eq("id", plan.id);
      if (error) throw error;
      setSuccessMessage("Weekly plan deleted successfully.");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The weekly plan could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  const updateWeeklyPlanAccess = async (isOpen: boolean) => {
    setBusy(true);
    try {
      const { error } = await getSupabaseBrowserClient().from("weekly_plan_access_control").upsert({ id: 1, is_open: isOpen, updated_by: currentAdminId, updated_at: new Date().toISOString() });
      if (error) throw error;
      setWeeklyPlanCreationOpen(isOpen);
      setSuccessMessage(isOpen ? "Weekly plan creation is now open for teachers." : "Weekly plan creation is now closed for teachers.");
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "The weekly-plan access setting could not be saved."); }
    finally { setBusy(false); }
  };

  const updateTeacherPlanAccess = async (teacherId: string, isOpen: boolean) => {
    setBusy(true);
    try {
      const { error } = await getSupabaseBrowserClient().from("weekly_plan_teacher_access").upsert({ teacher_id: teacherId, is_open: isOpen, updated_by: currentAdminId, updated_at: new Date().toISOString() });
      if (error) throw error;
      setTeacherPlanAccess((current) => ({ ...current, [teacherId]: isOpen }));
      setSuccessMessage("Teacher weekly-plan access updated.");
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "The teacher access setting could not be saved."); }
    finally { setBusy(false); }
  };

  const openPlanEditor = async (plan: ManagedPlan) => {
    setEditorLoading(true); setErrorMessage("");
    try {
      const { data, error } = await getSupabaseBrowserClient().from("weekly_plans")
        .select("id, plan_entries(id, day_of_week, period_number, classwork, homework, classera_notes, subjects(parent_plan_name))")
        .eq("id", plan.id).maybeSingle();
      if (error || !data) throw error ?? new Error("Weekly plan could not be found.");
      const rawEntries = (data.plan_entries ?? []) as unknown as { id: string; day_of_week: number; period_number: number; classwork: string; homework: string; classera_notes: string; subjects: { parent_plan_name: string } | { parent_plan_name: string }[] | null }[];
      setEditingPlan({ id: plan.id, className: plan.className, week: plan.week, entries: rawEntries.sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number).map((entry) => ({ id: entry.id, day_of_week: entry.day_of_week, period_number: entry.period_number, course: singleRelation(entry.subjects)?.parent_plan_name ?? "Subject", classwork: entry.classwork ?? "", homework: entry.homework ?? "", classeraNotes: entry.classera_notes ?? "" })) });
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "The plan editor could not be opened."); }
    finally { setEditorLoading(false); }
  };

  const savePlanEdits = async () => {
    if (!editingPlan) return;
    setBusy(true); setErrorMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const results = await Promise.all(editingPlan.entries.map((entry) => supabase.from("plan_entries").update({ classwork: entry.classwork, homework: entry.homework, classera_notes: entry.classeraNotes, updated_at: new Date().toISOString() }).eq("id", entry.id)));
      const failed = results.find((result) => result.error)?.error;
      if (failed) throw failed;
      setEditingPlan(null); setSuccessMessage("The weekly plan was updated. Its publication status remains governed by the supervisor approval workflow.");
      await loadDashboard();
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "The weekly-plan changes could not be saved."); }
    finally { setBusy(false); }
  };

  const saveHoliday = async () => {
    if (!currentAdminId || !selectedHolidayWeekId) return;
    setBusy(true); setErrorMessage("");
    try {
      const { error } = await getSupabaseBrowserClient().from("weekly_plan_holidays").upsert({ week_id: selectedHolidayWeekId, day_of_week: Number(holidayDraft.dayOfWeek), title: holidayDraft.title.trim() || "Official Holiday", note: holidayDraft.note.trim() || null, created_by: currentAdminId }, { onConflict: "week_id,day_of_week" });
      if (error) throw error;
      setSuccessMessage("The school-wide holiday is now active for every class in this week.");
      await loadDashboard();
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "The holiday could not be saved."); }
    finally { setBusy(false); }
  };

  const deleteHoliday = async (holidayId: string) => {
    if (!window.confirm("Remove this school-wide holiday? Existing teacher content will remain saved.")) return;
    setBusy(true); setErrorMessage("");
    try {
      const { error } = await getSupabaseBrowserClient().from("weekly_plan_holidays").delete().eq("id", holidayId);
      if (error) throw error;
      setSuccessMessage("The holiday was removed. Teacher content was not deleted."); await loadDashboard();
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : "The holiday could not be removed."); }
    finally { setBusy(false); }
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
          <button className={activeSection === "approvals" ? "active" : ""} onClick={() => openSection("approvals")}><span className="teacher-nav-icon">AP</span>Account Approvals<small>{pendingCount}</small></button>
          <button className={activeSection === "accounts" ? "active" : ""} onClick={() => openSection("accounts")}><span className="teacher-nav-icon">AC</span>All Accounts</button>
          <button className={activeSection === "roles" ? "active" : ""} onClick={() => openSection("roles")}><span className="teacher-nav-icon">RL</span>Roles & Permissions</button>
          <button className={activeSection === "plans" ? "active" : ""} onClick={() => openSection("plans")}><span className="teacher-nav-icon">WP</span>Manage Public Plans</button>
          <button className={activeSection === "holidays" ? "active" : ""} onClick={() => openSection("holidays")}><span className="teacher-nav-icon">HD</span>School Holidays</button>
          <p>School System</p>
          <button className={activeSection === "classes" ? "active" : ""} onClick={() => openSection("classes")}><span className="teacher-nav-icon">CL</span>Classes & Subjects</button>
          <button className={activeSection === "activity" ? "active" : ""} onClick={() => openSection("activity")}><span className="teacher-nav-icon">LG</span>Activity Log</button>
          <button className={activeSection === "settings" ? "active" : ""} onClick={() => openSection("settings")}><span className="teacher-nav-icon">ST</span>System Settings</button>
        </nav>
        <div className="super-admin-permission-card"><span>SA</span><div><strong>Primary authority</strong><p>Approve accounts and control every school workspace.</p></div></div>
        <div className="teacher-sidebar-profile"><span className="teacher-avatar super-admin-avatar">MF</span><div><strong>{currentAdminName}</strong><small>Super Admin</small></div><button aria-label="Open profile menu">•••</button></div>
      </aside>

      <section className="teacher-main">
        <header className="teacher-topbar"><div className="teacher-mobile-brand"><img src={`${basePath}/school-logo.jpeg`} alt="" /><strong>Super Admin</strong></div><label className="teacher-search"><span>⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search real staff names or assignments" /></label><div className="teacher-top-actions"><span className="teacher-sync"><i /> Supabase connected</span><button className="teacher-icon-button" aria-label="Notifications">◇<b>{pendingCount}</b></button><button className="teacher-profile-chip"><span className="teacher-avatar super-admin-avatar">MF</span><span><strong>{currentAdminName}</strong><small>Super Admin</small></span></button></div></header>

        <div className="teacher-content super-admin-content">
          <div className="teacher-page-heading"><div><p className="teacher-kicker">{currentSection.kicker}</p><h1>{currentSection.title}</h1><span>{currentSection.description}</span></div>{activeSection !== "plans" && <button type="button" className="teacher-primary-button super-admin-plans-link" onClick={() => openSection("plans")}>Manage public weekly plans <span>→</span></button>}</div>

          {errorMessage && <p className="super-admin-live-message error" role="alert">{errorMessage}</p>}
          {successMessage && <p className="super-admin-live-message success" role="status">{successMessage}</p>}

          {(activeSection === "approvals" || activeSection === "accounts") && <>
            <section className="teacher-stats" aria-label="Account approval summary">
              <article><span className="stat-icon magenta">PN</span><div><small>Pending approval</small><strong>{pendingCount}</strong><p>Waiting for your decision</p></div></article>
              <article><span className="stat-icon cyan">AC</span><div><small>Active accounts</small><strong>{activeCount}</strong><p>Can access their workspace</p></div></article>
              <article><span className="stat-icon navy">NR</span><div><small>Not registered</small><strong>{notRegisteredCount}</strong><p>Listed staff without accounts</p></div></article>
              <article><span className="stat-icon amber">AD</span><div><small>Active admins</small><strong>{adminCount}</strong><p>Admin Control Center access</p></div></article>
            </section>

            <section className="teacher-card super-admin-accounts-card">
              <div className="super-admin-toolbar">
                <div><h2>{activeSection === "approvals" ? "Account requests requiring review" : "Real school staff directory"}</h2><p>{loading ? "Loading accounts from Supabase…" : `${tableAccounts.length} staff members shown`}</p></div>
                <label className="super-admin-mobile-search">Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or username" /></label>
                <div className="super-admin-filters"><label>Role<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>All Roles</option><option>Teacher</option><option>Admin</option></select></label><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All Statuses</option><option>Pending</option><option>Active</option><option>Suspended</option><option>Rejected</option><option>Not Registered</option></select></label></div>
              </div>
              <div className="super-admin-table-wrap"><table className="super-admin-table"><thead><tr><th>School Staff</th><th>Role</th><th>Department / Assignments</th><th>Requested</th><th>Status</th><th>Last Action</th><th>Actions</th></tr></thead><tbody>
                {loading && <tr><td className="super-empty" colSpan={7}>Loading the real school directory…</td></tr>}
                {!loading && tableAccounts.map((account) => (
                  <tr key={account.id}><td><div className="super-account-name"><span>{initials(account.name)}</span><div><strong>{account.name}</strong><small>{account.username === "Not registered" ? account.department : `@${account.username}`}</small></div></div></td><td><span className={`super-role ${account.role.toLowerCase()}`}>{account.role === "Teacher" ? "TC · Teacher" : "AD · Admin"}</span></td><td>{account.assignmentSummary}</td><td>{account.requested}</td><td><span className={`super-account-status ${account.status.toLowerCase().replace(" ", "-")}`}><i />{account.status}</span></td><td>{account.lastAction}</td><td><div className="super-row-actions">
                    {account.status === "Pending" || account.status === "Rejected" ? <button className="review" onClick={() => openAccount(account)}>Review</button> : null}
                    {account.status === "Active" || account.status === "Suspended" ? <><button className="manage" onClick={() => openAccount(account)}>Manage</button><Link href={account.role === "Admin" ? "/admin" : "/teachers"}>Open workspace</Link></> : null}
                    {account.status === "Not Registered" ? <span className="super-waiting-registration">Waiting for registration</span> : null}
                  </div></td></tr>
                ))}
                {!loading && tableAccounts.length === 0 && <tr><td className="super-empty" colSpan={7}>{activeSection === "approvals" ? "No account requests need your review right now." : "No real staff accounts match the selected filters."}</td></tr>}
              </tbody></table></div>
            </section>
          </>}

          {activeSection === "roles" && <section className="super-admin-section-grid">
            <article className="teacher-card super-system-card"><span>SA</span><h2>Super Admin</h2><p>Full school access: approves accounts, assigns classes and subjects, suspends users, manages every plan and controls platform settings.</p><strong>1 primary account</strong></article>
            <article className="teacher-card super-system-card"><span>VP</span><h2>Vice Principal</h2><p>School-wide administrative review access after account approval. Weekly-plan editing remains limited by the assigned admin scope.</p><strong>{accounts.filter((account) => account.administrativeRole === "Vice Principal").length} listed vice principals</strong></article>
            <article className="teacher-card super-system-card"><span>SP</span><h2>Department Supervisor</h2><p>Reviews only the teachers in the supervisor’s own department: English, Arabic & Social Studies, or Math & Science.</p><strong>{accounts.filter((account) => account.administrativeRole?.includes("Supervisor")).length} listed supervisors</strong></article>
            <article className="teacher-card super-system-card"><span>TC</span><h2>Teacher</h2><p>Creates weekly-plan content only for the classes and subjects assigned by the Super Admin.</p><strong>{accounts.filter((account) => account.role === "Teacher").length} listed teachers</strong></article>
          </section>}

          {activeSection === "plans" && <section className="teacher-card super-admin-accounts-card">
            <div className="super-admin-filters"><label>School week<select value={selectedPlanWeekId} onChange={(event) => setSelectedPlanWeekId(event.target.value)}>{academicWeeks.map((week) => <option key={week.id} value={week.id}>{week.label || `Week ${week.week_number}`}</option>)}</select></label><span className="super-waiting-registration">{plansForSelectedWeek.length} plans in this week</span></div>
            <div className="super-admin-toolbar"><div><h2>Real weekly-plan directory</h2><p>{weeklyPlans.length} plans stored in Supabase</p></div><Link className="teacher-primary-button super-admin-plans-link" href="/weekly-plan">Open family plan page <span>→</span></Link></div>
            <div className="super-admin-table-wrap"><table className="super-admin-table"><thead><tr><th>Week</th><th>Class</th><th>Class Teacher</th><th>Entries</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
              {plansForSelectedWeek.map((plan) => <tr key={plan.id}><td><strong>{plan.week}</strong></td><td>{plan.className}</td><td>{plan.classTeacher}</td><td>{plan.entries}</td><td><span className={`super-account-status ${plan.status}`}><i />{plan.status}</span>{plan.manualPublicationOverride ? <small className="super-plan-override-note">Super Admin override</small> : null}</td><td>{plan.updated}</td><td><div className="super-row-actions"><Link href="/weekly-plan">View</Link><button disabled={busy || editorLoading} className="manage" onClick={() => void openPlanEditor(plan)}>{editorLoading ? "Opening…" : "Edit plan"}</button><button disabled={busy} className={plan.manualPublicationOverride ? "super-plan-delete" : "review"} onClick={() => void setPlanPublicationOverride(plan, !plan.manualPublicationOverride)}>{plan.manualPublicationOverride ? "Remove override" : "Force publish"}</button><button disabled={busy} className="super-plan-delete" onClick={() => void removeWeeklyPlan(plan)}>Delete plan</button></div></td></tr>)}
              {!loading && plansForSelectedWeek.length === 0 && <tr><td className="super-empty" colSpan={7}>No weekly plans were created for the selected school week.</td></tr>}
            </tbody></table></div>
          </section>}

          {activeSection === "holidays" && <section className="teacher-card super-admin-accounts-card">
            <div className="super-admin-toolbar"><div><h2>School-wide holiday control</h2><p>A holiday replaces that day&apos;s lessons for every class. Saved teacher content is kept safely in the database.</p></div></div>
            <div className="super-assignment-picker super-holiday-editor"><label>School week<select value={selectedHolidayWeekId} onChange={(event) => setSelectedHolidayWeekId(event.target.value)}>{academicWeeks.map((week) => <option key={week.id} value={week.id}>{week.label || `Week ${week.week_number}`}</option>)}</select></label><label>Day<select value={holidayDraft.dayOfWeek} onChange={(event) => setHolidayDraft({ ...holidayDraft, dayOfWeek: event.target.value })}>{holidayDays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>Holiday title<input value={holidayDraft.title} onChange={(event) => setHolidayDraft({ ...holidayDraft, title: event.target.value })} /></label><label>Family note<input value={holidayDraft.note} onChange={(event) => setHolidayDraft({ ...holidayDraft, note: event.target.value })} placeholder="Optional parent-facing note" /></label><button disabled={busy || !selectedHolidayWeekId} type="button" className="teacher-primary-button" onClick={() => void saveHoliday()}>{busy ? "Saving…" : "Save holiday"}</button></div>
            <div className="super-assignment-list">{holidaysForSelectedWeek.map((holiday) => <span key={holiday.id}><strong>{holidayDays[holiday.day_of_week]}: {holiday.title}</strong>{holiday.note ? <small>{holiday.note}</small> : null}<button disabled={busy} type="button" onClick={() => void deleteHoliday(holiday.id)} aria-label="Remove holiday">×</button></span>)}{holidaysForSelectedWeek.length === 0 && <small>No school-wide holidays are set for this week.</small>}</div>
          </section>}

          {activeSection === "classes" && <section className="super-admin-structure-layout">
            <article className="teacher-card super-structure-card"><div><h2>School Classes</h2><p>{classes.length} active class sections</p></div><div className="super-class-chip-grid">{classes.map((schoolClass) => <span key={schoolClass.id}>Grade {schoolClass.grade}<b>{schoolClass.section}</b></span>)}</div></article>
            <article className="teacher-card super-structure-card"><div><h2>Weekly-plan Subjects</h2><p>{subjects.length} active subjects available for assignments</p></div><div className="super-subject-list">{subjects.map((subject) => <span key={subject.id}><strong>{subject.name_en}</strong><small>Grades {subject.minimum_grade}–{subject.maximum_grade}</small></span>)}</div></article>
          </section>}

          {activeSection === "activity" && <section className="teacher-card super-activity-card"><div><h2>Recent Account Activity</h2><p>Registration and approval activity from the live directory.</p></div><ul>{accounts.filter((account) => account.status !== "Not Registered").map((account) => <li key={account.id}><span>{initials(account.name)}</span><div><strong>{account.name}</strong><small>{account.lastAction}</small></div><time>{account.requested}</time></li>)}</ul>{accounts.every((account) => account.status === "Not Registered") && <div className="super-section-empty"><span>LG</span><strong>No staff account activity yet</strong><p>New registration requests and your approval actions will appear here.</p></div>}</section>}

          {activeSection === "settings" && <section className="super-admin-section-grid">
            <article className="teacher-card super-system-card super-access-control-card"><span>WP</span><h2>Weekly-plan creation access</h2><p>Open or close plan creation for all teachers, then set individual exceptions.</p><strong>{weeklyPlanCreationOpen ? "Open for teachers" : "Closed for teachers"}</strong><button type="button" disabled={busy} className="teacher-primary-button" onClick={() => void updateWeeklyPlanAccess(!weeklyPlanCreationOpen)}>{weeklyPlanCreationOpen ? "Close creation" : "Open creation"}</button><div className="super-teacher-access-list">{accounts.filter((account) => account.role === "Teacher" && account.userId).map((account) => { const isOpen = teacherPlanAccess[account.userId as string] ?? weeklyPlanCreationOpen; return <label key={account.userId}><span>{account.name}<small>@{account.username}</small></span><input type="checkbox" checked={isOpen} disabled={busy} onChange={(event) => void updateTeacherPlanAccess(account.userId as string, event.target.checked)} /><b>{isOpen ? "Open" : "Closed"}</b></label>; })}</div></article>
            <article className="teacher-card super-system-card connected"><span>DB</span><h2>Database</h2><p>Supabase is connected and the protected school directory is available.</p><strong>Connected</strong></article>
            <article className="teacher-card super-system-card"><span>AY</span><h2>Academic Year</h2><p>The dashboard and weekly-plan workspace are prepared for the current school year.</p><strong>2026–2027</strong></article>
            <article className="teacher-card super-system-card"><span>RG</span><h2>Grades & Sections</h2><p>Two sections are available for every grade from Grade 1 through Grade 10.</p><strong>{classes.length} active classes</strong></article>
            <article className="teacher-card super-system-card"><span>SC</span><h2>Security</h2><p>Role-based access and Row Level Security protect staff-only database operations.</p><strong>Access control active</strong></article>
          </section>}
        </div>
      </section>

      {editingPlan && (
        <div className="teacher-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && setEditingPlan(null)}>
          <section className="teacher-editor-modal super-review-modal" role="dialog" aria-modal="true" aria-labelledby="edit-plan-title">
            <div className="teacher-modal-heading"><div><p>Super Admin editor</p><h2 id="edit-plan-title">{editingPlan.className} · {editingPlan.week}</h2></div><button disabled={busy} aria-label="Close editor" onClick={() => setEditingPlan(null)}>×</button></div>
            <p className="super-assignment-help">Changes are saved directly to the approved paper layout. Publication still follows the required supervisor approval workflow.</p>
            <div className="super-plan-editor-list">{editingPlan.entries.map((entry, index) => <article key={entry.id}><header><strong>{holidayDays[entry.day_of_week]} · Period {entry.period_number}</strong><span>{entry.course}</span></header><label>Classwork<textarea rows={2} value={entry.classwork} onChange={(event) => setEditingPlan((current) => current ? { ...current, entries: current.entries.map((item, itemIndex) => itemIndex === index ? { ...item, classwork: event.target.value } : item) } : current)} /></label><label>Homework<textarea rows={2} value={entry.homework} onChange={(event) => setEditingPlan((current) => current ? { ...current, entries: current.entries.map((item, itemIndex) => itemIndex === index ? { ...item, homework: event.target.value } : item) } : current)} /></label><label>Classera notes<textarea rows={2} value={entry.classeraNotes} onChange={(event) => setEditingPlan((current) => current ? { ...current, entries: current.entries.map((item, itemIndex) => itemIndex === index ? { ...item, classeraNotes: event.target.value } : item) } : current)} /></label></article>)}</div>
            <div className="teacher-editor-footer"><button disabled={busy} type="button" className="teacher-secondary-button" onClick={() => setEditingPlan(null)}>Cancel</button><button disabled={busy} type="button" className="teacher-primary-button" onClick={() => void savePlanEdits()}>{busy ? "Saving…" : "Save changes"}</button></div>
          </section>
        </div>
      )}

      {reviewAccount && (
        <div className="teacher-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && setReviewAccount(null)}>
          <section className="teacher-editor-modal super-review-modal" role="dialog" aria-modal="true" aria-labelledby="review-account-title">
            <div className="teacher-modal-heading"><div><p>{reviewAccount.status === "Pending" || reviewAccount.status === "Rejected" ? "Super Admin approval" : "Live account management"}</p><h2 id="review-account-title">{reviewAccount.status === "Pending" || reviewAccount.status === "Rejected" ? "Review account request" : "Manage real staff account"}</h2></div><button disabled={busy} aria-label="Close review" onClick={() => setReviewAccount(null)}>×</button></div>
            <div className="super-review-profile"><span>{initials(reviewAccount.name)}</span><div><strong>{reviewAccount.name}</strong><small>{reviewAccount.username === "Not registered" ? reviewAccount.department : `@${reviewAccount.username}`} · {reviewAccount.status}</small></div></div>
            <form onSubmit={(event) => { event.preventDefault(); if (reviewAccount.status === "Pending" || reviewAccount.status === "Rejected") void reviewRequest("approved"); else setReviewAccount(null); }}>
              <div className="super-review-grid"><div><small>School role</small><strong>{reviewAccount.administrativeRole ?? reviewAccount.role}</strong></div><div><small>Department</small><strong>{reviewAccount.department}</strong></div></div>

              {(reviewAccount.status === "Pending" || reviewAccount.status === "Rejected") && <div className="super-review-note"><span>SA</span><p>Approving this request creates the real active profile and sends this user to the correct dashboard. The account role comes from the approved school directory and cannot be changed by the applicant.</p></div>}

              {(reviewAccount.status === "Active" || reviewAccount.status === "Suspended") && (reviewAccount.role === "Teacher" || reviewAccount.administrativeRole?.includes("Supervisor")) && <div className="super-assignment-manager"><label>Teaching Classes & Subjects</label><div className="super-assignment-picker"><label>Class<select disabled={busy} value={assignmentDraft.classId} onChange={(event) => { const classId = event.target.value; const schoolClass = classes.find((item) => item.id === classId); const firstCompatible = subjects.find((subject) => schoolClass && schoolClass.grade >= subject.minimum_grade && schoolClass.grade <= subject.maximum_grade); setAssignmentDraft({ classId, subjectId: firstCompatible?.id ?? "" }); }}>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>Grade {schoolClass.grade} {schoolClass.section}</option>)}</select></label><label>Subject<select disabled={busy} value={assignmentDraft.subjectId} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, subjectId: event.target.value })}>{compatibleSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name_en}</option>)}</select></label><button disabled={busy || !assignmentDraft.subjectId} type="button" className="teacher-secondary-button" onClick={() => void addAssignment()}>{busy ? "Saving…" : "Add & save assignment"}</button></div><div className="super-assignment-list">{reviewAccount.assignments.map((assignment, index) => <span key={`${assignment.id ?? "new"}-${assignment.classId}-${assignment.subjectId}`}>{assignment.label}<button disabled={busy} type="button" aria-label={`Remove ${assignment.label}`} onClick={() => void removeAssignment(index)}>×</button></span>)}{reviewAccount.assignments.length === 0 && <small>No classes or subjects assigned yet.</small>}</div><p className="super-assignment-help">Every addition or removal is saved to Supabase immediately. The teacher or supervisor will see it after refreshing their workspace.</p></div>}

              {(reviewAccount.status === "Active" || reviewAccount.status === "Suspended") && reviewAccount.role === "Admin" && <div className="super-review-note"><span>AD</span><p>{reviewAccount.administrativeRole ?? "Administrator"} · {reviewAccount.department}. Admin scope is assigned from the approved school directory.</p></div>}

              {(reviewAccount.status === "Active" || reviewAccount.status === "Suspended") && reviewAccount.userId && <section className="super-password-reset"><div><small>Account recovery</small><h3>Set a temporary password</h3><p>Use this only when a staff member cannot sign in. Share the new password privately; it is never stored in this page.</p></div><label>Temporary password<input type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></label><button disabled={busy || temporaryPassword.length < 8} type="button" className="teacher-primary-button" onClick={() => void resetAccountPassword()}>{busy ? "Saving…" : "Reset password"}</button>{passwordResetMessage && <p className={`super-password-reset-message ${passwordResetTone}`} role={passwordResetTone === "error" ? "alert" : "status"}>{passwordResetMessage}</p>}</section>}

              <div className="teacher-editor-footer">
                {reviewAccount.status === "Pending" || reviewAccount.status === "Rejected" ? <button disabled={busy || reviewAccount.status === "Rejected"} type="button" className="super-reject-button" onClick={() => void reviewRequest("rejected")}>Reject request</button> : <button disabled={busy} type="button" className="super-reject-button" onClick={() => void toggleAccountStatus()}>{reviewAccount.status === "Suspended" ? "Reactivate account" : "Suspend account"}</button>}
                <div><button disabled={busy} type="button" className="teacher-secondary-button" onClick={() => setReviewAccount(null)}>{(reviewAccount.role === "Teacher" || reviewAccount.administrativeRole?.includes("Supervisor")) && reviewAccount.status === "Active" ? "Done" : "Cancel"}</button>{(reviewAccount.status === "Pending" || reviewAccount.status === "Rejected" || (reviewAccount.role === "Admin" && !reviewAccount.administrativeRole?.includes("Supervisor"))) && <button disabled={busy} type="submit" className="teacher-primary-button">{busy ? "Saving…" : reviewAccount.status === "Pending" || reviewAccount.status === "Rejected" ? "Approve account" : "Close"}</button>}</div>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
