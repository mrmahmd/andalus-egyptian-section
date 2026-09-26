"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffLanguagePreference } from "../language-switcher";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { formatAcademicWeekRange } from "../../lib/format-academic-week";

type AccountRole = "Teacher" | "Admin";
type AccountStatus = "Not Registered" | "Pending" | "Active" | "Suspended" | "Rejected";
type DashboardSection = "approvals" | "accounts" | "roles" | "plans" | "weeks" | "holidays" | "classes" | "activity" | "settings";

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

type TimetableRequirement = {
  classId: string;
  teacherId: string;
  department: string;
  subjectId: string;
  subjectName: string;
};

type PlanSubmissionSummary = {
  id: string;
  weeklyPlanId: string;
  teacherId: string;
  subjectId: string;
  subjectName: string;
  status: "draft" | "submitted" | "changes_requested" | "approved";
  reviewNote: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

type PlanEntrySummary = {
  weeklyPlanId: string;
  teacherId: string;
  subjectId: string;
  hasContent: boolean;
};

type SupervisorLink = { supervisorStaffId: string; teacherStaffId: string };
type PlanTrackingStatus = "not_started" | "draft" | "submitted" | "changes_requested" | "approved_waiting" | "published";

type PlanTrackingRow = {
  key: string;
  classId: string;
  grade: number;
  section: string;
  teacher: ManagedAccount;
  supervisorName: string;
  department: string;
  subjects: string[];
  status: PlanTrackingStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string;
};

type ClassCoverage = {
  classId: string;
  grade: number;
  section: string;
  plan: ManagedPlan | null;
  requiredTeachers: ManagedAccount[];
  completedTeachers: ManagedAccount[];
  missingTeachers: ManagedAccount[];
  publishedTeachers: ManagedAccount[];
  publicationState: "not_published" | "partially_published" | "fully_published";
  completionPercent: number;
  departments: string[];
};

type AcademicWeekOption = { id: string; week_number: number; label: string; starts_on: string; ends_on: string; is_current: boolean; teacher_entry_enabled: boolean; parent_portal_visible: boolean };
type SchoolHoliday = { id: string; week_id: string; day_of_week: number; title: string; note: string | null };
type EditableEntry = { id: string; day_of_week: number; period_number: number; course: string; classwork: string; homework: string; classeraNotes: string };
type EditablePlan = { id: string; className: string; week: string; entries: EditableEntry[] };

const holidayDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

function localWeekVisibilityPreview(): AcademicWeekOption[] {
  return Array.from({ length: 17 }, (_, index) => {
    const start = new Date(Date.UTC(2026, 8, 6 + index * 7));
    const end = new Date(Date.UTC(2026, 8, 12 + index * 7));
    const dateValue = (value: Date) => value.toISOString().slice(0, 10);
    return {
      id: `local-preview-week-${index + 1}`,
      week_number: index + 1,
      label: `Week ${index + 1}`,
      starts_on: dateValue(start),
      ends_on: dateValue(end),
      is_current: index === 3,
      teacher_entry_enabled: index === 3,
      parent_portal_visible: index < 3,
    };
  });
}

function singleRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function waitingDuration(value: string | null) {
  if (!value) return "—";
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (hours < 1) return "Less than one hour";
  if (hours < 24) return `${hours} hours waiting`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} waiting`;
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
  const [timetableRequirements, setTimetableRequirements] = useState<TimetableRequirement[]>([]);
  const [planSubmissions, setPlanSubmissions] = useState<PlanSubmissionSummary[]>([]);
  const [planEntrySummaries, setPlanEntrySummaries] = useState<PlanEntrySummary[]>([]);
  const [supervisorLinks, setSupervisorLinks] = useState<SupervisorLink[]>([]);
  const [academicWeeks, setAcademicWeeks] = useState<AcademicWeekOption[]>([]);
  const [schoolHolidays, setSchoolHolidays] = useState<SchoolHoliday[]>([]);
  const [selectedPlanWeekId, setSelectedPlanWeekId] = useState("");
  const [planGradeFilter, setPlanGradeFilter] = useState("all");
  const [planSectionFilter, setPlanSectionFilter] = useState("all");
  const [planDepartmentFilter, setPlanDepartmentFilter] = useState("all");
  const [planPublicationFilter, setPlanPublicationFilter] = useState("all");
  const [planTrackingStatusFilter, setPlanTrackingStatusFilter] = useState("all");
  const [bulkPublishConfirmationOpen, setBulkPublishConfirmationOpen] = useState(false);
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
  const [ownPassword, setOwnPassword] = useState({ current: "", next: "", confirm: "" });
  const [ownPasswordMessage, setOwnPasswordMessage] = useState("");
  const [ownPasswordTone, setOwnPasswordTone] = useState<"success" | "error" | "info">("info");
  const [weeklyPlanCreationOpen, setWeeklyPlanCreationOpen] = useState(true);
  const [teacherPlanAccess, setTeacherPlanAccess] = useState<Record<string, boolean>>({});
  const [localPreview, setLocalPreview] = useState(false);

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

      const [directoryResult, requestsResult, profilesResult, assignmentsResult, subjectsResult, classesResult, plansResult, accessResult, teacherAccessResult, weeksResult, holidaysResult, timetableResult, submissionsResult, planEntriesResult, supervisorLinksResult] = await Promise.all([
        supabase.from("staff_directory").select("id, full_name, account_kind, administrative_role, department_id, departments(name_en)").eq("is_active", true).order("full_name"),
        supabase.from("registration_requests").select("id, user_id, staff_id, username, status, requested_at, reviewed_at").order("requested_at", { ascending: false }),
        supabase.from("profiles").select("user_id, staff_id, username, display_name, role, status, approved_at, updated_at"),
        supabase.from("teacher_assignments").select("id, teacher_id, class_id, subject_id, school_classes(grade, section), subjects(name_en)"),
        supabase.from("subjects").select("id, name_en, minimum_grade, maximum_grade").eq("is_active", true).eq("include_in_weekly_plan", true).order("name_en"),
        supabase.from("school_classes").select("id, grade, section").eq("is_active", true).order("grade").order("section"),
        supabase.from("weekly_plans").select("id, class_id, week_id, class_teacher_name, status, manual_publication_override, updated_at, school_classes(grade, section), academic_weeks(week_number, label), plan_entries(count)").order("updated_at", { ascending: false }),
        supabase.from("weekly_plan_access_control").select("is_open").eq("id", 1).maybeSingle(),
        supabase.from("weekly_plan_teacher_access").select("teacher_id, is_open"),
        supabase.from("academic_weeks").select("id, week_number, label, starts_on, ends_on, is_current, teacher_entry_enabled, parent_portal_visible").order("week_number"),
        supabase.from("weekly_plan_holidays").select("id, week_id, day_of_week, title, note").order("day_of_week"),
        supabase.from("timetable_slots").select("class_id, teacher_id, subject_id, requires_weekly_plan_submission, subjects(name_en)").eq("requires_weekly_plan_submission", true),
        supabase.from("plan_submissions").select("id, weekly_plan_id, teacher_id, subject_id, status, review_note, submitted_at, reviewed_at, updated_at, subjects(name_en)"),
        supabase.from("plan_entries").select("weekly_plan_id, teacher_id, subject_id, classwork, homework, classera_notes"),
        supabase.from("supervisor_staff_links").select("supervisor_staff_id, teacher_staff_id"),
      ]);

      const firstError = [directoryResult.error, requestsResult.error, profilesResult.error, assignmentsResult.error, subjectsResult.error, classesResult.error, plansResult.error, weeksResult.error, holidaysResult.error, timetableResult.error, submissionsResult.error, planEntriesResult.error, supervisorLinksResult.error].find(Boolean);
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
      const activeAccountsByUser = new Map(realAccounts.filter((account) => account.userId && account.status === "Active").map((account) => [account.userId as string, account]));
      setTimetableRequirements((timetableResult.data ?? []).flatMap((slot) => {
        const teacherId = slot.teacher_id ? String(slot.teacher_id) : "";
        const account = activeAccountsByUser.get(teacherId);
        const subject = singleRelation(slot.subjects as { name_en: string } | { name_en: string }[] | null);
        return teacherId && account ? [{ classId: String(slot.class_id), teacherId, department: account.department, subjectId: String(slot.subject_id), subjectName: subject?.name_en ?? "Subject" }] : [];
      }));
      setPlanSubmissions((submissionsResult.data ?? []).map((submission) => ({
        id: String(submission.id),
        weeklyPlanId: String(submission.weekly_plan_id),
        teacherId: String(submission.teacher_id),
        subjectId: String(submission.subject_id),
        subjectName: singleRelation(submission.subjects as { name_en: string } | { name_en: string }[] | null)?.name_en ?? "Subject",
        status: submission.status as PlanSubmissionSummary["status"],
        reviewNote: String(submission.review_note ?? ""),
        submittedAt: submission.submitted_at ? String(submission.submitted_at) : null,
        reviewedAt: submission.reviewed_at ? String(submission.reviewed_at) : null,
        updatedAt: String(submission.updated_at),
      })));
      const entrySummaries = new Map<string, PlanEntrySummary>();
      for (const entry of planEntriesResult.data ?? []) {
        const weeklyPlanId = String(entry.weekly_plan_id);
        const teacherId = String(entry.teacher_id);
        const subjectId = String(entry.subject_id);
        const key = `${weeklyPlanId}:${teacherId}:${subjectId}`;
        const hasContent = [entry.classwork, entry.homework, entry.classera_notes].some((value) => String(value ?? "").trim().length > 0);
        const current = entrySummaries.get(key);
        entrySummaries.set(key, { weeklyPlanId, teacherId, subjectId, hasContent: Boolean(current?.hasContent || hasContent) });
      }
      setPlanEntrySummaries(Array.from(entrySummaries.values()));
      setSupervisorLinks((supervisorLinksResult.data ?? []).map((link) => ({ supervisorStaffId: String(link.supervisor_staff_id), teacherStaffId: String(link.teacher_staff_id) })));
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
    const previewRequested = ["localhost", "127.0.0.1"].includes(window.location.hostname)
      && new URLSearchParams(window.location.search).get("preview") === "week-visibility";
    if (previewRequested) {
      setLocalPreview(true);
      setActiveSection("weeks");
      setAcademicWeeks(localWeekVisibilityPreview());
      setLoading(false);
      return;
    }
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
    weeks: { kicker: "Academic-week access", title: "Week Visibility Control", description: "Choose which weeks teachers can edit and which published weeks families can see." },
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

  const planDepartments = useMemo(() => Array.from(new Set(timetableRequirements.map((requirement) => requirement.department))).sort(), [timetableRequirements]);
  const selectedPlanWeek = academicWeeks.find((week) => week.id === selectedPlanWeekId) ?? null;
  const weeklyClassCoverage = useMemo<ClassCoverage[]>(() => {
    const plansByClass = new Map(weeklyPlans.filter((plan) => plan.weekId === selectedPlanWeekId).map((plan) => [plan.classId, plan]));
    const accountsByUser = new Map(accounts.filter((account) => account.userId).map((account) => [account.userId as string, account]));
    return classes.map((schoolClass) => {
      const requirements = timetableRequirements.filter((requirement) => requirement.classId === schoolClass.id);
      const requiredTeacherIds = Array.from(new Set(requirements.map((requirement) => requirement.teacherId)));
      const plan = plansByClass.get(schoolClass.id) ?? null;
      const completedTeacherIds = new Set(planSubmissions
        .filter((submission) => submission.weeklyPlanId === plan?.id && (submission.status === "submitted" || submission.status === "approved"))
        .map((submission) => submission.teacherId));
      const meaningfulEntryKeys = new Set(planEntrySummaries
        .filter((entry) => entry.weeklyPlanId === plan?.id && entry.hasContent)
        .map((entry) => `${entry.teacherId}:${entry.subjectId}`));
      const publishedTeacherIds = new Set(plan?.status === "published" && selectedPlanWeek?.parent_portal_visible
        ? planSubmissions
          .filter((submission) => submission.weeklyPlanId === plan.id && submission.status === "approved" && meaningfulEntryKeys.has(`${submission.teacherId}:${submission.subjectId}`))
          .map((submission) => submission.teacherId)
        : []);
      const requiredTeachers = requiredTeacherIds.flatMap((teacherId) => accountsByUser.get(teacherId) ? [accountsByUser.get(teacherId) as ManagedAccount] : []);
      const completedTeachers = requiredTeachers.filter((teacher) => teacher.userId && completedTeacherIds.has(teacher.userId));
      const missingTeachers = requiredTeachers.filter((teacher) => !teacher.userId || !completedTeacherIds.has(teacher.userId));
      const publishedTeachers = requiredTeachers.filter((teacher) => teacher.userId && publishedTeacherIds.has(teacher.userId));
      const publicationState: ClassCoverage["publicationState"] = publishedTeachers.length === 0
        ? "not_published"
        : publishedTeachers.length === requiredTeachers.length && requiredTeachers.length > 0
          ? "fully_published"
          : "partially_published";
      return {
        classId: schoolClass.id,
        grade: schoolClass.grade,
        section: schoolClass.section,
        plan,
        requiredTeachers,
        completedTeachers,
        missingTeachers,
        publishedTeachers,
        publicationState,
        completionPercent: requiredTeachers.length > 0 ? Math.round((completedTeachers.length / requiredTeachers.length) * 100) : 0,
        departments: Array.from(new Set(requirements.map((requirement) => requirement.department))).sort(),
      };
    }).sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section));
  }, [accounts, classes, planEntrySummaries, planSubmissions, selectedPlanWeek?.parent_portal_visible, selectedPlanWeekId, timetableRequirements, weeklyPlans]);
  const planTrackingRows = useMemo<PlanTrackingRow[]>(() => {
    const accountsByUser = new Map(accounts.filter((account) => account.userId).map((account) => [account.userId as string, account]));
    const accountsByStaff = new Map(accounts.map((account) => [account.staffId, account]));
    const planByClass = new Map(weeklyPlans.filter((plan) => plan.weekId === selectedPlanWeekId).map((plan) => [plan.classId, plan]));
    const classById = new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass]));
    const supervisorNamesByTeacherStaff = new Map<string, string[]>();
    supervisorLinks.forEach((link) => {
      const supervisor = accountsByStaff.get(link.supervisorStaffId);
      if (!supervisor) return;
      const names = supervisorNamesByTeacherStaff.get(link.teacherStaffId) ?? [];
      if (!names.includes(supervisor.name)) names.push(supervisor.name);
      supervisorNamesByTeacherStaff.set(link.teacherStaffId, names);
    });

    const teacherClassRequirements = new Map<string, TimetableRequirement[]>();
    timetableRequirements.forEach((requirement) => {
      const key = `${requirement.classId}:${requirement.teacherId}`;
      const rows = teacherClassRequirements.get(key) ?? [];
      rows.push(requirement);
      teacherClassRequirements.set(key, rows);
    });

    return Array.from(teacherClassRequirements.entries()).flatMap(([key, requirements]) => {
      const first = requirements[0];
      const teacher = accountsByUser.get(first.teacherId);
      const schoolClass = classById.get(first.classId);
      if (!teacher || !schoolClass) return [];
      const plan = planByClass.get(first.classId) ?? null;
      const submissions = planSubmissions.filter((submission) => submission.weeklyPlanId === plan?.id && submission.teacherId === first.teacherId);
      const meaningfulSubjectIds = new Set(planEntrySummaries
        .filter((entry) => entry.weeklyPlanId === plan?.id && entry.teacherId === first.teacherId && entry.hasContent)
        .map((entry) => entry.subjectId));
      const meaningfulSubmissions = submissions.filter((submission) => meaningfulSubjectIds.has(submission.subjectId));
      const latestSubmission = submissions.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
      let status: PlanTrackingStatus = "not_started";
      if (meaningfulSubmissions.some((submission) => submission.status === "changes_requested")) status = "changes_requested";
      else if (meaningfulSubmissions.some((submission) => submission.status === "submitted")) status = "submitted";
      else if (meaningfulSubmissions.some((submission) => submission.status === "draft")) status = "draft";
      else if (meaningfulSubmissions.some((submission) => submission.status === "approved")) status = plan?.status === "published" && selectedPlanWeek?.parent_portal_visible ? "published" : "approved_waiting";
      const submittedDates = submissions.map((submission) => submission.submittedAt).filter((value): value is string => Boolean(value)).sort();
      const reviewedDates = submissions.map((submission) => submission.reviewedAt).filter((value): value is string => Boolean(value)).sort();
      return [{
        key,
        classId: first.classId,
        grade: schoolClass.grade,
        section: schoolClass.section,
        teacher,
        supervisorName: (supervisorNamesByTeacherStaff.get(teacher.staffId) ?? []).join(" + ") || "Not assigned",
        department: teacher.department,
        subjects: Array.from(new Set([...requirements.map((requirement) => requirement.subjectName), ...submissions.map((submission) => submission.subjectName)])).sort(),
        status,
        submittedAt: submittedDates.at(-1) ?? null,
        reviewedAt: reviewedDates.at(-1) ?? null,
        reviewNote: latestSubmission?.reviewNote ?? "",
      }];
    }).sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section) || a.teacher.name.localeCompare(b.teacher.name));
  }, [accounts, classes, planEntrySummaries, planSubmissions, selectedPlanWeek?.parent_portal_visible, selectedPlanWeekId, supervisorLinks, timetableRequirements, weeklyPlans]);
  const filteredPlanTrackingRows = useMemo(() => planTrackingRows.filter((row) => (
    (planGradeFilter === "all" || String(row.grade) === planGradeFilter)
    && (planSectionFilter === "all" || row.section === planSectionFilter)
    && (planDepartmentFilter === "all" || row.department === planDepartmentFilter)
    && (planTrackingStatusFilter === "all" || row.status === planTrackingStatusFilter)
  )), [planDepartmentFilter, planGradeFilter, planSectionFilter, planTrackingRows, planTrackingStatusFilter]);
  const trackingStatusCounts = useMemo(() => planTrackingRows.reduce<Record<PlanTrackingStatus, number>>((counts, row) => ({ ...counts, [row.status]: counts[row.status] + 1 }), {
    not_started: 0, draft: 0, submitted: 0, changes_requested: 0, approved_waiting: 0, published: 0,
  }), [planTrackingRows]);
  const filteredClassCoverage = useMemo(() => weeklyClassCoverage.filter((coverage) => {
    const published = coverage.publicationState !== "not_published";
    return (planGradeFilter === "all" || String(coverage.grade) === planGradeFilter)
      && (planSectionFilter === "all" || coverage.section === planSectionFilter)
      && (planDepartmentFilter === "all" || coverage.departments.includes(planDepartmentFilter))
      && (planPublicationFilter === "all"
        || (planPublicationFilter === "fully_published" && coverage.publicationState === "fully_published")
        || (planPublicationFilter === "partially_published" && coverage.publicationState === "partially_published")
        || (planPublicationFilter === "unpublished" && !published));
  }), [planDepartmentFilter, planGradeFilter, planPublicationFilter, planSectionFilter, weeklyClassCoverage]);
  const fullyPublishedClassCount = weeklyClassCoverage.filter((coverage) => coverage.publicationState === "fully_published").length;
  const partiallyPublishedClassCount = weeklyClassCoverage.filter((coverage) => coverage.publicationState === "partially_published").length;
  const unpublishedClassCount = weeklyClassCoverage.filter((coverage) => coverage.publicationState === "not_published").length;
  const fullyCompletedClassCount = weeklyClassCoverage.filter((coverage) => coverage.completionPercent === 100).length;
  const requiredTeacherClassCount = weeklyClassCoverage.reduce((total, coverage) => total + coverage.requiredTeachers.length, 0);
  const completedTeacherClassCount = weeklyClassCoverage.reduce((total, coverage) => total + coverage.completedTeachers.length, 0);
  const schoolWeeklyCompletionPercent = requiredTeacherClassCount > 0 ? Math.round((completedTeacherClassCount / requiredTeacherClassCount) * 100) : 0;
  const schoolWeeklyPublicationPercent = requiredTeacherClassCount > 0
    ? Math.round((weeklyClassCoverage.reduce((total, coverage) => total + coverage.publishedTeachers.length, 0) / requiredTeacherClassCount) * 100)
    : 0;
  const bulkPublishCandidates = weeklyClassCoverage.filter((coverage) => coverage.plan && coverage.plan.entries > 0 && coverage.plan.status !== "published");
  const holidaysForSelectedWeek = useMemo(() => schoolHolidays.filter((holiday) => holiday.week_id === selectedHolidayWeekId), [schoolHolidays, selectedHolidayWeekId]);

  const changeOwnPassword = async () => {
    const arabicUi = typeof window !== "undefined" && window.localStorage.getItem("andalus-language") === "ar";
    setOwnPasswordMessage("");
    if (!ownPassword.current) {
      setOwnPasswordTone("error");
      setOwnPasswordMessage(arabicUi ? "أدخل كلمة المرور الحالية." : "Enter your current password.");
      return;
    }
    if (ownPassword.next.length < 8) {
      setOwnPasswordTone("error");
      setOwnPasswordMessage(arabicUi ? "يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف." : "The new password must contain at least 8 characters.");
      return;
    }
    if (ownPassword.next !== ownPassword.confirm) {
      setOwnPasswordTone("error");
      setOwnPasswordMessage(arabicUi ? "كلمة المرور الجديدة وتأكيدها غير متطابقين." : "The new password and confirmation do not match.");
      return;
    }
    setBusy(true);
    setOwnPasswordTone("info");
    setOwnPasswordMessage(arabicUi ? "جارٍ تحديث كلمة المرور بأمان…" : "Updating your password securely…");
    try {
      const { error } = await getSupabaseBrowserClient().auth.updateUser({ password: ownPassword.next, current_password: ownPassword.current });
      if (error) throw error;
      setOwnPassword({ current: "", next: "", confirm: "" });
      setOwnPasswordTone("success");
      setOwnPasswordMessage(arabicUi ? "تم تغيير كلمة مرور حساب السوبر أدمن بنجاح." : "Your Super Admin password was changed successfully.");
    } catch (error) {
      setOwnPasswordTone("error");
      setOwnPasswordMessage(error instanceof Error ? (arabicUi ? `تعذر تغيير كلمة المرور: ${error.message}` : error.message) : (arabicUi ? "تعذر تغيير كلمة المرور." : "Your password could not be changed."));
    } finally {
      setBusy(false);
    }
  };

  const publishAllSchoolPlans = async () => {
    if (!selectedPlanWeekId) return;
    setBulkPublishConfirmationOpen(false);
    setBusy(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const results = await Promise.all(bulkPublishCandidates.map((coverage) => supabase.rpc("set_weekly_plan_publication_override", {
        target_plan_id: coverage.plan?.id as string,
        should_publish: true,
      })));
      const failedResults = results.filter((result) => result.error);
      const publishedCount = results.length - failedResults.length;
      await loadDashboard();
      if (failedResults.length > 0) {
        setErrorMessage(`${publishedCount} plans were published, but ${failedResults.length} plans could not be published. ${failedResults[0].error?.message ?? "Please try those plans again."}`);
      } else {
        setSuccessMessage(`${publishedCount} non-empty class plans were approved and published by Super Admin override. Empty and unstarted classes remain unpublished.`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The school-wide publication action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

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
    const arabicUi = typeof window !== "undefined" && window.localStorage.getItem("andalus-language") === "ar";
    const confirmed = window.confirm(
      arabicUi
        ? `حذف ${plan.className} — ${plan.week} نهائيًا؟\n\nسيؤدي ذلك إلى حذف الخطة وإدخالات الحصص والاختبارات والملاحظات وطلبات المراجعة لهذا الفصل والأسبوع. لن تتأثر حسابات الموظفين أو التكليفات أو جدول الحصص.`
        : `Permanently delete ${plan.className} — ${plan.week}?\n\nThis removes the plan, lesson entries, quizzes, notes, and review submissions for this class and week. Staff accounts, assignments, and the timetable will not be affected.`,
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

  const updateAcademicWeekVisibility = async (weekId: string, field: "teacher_entry_enabled" | "parent_portal_visible", value: boolean) => {
    setBusy(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      if (localPreview) {
        setAcademicWeeks((current) => current.map((week) => week.id === weekId ? { ...week, [field]: value } : week));
        setSuccessMessage("Local preview only — no school data was changed.");
        return;
      }
      const { data: savedWeek, error } = await getSupabaseBrowserClient().from("academic_weeks")
        .update({ [field]: value })
        .eq("id", weekId)
        .select("id, teacher_entry_enabled, parent_portal_visible")
        .single();
      if (error) throw error;
      if (!savedWeek || savedWeek[field] !== value) throw new Error("The saved week setting could not be verified. Please refresh and try again.");
      setAcademicWeeks((current) => current.map((week) => week.id === weekId ? { ...week, teacher_entry_enabled: savedWeek.teacher_entry_enabled, parent_portal_visible: savedWeek.parent_portal_visible } : week));
      const week = academicWeeks.find((item) => item.id === weekId);
      const weekName = `Week ${week?.week_number ?? ""}`.trim();
      setSuccessMessage(field === "teacher_entry_enabled"
        ? `${weekName} is now ${value ? "open" : "closed"} for teacher entry. Existing work was not changed.`
        : `${weekName} is now ${value ? "visible" : "hidden"} on the parent portal. Publication data was not changed.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The academic-week visibility setting could not be saved.");
    } finally {
      setBusy(false);
    }
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
    const arabicUi = typeof window !== "undefined" && window.localStorage.getItem("andalus-language") === "ar";
    if (!window.confirm(arabicUi ? "إزالة هذه الإجازة العامة؟ سيظل محتوى المعلمين محفوظًا." : "Remove this school-wide holiday? Existing teacher content will remain saved.")) return;
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
        <div className="teacher-brand"><img src={`${basePath}/school-logo.png`} alt="AlAndalus Private Schools" /><div><strong>ALANDALUS</strong><span>Super Admin Control Center</span></div></div>
        <div className="teacher-school-year"><span>Academic year</span><strong>2026–2027</strong></div>
        <nav className="teacher-nav" aria-label="Super administrator navigation">
          <p>Super Administration</p>
          <button className={activeSection === "approvals" ? "active" : ""} onClick={() => openSection("approvals")}><span className="teacher-nav-icon">AP</span>Account Approvals<small>{pendingCount}</small></button>
          <button className={activeSection === "accounts" ? "active" : ""} onClick={() => openSection("accounts")}><span className="teacher-nav-icon">AC</span>All Accounts</button>
          <button className={activeSection === "roles" ? "active" : ""} onClick={() => openSection("roles")}><span className="teacher-nav-icon">RL</span>Roles & Permissions</button>
          <button className={activeSection === "plans" ? "active" : ""} onClick={() => openSection("plans")}><span className="teacher-nav-icon">WP</span>Manage Public Plans</button>
          <button className={activeSection === "weeks" ? "active" : ""} onClick={() => openSection("weeks")}><span className="teacher-nav-icon">WK</span>Week Visibility</button>
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
        <header className="teacher-topbar"><div className="teacher-mobile-brand"><img src={`${basePath}/school-logo.png`} alt="" /><strong>Super Admin</strong></div><label className="teacher-search"><span>⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search real staff names or assignments" /></label><div className="teacher-top-actions"><span className="teacher-sync"><i /> Supabase connected</span><button className="teacher-icon-button" aria-label="Notifications">◇<b>{pendingCount}</b></button><button className="teacher-profile-chip"><span className="teacher-avatar super-admin-avatar">MF</span><span><strong>{currentAdminName}</strong><small>Super Admin</small></span></button></div></header>

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
                <div className="super-admin-filters"><label>Role<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="All Roles">All Roles</option><option value="Teacher">Teacher</option><option value="Admin">Admin</option></select></label><label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="All Statuses">All Statuses</option><option value="Pending">Pending</option><option value="Active">Active</option><option value="Suspended">Suspended</option><option value="Rejected">Rejected</option><option value="Not Registered">Not Registered</option></select></label></div>
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

          {activeSection === "plans" && <>
            <section className="super-plan-report-summary" aria-label="Weekly publication report">
              <article><small>Fully published classes</small><strong>{fullyPublishedClassCount}<em> / {weeklyClassCoverage.length}</em></strong><p>Every assigned teacher is visible</p></article>
              <article><small>Partially published</small><strong>{partiallyPublishedClassCount}</strong><p>Approved teachers are visible; missing teachers stay blank</p></article>
              <article><small>Not published</small><strong>{unpublishedClassCount}</strong><p>Includes plans still being written or reviewed</p></article>
              <article><small>100% teacher completion</small><strong>{fullyCompletedClassCount}</strong><p>Every assigned teacher sent a weekly plan</p></article>
              <article className="overall completion"><small>School weekly-plan completion</small><strong>{schoolWeeklyCompletionPercent}%</strong><div><i style={{ width: `${schoolWeeklyCompletionPercent}%` }} /></div><p>Selected week: <b>{selectedPlanWeek?.label || `Week ${selectedPlanWeek?.week_number ?? "—"}`}</b></p></article>
              <article className="overall publication"><small>School publication rate</small><strong>{schoolWeeklyPublicationPercent}%</strong><div><i style={{ width: `${schoolWeeklyPublicationPercent}%` }} /></div><p>Selected week: <b>{selectedPlanWeek?.label || `Week ${selectedPlanWeek?.week_number ?? "—"}`}</b></p></article>
            </section>

            <section className="teacher-card super-admin-accounts-card super-plan-report-card">
              <div className="super-admin-toolbar super-plan-report-toolbar"><div><h2>Weekly school publication report</h2><p>Teacher completion counts each teacher once, regardless of how many subjects they teach.</p></div><div className="super-plan-report-actions"><Link className="teacher-secondary-button" href="/weekly-plan">Open family plan page</Link><button type="button" className="teacher-primary-button super-bulk-publish-button" disabled={busy || bulkPublishCandidates.length === 0} onClick={() => setBulkPublishConfirmationOpen(true)}>Approve & publish all school plans</button></div></div>
              <div className="super-admin-filters super-plan-report-filters">
                <label>School week<select value={selectedPlanWeekId} onChange={(event) => setSelectedPlanWeekId(event.target.value)}>{academicWeeks.map((week) => <option key={week.id} value={week.id}>{week.label || `Week ${week.week_number}`}</option>)}</select></label>
                <label>Grade<select value={planGradeFilter} onChange={(event) => setPlanGradeFilter(event.target.value)}><option value="all">All grades</option>{Array.from(new Set(classes.map((schoolClass) => schoolClass.grade))).map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label>
                <label>Section<select value={planSectionFilter} onChange={(event) => setPlanSectionFilter(event.target.value)}><option value="all">All sections</option>{Array.from(new Set(classes.map((schoolClass) => schoolClass.section))).sort().map((section) => <option key={section} value={section}>Section {section}</option>)}</select></label>
                <label>Department<select value={planDepartmentFilter} onChange={(event) => setPlanDepartmentFilter(event.target.value)}><option value="all">All departments</option>{planDepartments.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
                <label>Publication<select value={planPublicationFilter} onChange={(event) => setPlanPublicationFilter(event.target.value)}><option value="all">All classes</option><option value="fully_published">Fully published</option><option value="partially_published">Partially published</option><option value="unpublished">Not published</option></select></label>
                <span className="super-waiting-registration">{filteredClassCoverage.length} classes shown</span>
              </div>
              <div className="super-admin-table-wrap"><table className="super-admin-table super-plan-report-table"><thead><tr><th>Class</th><th>Teacher completion</th><th>Teachers</th><th>Publication</th><th>Entries</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
                {filteredClassCoverage.map((coverage) => {
                  const plan = coverage.plan;
                  const published = coverage.publicationState !== "not_published";
                  const statusLabel = coverage.publicationState === "fully_published"
                    ? "Fully published"
                    : coverage.publicationState === "partially_published"
                      ? `Partially published · ${coverage.publishedTeachers.length} of ${coverage.requiredTeachers.length} teachers`
                      : plan ? coverage.completedTeachers.length > 0 ? "Awaiting remaining approvals" : "Draft started" : "Not started";
                  return <tr key={coverage.classId}><td><strong>Grade {coverage.grade} · {coverage.section}</strong><small className="super-plan-class-departments">{coverage.departments.join(" · ") || "No required weekly-plan teachers"}</small></td><td><div className="super-class-completion"><strong>{coverage.completionPercent}%</strong><div><i style={{ width: `${coverage.completionPercent}%` }} /></div><small>{coverage.completedTeachers.length} of {coverage.requiredTeachers.length} teachers completed</small></div></td><td><details className="super-plan-teacher-details"><summary>View teacher status</summary><div>{coverage.completedTeachers.map((teacher) => <span className="complete" key={teacher.userId}>✓ {teacher.name}</span>)}{coverage.missingTeachers.map((teacher) => <span className="missing" key={teacher.userId}>○ {teacher.name}</span>)}{coverage.requiredTeachers.length === 0 && <span>No assigned teachers</span>}</div></details></td><td><span className={`super-account-status ${published ? "published" : "draft"}`}><i />{statusLabel}</span>{plan?.manualPublicationOverride ? <small className="super-plan-override-note">Super Admin override</small> : null}</td><td>{plan?.entries ?? 0}</td><td>{plan?.updated ?? "—"}</td><td>{plan ? <div className="super-row-actions"><Link href={`/weekly-plan/?grade=${coverage.grade}&section=${coverage.section}&week=${academicWeeks.find((week) => week.id === selectedPlanWeekId)?.week_number ?? 1}`}>View</Link><button disabled={busy || editorLoading} className="manage" onClick={() => void openPlanEditor(plan)}>{editorLoading ? "Opening…" : "Edit"}</button><button disabled={busy} className={plan.manualPublicationOverride ? "super-plan-delete" : "review"} onClick={() => void setPlanPublicationOverride(plan, !plan.manualPublicationOverride)}>{plan.manualPublicationOverride ? "Remove override" : "Force publish"}</button><button disabled={busy} className="super-plan-delete" onClick={() => void removeWeeklyPlan(plan)}>Delete</button></div> : <span className="super-waiting-registration">Waiting for teachers</span>}</td></tr>;
                })}
                {!loading && filteredClassCoverage.length === 0 && <tr><td className="super-empty" colSpan={7}>No classes match the selected filters.</td></tr>}
              </tbody></table></div>
            </section>

            <section className="teacher-card super-admin-accounts-card super-plan-tracking-card">
              <div className="super-admin-toolbar super-plan-tracking-heading"><div><p className="teacher-kicker">Plan approval route</p><h2>Track every teacher plan</h2><span>Each row reflects that teacher&apos;s own work only; a partially published class never marks every teacher as published.</span></div><label>Route status<select value={planTrackingStatusFilter} onChange={(event) => setPlanTrackingStatusFilter(event.target.value)}><option value="all">All route statuses</option><option value="not_started">Not started</option><option value="draft">Draft — not sent</option><option value="submitted">Waiting for supervisor</option><option value="changes_requested">Returned for changes</option><option value="approved_waiting">Approved — publication pending</option><option value="published">This teacher&apos;s plan is public</option></select></label></div>
              <div className="super-plan-tracking-counts" aria-label="Teacher plan route summary">
                <button type="button" className={planTrackingStatusFilter === "not_started" ? "active not-started" : "not-started"} onClick={() => setPlanTrackingStatusFilter("not_started")}><strong>{trackingStatusCounts.not_started}</strong><span>Not started</span></button>
                <button type="button" className={planTrackingStatusFilter === "draft" ? "active draft" : "draft"} onClick={() => setPlanTrackingStatusFilter("draft")}><strong>{trackingStatusCounts.draft}</strong><span>Drafts not sent</span></button>
                <button type="button" className={planTrackingStatusFilter === "submitted" ? "active submitted" : "submitted"} onClick={() => setPlanTrackingStatusFilter("submitted")}><strong>{trackingStatusCounts.submitted}</strong><span>Waiting for supervisor</span></button>
                <button type="button" className={planTrackingStatusFilter === "changes_requested" ? "active changes" : "changes"} onClick={() => setPlanTrackingStatusFilter("changes_requested")}><strong>{trackingStatusCounts.changes_requested}</strong><span>Returned for changes</span></button>
                <button type="button" className={planTrackingStatusFilter === "approved_waiting" ? "active approved" : "approved"} onClick={() => setPlanTrackingStatusFilter("approved_waiting")}><strong>{trackingStatusCounts.approved_waiting}</strong><span>Approved, publication pending</span></button>
                <button type="button" className={planTrackingStatusFilter === "published" ? "active published" : "published"} onClick={() => setPlanTrackingStatusFilter("published")}><strong>{trackingStatusCounts.published}</strong><span>Teacher plans public</span></button>
                {planTrackingStatusFilter !== "all" && <button type="button" className="clear" onClick={() => setPlanTrackingStatusFilter("all")}><strong>×</strong><span>Show all</span></button>}
              </div>
              <div className="super-admin-table-wrap"><table className="super-admin-table super-plan-tracking-table"><thead><tr><th>Teacher</th><th>Class & subjects</th><th>Responsible supervisor</th><th>Current stage</th><th>Sent / waiting</th><th>Plan route</th></tr></thead><tbody>
                {filteredPlanTrackingRows.map((row) => {
                  const stageLabel = row.status === "not_started" ? "Not started"
                    : row.status === "draft" ? "Draft — not sent"
                      : row.status === "submitted" ? `Waiting for ${row.supervisorName}`
                        : row.status === "changes_requested" ? "Returned for changes"
                          : row.status === "approved_waiting" ? "Approved — publication pending"
                            : "This teacher's plan is visible to families";
                  const sent = row.submittedAt ? formatDateTime(row.submittedAt) : "Not sent";
                  return <tr key={row.key}><td><div className="super-account-name"><span>{initials(row.teacher.name)}</span><div><strong>{row.teacher.name}</strong><small>{row.department}</small></div></div></td><td><strong>Grade {row.grade} · {row.section}</strong><small className="super-plan-class-departments">{row.subjects.join(" · ")}</small></td><td><strong>{row.supervisorName}</strong></td><td><span className={`super-tracking-status ${row.status}`}><i />{stageLabel}</span>{row.reviewNote && <small className="super-tracking-review-note">Supervisor note: {row.reviewNote}</small>}</td><td><strong>{sent}</strong>{row.status === "submitted" && <small className="super-tracking-wait">{waitingDuration(row.submittedAt)}</small>}</td><td><details className="super-plan-route"><summary>View route</summary><ol><li className={row.status !== "not_started" ? "done" : "current"}><i />Plan started</li><li className={["submitted", "changes_requested", "approved_waiting", "published"].includes(row.status) ? "done" : row.status === "draft" ? "current" : ""}><i />Sent to supervisor</li><li className={["approved_waiting", "published"].includes(row.status) ? "done" : ["submitted", "changes_requested"].includes(row.status) ? "current" : ""}><i />Supervisor decision{row.reviewedAt ? <small>{formatDateTime(row.reviewedAt)}</small> : null}</li><li className={row.status === "published" ? "done" : row.status === "approved_waiting" ? "current" : ""}><i />Published for families</li></ol></details></td></tr>;
                })}
                {!loading && filteredPlanTrackingRows.length === 0 && <tr><td className="super-empty" colSpan={6}>No teacher plans match the selected route filters.</td></tr>}
              </tbody></table></div>
            </section>
          </>}

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

          {activeSection === "weeks" && <section className="teacher-card super-week-visibility-card">
            <div className="super-week-visibility-heading"><div><span>WK</span><div><h2>Academic-week visibility</h2><p>Teacher entry and parent visibility are independent. Closing either switch never deletes plans, submissions, approvals, or published content.</p></div></div><div><strong>{academicWeeks.filter((week) => week.teacher_entry_enabled).length}</strong><small>open for teachers</small><strong>{academicWeeks.filter((week) => week.parent_portal_visible).length}</strong><small>visible to parents</small></div></div>
            <div className="super-week-visibility-list">{academicWeeks.map((week) => <article key={week.id}><div className="super-week-identity"><span>{String(week.week_number).padStart(2, "0")}</span><div><strong>Week {week.week_number}</strong><small>{formatAcademicWeekRange(week)}</small></div></div><label className={week.teacher_entry_enabled ? "enabled" : "disabled"}><span><strong>Teacher entry</strong><small>{week.teacher_entry_enabled ? "Teachers can write and submit" : "Hidden and locked for teachers"}</small></span><input type="checkbox" checked={week.teacher_entry_enabled} disabled={busy} onChange={(event) => void updateAcademicWeekVisibility(week.id, "teacher_entry_enabled", event.target.checked)} /><b>{week.teacher_entry_enabled ? "Open" : "Closed"}</b></label><label className={week.parent_portal_visible ? "enabled" : "disabled"}><span><strong>Parent portal</strong><small>{week.parent_portal_visible ? "Published plans can be viewed" : "Hidden even when published"}</small></span><input type="checkbox" checked={week.parent_portal_visible} disabled={busy} onChange={(event) => void updateAcademicWeekVisibility(week.id, "parent_portal_visible", event.target.checked)} /><b>{week.parent_portal_visible ? "Visible" : "Hidden"}</b></label></article>)}</div>
          </section>}

          {activeSection === "settings" && <section className="super-admin-section-grid">
            <StaffLanguagePreference />
            <article className="teacher-card super-system-card super-own-password-card"><span>PW</span><h2>Change my password</h2><p>Confirm your current password, then choose a new password for this Super Admin account.</p><div className="super-own-password-fields"><label>Current password<input type="password" value={ownPassword.current} onChange={(event) => setOwnPassword({ ...ownPassword, current: event.target.value })} autoComplete="current-password" /></label><label>New password<input type="password" value={ownPassword.next} onChange={(event) => setOwnPassword({ ...ownPassword, next: event.target.value })} minLength={8} autoComplete="new-password" /></label><label>Confirm new password<input type="password" value={ownPassword.confirm} onChange={(event) => setOwnPassword({ ...ownPassword, confirm: event.target.value })} minLength={8} autoComplete="new-password" /></label></div><button type="button" disabled={busy || !ownPassword.current || ownPassword.next.length < 8 || ownPassword.next !== ownPassword.confirm} className="teacher-primary-button" onClick={() => void changeOwnPassword()}>{busy ? "Updating…" : "Change my password"}</button>{ownPasswordMessage && <div className={`super-password-reset-message ${ownPasswordTone}`} role={ownPasswordTone === "error" ? "alert" : "status"}>{ownPasswordMessage}</div>}</article>
            <article className="teacher-card super-system-card super-access-control-card"><span>WP</span><h2>Weekly-plan creation access</h2><p>Open or close plan creation for all teachers, then set individual exceptions.</p><strong>{weeklyPlanCreationOpen ? "Open for teachers" : "Closed for teachers"}</strong><button type="button" disabled={busy} className="teacher-primary-button" onClick={() => void updateWeeklyPlanAccess(!weeklyPlanCreationOpen)}>{weeklyPlanCreationOpen ? "Close creation" : "Open creation"}</button><div className="super-teacher-access-list">{accounts.filter((account) => account.role === "Teacher" && account.userId).map((account) => { const isOpen = teacherPlanAccess[account.userId as string] ?? weeklyPlanCreationOpen; return <label key={account.userId}><span>{account.name}<small>@{account.username}</small></span><input type="checkbox" checked={isOpen} disabled={busy} onChange={(event) => void updateTeacherPlanAccess(account.userId as string, event.target.checked)} /><b>{isOpen ? "Open" : "Closed"}</b></label>; })}</div></article>
            <article className="teacher-card super-system-card connected"><span>DB</span><h2>Database</h2><p>Supabase is connected and the protected school directory is available.</p><strong>Connected</strong></article>
            <article className="teacher-card super-system-card"><span>AY</span><h2>Academic Year</h2><p>The dashboard and weekly-plan workspace are prepared for the current school year.</p><strong>2026–2027</strong></article>
            <article className="teacher-card super-system-card"><span>RG</span><h2>Grades & Sections</h2><p>Two sections are available for every grade from Grade 1 through Grade 10.</p><strong>{classes.length} active classes</strong></article>
            <article className="teacher-card super-system-card"><span>SC</span><h2>Security</h2><p>Role-based access and Row Level Security protect staff-only database operations.</p><strong>Access control active</strong></article>
          </section>}
        </div>
      </section>

      {bulkPublishConfirmationOpen && <div className="weekly-send-confirmation-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setBulkPublishConfirmationOpen(false)}><section className="weekly-send-confirmation super-bulk-publish-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="bulk-school-publish-title"><span aria-hidden="true">SA</span><h3 id="bulk-school-publish-title">Approve and publish the whole school week?</h3><p>This Super Admin override will publish every non-empty class plan in <strong>{academicWeeks.find((week) => week.id === selectedPlanWeekId)?.label ?? "the selected week"}</strong>. Empty or unstarted classes remain unpublished, and the teacher-completion report remains unchanged so missing teachers stay visible.</p><div className="super-bulk-publish-summary"><strong>{bulkPublishCandidates.length}<small>plans ready to force publish</small></strong><strong>{unpublishedClassCount}<small>classes currently not published</small></strong><strong>{weeklyClassCoverage.filter((coverage) => coverage.completionPercent < 100).length}<small>classes below 100% teacher completion</small></strong></div><div><button type="button" className="teacher-secondary-button" onClick={() => setBulkPublishConfirmationOpen(false)}>Cancel</button><button type="button" className="teacher-primary-button" disabled={busy || bulkPublishCandidates.length === 0} onClick={() => void publishAllSchoolPlans()}>Yes, approve and publish</button></div></section></div>}

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
