"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StaffLanguagePreference } from "../language-switcher";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { delegatedStaffId, getStaffWorkspaceClient } from "../../lib/supabase/staff-workspace";
import { formatAcademicWeekRange } from "../../lib/format-academic-week";
import FaridQuizzesPanel from "./farid-quizzes-panel";
import ClosedWeekAlert from "./closed-week-alert";
import "../exceptional-publication.css";

const navigation = [
  ["Overview", "OV"],
  ["Weekly Plans", "WP"],
  ["My Timetable", "TT"],
  ["My Classes", "CL"],
  ["My Subjects", "SB"],
  ["Calendar", "CA"],
] as const;
const faridNavigation = [...navigation, ["Quizzes", "QZ"] as const] as const;

const supervisorNavigation = [
  ["Overview", "OV"],
  ["Teacher Reviews", "RV"],
  ["Weekly Plans", "WP"],
  ["My Timetable", "TT"],
  ["Department Teachers", "DT"],
] as const;

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const arabicDayNames: Record<string, string> = { Sunday: "الأحد", Monday: "الاثنين", Tuesday: "الثلاثاء", Wednesday: "الأربعاء", Thursday: "الخميس" };
const dictationNotePrefix = "__ENGLISH_DICTATION__";

type EnglishDictation = { day: number; words: string[] };

function parseDictationWords(value: string) {
  return Array.from(new Set(value.split(/[\n,،;]+/).map((word) => word.trim()).filter(Boolean)));
}

function encodeEnglishDictation(day: string, words: string) {
  return `${dictationNotePrefix}${JSON.stringify({ day: Number(day), words: parseDictationWords(words) })}`;
}

function parseEnglishDictation(value: string): EnglishDictation | null {
  if (!value.startsWith(dictationNotePrefix)) return null;
  try {
    const parsed = JSON.parse(value.slice(dictationNotePrefix.length)) as EnglishDictation;
    return Number.isInteger(parsed.day) && parsed.day >= 0 && parsed.day <= 4 && Array.isArray(parsed.words)
      ? { day: parsed.day, words: parsed.words.map(String).map((word) => word.trim()).filter(Boolean) }
      : null;
  } catch {
    return null;
  }
}

function chunkWords(words: string[], size = 4) {
  return Array.from({ length: Math.ceil(words.length / size) }, (_, index) => words.slice(index * size, index * size + size));
}

type Assignment = {
  id: string;
  classId: string;
  subjectId: string;
  grade: number;
  section: string;
  subject: string;
};

type AcademicWeek = {
  id: string;
  week_number: number;
  label: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
  teacher_entry_enabled: boolean;
  parent_portal_visible: boolean;
};
type SchoolHoliday = { id: string; week_id: string; day_of_week: number; title: string; note: string | null };

type TimetableSlot = {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  day_of_week: number;
  period_number: number;
  requires_weekly_plan_submission: boolean;
};

type PersonalTimetableSlot = TimetableSlot & { className: string; subject: string };

function assignedPlanSlotsForWeek(slots: TimetableSlot[], teacherAssignments: Assignment[], teacherId: string, classId: string, week: AcademicWeek | undefined, holidays: SchoolHoliday[]) {
  const classAssignments = teacherAssignments.filter((assignment) => assignment.classId === classId);
  const schoolClass = classAssignments[0];
  const classSlots = slots.filter((slot) => slot.class_id === classId);
  const sundayPeriodSix = classSlots.find((slot) => slot.day_of_week === 0 && slot.period_number === 6);
  const tuesdayPeriodOne = classSlots.find((slot) => slot.day_of_week === 2 && slot.period_number === 1);
  const preservePreWeekFive5B = schoolClass?.grade === 5 && schoolClass.section === "B" && (week?.week_number ?? 5) < 5 && sundayPeriodSix && tuesdayPeriodOne;
  return classSlots
    .map((slot) => {
      if (!preservePreWeekFive5B) return slot;
      if (slot.id === sundayPeriodSix.id) return { ...slot, subject_id: tuesdayPeriodOne.subject_id };
      if (slot.id === tuesdayPeriodOne.id) return { ...slot, subject_id: sundayPeriodSix.subject_id };
      return slot;
    })
    .filter((slot) => {
      const assignedSubject = classAssignments.some((assignment) => assignment.subjectId === slot.subject_id);
      const historicalSwapSlot = Boolean(preservePreWeekFive5B && (slot.id === sundayPeriodSix.id || slot.id === tuesdayPeriodOne.id));
      const assignedTeacher = historicalSwapSlot ? assignedSubject : String(slot.teacher_id) === teacherId && assignedSubject;
      return assignedTeacher && !holidays.some((holiday) => holiday.week_id === week?.id && holiday.day_of_week === slot.day_of_week);
    })
    .sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number);
}

type ParentPreviewSlot = Omit<TimetableSlot, "teacher_id"> & {
  subject: string;
};

type TeacherEntry = {
  id: string;
  timetableSlotId: string | null;
  weeklyPlanId: string;
  classId: string;
  weekId: string;
  subjectId: string;
  day: string;
  dayOfWeek: number;
  periodNumber: number;
  className: string;
  subject: string;
  week: string;
  status: string;
  publicationStatus: string;
  updated: string;
  hasMeaningfulContent: boolean;
  hasClasswork: boolean;
};

type MySubmission = {
  id: string;
  weeklyPlanId: string;
  classId: string;
  weekId: string;
  subjectId: string;
  className: string;
  week: string;
  subject: string;
  status: "draft" | "submitted" | "changes_requested" | "approved";
  reviewNote: string;
};

type ReviewItem = {
  id: string;
  weeklyPlanId: string;
  teacherId: string;
  subjectId: string;
  weekId: string;
  classId: string;
  teacherName: string;
  subject: string;
  className: string;
  week: string;
  status: string;
  note: string;
  submittedAt: string;
  entries: { day: string; period: number; subject: string; classwork: string; homework: string; notes: string }[];
  quizzes: { subject: string; date: string; details: string }[];
  weeklyNotes: string[];
};

type SupervisorPlanReview = {
  key: string;
  weeklyPlanId: string;
  teacherId: string;
  weekId: string;
  classId: string;
  teacherName: string;
  className: string;
  week: string;
  status: "submitted" | "changes_requested" | "approved";
  submittedAt: string;
  note: string;
  reviews: ReviewItem[];
  entries: ReviewItem["entries"];
  quizzes: ReviewItem["quizzes"];
  weeklyNotes: string[];
};

type SlotDraft = { classwork: string; homework: string; classeraNotes: string; englishProgramme: string; scienceComponent: string };
type ApprovedLessonSnapshot = { classwork: string; homework: string; classera_notes: string };
type SchoolClass = { id: string; grade: number; section: string };
type SchoolSubject = { id: string; name_en: string };
type DepartmentTeacher = { userId: string; name: string; assignments: Assignment[] };
type WeeklyPlanRow = { planId: string; classId: string; weekId: string; className: string; week: string; subjects: string[]; lessonCount: number; status: string; publicationStatus: string; updated: string };
type CopyConflict = { targetPlanId: string; targetLabel: string };
type CopyTargetClass = Assignment & { lessonCount: number };
type EditorCompletionKind = "draft" | "submitted" | "approved" | "published_edit" | "approved_edit" | "error";

const emptySlotDraft = (): SlotDraft => ({ classwork: "", homework: "", classeraNotes: "", englishProgramme: "", scienceComponent: "" });
const scienceComponents = ["Chemistry", "Physics", "Biology"];
const englishProgrammes = ["AL", "OL"];

function isEnglishSubject(subject: string) {
  return subject === "English" || subject.startsWith("English ") || ["Connect Plus", "Hello Plus", "Hello", "Upstream"].includes(subject);
}

function splitEnglishClasswork(value: string) {
  const match = value.match(/^(AL|OL)\s*(?:—|-)\s*/i);
  return {
    programme: match?.[1]?.toUpperCase() ?? "",
    classwork: match ? value.slice(match[0].length) : value,
  };
}

function formatEnglishClasswork(programme: string, value: string) {
  const classwork = splitEnglishClasswork(value.trim()).classwork.trim();
  return programme && classwork ? `${programme} - ${classwork}` : classwork;
}

function hasMeaningfulPlanContent(row: { classwork?: string | null; homework?: string | null; classera_notes?: string | null }) {
  return [row.classwork, row.homework, row.classera_notes].some((value) => String(value ?? "").trim().length > 0);
}
function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function academicWeekRange(week: AcademicWeek, isArabic = false) {
  return formatAcademicWeekRange(week, isArabic ? "ar-EG" : "en-GB");
}

function reviewStatusLabel(status: string, arabic: boolean) {
  if (!arabic) return status.replaceAll("_", " ");
  return status === "approved" ? "معتمدة" : status === "changes_requested" ? "مطلوب تعديل" : status === "submitted" ? "مرسلة للمراجعة" : status;
}

export default function TeachersDashboardPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [activeNav, setActiveNav] = useState("Overview");
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [weeklyBuilderOpen, setWeeklyBuilderOpen] = useState(false);
  const [weeklyBuilderReadOnly, setWeeklyBuilderReadOnly] = useState(false);
  const [publishedEditPlanId, setPublishedEditPlanId] = useState("");
  const [approvedEditPublished, setApprovedEditPublished] = useState(false);
  const [publishedEditConfirmationOpen, setPublishedEditConfirmationOpen] = useState(false);
  const [compactWeeklyBuilder, setCompactWeeklyBuilder] = useState(false);
  const [selectedBuilderDay, setSelectedBuilderDay] = useState(0);
  const [profileId, setProfileId] = useState("");
  const [workingOnBehalf, setWorkingOnBehalf] = useState(false);
  const [isFaridTeacher, setIsFaridTeacher] = useState(false);
  const [teacherName, setTeacherName] = useState("Teacher");
  const [departmentName, setDepartmentName] = useState("Teacher Department");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [academicWeeks, setAcademicWeeks] = useState<AcademicWeek[]>([]);
  const [schoolHolidays, setSchoolHolidays] = useState<SchoolHoliday[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [personalTimetable, setPersonalTimetable] = useState<PersonalTimetableSlot[]>([]);
  const [dashboardWeekId, setDashboardWeekId] = useState("");
  const [planViewFilter, setPlanViewFilter] = useState<"all" | "needs_action" | "submitted" | "approved">("all");
  const [entries, setEntries] = useState<TeacherEntry[]>([]);
  const [mySubmissions, setMySubmissions] = useState<MySubmission[]>([]);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [selectedReviewWeekId, setSelectedReviewWeekId] = useState("");
  const [selectedReviewClassId, setSelectedReviewClassId] = useState("");
  const [bulkApprovalConfirmationOpen, setBulkApprovalConfirmationOpen] = useState(false);
  const [bulkApprovalArabic, setBulkApprovalArabic] = useState(false);
  const [dashboardArabic, setDashboardArabic] = useState(false);
  const [departmentTeachers, setDepartmentTeachers] = useState<DepartmentTeacher[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);
  const [schoolSubjects, setSchoolSubjects] = useState<SchoolSubject[]>([]);
  const [selectedDepartmentTeacherId, setSelectedDepartmentTeacherId] = useState("");
  const [departmentAssignmentDraft, setDepartmentAssignmentDraft] = useState({ classId: "", subjectId: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const editorSaveInProgress = useRef(false);
  const approvedLessonSnapshot = useRef<Record<string, ApprovedLessonSnapshot>>({});
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");
  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [slotDrafts, setSlotDrafts] = useState<Record<string, SlotDraft>>({});
  const [quizDay, setQuizDay] = useState("2");
  const [quizDetails, setQuizDetails] = useState("");
  const [quizSubjectId, setQuizSubjectId] = useState("");
  const [dictationDay, setDictationDay] = useState("0");
  const [dictationWords, setDictationWords] = useState("");
  const [weeklyPlanCreationOpen, setWeeklyPlanCreationOpen] = useState(true);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [builderFeedback, setBuilderFeedback] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [builderHydrated, setBuilderHydrated] = useState(false);
  const autoSaveTimer = useRef<number | null>(null);
  const autoSavedSignature = useRef("");
  const pendingSupervisorSubmission = useRef(false);
  const [savedPlanId, setSavedPlanId] = useState("");
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copySourcePlan, setCopySourcePlan] = useState<WeeklyPlanRow | null>(null);
  const [copyTargetClassId, setCopyTargetClassId] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [copyConflict, setCopyConflict] = useState<CopyConflict | null>(null);
  const [parentPreviewOpen, setParentPreviewOpen] = useState(false);
  const [parentPreviewLoading, setParentPreviewLoading] = useState(false);
  const [parentPreviewSlots, setParentPreviewSlots] = useState<ParentPreviewSlot[]>([]);
  const [sendConfirmationOpen, setSendConfirmationOpen] = useState(false);
  const [sendConfirmationArabic, setSendConfirmationArabic] = useState(false);
  const [submissionSuccessOpen, setSubmissionSuccessOpen] = useState(false);
  const [submissionSuccessArabic, setSubmissionSuccessArabic] = useState(false);
  const [editorCompletionKind, setEditorCompletionKind] = useState<EditorCompletionKind>("submitted");

  useEffect(() => { editorSaveInProgress.current = saving && weeklyBuilderOpen; }, [saving, weeklyBuilderOpen]);

  const openWeeklyEditor = useCallback(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("editor") !== "1") {
      url.searchParams.set("editor", "1");
      window.history.pushState({ staffEditor: true }, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setWeeklyBuilderOpen(true);
  }, []);

  const closeWeeklyEditor = useCallback((showOverview = false) => {
    setWeeklyBuilderOpen(false);
    setPublishedEditPlanId("");
    setApprovedEditPublished(false);
    setPublishedEditConfirmationOpen(false);
    const url = new URL(window.location.href);
    if (showOverview) {
      url.searchParams.delete("editor");
      url.searchParams.set("section", "Overview");
      window.history.replaceState({ staffSection: "Overview" }, "", `${url.pathname}${url.search}${url.hash}`);
      setActiveNav("Overview");
    } else if (url.searchParams.get("editor") === "1") {
      window.history.back();
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => setDashboardArabic(window.localStorage.getItem("andalus-language") === "ar"));
    const compactQuery = window.matchMedia("(max-width: 760px)");
    const syncCompactBuilder = () => setCompactWeeklyBuilder(compactQuery.matches);
    queueMicrotask(syncCompactBuilder);
    compactQuery.addEventListener("change", syncCompactBuilder);
    return () => compactQuery.removeEventListener("change", syncCompactBuilder);
  }, []);

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    const restoreLocation = () => {
      if (!active) return;
      const url = new URL(window.location.href);
      if (editorSaveInProgress.current && url.searchParams.get("editor") !== "1") {
        url.searchParams.set("editor", "1");
        window.history.pushState({ staffEditor: true }, "", `${url.pathname}${url.search}${url.hash}`);
        return;
      }
      const availableSections = new Set<string>([
        ...(isSupervisor ? supervisorNavigation : isFaridTeacher ? faridNavigation : navigation).map(([label]) => label),
        "Profile & assignments", "Settings",
      ]);
      const requestedSection = url.searchParams.get("section");
      setActiveNav(requestedSection && availableSections.has(requestedSection) ? requestedSection : "Overview");
      setWeeklyBuilderOpen(false);
      setPublishedEditPlanId("");
      setApprovedEditPublished(false);
      setPublishedEditConfirmationOpen(false);
      setSendConfirmationOpen(false);
      setCopyDialogOpen(false);
      setParentPreviewOpen(false);
      setBulkApprovalConfirmationOpen(false);
      if (url.searchParams.has("editor")) {
        url.searchParams.delete("editor");
        window.history.replaceState({ staffSection: requestedSection }, "", `${url.pathname}${url.search}${url.hash}`);
      }
    };
    queueMicrotask(restoreLocation);
    window.addEventListener("popstate", restoreLocation);
    return () => { active = false; window.removeEventListener("popstate", restoreLocation); };
  }, [profileId, isSupervisor, isFaridTeacher]);

  const loadTeacherDashboard = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const supabase = getStaffWorkspaceClient();
      const { data: userData, error: userError } = await getSupabaseBrowserClient().auth.getUser();
      if (userError) throw userError;
      if (!userData.user) {
        window.location.replace(`${basePath}/teachers/login/`);
        return;
      }

      const targetUserId = delegatedStaffId() || userData.user.id;
      if (delegatedStaffId()) {
        const { error } = await supabase.rpc("open_workspace");
        if (error) throw new Error(`تعذر فتح لوحة المستخدم بالنيابة. ${error.message}`);
      }
      setWorkingOnBehalf(Boolean(delegatedStaffId()));
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, role, status, department_id, departments(name_en), staff_directory(administrative_role)")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (profileError) throw profileError;
      const staffRecord = one(profile?.staff_directory as { administrative_role: string | null } | { administrative_role: string | null }[] | null);
      const supervisorAccount = profile?.role === "admin" && String(staffRecord?.administrative_role ?? "").includes("Supervisor");
      if (!profile || (profile.role !== "teacher" && !supervisorAccount) || profile.status !== "active") {
        const destination = profile?.role === "super_admin" ? "/super-admin/" : profile?.role === "admin" ? "/admin/" : "/teachers/login/";
        window.location.replace(`${basePath}${destination}`);
        return;
      }
      setIsFaridTeacher(profile.role === "teacher" && profile.username === "mrmahmd");

      const departmentTeachersPromise = supervisorAccount ? supabase.rpc("get_my_department_teachers") : Promise.resolve({ data: [], error: null });
      const [assignmentsResult, weeksResult, slotsResult, entriesResult, mySubmissionsResult, reviewsResult, departmentTeachersResult, classesResult, subjectsResult, accessResult, teacherAccessResult, holidaysResult, personalTimetableResult] = await Promise.all([
        supabase.from("teacher_assignments").select("id, class_id, subject_id, school_classes(grade, section), subjects(name_en, include_in_weekly_plan)").eq("teacher_id", targetUserId),
        supabase.from("academic_weeks").select("id, week_number, label, starts_on, ends_on, is_current, teacher_entry_enabled, parent_portal_visible").order("week_number"),
        supabase.from("timetable_slots").select("id, class_id, subject_id, teacher_id, day_of_week, period_number, requires_weekly_plan_submission").eq("requires_weekly_plan_submission", true).order("day_of_week").order("period_number"),
        supabase.from("plan_entries").select("id, weekly_plan_id, timetable_slot_id, subject_id, day_of_week, period_number, classwork, homework, classera_notes, updated_at, subjects(name_en), weekly_plans(class_id, week_id, status, school_classes(grade, section), academic_weeks(label))").eq("teacher_id", targetUserId).order("updated_at", { ascending: false }),
        supabase.from("plan_submissions").select("id, weekly_plan_id, subject_id, status, review_note, weekly_plans(class_id, week_id, school_classes(grade, section), academic_weeks(label)), subjects(name_en)").eq("teacher_id", targetUserId).order("updated_at", { ascending: false }),
        Promise.resolve({ data: [], error: null }),
        departmentTeachersPromise,
        supabase.from("school_classes").select("id, grade, section").eq("is_active", true).order("grade").order("section"),
        supabase.from("subjects").select("id, name_en").eq("is_active", true).eq("include_in_weekly_plan", true).order("name_en"),
        supabase.from("weekly_plan_access_control").select("is_open").eq("id", 1).maybeSingle(),
        supabase.from("weekly_plan_teacher_access").select("is_open").eq("teacher_id", targetUserId).maybeSingle(),
        supabase.from("weekly_plan_holidays").select("id, week_id, day_of_week, title, note"),
        supabase.from("timetable_slots").select("id, class_id, subject_id, teacher_id, day_of_week, period_number, requires_weekly_plan_submission, school_classes(grade, section), subjects(name_en)").eq("teacher_id", targetUserId).order("day_of_week").order("period_number"),
      ]);
      const firstError = [assignmentsResult.error, weeksResult.error, slotsResult.error, entriesResult.error, mySubmissionsResult.error, reviewsResult.error, classesResult.error, subjectsResult.error, holidaysResult.error].find(Boolean);
      if (firstError) throw firstError;

      const requiredSlotRows = (slotsResult.data ?? []) as TimetableSlot[];
      const personalSlotRows: PersonalTimetableSlot[] = (personalTimetableResult.data ?? []).map((slot) => {
        const schoolClass = one(slot.school_classes as { grade: number; section: string } | { grade: number; section: string }[] | null);
        const subject = one(slot.subjects as { name_en: string } | { name_en: string }[] | null);
        return {
          id: String(slot.id), class_id: String(slot.class_id), subject_id: String(slot.subject_id), teacher_id: String(slot.teacher_id),
          day_of_week: Number(slot.day_of_week), period_number: Number(slot.period_number), requires_weekly_plan_submission: Boolean(slot.requires_weekly_plan_submission),
          className: `Grade ${schoolClass?.grade ?? "—"} · ${schoolClass?.section ?? ""}`, subject: subject?.name_en ?? "Subject",
        };
      });
      const realAssignments: Assignment[] = (assignmentsResult.data ?? []).map((assignment) => {
        const schoolClass = one(assignment.school_classes as { grade: number; section: string } | { grade: number; section: string }[] | null);
        const subject = one(assignment.subjects as { name_en: string; include_in_weekly_plan: boolean } | { name_en: string; include_in_weekly_plan: boolean }[] | null);
        if (!subject?.include_in_weekly_plan || !requiredSlotRows.some((slot) => String(slot.teacher_id) === String(targetUserId) && String(slot.class_id) === String(assignment.class_id) && String(slot.subject_id) === String(assignment.subject_id))) return null;
        return {
          id: String(assignment.id),
          classId: String(assignment.class_id),
          subjectId: String(assignment.subject_id),
          grade: Number(schoolClass?.grade ?? 0),
          section: schoolClass?.section ?? "",
          subject: subject?.name_en ?? "Subject",
        };
      }).filter((assignment): assignment is Assignment => assignment !== null);

      const realEntries: TeacherEntry[] = (entriesResult.data ?? []).map((entry) => {
        const subject = one(entry.subjects as { name_en: string } | { name_en: string }[] | null);
        const weeklyPlan = one(entry.weekly_plans as unknown as { class_id: string; week_id: string; status: string; school_classes: { grade: number; section: string } | { grade: number; section: string }[] | null; academic_weeks: { label: string } | { label: string }[] | null } | { class_id: string; week_id: string; status: string; school_classes: { grade: number; section: string } | { grade: number; section: string }[] | null; academic_weeks: { label: string } | { label: string }[] | null }[] | null);
        const schoolClass = one(weeklyPlan?.school_classes);
        const week = one(weeklyPlan?.academic_weeks);
        return {
          id: String(entry.id), timetableSlotId: entry.timetable_slot_id ? String(entry.timetable_slot_id) : null, weeklyPlanId: String(entry.weekly_plan_id), classId: String(weeklyPlan?.class_id ?? ""), weekId: String(weeklyPlan?.week_id ?? ""), subjectId: String(entry.subject_id),
          day: dayNames[Number(entry.day_of_week)] ?? "School day",
          dayOfWeek: Number(entry.day_of_week), periodNumber: Number(entry.period_number),
          className: `Grade ${schoolClass?.grade ?? "—"} · ${schoolClass?.section ?? ""}`,
          subject: subject?.name_en ?? "Subject",
          week: week?.label ?? "Academic week",
          status: weeklyPlan?.status ?? "draft",
          publicationStatus: weeklyPlan?.status ?? "draft",
          updated: formatDate(String(entry.updated_at)),
          hasMeaningfulContent: hasMeaningfulPlanContent(entry),
          hasClasswork: Boolean(String(entry.classwork ?? "").trim()),
        };
      });

      const realMySubmissions: MySubmission[] = (mySubmissionsResult.data ?? []).map((submission) => {
        const plan = one(submission.weekly_plans as unknown as { class_id: string; week_id: string; school_classes: { grade: number; section: string } | { grade: number; section: string }[] | null; academic_weeks: { label: string } | { label: string }[] | null } | { class_id: string; week_id: string; school_classes: { grade: number; section: string } | { grade: number; section: string }[] | null; academic_weeks: { label: string } | { label: string }[] | null }[] | null);
        const schoolClass = one(plan?.school_classes);
        const week = one(plan?.academic_weeks);
        const subject = one(submission.subjects as { name_en: string } | { name_en: string }[] | null);
        return {
          id: String(submission.id), weeklyPlanId: String(submission.weekly_plan_id), classId: String(plan?.class_id ?? ""), weekId: String(plan?.week_id ?? ""), subjectId: String(submission.subject_id),
          className: `Grade ${schoolClass?.grade ?? ""} · ${schoolClass?.section ?? ""}`, week: week?.label ?? "Academic week", subject: subject?.name_en ?? "Subject",
          status: String(submission.status) as MySubmission["status"], reviewNote: String(submission.review_note ?? ""),
        };
      });

      const departmentTeacherRows = (departmentTeachersResult.data ?? []) as Record<string, unknown>[];
      const departmentTeacherIds = departmentTeacherRows.map((item) => String(item.user_id ?? "")).filter(Boolean);
      const { data: supervisorReviewRows = [], error: supervisorReviewsError } = supervisorAccount && departmentTeacherIds.length
        ? await supabase.rpc("get_my_supervisor_review_queue")
        : { data: [], error: null };
      if (supervisorReviewsError) throw supervisorReviewsError;

      const realReviews: ReviewItem[] = ((supervisorReviewRows ?? []) as unknown as Record<string, unknown>[]).map((item) => {
        const matchingEntries = ((item.entries ?? []) as { day_of_week: number; period_number: number; teacher_id: string; subject_id: string; classwork: string; homework: string; classera_notes: string }[])
          .sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number);
        return {
          id: String(item.id), weeklyPlanId: String(item.weekly_plan_id ?? ""), teacherId: String(item.teacher_id), subjectId: String(item.subject_id ?? ""), weekId: String(item.week_id ?? ""), classId: String(item.class_id ?? ""), teacherName: String(item.teacher_name ?? "Teacher"), subject: String(item.subject_name ?? "Subject"),
          className: `Grade ${item.grade ?? ""} · ${item.section ?? ""}`, week: String(item.week_label ?? "Academic week"),
          status: String(item.status), note: String(item.review_note ?? ""), submittedAt: item.submitted_at ? formatDate(String(item.submitted_at)) : "Not submitted",
          entries: matchingEntries.map((entry) => ({ day: dayNames[entry.day_of_week] ?? "School day", period: entry.period_number, subject: String(item.subject_name ?? "Subject"), classwork: entry.classwork, homework: entry.homework, notes: entry.classera_notes })),
          quizzes: ((item.quizzes ?? []) as { subject: string; quiz_date: string | null; details: string }[]).filter((quiz) => Boolean(quiz.details)).map((quiz) => ({ subject: quiz.subject ?? "Subject", date: quiz.quiz_date ?? "", details: quiz.details })),
          weeklyNotes: ((item.weekly_notes ?? []) as string[]).filter(Boolean),
        };
      });
      const { data: departmentAssignmentRows = [], error: departmentAssignmentError } = departmentTeacherIds.length ? await supabase.from("teacher_assignments").select("id, teacher_id, class_id, subject_id, school_classes(grade, section), subjects(name_en)").in("teacher_id", departmentTeacherIds) : { data: [], error: null };
      if (departmentAssignmentError) throw departmentAssignmentError;
      const realDepartmentTeachers: DepartmentTeacher[] = departmentTeacherRows.map((item) => {
        const assignmentRows = (departmentAssignmentRows as Record<string, unknown>[]).filter((assignment) => String(assignment.teacher_id) === String(item.user_id ?? ""));
        return {
        userId: String(item.user_id ?? ""), name: String(item.display_name ?? "Teacher"), assignments: assignmentRows.map((assignment) => {
          const schoolClass = one(assignment.school_classes as { grade: number; section: string } | { grade: number; section: string }[] | null);
          const subject = one(assignment.subjects as { name_en: string } | { name_en: string }[] | null);
          return { id: String(assignment.id), classId: String(assignment.class_id), subjectId: String(assignment.subject_id), grade: Number(schoolClass?.grade ?? 0), section: schoolClass?.section ?? "", subject: subject?.name_en ?? "Subject" };
        }),
      };
      });

      const department = one(profile.departments as { name_en: string } | { name_en: string }[] | null);
      const weeks = (weeksResult.data ?? []) as AcademicWeek[];
      const teacherEntryWeeks = weeks.filter((week) => week.teacher_entry_enabled);
      setProfileId(targetUserId);
      setTeacherName(profile.display_name);
      setDepartmentName(department?.name_en ?? "Teacher Department");
      setWeeklyPlanCreationOpen(teacherAccessResult.data?.is_open ?? accessResult.data?.is_open ?? true);
      setIsSupervisor(supervisorAccount);
      setAssignments(realAssignments);
      setAcademicWeeks(weeks);
      setSchoolHolidays((holidaysResult.data ?? []) as SchoolHoliday[]);
      setTimetableSlots(requiredSlotRows);
      setPersonalTimetable(personalSlotRows);
      setEntries(realEntries);
      setMySubmissions(realMySubmissions);
      setReviewItems(realReviews);
      setDepartmentTeachers(realDepartmentTeachers);
      setSchoolClasses((classesResult.data ?? []) as SchoolClass[]);
      setSchoolSubjects((subjectsResult.data ?? []) as SchoolSubject[]);
      setSelectedDepartmentTeacherId((current) => realDepartmentTeachers.some((teacher) => teacher.userId === current) ? current : realDepartmentTeachers[0]?.userId ?? "");
      setSelectedReviewWeekId((current) => weeks.some((week) => week.id === current) ? current : weeks.find((week) => week.is_current)?.id ?? weeks[0]?.id ?? "");
      const dashboardWeekChoices = weeks.filter((week) => week.teacher_entry_enabled || realEntries.some((entry) => entry.weekId === week.id) || supervisorAccount && realReviews.some((review) => review.weekId === week.id));
      setDashboardWeekId((current) => dashboardWeekChoices.some((week) => week.id === current) ? current : dashboardWeekChoices.find((week) => week.is_current)?.id ?? dashboardWeekChoices[0]?.id ?? "");
      if (departmentTeachersResult.error) {
        setMessage(window.localStorage.getItem("andalus-language") === "ar" ? "لوحتك جاهزة، لكن تعذّر تحميل تكليفات معلمي القسم. يرجى تحديث الصفحة." : "Your dashboard is ready. Department teacher assignments could not be loaded yet; please refresh once.");
        setMessageTone("info");
      }
      if (personalTimetableResult.error) {
        setMessage(window.localStorage.getItem("andalus-language") === "ar" ? "خططك جاهزة، لكن تعذّر تحميل جدول حصصك. يرجى تحديث الصفحة." : "Your plans are ready, but your timetable could not be loaded. Please refresh once.");
        setMessageTone("info");
      }
      setSelectedClassId((current) => realAssignments.some((assignment) => assignment.classId === current) ? current : realAssignments[0]?.classId ?? "");
      setSelectedWeekId((current) => teacherEntryWeeks.some((week) => week.id === current) ? current : teacherEntryWeeks.find((week) => week.is_current)?.id ?? teacherEntryWeeks[0]?.id ?? "");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "The teacher workspace could not be loaded.";
      setMessage(errorMessage);
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTeacherDashboard(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTeacherDashboard]);

  const verifyTeacherWeekAccess = useCallback(async (weekId: string, closeEditorWhenClosed = true) => {
    const arabic = window.localStorage.getItem("andalus-language") === "ar";
    try {
      const { data: liveWeek, error } = await getStaffWorkspaceClient()
        .from("academic_weeks")
        .select("id, teacher_entry_enabled")
        .eq("id", weekId)
        .single();
      if (error) throw error;
      if (liveWeek?.teacher_entry_enabled) return true;
      const text = arabic
        ? "هذا الأسبوع مغلق الآن من إدارة المدرسة، لذلك لا يمكن فتحه أو حفظ أي كتابة جديدة فيه. الخطط المحفوظة سابقًا لم تُحذف."
        : "This week is now closed by school administration, so it cannot be opened or receive new saves. Previously saved plans were not deleted.";
      setAcademicWeeks((current) => current.map((week) => week.id === weekId ? { ...week, teacher_entry_enabled: false } : week));
      setSelectedWeekId((current) => current === weekId ? "" : current);
      setMessage(text);
      setMessageTone("error");
      setBuilderFeedback({ tone: "error", text });
      if (closeEditorWhenClosed) closeWeeklyEditor();
      return false;
    } catch (error) {
      const text = arabic
        ? "تعذر التحقق من فتح الأسبوع الآن، لذلك تم إيقاف الحفظ مؤقتًا لحماية الخطة. حدّث الصفحة وحاول مرة أخرى."
        : "The week access could not be verified, so saving was paused to protect the plan. Refresh and try again.";
      setMessage(error instanceof Error ? `${text} (${error.message})` : text);
      setMessageTone("error");
      setBuilderFeedback({ tone: "error", text });
      return false;
    }
  }, [closeWeeklyEditor]);

  useEffect(() => {
    const recheckOpenEditor = () => {
      if (document.visibilityState === "visible" && weeklyBuilderOpen && !weeklyBuilderReadOnly && !publishedEditPlanId && selectedWeekId) void verifyTeacherWeekAccess(selectedWeekId);
    };
    window.addEventListener("focus", recheckOpenEditor);
    document.addEventListener("visibilitychange", recheckOpenEditor);
    return () => {
      window.removeEventListener("focus", recheckOpenEditor);
      document.removeEventListener("visibilitychange", recheckOpenEditor);
    };
  }, [selectedWeekId, verifyTeacherWeekAccess, weeklyBuilderOpen, weeklyBuilderReadOnly, publishedEditPlanId]);

  const teacherEntryWeeks = useMemo(() => academicWeeks.filter((week) => week.teacher_entry_enabled), [academicWeeks]);
  const selectedWeek = academicWeeks.find((week) => week.id === selectedWeekId);
  const holidayForDay = (dayOfWeek: number) => schoolHolidays.find((holiday) => holiday.week_id === selectedWeekId && holiday.day_of_week === dayOfWeek) ?? null;
  const selectedClassAssignments = useMemo(() => assignments.filter((assignment) => assignment.classId === selectedClassId), [assignments, selectedClassId]);
  const selectedClass = selectedClassAssignments[0];
  const selectedClassSlots = useMemo(() => assignedPlanSlotsForWeek(timetableSlots, assignments, profileId, selectedClassId, selectedWeek, schoolHolidays), [timetableSlots, assignments, profileId, selectedClassId, selectedWeek, schoolHolidays]);
  const editableClassSlots = useMemo(() => selectedClassSlots.filter((slot) => !holidayForDay(slot.day_of_week)), [selectedClassSlots, selectedWeekId, schoolHolidays]);
  const activeDayIndexes = dayNames.map((_, index) => index).filter((index) => selectedClassSlots.some((slot) => slot.day_of_week === index) || Boolean(holidayForDay(index)));
  const visibleBuilderDayIndexes = compactWeeklyBuilder
    ? activeDayIndexes.includes(selectedBuilderDay) ? [selectedBuilderDay] : activeDayIndexes.slice(0, 1)
    : activeDayIndexes;
  const assignmentForSlot = (slot: TimetableSlot) => selectedClassAssignments.find((assignment) => assignment.subjectId === slot.subject_id);
  const slotDraftFor = (slot: TimetableSlot) => slotDrafts[slot.id] ?? emptySlotDraft();
  const uniqueClasses = useMemo(() => Array.from(new Map(assignments.map((assignment) => [assignment.classId, `Grade ${assignment.grade} · ${assignment.section}`])).values()), [assignments]);
  const uniqueSubjects = useMemo(() => Array.from(new Set(assignments.map((assignment) => assignment.subject))), [assignments]);

  const approvedSubjectIds = useMemo(() => new Set(mySubmissions
    .filter((submission) => submission.classId === selectedClassId && submission.weekId === selectedWeekId && submission.status === "approved")
    .map((submission) => submission.subjectId)), [mySubmissions, selectedClassId, selectedWeekId]);
  const copySourceAssignments = useMemo(() => {
    if (!copySourcePlan) return [];
    const writtenSubjectIds = new Set(entries.filter((entry) => entry.weeklyPlanId === copySourcePlan.planId && entry.hasMeaningfulContent).map((entry) => entry.subjectId));
    return assignments.filter((assignment) => assignment.classId === copySourcePlan.classId && writtenSubjectIds.has(assignment.subjectId));
  }, [assignments, copySourcePlan, entries]);
  const copyTargetClasses = useMemo<CopyTargetClass[]>(() => {
    if (!copySourcePlan || !copySourceAssignments.length) return [];
    const grouped = new Map<string, CopyTargetClass>();
    for (const assignment of assignments.filter((item) => item.classId !== copySourcePlan.classId && item.grade === copySourceAssignments[0].grade)) {
      const existing = grouped.get(assignment.classId);
      if (!existing) grouped.set(assignment.classId, { ...assignment, lessonCount: 0 });
    }
    const week = academicWeeks.find((item) => item.id === copySourcePlan.weekId);
    return [...grouped.values()].map((target) => ({
      ...target,
      lessonCount: assignedPlanSlotsForWeek(timetableSlots, assignments, profileId, target.classId, week, schoolHolidays).filter((slot) => slot.requires_weekly_plan_submission).length,
    }));
  }, [assignments, copySourceAssignments, copySourcePlan, timetableSlots, academicWeeks, profileId, schoolHolidays]);

  const builderStatus = useMemo(() => {
    const subjectIds = new Set(selectedClassSlots.map((slot) => slot.subject_id));
    const statuses = mySubmissions.filter((submission) => submission.classId === selectedClassId && submission.weekId === selectedWeekId && subjectIds.has(submission.subjectId));
    const approvedCount = statuses.filter((submission) => submission.status === "approved").length;
    if (statuses.some((submission) => submission.status === "submitted")) return "submitted";
    if (statuses.some((submission) => submission.status === "changes_requested")) return "changes_requested";
    if (subjectIds.size > 0 && approvedCount === subjectIds.size) return "approved";
    return savedPlanId ? "draft" : "new";
  }, [mySubmissions, savedPlanId, selectedClassId, selectedWeekId, selectedClassSlots, selectedClassAssignments]);

  const loadPlanIntoBuilder = useCallback(async () => {
    if (!weeklyBuilderOpen || !profileId || !selectedClassId || !selectedWeekId) return;
    setBuilderHydrated(false);
    approvedLessonSnapshot.current = {};
    try {
      const supabase = getStaffWorkspaceClient();
      const { data: plan, error: planError } = await supabase.from("weekly_plans")
        .select("id, plan_entries(timetable_slot_id, teacher_id, subject_id, day_of_week, period_number, classwork, homework, classera_notes), plan_quizzes(subject_id, quiz_date, details), plan_notes(note_text, teacher_id)")
        .eq("plan_entries.teacher_id", profileId)
        .eq("plan_quizzes.teacher_id", profileId)
        .eq("plan_notes.teacher_id", profileId)
        .eq("class_id", selectedClassId).eq("week_id", selectedWeekId).maybeSingle();
      if (planError) throw planError;
      setSavedPlanId(plan?.id ? String(plan.id) : "");
      const rows = (plan?.plan_entries ?? []) as Array<{ timetable_slot_id: string | null; teacher_id: string; subject_id: string; day_of_week: number; period_number: number; classwork: string; homework: string; classera_notes: string }>;
      const nextDrafts: Record<string, SlotDraft> = {};
      selectedClassSlots.forEach((slot) => {
        const row = rows.find((entry) => entry.teacher_id === profileId && entry.subject_id === slot.subject_id && entry.timetable_slot_id === slot.id)
          ?? rows.find((entry) => entry.teacher_id === profileId && entry.subject_id === slot.subject_id && entry.day_of_week === slot.day_of_week && entry.period_number === slot.period_number);
        if (!row) return;
        approvedLessonSnapshot.current[slot.id] = { classwork: row.classwork ?? "", homework: row.homework ?? "", classera_notes: row.classera_notes ?? "" };
        const assignment = assignmentForSlot(slot);
        let classwork = row.classwork ?? "";
        let englishProgramme = "";
        let scienceComponent = "";
        if (isEnglishSubject(assignment?.subject ?? "")) {
          const parsedClasswork = splitEnglishClasswork(classwork);
          englishProgramme = parsedClasswork.programme;
          classwork = parsedClasswork.classwork;
        }
        if (assignment?.subject === "Integrated Science") {
          scienceComponent = scienceComponents.find((component) => classwork.startsWith(`${component} — `)) ?? "";
          if (scienceComponent) classwork = classwork.slice(scienceComponent.length + 3);
        }
        nextDrafts[slot.id] = { classwork, homework: row.homework ?? "", classeraNotes: row.classera_notes ?? "", englishProgramme, scienceComponent };
      });
      setSlotDrafts(nextDrafts);
      const quiz = ((plan?.plan_quizzes ?? []) as Array<{ subject_id: string; quiz_date: string | null; details: string }>).find((row) => Boolean(row.details));
      setQuizSubjectId(quiz?.subject_id ?? "");
      setQuizDetails(quiz?.details ?? "");
      if (quiz?.quiz_date && selectedWeek) {
        const offset = Math.max(0, Math.min(4, Math.round((new Date(`${quiz.quiz_date}T12:00:00`).getTime() - new Date(`${selectedWeek.starts_on}T12:00:00`).getTime()) / 86400000)));
        setQuizDay(String(offset));
      }
      const note = ((plan?.plan_notes ?? []) as Array<{ note_text: string; teacher_id: string }>).find((row) => row.teacher_id === profileId);
      const dictation = note ? parseEnglishDictation(note.note_text) : null;
      setDictationDay(String(dictation?.day ?? 0));
      setDictationWords(dictation?.words.join("\n") ?? "");
      setBuilderHydrated(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The saved plan could not be opened.");
      setMessageTone("error");
      setBuilderHydrated(true);
    }
  }, [profileId, selectedClassId, selectedWeekId, selectedClassSlots, weeklyBuilderOpen, selectedWeek]);

  useEffect(() => { void loadPlanIntoBuilder(); }, [loadPlanIntoBuilder]);

  const openWeeklyBuilder = async (targetWeekId?: string, targetClassId?: string) => {
    if (!weeklyPlanCreationOpen) {
      setMessage("Weekly plan creation is currently closed by school administration.");
      setMessageTone("info");
      return;
    }
    if (loading) {
      setMessage("Your teacher data is still loading. Please wait a moment and try again.");
      setMessageTone("info");
      return;
    }
    if (assignments.length === 0) {
      setMessage("No classes or subjects are assigned yet. Ask the General Supervisor to complete your assignments.");
      setMessageTone("info");
      return;
    }
    if (teacherEntryWeeks.length === 0) {
      setMessage("No academic week is currently open for teacher entry. Your saved and submitted plans remain available in plan history.");
      setMessageTone("info");
      return;
    }
    const firstAssignment = assignments.find((assignment) => assignment.classId === targetClassId) ?? selectedClass ?? assignments[0];
    const firstWeek = targetWeekId ? teacherEntryWeeks.find((week) => week.id === targetWeekId) : selectedWeek ?? teacherEntryWeeks.find((week) => week.is_current) ?? teacherEntryWeeks[0];
    if (targetWeekId && !firstWeek) {
      setMessage(dashboardArabic ? "هذا الأسبوع مغلق لكتابة الخطط؛ يمكنك معاينة الخطط المحفوظة فقط." : "This week is closed for writing plans; saved plans remain available for preview.");
      setMessageTone("info");
      return;
    }
    if (!firstWeek || !(await verifyTeacherWeekAccess(firstWeek.id, false))) return;
    if (firstAssignment) setSelectedClassId(firstAssignment.classId);
    setSelectedWeekId(firstWeek.id);
    setBuilderFeedback(null);
    setWeeklyBuilderReadOnly(false);
    openWeeklyEditor();
  };

  const updateSlotDraft = (slotId: string, field: keyof SlotDraft, value: string) => {
    setSlotDrafts((current) => ({ ...current, [slotId]: { ...(current[slotId] ?? emptySlotDraft()), [field]: value } }));
  };

  const previewClasswork = (slot: TimetableSlot) => {
    const assignment = assignmentForSlot(slot);
    const draft = slotDraftFor(slot);
    if (isEnglishSubject(assignment?.subject ?? "")) return formatEnglishClasswork(draft.englishProgramme, draft.classwork);
    const prefix = assignment?.subject === "Integrated Science" ? draft.scienceComponent : "";
    return [prefix, draft.classwork.trim()].filter(Boolean).join(" — ");
  };

  const openParentPreview = async () => {
    if (!selectedClass || !selectedWeek) return;
    setParentPreviewOpen(true);
    setParentPreviewLoading(true);
    try {
      const { data, error } = await getStaffWorkspaceClient().from("timetable_slots")
        .select("id, class_id, subject_id, day_of_week, period_number, subjects(parent_plan_name, name_en)")
        .eq("class_id", selectedClassId)
        .eq("requires_weekly_plan_submission", true)
        .order("day_of_week", { ascending: true })
        .order("period_number", { ascending: true });
      if (error) throw error;
      const slots = (data ?? []).map((row) => {
        const related = one((row as { subjects?: { parent_plan_name?: string; name_en?: string } | { parent_plan_name?: string; name_en?: string }[] | null }).subjects);
        return {
          id: String(row.id),
          class_id: String(row.class_id),
          subject_id: String(row.subject_id),
          day_of_week: Number(row.day_of_week),
          period_number: Number(row.period_number),
          requires_weekly_plan_submission: true,
          subject: related?.parent_plan_name || related?.name_en || "Subject",
        };
      });
      setParentPreviewSlots(slots);
    } catch (error) {
      setParentPreviewSlots([]);
      setMessage(error instanceof Error ? error.message : "The parent-plan preview could not be loaded.");
      setMessageTone("error");
    } finally {
      setParentPreviewLoading(false);
    }
  };

  const saveWholeWeek = async (submitForReview = false, silent = false) => {
    if (publishedEditPlanId || (silent && delegatedStaffId())) return;
    if (!profileId || !selectedClass || !selectedWeek) return;
    if (submitForReview && autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    if (!submitForReview && builderStatus === "submitted") {
      if (!silent) {
        setMessage(dashboardArabic ? "هذه الخطة موجودة بالفعل لدى المشرف. اسحبها للتعديل قبل إجراء أي تغييرات أو حفظها." : "This weekly plan is already with your supervisor. Withdraw it before making or saving changes.");
        setMessageTone("info");
      }
      return;
    }
    if (selectedClassSlots.length === 0) {
      const text = dashboardArabic ? "لا توجد حصص مرتبطة بهذا الفصل حتى الآن. اطلب من مسؤول المنصة مراجعة ربط الجدول." : "No timetable lessons are linked to this class yet. Ask the General Supervisor to review the timetable connection.";
      setMessage(text);
      setMessageTone("error");
      setBuilderFeedback({ tone: "error", text });
      return;
    }
    const englishSlotMissingProgramme = editableClassSlots.find((slot) => {
      const assignment = assignmentForSlot(slot);
      const draft = slotDraftFor(slot);
      return isEnglishSubject(assignment?.subject ?? "") && Boolean(draft.classwork.trim()) && !draft.englishProgramme;
    });
    if (englishSlotMissingProgramme) {
      if (silent) setAutoSaveState("idle");
      else {
        const text = dashboardArabic ? `اختر AL أو OL ليوم ${arabicDayNames[dayNames[englishSlotMissingProgramme.day_of_week]]} · الحصة ${englishSlotMissingProgramme.period_number} قبل حفظ عمل الحصة.` : `Choose AL or OL for ${dayNames[englishSlotMissingProgramme.day_of_week]} · Period ${englishSlotMissingProgramme.period_number} before saving Classwork.`;
        setMessage(text);
        setMessageTone("error");
        setBuilderFeedback({ tone: "error", text });
      }
      return;
    }
    if (submitForReview) {
      pendingSupervisorSubmission.current = false;
      setBuilderFeedback({ tone: "info", text: dashboardArabic ? isSupervisor ? "جارٍ اعتماد خطتك التعليمية تلقائيًا…" : "جارٍ إرسال الخطة الأسبوعية إلى المشرف…" : isSupervisor ? "Approving your teaching plan automatically…" : "Sending the weekly plan to your supervisor…" });
    }
    setSaving(true);
    if (silent) setAutoSaveState("saving");
    try {
      if (!(await verifyTeacherWeekAccess(selectedWeek.id))) {
        if (silent) setAutoSaveState("idle");
        return;
      }
      const supabase = getStaffWorkspaceClient();
      let weeklyPlanId = "";
      if (workingOnBehalf) {
        const date = new Date(`${selectedWeek.starts_on}T12:00:00`);
        date.setDate(date.getDate() + Number(quizDay));
        const { data, error } = await supabase.rpc("save_staff_plan", {
          class_id: selectedClassId, week_id: selectedWeek.id, submit: submitForReview,
          lessons: editableClassSlots.filter((slot) => !approvedSubjectIds.has(slot.subject_id)).map((slot) => {
            const draft = slotDraftFor(slot);
            const assignment = assignmentForSlot(slot);
            const text = draft.classwork.trim();
            return { slot_id: slot.id,
              classwork: isEnglishSubject(assignment?.subject ?? "") ? formatEnglishClasswork(draft.englishProgramme, text) : assignment?.subject === "Integrated Science" && draft.scienceComponent && text ? `${draft.scienceComponent} — ${text}` : text,
              homework: draft.homework.trim(), classera_notes: draft.classeraNotes.trim() };
          }),
          dictation_note: departmentName === "English Department" ? parseDictationWords(dictationWords).length ? encodeEnglishDictation(dictationDay, dictationWords) : "" : null,
          quiz_subject_id: quizSubjectId || null, quiz_details: quizDetails.trim(), quiz_date: date.toISOString().slice(0, 10),
        });
        if (error) throw new Error(error.message);
        if (typeof data !== "string" || !data) throw new Error("The delegated save was not confirmed.");
        weeklyPlanId = data;
      } else {
      const { data: existingPlan, error: planReadError } = await supabase.from("weekly_plans").select("id").eq("class_id", selectedClassId).eq("week_id", selectedWeek.id).maybeSingle();
      if (planReadError) throw planReadError;
      weeklyPlanId = existingPlan?.id ? String(existingPlan.id) : "";
      if (!weeklyPlanId) {
        const { data: createdPlan, error: createPlanError } = await supabase.from("weekly_plans").insert({
          class_id: selectedClassId,
          week_id: selectedWeek.id,
          class_teacher_name: teacherName,
          status: "draft",
        }).select("id").single();
        if (createPlanError) throw createPlanError;
        weeklyPlanId = String(createdPlan.id);
      }

      // The timetable can change after an earlier teacher has saved a lesson.
      // Never overwrite that teacher's entry through the shared day/period key.
      const writableSlots = editableClassSlots.filter((slot) => !approvedSubjectIds.has(slot.subject_id));
      const { data: occupiedEntries, error: occupiedEntriesError } = await supabase.from("plan_entries")
        .select("teacher_id, subject_id, day_of_week, period_number")
        .eq("weekly_plan_id", weeklyPlanId);
      if (occupiedEntriesError) throw occupiedEntriesError;
      const conflictingSlot = writableSlots.find((slot) => (occupiedEntries ?? []).some((entry) =>
        entry.day_of_week === slot.day_of_week
        && entry.period_number === slot.period_number
        && (entry.teacher_id !== profileId || entry.subject_id !== slot.subject_id)));
      if (conflictingSlot) {
        const arabic = window.localStorage.getItem("andalus-language") === "ar";
        throw new Error(arabic
          ? `تعذر حفظ حصة ${arabicDayNames[dayNames[conflictingSlot.day_of_week]]} رقم ${conflictingSlot.period_number}: توجد خطة سابقة لمعلم أو مادة أخرى في موضعها بعد تعديل الجدول. أخبر مسؤول المنصة؛ لن تُستبدل خطة المعلم الآخر.`
          : `Cannot save ${dayNames[conflictingSlot.day_of_week]} period ${conflictingSlot.period_number}: another teacher's or subject's saved lesson occupies this timetable position. Contact the General Supervisor; the other plan was not overwritten.`);
      }

      const entryRows = writableSlots.map((slot) => {
        const assignment = assignmentForSlot(slot);
        const draft = slotDraftFor(slot);
        const classwork = draft.classwork.trim();
        const isEnglish = isEnglishSubject(assignment?.subject ?? "");
        const prefix = assignment?.subject === "Integrated Science" ? draft.scienceComponent : "";
        return {
          weekly_plan_id: weeklyPlanId,
          timetable_slot_id: slot.id,
          teacher_id: profileId,
          subject_id: slot.subject_id,
          day_of_week: slot.day_of_week,
          period_number: slot.period_number,
          classwork: isEnglish ? formatEnglishClasswork(draft.englishProgramme, classwork) : prefix && classwork ? `${prefix} — ${classwork}` : classwork,
          homework: draft.homework.trim(),
          classera_notes: draft.classeraNotes.trim(),
          updated_at: new Date().toISOString(),
        };
      });
      if (entryRows.length) {
        const { data: savedEntryRows, error: entriesError } = await supabase
          .from("plan_entries")
          .upsert(entryRows, { onConflict: "weekly_plan_id,day_of_week,period_number" })
          .select("id");
        if (entriesError) throw entriesError;
        if ((savedEntryRows ?? []).length !== entryRows.length) throw new Error("Supabase did not confirm every lesson save. Please try again.");
      }

      const submittedAt = submitForReview ? new Date().toISOString() : null;
      const submissionRows = Array.from(new Set(editableClassSlots.filter((slot) => !approvedSubjectIds.has(slot.subject_id)).map((slot) => slot.subject_id))).map((subjectId) => ({
        weekly_plan_id: weeklyPlanId, teacher_id: profileId, subject_id: subjectId,
        status: submitForReview ? (isSupervisor ? "approved" : "submitted") : "draft",
        reviewed_by: submitForReview && isSupervisor ? profileId : null,
        reviewed_at: submitForReview && isSupervisor ? submittedAt : null,
        submitted_at: submittedAt,
      }));
      let writableSubmissionRows = submissionRows;
      if (!submitForReview && submissionRows.length) {
        const { data: currentSubmissionRows, error: currentSubmissionError } = await supabase
          .from("plan_submissions")
          .select("subject_id, status")
          .eq("weekly_plan_id", weeklyPlanId)
          .eq("teacher_id", profileId)
          .in("subject_id", submissionRows.map((row) => row.subject_id));
        if (currentSubmissionError) throw currentSubmissionError;
        const protectedSubjectIds = new Set((currentSubmissionRows ?? [])
          .filter((row) => row.status === "submitted" || row.status === "approved")
          .map((row) => String(row.subject_id)));
        writableSubmissionRows = submissionRows.filter((row) => !protectedSubjectIds.has(row.subject_id));
      }
      if (writableSubmissionRows.length) {
        const { data: savedSubmissionRows, error: submissionError } = await supabase
          .from("plan_submissions")
          .upsert(writableSubmissionRows, { onConflict: "weekly_plan_id,teacher_id,subject_id" })
          .select("subject_id, status, submitted_at");
        if (submissionError) throw submissionError;
        const expectedStatus = isSupervisor ? "approved" : "submitted";
        if (submitForReview && (
          (savedSubmissionRows ?? []).length !== writableSubmissionRows.length
          || (savedSubmissionRows ?? []).some((row) => row.status !== expectedStatus || !row.submitted_at)
        )) throw new Error("Supabase did not confirm the supervisor submission. Please try again.");
      }

      if (quizDetails.trim() && quizSubjectId) {
        const { error: oldQuizError } = await supabase.from("plan_quizzes").delete().eq("weekly_plan_id", weeklyPlanId).eq("teacher_id", profileId).eq("subject_id", quizSubjectId);
        if (oldQuizError) throw oldQuizError;
        const quizDate = new Date(`${selectedWeek.starts_on}T12:00:00`);
        quizDate.setDate(quizDate.getDate() + Number(quizDay));
        const { error: quizError } = await supabase.from("plan_quizzes").insert({ weekly_plan_id: weeklyPlanId, teacher_id: profileId, subject_id: quizSubjectId, quiz_date: quizDate.toISOString().slice(0, 10), details: quizDetails.trim() });
        if (quizError) throw quizError;
      }

      const { error: oldNoteError } = await supabase.from("plan_notes").delete().eq("weekly_plan_id", weeklyPlanId).eq("teacher_id", profileId);
      if (oldNoteError) throw oldNoteError;
      if (departmentName === "English Department" && parseDictationWords(dictationWords).length > 0) {
        const { error: noteError } = await supabase.from("plan_notes").insert({ weekly_plan_id: weeklyPlanId, teacher_id: profileId, note_text: encodeEnglishDictation(dictationDay, dictationWords) });
        if (noteError) throw noteError;
      }

      }
      setSavedPlanId(weeklyPlanId);
      autoSavedSignature.current = autosaveSignature;
      if (!silent) {
        const actionArabic = window.localStorage.getItem("andalus-language") === "ar";
        const successText = submitForReview
          ? isSupervisor
            ? actionArabic ? "تم اعتماد خطتك التعليمية تلقائيًا، وتم تحديث حالتها في الشاشة الرئيسية." : "Your teaching plan was approved automatically and its status was updated on the main screen."
            : actionArabic ? "تم إرسال الخطة الأسبوعية إلى المشرف للاعتماد، وتم تحديث حالتها في الشاشة الرئيسية." : "Your weekly plan was sent to the supervisor for approval and its status was updated on the main screen."
          : actionArabic ? "تم حفظ الخطة الأسبوعية كمسودة بنجاح. يمكنك فتحها لاحقًا لاستكمالها وإرسالها للمشرف." : "Your weekly plan was saved successfully as a draft. You can reopen it later to finish and submit it.";
        setMessage(successText);
        setMessageTone("success");
        setBuilderFeedback({ tone: "success", text: successText });
        await loadTeacherDashboard();
        setSubmissionSuccessArabic(actionArabic);
        setEditorCompletionKind(submitForReview ? isSupervisor ? "approved" : "submitted" : "draft");
        closeWeeklyEditor(true);
        setSubmissionSuccessOpen(true);
      } else {
        setAutoSaveState("saved");
      }
    } catch (error) {
      if (silent) { autoSavedSignature.current = ""; setAutoSaveState("idle"); }
      else {
        const actionArabic = window.localStorage.getItem("andalus-language") === "ar";
        const details = error instanceof Error ? error.message : typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? `Code ${error.code}` : "";
        const errorText = actionArabic
          ? details.startsWith("تعذر حفظ حصة") ? details : `تعذر حفظ الخطة. لم يُغلق المحرر حتى لا تفقد ما كتبته.${details ? ` (${details})` : ""}`
          : details || "The weekly plan could not be saved.";
        setMessage(errorText);
        setMessageTone("error");
        setBuilderFeedback({ tone: "error", text: errorText });
        setSubmissionSuccessArabic(actionArabic);
        setEditorCompletionKind("error");
        setSubmissionSuccessOpen(true);
      }
    } finally {
      setSaving(false);
      if (!submitForReview && pendingSupervisorSubmission.current) {
        pendingSupervisorSubmission.current = false;
        window.setTimeout(() => { void saveWholeWeek(true); }, 0);
      }
    }
  };

  const savePublishedEdit = async () => {
    if (!publishedEditPlanId || !profileId || !builderHydrated || saving) return;
    const arabic = window.localStorage.getItem("andalus-language") === "ar";
    if (editableClassSlots.some((slot) => {
      const assignment = assignmentForSlot(slot);
      const draft = slotDraftFor(slot);
      return isEnglishSubject(assignment?.subject ?? "") && Boolean(draft.classwork.trim()) && !draft.englishProgramme;
    })) {
      setBuilderFeedback({ tone: "error", text: arabic ? "اختر AL أو OL لكل حصة إنجليزي مكتوبة قبل نشر التعديل." : "Choose AL or OL for each written English lesson before publishing changes." });
      setPublishedEditConfirmationOpen(false);
      return;
    }
    setSaving(true);
    setPublishedEditConfirmationOpen(false);
    try {
      const lessonChanges = editableClassSlots.map((slot) => {
        const assignment = assignmentForSlot(slot);
        const draft = slotDraftFor(slot);
        const classwork = draft.classwork.trim();
        const prefix = assignment?.subject === "Integrated Science" ? draft.scienceComponent : "";
        return {
          slot_id: slot.id,
          classwork: isEnglishSubject(assignment?.subject ?? "") ? formatEnglishClasswork(draft.englishProgramme, classwork) : prefix && classwork ? `${prefix} — ${classwork}` : classwork,
          homework: draft.homework.trim(),
          classera_notes: draft.classeraNotes.trim(),
        };
      });
      const supabase = getStaffWorkspaceClient();
      const dictationNote = departmentName === "English Department" ? parseDictationWords(dictationWords).length ? encodeEnglishDictation(dictationDay, dictationWords) : "" : null;
      const lessonsUnchanged = lessonChanges.length > 0 && lessonChanges.every((lesson) => {
        const original = approvedLessonSnapshot.current[lesson.slot_id];
        return original && original.classwork === lesson.classwork && original.homework === lesson.homework && original.classera_notes === lesson.classera_notes;
      });
      if (workingOnBehalf && lessonsUnchanged && dictationNote === "") {
        const { error } = await supabase.rpc("remove_staff_dictation", { plan_id: publishedEditPlanId });
        if (error) throw new Error(error.message);
      } else if (lessonsUnchanged && dictationNote === "") {
        // A dictation-only removal must not re-save every approved lesson: the
        // timetable may have changed since approval, and no lesson was edited.
        const { data: currentPlan, error: currentPlanError } = await supabase.from("weekly_plans")
          .select("id, status").eq("id", publishedEditPlanId).single();
        if (currentPlanError) throw currentPlanError;
        if (!currentPlan || !["draft", "published"].includes(currentPlan.status)) throw new Error("This approved plan is no longer available for correction.");
        const { data: approvals, error: approvalsError } = await supabase.from("plan_submissions")
          .select("subject_id, status").eq("weekly_plan_id", publishedEditPlanId).eq("teacher_id", profileId);
        if (approvalsError) throw approvalsError;
        const ownSubjects = new Set(selectedClassAssignments.map((assignment) => assignment.subjectId));
        if (!ownSubjects.size || !Array.from(ownSubjects).every((subjectId) => approvals?.some((item) => item.subject_id === subjectId && item.status === "approved"))) {
          throw new Error("Your subject approval changed. Refresh the page before editing dictation.");
        }
        const { data: currentNotes, error: notesError } = await supabase.from("plan_notes")
          .select("id, note_text").eq("weekly_plan_id", publishedEditPlanId).eq("teacher_id", profileId);
        if (notesError) throw notesError;
        const dictationIds = (currentNotes ?? []).filter((note) => note.note_text.startsWith(dictationNotePrefix)).map((note) => note.id);
        if (dictationIds.length) {
          const { data: deletedNotes, error: deleteError } = await supabase.from("plan_notes")
            .delete().in("id", dictationIds).eq("weekly_plan_id", publishedEditPlanId).eq("teacher_id", profileId).select("id");
          if (deleteError) throw deleteError;
          if (deletedNotes?.length !== dictationIds.length) throw new Error("The database did not confirm removal of every dictation note.");
        }
      } else {
        const { data, error } = await supabase.rpc("update_my_published_plan", {
          target_plan_id: publishedEditPlanId,
          lesson_changes: lessonChanges,
          dictation_note: dictationNote,
        });
        if (error) throw error;
        if (Number(data) !== lessonChanges.length) throw new Error("The database did not confirm every approved lesson update.");
      }
      await loadTeacherDashboard();
      setMessage(approvedEditPublished ? arabic ? "تم حفظ التعديل على الخطة المنشورة دون إعادة إرساله للمشرف." : "Published changes were saved without another supervisor review." : arabic ? "تم حفظ تعديل الخطة المعتمدة دون إعادة إرسالها للمشرف. ستظهر لولي الأمر عند استيفاء شروط النشر." : "Approved changes were saved without another review. Families will see them when publication conditions are met.");
      setMessageTone("success");
      setSubmissionSuccessArabic(arabic);
      setEditorCompletionKind(approvedEditPublished ? "published_edit" : "approved_edit");
      closeWeeklyEditor(true);
      setSubmissionSuccessOpen(true);
    } catch (error) {
      const text = error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "The approved plan could not be updated.";
      setBuilderFeedback({ tone: "error", text: arabic ? `تعذر حفظ التعديل، ولم تُغلق نافذة التحرير. ${text}` : text });
    } finally {
      setSaving(false);
    }
  };

  const missingClassworkSlots = editableClassSlots.filter((slot) => !approvedSubjectIds.has(slot.subject_id) && !slotDraftFor(slot).classwork.trim());
  const confirmAndSendWholeWeek = () => {
    const arabic = window.localStorage.getItem("andalus-language") === "ar";
    const hasWrittenClasswork = editableClassSlots.some((slot) => !approvedSubjectIds.has(slot.subject_id) && Boolean(slotDraftFor(slot).classwork.trim()));
    if (!hasWrittenClasswork) {
      const text = arabic ? "اكتب عمل الحصة لحصة واحدة على الأقل قبل إرسال الخطة الأسبوعية إلى المشرف." : "Write Classwork for at least one lesson before sending the weekly plan to your supervisor.";
      setBuilderFeedback({ tone: "error", text });
      setSubmissionSuccessArabic(arabic);
      setEditorCompletionKind("error");
      setSubmissionSuccessOpen(true);
      return;
    }
    setSendConfirmationArabic(arabic);
    setSendConfirmationOpen(true);
  };

  const sendConfirmedWeeklyPlan = () => {
    setSendConfirmationOpen(false);
    if (saving) {
      pendingSupervisorSubmission.current = true;
      setBuilderFeedback({ tone: "info", text: sendConfirmationArabic ? "جارٍ إكمال الحفظ التلقائي، ثم ستُرسل الخطة مباشرة." : "Finishing the automatic save, then the plan will be sent immediately." });
      return;
    }
    void saveWholeWeek(true);
  };

  const finishSuccessfulSubmission = () => {
    setSubmissionSuccessOpen(false);
    if (editorCompletionKind !== "error") {
      closeWeeklyEditor(true);
    }
  };

  const hasAutosaveContent = useMemo(() => Object.values(slotDrafts).some((draft) => Boolean(draft.classwork.trim() || draft.homework.trim() || draft.classeraNotes.trim())) || Boolean(quizDetails.trim() || (departmentName === "English Department" && dictationWords.trim())), [slotDrafts, quizDetails, departmentName, dictationWords]);
  const autosaveSignature = useMemo(() => JSON.stringify({ selectedClassId, selectedWeekId, slotDrafts, quizDay, quizDetails, quizSubjectId, dictationDay, dictationWords }), [selectedClassId, selectedWeekId, slotDrafts, quizDay, quizDetails, quizSubjectId, dictationDay, dictationWords]);
  useEffect(() => {
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    if (workingOnBehalf || delegatedStaffId() || !weeklyBuilderOpen || weeklyBuilderReadOnly || publishedEditPlanId || !builderHydrated || !hasAutosaveContent || saving || builderStatus === "submitted" || builderStatus === "approved" || autoSavedSignature.current === autosaveSignature) return;
    setAutoSaveState("idle");
    autoSaveTimer.current = window.setTimeout(() => { autoSavedSignature.current = autosaveSignature; void saveWholeWeek(false, true); }, 1400);
    return () => { if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current); };
  }, [workingOnBehalf, weeklyBuilderOpen, weeklyBuilderReadOnly, publishedEditPlanId, builderHydrated, hasAutosaveContent, autosaveSignature, saving, builderStatus]);

  const withdrawSubmissionForEditing = async (submission: MySubmission) => {
    if (submission.status !== "submitted") return;
    setSaving(true);
    try {
      if (workingOnBehalf) {
        const { error } = await getStaffWorkspaceClient().rpc("withdraw_staff_plan", { plan_id: submission.weeklyPlanId });
        if (error) throw new Error(error.message);
      } else {
      const { data: withdrawnRows, error } = await getStaffWorkspaceClient()
        .from("plan_submissions")
        .update({ status: "draft", submitted_at: null, review_note: null, reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() })
        .eq("weekly_plan_id", submission.weeklyPlanId)
        .eq("teacher_id", profileId)
        .eq("status", "submitted")
        .select("id, status");
      if (error) throw error;
      if (!(withdrawnRows ?? []).length || (withdrawnRows ?? []).some((row) => row.status !== "draft")) throw new Error("Supabase did not confirm the complete plan withdrawal. Please try again.");
      }
      setMessage("The plan was withdrawn from review and is ready to edit again.");
      setMessageTone("success");
      await loadTeacherDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The plan could not be withdrawn from review.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  };

  const openSavedPlan = async (submission: MySubmission) => {
    if (!(await verifyTeacherWeekAccess(submission.weekId, false))) return;
    setSelectedClassId(submission.classId);
    setSelectedWeekId(submission.weekId);
    setBuilderFeedback(null);
    setWeeklyBuilderReadOnly(false);
    openWeeklyEditor();
  };

  const openEntryEditor = async (entry: TeacherEntry) => {
    if (!(await verifyTeacherWeekAccess(entry.weekId, false))) return;
    setSelectedClassId(entry.classId);
    setSelectedWeekId(entry.weekId);
    setBuilderFeedback(null);
    setWeeklyBuilderReadOnly(false);
    openWeeklyEditor();
  };

  const entryReviewStatus = (entry: TeacherEntry) => mySubmissions.find((submission) => submission.classId === entry.classId && submission.weekId === entry.weekId && submission.subjectId === entry.subjectId)?.status ?? "draft";

  const deleteDraftEntry = async (entry: TeacherEntry) => {
    const status = entryReviewStatus(entry);
    if (status !== "draft" && status !== "changes_requested") {
      setMessage("Only a draft or a returned plan can be deleted. Withdraw a submitted plan first.");
      setMessageTone("info");
      return;
    }
    if (!window.confirm(`Delete this ${entry.day} ${entry.subject} lesson? This removes only this lesson, not the other subjects or the whole class plan.`)) return;
    setSaving(true);
    try {
      const supabase = getStaffWorkspaceClient();
      const { data: deletedRows, error } = await supabase.from("plan_entries").delete().eq("id", entry.id).eq("teacher_id", profileId).select("id");
      if (error) throw error;
      if (!deletedRows?.length) throw new Error("This lesson could not be deleted. Please refresh and try again.");
      const { data: remainingRows, error: remainingError } = await supabase.from("plan_entries").select("id").eq("weekly_plan_id", entry.weeklyPlanId).eq("teacher_id", profileId).eq("subject_id", entry.subjectId).limit(1);
      if (remainingError) throw remainingError;
      if (!remainingRows?.length) {
        const { error: draftError } = await supabase.from("plan_submissions").update({ status: "draft", submitted_at: null, review_note: null, reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() }).eq("weekly_plan_id", entry.weeklyPlanId).eq("teacher_id", profileId).eq("subject_id", entry.subjectId);
        if (draftError) throw draftError;
      }
      setMessage("The lesson was deleted. Other lessons and subjects were not changed.");
      setMessageTone("success");
      await loadTeacherDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The lesson could not be deleted.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  };

  const openWeeklyPlan = async (plan: WeeklyPlanRow) => {
    const week = academicWeeks.find((item) => item.id === plan.weekId);
    const statusAllowsEditing = plan.status === "draft" || plan.status === "changes_requested";
    let canEdit = Boolean(weeklyPlanCreationOpen && week?.teacher_entry_enabled && statusAllowsEditing);
    if (canEdit) canEdit = await verifyTeacherWeekAccess(plan.weekId, false);
    setSelectedClassId(plan.classId);
    setSelectedWeekId(plan.weekId);
    setBuilderFeedback(canEdit ? null : { tone: "info", text: dashboardArabic ? "هذه معاينة فقط. الأسبوع مغلق للتحرير أو أن الخطة مرسلة/معتمدة، لذلك لا يمكن تغيير أي بيانات." : "Preview only. This week is closed for editing or the plan is submitted/approved, so no data can be changed." });
    setPublishedEditPlanId("");
    setWeeklyBuilderReadOnly(!canEdit);
    openWeeklyEditor();
  };

  const openPublishedEdit = async (plan: WeeklyPlanRow) => {
    if (plan.status !== "approved") return;
    setSaving(true);
    try {
      const supabase = getStaffWorkspaceClient();
      const [{ data: livePlan, error: planError }, { data: submissions, error: submissionError }] = await Promise.all([
        supabase.from("weekly_plans").select("id, status").eq("id", plan.planId).single(),
        supabase.from("plan_submissions").select("subject_id, status").eq("weekly_plan_id", plan.planId).eq("teacher_id", profileId),
      ]);
      if (planError || submissionError) throw planError ?? submissionError;
      const ownSubjects = new Set(assignments.filter((assignment) => assignment.classId === plan.classId).map((assignment) => assignment.subjectId));
      if (!(["draft", "published"].includes(livePlan?.status ?? "")) || !ownSubjects.size || (submissions ?? []).filter((submission) => ownSubjects.has(submission.subject_id)).some((submission) => submission.status !== "approved") || !Array.from(ownSubjects).every((subjectId) => (submissions ?? []).some((submission) => submission.subject_id === subjectId && submission.status === "approved"))) {
        throw new Error(dashboardArabic ? "هذه الخطة لم تعد معتمدة لك. حدّث الصفحة وراجع حالتها." : "This plan is no longer approved for you. Refresh and check its status.");
      }
      setSelectedClassId(plan.classId);
      setSelectedWeekId(plan.weekId);
      setPublishedEditPlanId(plan.planId);
      setApprovedEditPublished(livePlan?.status === "published");
      setWeeklyBuilderReadOnly(false);
      setBuilderFeedback({ tone: "info", text: livePlan?.status === "published" ? dashboardArabic ? "أنت تعدّل خطة منشورة. سيظهر التعديل لولي الأمر بعد تأكيد الحفظ إذا كان الأسبوع ظاهرًا له." : "You are editing a published plan. Changes appear for families after confirmation if the week is visible." : dashboardArabic ? "أنت تعدّل خطة معتمدة لم تُنشر بعد. سيُحفظ التعديل دون إعادة إرساله للمشرف، ولن يظهر لولي الأمر قبل استيفاء شروط النشر." : "You are editing an approved plan that is not yet published. Changes are saved without another review and remain hidden until publication conditions are met." });
      openWeeklyEditor();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : dashboardArabic ? "تعذر فتح تعديل الخطة المعتمدة." : "The approved plan could not be opened for editing.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  };

  const openCopyPlanDialog = (plan: WeeklyPlanRow) => {
    setCopySourcePlan(plan);
    setCopyTargetClassId("");
    setCopyFeedback("");
    setCopyConflict(null);
    setCopyDialogOpen(true);
  };

  const closeCopyPlanDialog = () => {
    if (saving) return;
    setCopyDialogOpen(false);
    setCopySourcePlan(null);
    setCopyTargetClassId("");
    setCopyFeedback("");
    setCopyConflict(null);
  };

  const openExistingCopyTarget = async () => {
    if (!copySourcePlan || !copyTargetClassId) return;
    const targetClassId = copyTargetClassId;
    const targetWeekId = copySourcePlan.weekId;
    closeCopyPlanDialog();
    setSelectedClassId(targetClassId);
    setSelectedWeekId(targetWeekId);
    setSlotDrafts({});
    setBuilderFeedback({ tone: "info", text: dashboardArabic ? "الخطة الحالية محفوظة دون تغيير. هذه معاينة فقط؛ استخدم إجراء التعديل المناسب من قائمة الخطط." : "The existing plan was kept unchanged. This is a read-only preview; use the appropriate edit action from your plans." });
    setWeeklyBuilderReadOnly(true);
    openWeeklyEditor();
  };

  const clearWeeklyDraft = async (plan: WeeklyPlanRow) => {
    if (plan.status !== "draft" && plan.status !== "changes_requested") return;
    if (!window.confirm(`Clear your saved draft for ${plan.className}, ${plan.week}? This removes only your lessons and keeps other teachers' work unchanged.`)) return;
    setSaving(true);
    try {
      const supabase = getStaffWorkspaceClient();
      const { error: entryError } = await supabase.from("plan_entries").delete().eq("weekly_plan_id", plan.planId).eq("teacher_id", profileId);
      if (entryError) throw entryError;
      const { error: submissionError } = await supabase.from("plan_submissions").update({ status: "draft", submitted_at: null, review_note: null, reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() }).eq("weekly_plan_id", plan.planId).eq("teacher_id", profileId).in("status", ["draft", "changes_requested"]);
      if (submissionError) throw submissionError;
      setMessage("Your draft lessons for this week were cleared. Other teachers' plans were not changed.");
      setMessageTone("success");
      await loadTeacherDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The weekly draft could not be cleared.");
      setMessageTone("error");
    } finally { setSaving(false); }
  };

  const copyPlanToOtherClasses = async () => {
    if (!copySourcePlan || !copyTargetClassId) return;
    const target = copyTargetClasses.find((item) => item.classId === copyTargetClassId);
    if (!target) return;
    if (!(await verifyTeacherWeekAccess(copySourcePlan.weekId, false))) {
      setCopyFeedback(dashboardArabic ? "الأسبوع مغلق للتحرير؛ لا يمكن إنشاء مسودة منسوخة." : "This week is closed; a copied draft cannot be created.");
      return;
    }
    setSaving(true);
    setCopyFeedback("");
    setCopyConflict(null);
    try {
      const { data, error } = await getStaffWorkspaceClient().rpc("copy_my_weekly_plan", {
        source_plan_id: copySourcePlan.planId, target_class_id: target.classId,
      });
      if (error) {
        const messages: Record<string, [string, string]> = {
          COPY_EMPTY_SOURCE: ["اكتب واحفظ حصة واحدة على الأقل قبل النسخ.", "Write and save at least one lesson before copying."],
          COPY_CLOSED_WEEK: ["الأسبوع مغلق للتحرير؛ لم يتم النسخ.", "This week is closed; nothing was copied."],
          COPY_ACCESS_DENIED: ["لا تملك صلاحية نسخ هذه الخطة أو الكتابة في الفصل المختار.", "You cannot copy this plan or write in the selected class."],
          COPY_GRADE_MISMATCH: ["اختر فصلًا آخر في الصف نفسه.", "Choose another class in the same grade."],
          COPY_SUBJECT_UNAVAILABLE: ["إحدى المواد المكتوبة ليس لها حصص مسندة لك في الفصل المستهدف؛ لم يتم نسخ أي شيء.", "A written subject has no assigned lessons in the target class. Nothing was copied."],
          COPY_INSUFFICIENT_SLOTS: ["عدد حصص إحدى المواد في الفصل المستهدف أقل من الحصص المكتوبة؛ لم يتم نسخ أي شيء.", "A target subject has fewer slots than written source lessons. Nothing was copied."],
          COPY_TARGET_OCCUPIED: ["توجد حصة محفوظة في أحد المواضع المطلوبة؛ لم يتم استبدالها أو نسخ أي شيء.", "A required slot contains saved work. Nothing was replaced or copied."],
        };
        const known = messages[error.message];
        const detail = error.details ? ` (${error.details})` : "";
        throw new Error(known ? known[dashboardArabic ? 0 : 1] + detail : dashboardArabic ? "تعذر نسخ الخطة. لم تُحفظ نسخة جزئية؛ حاول مرة أخرى." : "The plan could not be copied. No partial copy was saved; please try again.");
      }
      if (data?.status === "conflict") {
        setCopyConflict({ targetPlanId: String(data.target_plan_id), targetLabel: dashboardArabic ? `الصف ${target.grade} · ${target.section}` : `Grade ${target.grade} · ${target.section}` });
        return;
      }
      if (data?.status !== "copied" || !data.target_plan_id || !(data.copied_lessons > 0)) throw new Error(dashboardArabic ? "لم تؤكد قاعدة البيانات اكتمال النسخ." : "The database did not confirm the copy.");
      const copiedClassId = target.classId;
      const copiedWeekId = copySourcePlan.weekId;
      const emptySlots = Number(data.empty_slots ?? 0);
      const copiedMessage = dashboardArabic
        ? `تم نسخ جميع موادك المكتوبة إلى الصف ${target.grade} · ${target.section} كمسودة حسب جدول الفصل. راجعها قبل إرسالها للاعتماد.${emptySlots ? ` بقيت ${emptySlots} حصص فارغة تحتاج الاستكمال.` : ""}`
        : `All your written subjects were copied to Grade ${target.grade} · ${target.section} as a draft using its timetable. Review before submitting.${emptySlots ? ` ${emptySlots} extra slots remain empty.` : ""}`;
      await loadTeacherDashboard();
      setCopyDialogOpen(false);
      setCopySourcePlan(null);
      setCopyTargetClassId("");
      setCopyConflict(null);
      setSelectedClassId(copiedClassId);
      setSelectedWeekId(copiedWeekId);
      setSlotDrafts({});
      setQuizSubjectId("");
      setWeeklyBuilderReadOnly(false);
      autoSavedSignature.current = "";
      setMessage(copiedMessage);
      setMessageTone("success");
      setBuilderFeedback({ tone: "success", text: copiedMessage });
      openWeeklyEditor();
    } catch (error) {
      setCopyFeedback(error instanceof Error ? error.message : dashboardArabic ? "تعذر نسخ الخطة." : "The plan could not be copied.");
    } finally {
      setSaving(false);
    }
  };

  const closedReviewWeekMessage = (arabic: boolean) => arabic
    ? "الأسبوع مغلق، تواصل مع الإدارة."
    : "This week is closed. Contact administration.";

  const verifySupervisorWeekAccess = async (weekId: string) => {
    const arabic = window.localStorage.getItem("andalus-language") === "ar";
    const { data, error } = await getStaffWorkspaceClient().from("academic_weeks")
      .select("teacher_entry_enabled").eq("id", weekId).single();
    if (error || !data?.teacher_entry_enabled) {
      if (!error) setAcademicWeeks((current) => current.map((week) => week.id === weekId ? { ...week, teacher_entry_enabled: false } : week));
      setMessage(error
        ? arabic ? "تعذر التحقق من فتح الأسبوع. حدّث الصفحة وحاول مرة أخرى." : "Could not verify week access. Refresh and try again."
        : closedReviewWeekMessage(arabic));
      setMessageTone("error");
      return false;
    }
    return true;
  };

  const reviewErrorMessage = (error: unknown, arabic: boolean, fallback: string) => {
    const detail = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    if (detail.includes("This week is closed. Contact administration.")) setAcademicWeeks((current) => current.map((week) => week.id === selectedReviewWeekId ? { ...week, teacher_entry_enabled: false } : week));
    return detail.includes("This week is closed. Contact administration.")
      ? closedReviewWeekMessage(arabic) : arabic ? fallback : detail || fallback;
  };

  const reviewWeeklyPlan = async (review: SupervisorPlanReview, decision: "approved" | "changes_requested") => {
    const arabic = window.localStorage.getItem("andalus-language") === "ar";
    const note = reviewNotes[review.key]?.trim() ?? "";
    if (decision === "changes_requested" && !note) {
      setMessage(arabic ? "اكتب ملاحظة المراجعة قبل إعادة الخطة الأسبوعية إلى المعلم." : "Write a review note before returning the weekly plan to the teacher.");
      setMessageTone("error");
      return;
    }
    setSaving(true);
    try {
      if (!await verifySupervisorWeekAccess(review.weekId)) return;
      const supabase = getStaffWorkspaceClient();
      const pendingReviewIds = review.reviews.filter((item) => item.status === "submitted").map((item) => item.id);
      const results = await Promise.all(pendingReviewIds.map((submissionId) => supabase.rpc("review_plan_submission", { submission_id: submissionId, decision, note: note || null })));
      const failed = results.find((result) => result.error)?.error;
      if (failed) throw failed;
      setMessage(decision === "approved"
        ? arabic ? "تم اعتماد الخطة الأسبوعية كاملة. ستظهر لأولياء الأمور عند عدم وجود أي خطة مرسلة ما زالت بانتظار المراجعة، وتظهر حصص المعلم الذي لم يرسل بعبارة Plan not published." : "The full weekly plan was approved. It becomes visible when no submitted plan is still waiting for review; lessons from teachers who did not submit show Plan not published."
        : arabic ? "تمت إعادة الخطة الأسبوعية كاملة إلى المعلم مع ملاحظتك." : "The full weekly plan was returned to the teacher with your note.");
      setMessageTone("success");
      setReviewNotes((current) => ({ ...current, [review.key]: "" }));
      await loadTeacherDashboard();
    } catch (error) {
      setMessage(reviewErrorMessage(error, arabic, arabic ? "تعذر إكمال إجراء المراجعة." : "The review action could not be completed."));
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  };

  const reviewSubmission = async (review: ReviewItem, decision: "approved" | "changes_requested") => {
    const matchingReviews = reviewItems.filter((item) => item.weeklyPlanId === review.weeklyPlanId && item.teacherId === review.teacherId);
    const plan: SupervisorPlanReview = {
      key: review.id, weeklyPlanId: review.weeklyPlanId, teacherId: review.teacherId, weekId: review.weekId, classId: review.classId,
      teacherName: review.teacherName, className: review.className, week: review.week,
      status: review.status === "approved" ? "approved" : review.status === "changes_requested" ? "changes_requested" : "submitted",
      submittedAt: review.submittedAt, note: review.note, reviews: matchingReviews, entries: review.entries, quizzes: review.quizzes, weeklyNotes: review.weeklyNotes,
    };
    await reviewWeeklyPlan(plan, decision);
  };

  const approveAllSelectedWeekPlans = async () => {
    if (!selectedReviewWeekId) return;
    const arabic = window.localStorage.getItem("andalus-language") === "ar";
    setBulkApprovalConfirmationOpen(false);
    setSaving(true);
    try {
      if (!await verifySupervisorWeekAccess(selectedReviewWeekId)) return;
      const { data, error } = await getStaffWorkspaceClient().rpc("approve_my_week_submissions", {
        target_week_id: selectedReviewWeekId,
      });
      if (error) throw error;
      const approvedCount = Number(data ?? 0);
      setMessage(approvedCount > 0
        ? arabic ? `تم اعتماد ${approvedCount} خطة مادة مرسلة. ستُنشر خطة كل فصل عند عدم بقاء أي خطة مرسلة قيد المراجعة، وتظهر حصص غير المرسلين بعبارة Plan not published.` : `${approvedCount} submitted subject plan${approvedCount === 1 ? " was" : "s were"} approved. Each class plan publishes when no submitted plan remains under review; missing teachers show Plan not published.`
        : arabic ? "لا توجد خطط مرسلة تنتظر اعتمادك في هذا الأسبوع." : "There were no submitted plans waiting for your approval in this week.");
      setMessageTone(approvedCount > 0 ? "success" : "info");
      await loadTeacherDashboard();
    } catch (error) {
      setMessage(reviewErrorMessage(error, arabic, arabic ? "تعذر اعتماد خطط الأسبوع المحدد." : "The selected week plans could not be approved."));
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  };

  const requestBulkApproval = () => {
    setBulkApprovalArabic(window.localStorage.getItem("andalus-language") === "ar");
    setBulkApprovalConfirmationOpen(true);
  };

  const selectDepartmentTeacher = (teacherId: string) => {
    setSelectedDepartmentTeacherId(teacherId);
    setDepartmentAssignmentDraft({ classId: "", subjectId: "" });
  };

  const addDepartmentAssignment = async (teacherId: string) => {
    if (!teacherId || !departmentAssignmentDraft.classId || !departmentAssignmentDraft.subjectId) return;
    setSaving(true);
    try {
      const supabase = getStaffWorkspaceClient();
      const { error } = await supabase.from("teacher_assignments").insert({ teacher_id: teacherId, class_id: departmentAssignmentDraft.classId, subject_id: departmentAssignmentDraft.subjectId });
      if (error) throw error;
      setDepartmentAssignmentDraft((current) => ({ ...current, subjectId: "" }));
      setMessage("The class and subject were assigned to the teacher.");
      setMessageTone("success");
      await loadTeacherDashboard();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The assignment could not be saved."); setMessageTone("error"); } finally { setSaving(false); }
  };

  const removeDepartmentAssignment = async (assignmentId: string) => {
    setSaving(true);
    try {
      const supabase = getStaffWorkspaceClient();
      const { error } = await supabase.from("teacher_assignments").delete().eq("id", assignmentId);
      if (error) throw error;
      setMessage("The assignment was removed from the teacher.");
      setMessageTone("success");
      await loadTeacherDashboard();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The assignment could not be removed."); setMessageTone("error"); } finally { setSaving(false); }
  };

  const signOut = async () => {
    if (delegatedStaffId()) { window.location.assign(`${basePath}/super-admin/?section=accounts`); return; }
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.replace(`${basePath}/teachers/login/`);
  };

  const currentWeek = academicWeeks.find((week) => week.is_current) ?? academicWeeks[0];
  const weeklyPlanRows = useMemo(() => Array.from(entries.reduce((groups, entry) => {
    const existing = groups.get(entry.weeklyPlanId) ?? { planId: entry.weeklyPlanId, classId: entry.classId, weekId: entry.weekId, className: entry.className, week: entry.week, subjects: [], lessonCount: 0, status: "draft", publicationStatus: entry.publicationStatus, updated: entry.updated } as WeeklyPlanRow;
    if (!existing.subjects.includes(entry.subject)) existing.subjects.push(entry.subject);
    existing.lessonCount += 1;
    groups.set(entry.weeklyPlanId, existing);
    return groups;
  }, new Map<string, WeeklyPlanRow>()).values()).map((plan) => {
    const subjectIds = Array.from(new Set(entries.filter((entry) => entry.weeklyPlanId === plan.planId).map((entry) => entry.subjectId)));
    const statuses = subjectIds.map((subjectId) => mySubmissions.find((submission) => submission.weeklyPlanId === plan.planId && submission.subjectId === subjectId)?.status ?? "draft");
    const status = statuses.some((item) => item === "changes_requested") ? "changes_requested"
      : statuses.some((item) => item === "submitted") ? "submitted"
        : statuses.length > 0 && statuses.every((item) => item === "approved") ? "approved"
          : "draft";
    return { ...plan, status };
  }).sort((a, b) => Number(b.weekId === currentWeek?.id) - Number(a.weekId === currentWeek?.id) || a.week.localeCompare(b.week)), [entries, mySubmissions, currentWeek?.id]);
  const waitingReviews = reviewItems.filter((item) => item.status === "submitted");
  const dashboardWeeks = academicWeeks.filter((week) => week.teacher_entry_enabled || entries.some((entry) => entry.weekId === week.id) || isSupervisor && reviewItems.some((review) => review.weekId === week.id));
  const dashboardWeek = academicWeeks.find((week) => week.id === dashboardWeekId);
  const dashboardPlans = weeklyPlanRows.filter((plan) => plan.weekId === dashboardWeekId);
  const incompleteOwnPlans = dashboardPlans.map((plan) => {
    const week = academicWeeks.find((item) => item.id === plan.weekId);
    const requiredSlots = assignedPlanSlotsForWeek(timetableSlots, assignments, profileId, plan.classId, week, schoolHolidays);
    const missingSlots = requiredSlots.filter((slot) => !entries.some((entry) => entry.weeklyPlanId === plan.planId && entry.subjectId === slot.subject_id && entry.hasClasswork
      && (entry.timetableSlotId ? entry.timetableSlotId === slot.id : entry.dayOfWeek === slot.day_of_week && entry.periodNumber === slot.period_number)));
    return { plan, missingSlots };
  }).filter((item) => item.missingSlots.length > 0);
  const incompleteSupervisedPlanMap = new Map<string, { teacherId: string; teacherName: string; classId: string; className: string; missingSlots: TimetableSlot[] }>();
  if (isSupervisor && dashboardWeek) reviewItems.filter((review) => review.weekId === dashboardWeekId).forEach((review) => {
    const teacher = departmentTeachers.find((item) => item.userId === review.teacherId);
    if (!teacher) return;
    const requiredSlots = assignedPlanSlotsForWeek(timetableSlots, teacher.assignments, teacher.userId, review.classId, dashboardWeek, schoolHolidays)
      .filter((slot) => slot.subject_id === review.subjectId);
    const missingSlots = requiredSlots.filter((slot) => !review.entries.some((entry) => entry.day === dayNames[slot.day_of_week] && entry.period === slot.period_number && entry.classwork.trim()));
    if (!missingSlots.length) return;
    const key = `${review.teacherId}:${review.classId}`;
    const existing = incompleteSupervisedPlanMap.get(key) ?? { teacherId: review.teacherId, teacherName: review.teacherName, classId: review.classId, className: review.className, missingSlots: [] };
    missingSlots.forEach((slot) => { if (!existing.missingSlots.some((item) => item.id === slot.id)) existing.missingSlots.push(slot); });
    incompleteSupervisedPlanMap.set(key, existing);
  });
  const incompleteSupervisedPlans = Array.from(incompleteSupervisedPlanMap.values());
  const actionablePlans = dashboardPlans.filter((plan) => plan.status === "draft" || plan.status === "changes_requested");
  const submittedPlans = dashboardPlans.filter((plan) => plan.status === "submitted");
  const approvedPlans = dashboardPlans.filter((plan) => plan.status === "approved");
  const assignedClassChoices = Array.from(new Map(assignments.map((assignment) => [assignment.classId, { id: assignment.classId, name: `Grade ${assignment.grade} · ${assignment.section}` }])).values());
  const unstartedClasses = assignedClassChoices.filter((schoolClass) =>
    timetableSlots.some((slot) => slot.class_id === schoolClass.id && slot.teacher_id === profileId)
    && !dashboardPlans.some((plan) => plan.classId === schoolClass.id));
  const dashboardWaitingReviews = waitingReviews.filter((review) => review.weekId === dashboardWeekId);
  const dashboardWaitingPlans = Array.from(new Map(dashboardWaitingReviews.map((review) => [`${review.teacherId}-${review.classId}`, review])).values());
  const missingTeacherClassPlans = departmentTeachers.flatMap((teacher) => {
    const assignedClasses = Array.from(new Map(teacher.assignments.filter((assignment) =>
      timetableSlots.some((slot) => slot.class_id === assignment.classId && slot.subject_id === assignment.subjectId && slot.teacher_id === teacher.userId)
    ).map((assignment) => [assignment.classId, assignment])).values());
    return assignedClasses.filter((assignment) => !reviewItems.some((review) =>
      review.weekId === dashboardWeekId && review.teacherId === teacher.userId && review.classId === assignment.classId
    )).map((assignment) => ({ teacherId: teacher.userId, teacherName: teacher.name, classId: assignment.classId, className: `Grade ${assignment.grade} · ${assignment.section}` }));
  });
  const pendingTeacherCount = new Set(missingTeacherClassPlans.map((item) => item.teacherId)).size;
  const todayDayIndex = dayNames.indexOf(new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Africa/Cairo" }).format(new Date()));
  const todayLessons = personalTimetable.filter((slot) => slot.day_of_week === todayDayIndex);
  const visibleWeeklyPlans = weeklyPlanRows.filter((plan) => plan.weekId === dashboardWeekId && (planViewFilter === "all" || (planViewFilter === "needs_action" ? plan.status === "draft" || plan.status === "changes_requested" : plan.status === planViewFilter)));
  const selectedReviewWeek = academicWeeks.find((week) => week.id === selectedReviewWeekId);
  const supervisorReviewClasses = useMemo(() => {
    const assignedClasses = departmentTeachers.flatMap((teacher) => teacher.assignments.map((assignment) => [
      assignment.classId,
      { id: assignment.classId, name: `Grade ${assignment.grade} · ${assignment.section}`, grade: assignment.grade, section: assignment.section },
    ] as const));
    const submittedClasses = reviewItems.map((item) => [
      item.classId,
      { id: item.classId, name: item.className, grade: Number(item.className.match(/Grade\s+(\d+)/)?.[1] ?? 0), section: item.className.split("·")[1]?.trim() ?? "" },
    ] as const);
    return Array.from(new Map([...assignedClasses, ...submittedClasses]).values()).sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section));
  }, [departmentTeachers, reviewItems]);
  const effectiveReviewClassId = selectedReviewClassId && supervisorReviewClasses.some((schoolClass) => schoolClass.id === selectedReviewClassId) ? selectedReviewClassId : "";
  const selectedClassReviewRawItems = reviewItems.filter((item) => (!effectiveReviewClassId || item.classId === effectiveReviewClassId) && item.weekId === selectedReviewWeekId);
  const selectedClassTeacherPlans = useMemo(() => Array.from(selectedClassReviewRawItems.reduce((groups, item) => {
    const key = `${item.teacherId}-${item.weeklyPlanId || `${item.weekId}-${item.classId}`}`;
    const current = groups.get(key) ?? {
      key, weeklyPlanId: item.weeklyPlanId, teacherId: item.teacherId, weekId: item.weekId, classId: item.classId,
      teacherName: item.teacherName, className: item.className, week: item.week, status: "approved", submittedAt: item.submittedAt,
      note: "", reviews: [], entries: [], quizzes: [], weeklyNotes: [],
    } as SupervisorPlanReview;
    current.reviews.push(item);
    current.entries.push(...item.entries);
    current.quizzes.push(...item.quizzes);
    current.weeklyNotes.push(...item.weeklyNotes);
    if (item.status === "submitted") current.status = "submitted";
    else if (current.status !== "submitted" && item.status === "changes_requested") current.status = "changes_requested";
    if (!current.note && item.note) current.note = item.note;
    groups.set(key, current);
    return groups;
  }, new Map<string, SupervisorPlanReview>()).values()).map((plan) => ({ ...plan, entries: plan.entries.sort((a, b) => dayNames.indexOf(a.day) - dayNames.indexOf(b.day) || a.period - b.period), quizzes: Array.from(new Map(plan.quizzes.map((quiz) => [`${quiz.subject}-${quiz.date}-${quiz.details}`, quiz])).values()), weeklyNotes: Array.from(new Set(plan.weeklyNotes)) })), [selectedClassReviewRawItems]);
  const selectedClassReviewItems = useMemo(() => selectedClassTeacherPlans
    .map((plan) => ({
      id: plan.key, weeklyPlanId: plan.weeklyPlanId, teacherId: plan.teacherId, subjectId: plan.reviews[0]?.subjectId ?? "", weekId: plan.weekId, classId: plan.classId,
      teacherName: plan.teacherName, className: plan.className, week: plan.week,
      subject: plan.reviews.map((item) => item.subject).join(" + "), status: plan.status, note: plan.note, submittedAt: plan.submittedAt, entries: plan.entries, quizzes: plan.quizzes, weeklyNotes: plan.weeklyNotes,
    })).sort((a, b) => Number(b.status === "submitted") - Number(a.status === "submitted") || a.className.localeCompare(b.className) || a.teacherName.localeCompare(b.teacherName)), [selectedClassTeacherPlans]);
  const selectedWeekWaitingReviews = reviewItems.filter((item) => item.weekId === selectedReviewWeekId && item.status === "submitted");
  const selectedWeekPendingCount = selectedWeekWaitingReviews.length;
  const selectedReviewWeekOpen = Boolean(academicWeeks.find((week) => week.id === selectedReviewWeekId)?.teacher_entry_enabled);
  const selectedDepartmentTeacher = departmentTeachers.find((teacher) => teacher.userId === selectedDepartmentTeacherId);
  const workspaceNavigation = isSupervisor ? supervisorNavigation : isFaridTeacher ? faridNavigation : navigation;
  const navLabel = (label: string) => dashboardArabic ? ({ Overview: "الرئيسية", "Weekly Plans": "خططي الأسبوعية", "Quizzes": "الاختبارات", "My Timetable": "جدول حصصي", "My Classes": "فصولي", "My Subjects": "موادي", Calendar: "الأسابيع الدراسية", "Teacher Reviews": "مراجعة الخطط", "Department Teachers": "معلمو القسم", "Profile & assignments": "ملفي وتكليفاتي", Settings: "الإعدادات" } as Record<string, string>)[label] ?? label : label;
  const openWorkspaceSection = (label: string) => {
    if (activeNav !== label) {
      const url = new URL(window.location.href);
      url.searchParams.set("section", label);
      url.searchParams.delete("editor");
      window.history.pushState({ staffSection: label }, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setActiveNav(label);
    setMobileNavigationOpen(false);
  };
  const openDashboardPlanList = (filter: typeof planViewFilter) => {
    setPlanViewFilter(filter);
    openWorkspaceSection("Weekly Plans");
  };
  const incompleteOwnPlanAction = (plan: WeeklyPlanRow): "edit_approved" | "complete" | "preview" => {
    const weekOpen = Boolean(weeklyPlanCreationOpen && academicWeeks.find((week) => week.id === plan.weekId)?.teacher_entry_enabled);
    if (plan.status === "approved" && weeklyPlanCreationOpen) {
      const classSubjectIds = assignments.filter((assignment) => assignment.classId === plan.classId).map((assignment) => assignment.subjectId);
      const allSubjectsApproved = classSubjectIds.length > 0 && classSubjectIds.every((subjectId) => mySubmissions.some((submission) => submission.classId === plan.classId && submission.weekId === plan.weekId && submission.subjectId === subjectId && submission.status === "approved"));
      if (allSubjectsApproved) return "edit_approved";
      if (weekOpen) return "complete";
    }
    if ((plan.status === "draft" || plan.status === "changes_requested") && weekOpen) return "complete";
    return "preview";
  };
  const openIncompleteOwnPlan = (plan: WeeklyPlanRow) => {
    const action = incompleteOwnPlanAction(plan);
    if (action === "edit_approved") void openPublishedEdit(plan);
    else if (action === "complete" && plan.status === "approved") void openWeeklyBuilder(plan.weekId, plan.classId);
    else void openWeeklyPlan(plan);
  };
  const openIncompleteSupervisedPlan = (classId: string) => {
    setSelectedReviewWeekId(dashboardWeekId);
    setSelectedReviewClassId(classId);
    openWorkspaceSection("Teacher Reviews");
    window.setTimeout(() => document.getElementById("supervisor-review-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const openFirstWaitingReview = () => {
    const firstWaitingReview = waitingReviews[0];
    if (!firstWaitingReview) return;
    setSelectedReviewWeekId(firstWaitingReview.weekId);
    setSelectedReviewClassId(firstWaitingReview.classId);
    openWorkspaceSection("Teacher Reviews");
    window.setTimeout(() => document.getElementById("supervisor-review-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const openSelectedWeekWaitingReview = () => {
    const nextReview = selectedWeekWaitingReviews.find((item) => item.classId !== selectedReviewClassId) ?? selectedWeekWaitingReviews[0];
    if (!nextReview) return;
    setSelectedReviewClassId(nextReview.classId);
    window.setTimeout(() => document.getElementById("supervisor-review-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return (
    <main className={`teacher-portal${!isSupervisor ? " teacher-dashboard-refresh" : ""}`}>
      <aside className="teacher-sidebar">
        <div className="teacher-brand"><img src={`${basePath}/school-logo.png`} alt="AlAndalus Private Schools" /><div><strong>ALANDALUS</strong><span>{dashboardArabic ? isSupervisor ? "مساحة المشرف" : "مساحة المعلم" : isSupervisor ? "Supervisor Workspace" : "Teacher Workspace"}</span></div></div>
        <div className="teacher-school-year"><span>{dashboardArabic ? "العام الدراسي" : "Academic year"}</span><strong>2026–2027</strong></div>
        <nav className="teacher-nav" aria-label="Teacher workspace navigation">
          <p>{dashboardArabic ? "مساحة العمل" : "Workspace"}</p>
          {workspaceNavigation.map(([label, icon]) => <button key={label} className={activeNav === label ? "active" : ""} onClick={() => openWorkspaceSection(label)}><span className="teacher-nav-icon">{icon}</span>{navLabel(label)}{label === "Weekly Plans" && <small>{weeklyPlanRows.length}</small>}{label === "Teacher Reviews" && <small>{waitingReviews.length}</small>}{label === "Department Teachers" && <small>{departmentTeachers.length}</small>}</button>)}
          <p>{dashboardArabic ? "الحساب" : "Account"}</p>
          <button className={activeNav === "Profile & assignments" ? "active" : ""} onClick={() => openWorkspaceSection("Profile & assignments")}><span className="teacher-nav-icon">PR</span>{navLabel("Profile & assignments")}</button>
          <button className={activeNav === "Settings" ? "active" : ""} onClick={() => openWorkspaceSection("Settings")}><span className="teacher-nav-icon">ST</span>{navLabel("Settings")}</button>
        </nav>
        <div className="teacher-help-card"><span>?</span><strong>{dashboardArabic ? "تحتاج مساعدة؟" : "Need help?"}</strong><p>{dashboardArabic ? "تواصل مع منسق المدرسة لتعديل الحساب أو التكليفات." : "Contact the academic coordinator for account or assignment changes."}</p><Link href="/support/">{dashboardArabic ? "الدعم الفني" : "Open support"}</Link></div>
        <div className="teacher-sidebar-profile"><span className="teacher-avatar">{initials(teacherName)}</span><div><strong>{teacherName}</strong><small>{dashboardArabic ? isSupervisor ? "مشرف" : "معلم" : isSupervisor ? "Supervisor" : "Teacher"}</small></div><button aria-label={dashboardArabic ? "تسجيل الخروج" : "Sign out"} onClick={() => void signOut()}>↪</button></div>
      </aside>

      <section className="teacher-main">
      {workingOnBehalf && <div className="staff-delegation-banner" role="status" dir={dashboardArabic ? "rtl" : "ltr"}>
        <div><strong>{dashboardArabic ? `المشرف العام يعمل نيابةً عن: ${teacherName}` : `General Supervisor working on behalf of: ${teacherName}`}</strong><small>{dashboardArabic ? "حفظ يدوي فقط. تُسجل إجراءاتك باسمك الإداري، وتظل قواعد الأسبوع والاعتماد مطبقة." : "Manual save only. Actions are recorded under your admin account; week and approval rules still apply."}</small></div>
        <a href={`${basePath}/super-admin/?section=accounts`}>{dashboardArabic ? "العودة للمشرف العام" : "Return to General Supervisor"}</a>
      </div>}
        <div className={`teacher-mobile-menu ${mobileNavigationOpen ? "is-open" : ""}`} aria-hidden={!mobileNavigationOpen}>
          <button type="button" className="teacher-mobile-menu-backdrop" aria-label="Close workspace menu" onClick={() => setMobileNavigationOpen(false)} />
          <div className="teacher-mobile-menu-panel" role="dialog" aria-modal="true" aria-label="Teacher workspace menu">
            <div className="teacher-mobile-menu-heading"><div className="teacher-brand"><img src={`${basePath}/school-logo.png`} alt="" /><div><strong>ALANDALUS</strong><span>{dashboardArabic ? isSupervisor ? "مساحة المشرف" : "مساحة المعلم" : isSupervisor ? "Supervisor Workspace" : "Teacher Workspace"}</span></div></div><button type="button" aria-label="Close menu" onClick={() => setMobileNavigationOpen(false)}>×</button></div>
            <nav className="teacher-nav" aria-label="Teacher workspace navigation">
              <p>{dashboardArabic ? "مساحة العمل" : "Workspace"}</p>
              {workspaceNavigation.map(([label, icon]) => <button key={label} className={activeNav === label ? "active" : ""} onClick={() => openWorkspaceSection(label)}><span className="teacher-nav-icon">{icon}</span>{navLabel(label)}{label === "Weekly Plans" && <small>{weeklyPlanRows.length}</small>}{label === "Teacher Reviews" && <small>{waitingReviews.length}</small>}{label === "Department Teachers" && <small>{departmentTeachers.length}</small>}</button>)}
              <p>{dashboardArabic ? "الحساب" : "Account"}</p>
              <button className={activeNav === "Profile & assignments" ? "active" : ""} onClick={() => openWorkspaceSection("Profile & assignments")}><span className="teacher-nav-icon">PR</span>{navLabel("Profile & assignments")}</button>
              <button className={activeNav === "Settings" ? "active" : ""} onClick={() => openWorkspaceSection("Settings")}><span className="teacher-nav-icon">ST</span>{navLabel("Settings")}</button>
            </nav>
            <div className="teacher-sidebar-profile"><span className="teacher-avatar">{initials(teacherName)}</span><div><strong>{teacherName}</strong><small>Teacher</small></div><button aria-label="Sign out" onClick={() => void signOut()}>↪</button></div>
          </div>
        </div>
        <header className="teacher-topbar"><button type="button" className="teacher-mobile-menu-button" aria-label="Open workspace menu" aria-expanded={mobileNavigationOpen} onClick={() => setMobileNavigationOpen(true)}>☰</button><div className="teacher-mobile-brand"><img src={`${basePath}/school-logo.png`} alt="" /><strong>{dashboardArabic ? isSupervisor ? "لوحة المشرف" : "لوحة المعلم" : isSupervisor ? "Supervisor Workspace" : "Teacher Workspace"}</strong></div><span className="teacher-topbar-caption">{dashboardArabic ? "خططك وحصصك في مكان واحد" : "Your plans and lessons in one place"}</span><div className="teacher-top-actions"><span className="teacher-sync"><i /> {dashboardArabic ? "متصل بالمنصة" : "Workspace connected"}</span><button className="teacher-profile-chip"><span className="teacher-avatar">{initials(teacherName)}</span><span><strong>{teacherName}</strong><small>{departmentName}</small></span></button></div></header>
        {isSupervisor && <nav className="teacher-mobile-supervisor-nav" aria-label="Supervisor workspace navigation">{supervisorNavigation.map(([label, icon]) => <button key={label} className={activeNav === label ? "active" : ""} onClick={() => openWorkspaceSection(label)}><span>{icon}</span><b>{navLabel(label)}</b>{label === "Teacher Reviews" && waitingReviews.length > 0 && <i>{waitingReviews.length}</i>}{label === "Department Teachers" && <i>{departmentTeachers.length}</i>}</button>)}</nav>}

        <div className="teacher-content">
          <div className="teacher-page-heading"><div><p className="teacher-kicker">{dashboardWeek ? dashboardArabic ? `الأسبوع ${dashboardWeek.week_number} · ${academicWeekRange(dashboardWeek, true)}` : `Week ${dashboardWeek.week_number} · ${academicWeekRange(dashboardWeek)}` : dashboardArabic ? "مساحة العمل" : "Staff workspace"}</p><h1>{activeNav === "Overview" ? dashboardArabic ? `أهلًا، ${teacherName}` : `Welcome, ${teacherName}.` : navLabel(activeNav)}</h1><span>{activeNav === "Overview" ? dashboardArabic ? isSupervisor ? "خطط معلميك، خطتك، وحصصك أمامك في صفحة واحدة." : "تابع خططك وحصصك وما يحتاج منك إجراء هذا الأسبوع." : isSupervisor ? "Review your teachers' plans, write your own, and follow your lessons in one place." : "See the plans and lessons needing your attention this week." : dashboardArabic ? "اختر الإجراء المناسب وتابع حالته بوضوح." : "Choose the next action and follow its status clearly."}</span></div><div className="teacher-heading-actions"><button type="button" className="teacher-primary-button" disabled={saving || !weeklyPlanCreationOpen || !dashboardWeek?.teacher_entry_enabled} aria-busy={loading} onClick={() => void openWeeklyBuilder(dashboardWeekId)}><span>＋</span> {loading ? dashboardArabic ? "جارٍ تحميل البيانات…" : "Loading teacher data…" : weeklyPlanCreationOpen && dashboardWeek?.teacher_entry_enabled ? dashboardArabic ? isSupervisor ? "إعداد خطتي التعليمية" : "إعداد خطة الأسبوع" : isSupervisor ? "Write my teaching plan" : "Create weekly plan" : dashboardArabic ? "الأسبوع مغلق للتحرير" : "Week closed for editing"}</button></div></div>

          {message && <p className={`super-admin-live-message ${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{message}</p>}

          {activeNav === "Quizzes" && isFaridTeacher && <FaridQuizzesPanel weeks={academicWeeks} assignments={assignments} teacherId={profileId} initialWeekId={dashboardWeekId} readOnly={workingOnBehalf} arabic={dashboardArabic} />}

          {activeNav === "Overview" && <section className="staff-dashboard" aria-label={dashboardArabic ? "ملخص الأسبوع" : "Weekly overview"}>
            <div className="staff-dashboard-hero"><div><span className="staff-dashboard-eyebrow">{dashboardArabic ? isSupervisor ? "لوحة متابعة المشرف" : "لوحة متابعة المعلم" : isSupervisor ? "Supervisor dashboard" : "Teacher dashboard"}</span><h2>{dashboardArabic ? "ابدأ بما يحتاج اهتمامك" : "Start with what needs your attention"}</h2><p>{dashboardArabic ? "الأرقام والإجراءات التالية تخص الأسبوع المختار فقط، وحصصك مأخوذة من جدول المدرسة." : "The figures and actions below belong to the selected week. Your lessons come from the school timetable."}</p></div><label>{dashboardArabic ? "الأسبوع الدراسي" : "School week"}<select value={dashboardWeekId} onChange={(event) => { setDashboardWeekId(event.target.value); setPlanViewFilter("all"); }} aria-label={dashboardArabic ? "اختر الأسبوع الدراسي" : "Choose school week"}>{dashboardWeeks.map((week) => <option key={week.id} value={week.id}>{dashboardArabic ? `الأسبوع ${week.week_number}` : `Week ${week.week_number}`} · {academicWeekRange(week, dashboardArabic)}</option>)}</select><small>{dashboardWeek ? dashboardWeek.teacher_entry_enabled ? dashboardArabic ? "مفتوح لكتابة الخطط" : "Open for plan writing" : dashboardArabic ? "مغلق للتحرير · المعاينة متاحة" : "Editing closed · preview available" : dashboardArabic ? "لا يوجد أسبوع متاح حاليًا" : "No available week right now"}</small></label></div>
            <div className="staff-dashboard-metrics">
              {isSupervisor && <button type="button" className="staff-metric review" onClick={() => { setSelectedReviewWeekId(dashboardWeekId); setSelectedReviewClassId(""); openWorkspaceSection("Teacher Reviews"); }}><span>{dashboardArabic ? "تنتظر مراجعتي" : "Waiting for my review"}</span><strong>{dashboardWaitingPlans.length}</strong><small>{dashboardArabic ? "افتح خطط المعلمين المرسلة" : "Open submitted teacher plans"}</small></button>}
              <button type="button" className="staff-metric action" onClick={() => openDashboardPlanList("needs_action")}><span>{dashboardArabic ? "تحتاج مني إجراء" : "Need my action"}</span><strong>{actionablePlans.length + unstartedClasses.length}</strong><small>{dashboardArabic ? "مسودات أو فصول لم أبدأها" : "Drafts or classes not started"}</small></button>
              <button type="button" className="staff-metric sent" onClick={() => openDashboardPlanList("submitted")}><span>{dashboardArabic ? "مرسلة للمراجعة" : "Sent for review"}</span><strong>{submittedPlans.length}</strong><small>{dashboardArabic ? "متابعة حالة خططي" : "Follow my plan status"}</small></button>
              <button type="button" className="staff-metric approved" onClick={() => openDashboardPlanList("approved")}><span>{dashboardArabic ? isSupervisor ? "خططي المعتمدة تلقائيًا" : "خطط معتمدة" : isSupervisor ? "My auto-approved plans" : "Approved plans"}</span><strong>{approvedPlans.length}</strong><small>{dashboardArabic ? "عرض الخطط المعتمدة" : "View approved plans"}</small></button>
              {isSupervisor && <button type="button" className="staff-metric missing" onClick={() => document.getElementById("staff-missing-teachers")?.scrollIntoView({ behavior: "smooth", block: "start" })}><span>{dashboardArabic ? "معلمون لهم فصول بلا خطة مرسلة" : "Teachers with classes not sent"}</span><strong>{pendingTeacherCount}</strong><small>{dashboardArabic ? "عرض الأسماء والفصول" : "See names and classes"}</small></button>}
            </div>
            {(incompleteOwnPlans.length > 0 || incompleteSupervisedPlans.length > 0) && <section className="teacher-card staff-attention-panel" aria-label={dashboardArabic ? "خطط بها حصص ناقصة" : "Plans with missing lessons"}>
              <header><div><span className="staff-attention-kicker">{dashboardArabic ? "يرجى الانتباه" : "Needs attention"}</span><h3>{dashboardArabic ? "حصص لم يُكتب لها عمل الحصة" : "Lessons missing Classwork"}</h3><p>{dashboardArabic ? "الحصص التالية من جدول الأسبوع المختار. لا تُحسب الواجبات أو ملاحظات كلاسيرا بديلًا عن عمل الحصة." : "These lessons belong to the selected week's timetable. Homework and Classera notes do not replace Classwork."}</p></div><b>{incompleteOwnPlans.length + incompleteSupervisedPlans.length}</b></header>
              {incompleteOwnPlans.length > 0 && <div className="staff-attention-group"><h4>{dashboardArabic ? isSupervisor ? "خططي أنا" : "خططي" : "My plans"}</h4><div className="staff-attention-list">{incompleteOwnPlans.map(({ plan, missingSlots }) => <article key={plan.planId}><div className="staff-attention-row-heading"><strong>{plan.className}</strong><small>{dashboardArabic ? `${missingSlots.length} حصص ناقصة` : `${missingSlots.length} missing lessons`}</small></div><div className="staff-attention-lessons">{missingSlots.map((slot) => <span key={slot.id}>{dashboardArabic ? arabicDayNames[dayNames[slot.day_of_week]] : dayNames[slot.day_of_week]} · {dashboardArabic ? "الحصة" : "Period"} {slot.period_number} · {schoolSubjects.find((subject) => subject.id === slot.subject_id)?.name_en ?? (dashboardArabic ? "المادة" : "Subject")}</span>)}</div><button type="button" disabled={saving} onClick={() => openIncompleteOwnPlan(plan)}>{incompleteOwnPlanAction(plan) === "edit_approved" ? dashboardArabic ? "تعديل الخطة" : "Edit plan" : incompleteOwnPlanAction(plan) === "complete" ? dashboardArabic ? "استكمال الخطة" : "Complete plan" : dashboardArabic ? "معاينة الخطة" : "Preview plan"} ←</button></article>)}</div></div>}
              {isSupervisor && incompleteSupervisedPlans.length > 0 && <div className="staff-attention-group"><h4>{dashboardArabic ? "خطط معلمي القسم" : "Department teachers' plans"}</h4><div className="staff-attention-list">{incompleteSupervisedPlans.map((item) => <article key={`${item.teacherId}:${item.classId}`}><div className="staff-attention-row-heading"><strong>{item.teacherName} · {item.className}</strong><small>{dashboardArabic ? `${item.missingSlots.length} حصص ناقصة` : `${item.missingSlots.length} missing lessons`}</small></div><div className="staff-attention-lessons">{item.missingSlots.map((slot) => <span key={slot.id}>{dashboardArabic ? arabicDayNames[dayNames[slot.day_of_week]] : dayNames[slot.day_of_week]} · {dashboardArabic ? "الحصة" : "Period"} {slot.period_number} · {schoolSubjects.find((subject) => subject.id === slot.subject_id)?.name_en ?? (dashboardArabic ? "المادة" : "Subject")}</span>)}</div><button type="button" onClick={() => openIncompleteSupervisedPlan(item.classId)}>{dashboardArabic ? "عرض خطة المعلم" : "View teacher plan"} ←</button></article>)}</div></div>}
            </section>}
            <div className="staff-dashboard-panels">
              <section className="teacher-card staff-dashboard-panel"><header><div><span>{dashboardArabic ? "خطوتك التالية" : "Your next step"}</span><h3>{dashboardArabic ? "خططي لهذا الأسبوع" : "My plans this week"}</h3></div><button type="button" onClick={() => openDashboardPlanList("all")}>{dashboardArabic ? "عرض كل الخطط" : "View all plans"} ←</button></header>{!isSupervisor ? <div className="teacher-overview-class-grid">
                {dashboardPlans.map((plan) => {
                  const editable = (plan.status === "draft" || plan.status === "changes_requested") && weeklyPlanCreationOpen && Boolean(dashboardWeek?.teacher_entry_enabled);
                  const tone = plan.status === "approved" ? "approved" : plan.status === "submitted" ? "sent" : "action";
                  const status = dashboardArabic ? plan.status === "approved" ? "معتمدة" : plan.status === "submitted" ? "مرسلة للمراجعة" : plan.status === "changes_requested" ? "مطلوب تعديل" : "مسودة" : plan.status === "approved" ? "Approved" : plan.status === "submitted" ? "Sent for review" : plan.status === "changes_requested" ? "Changes requested" : "Draft";
                  return <article className={`teacher-overview-class ${tone}`} key={plan.planId}>
                    <header><h4 dir="ltr">{plan.className}</h4><span>{status}</span></header>
                    <div><strong dir="ltr">{plan.subjects.join(" · ")}</strong><p>{dashboardArabic ? `${plan.lessonCount} حصص مكتوبة في خطة الأسبوع` : `${plan.lessonCount} lessons written in this week's plan`}</p><button type="button" disabled={saving} onClick={() => void openWeeklyPlan(plan)}>{dashboardArabic ? editable ? "استكمال الخطة" : "معاينة الخطة" : editable ? "Continue plan" : "Preview plan"} ←</button></div>
                  </article>;
                })}
                {unstartedClasses.map((schoolClass) => <article className="teacher-overview-class not-started" key={schoolClass.id}><header><h4 dir="ltr">{schoolClass.name}</h4><span>{dashboardArabic ? "لم تبدأ بعد" : "Not started"}</span></header><div><p>{dashboardArabic ? "ابدأ كتابة خطة هذا الفصل للأسبوع المختار." : "Start this class plan for the selected week."}</p><button type="button" disabled={saving || !dashboardWeek?.teacher_entry_enabled || !weeklyPlanCreationOpen} onClick={() => void openWeeklyBuilder(dashboardWeekId, schoolClass.id)}>{dashboardArabic ? "ابدأ الخطة" : "Start plan"} ＋</button></div></article>)}
                {dashboardPlans.length + unstartedClasses.length === 0 && <p className="staff-dashboard-empty">{dashboardArabic ? "لا توجد خطط أو فصول مكلّف بها في هذا الأسبوع." : "No plans or assigned classes for this week."}</p>}
              </div> : <div className="staff-task-list">
                {actionablePlans.slice(0, 4).map((plan) => <button type="button" key={plan.planId} className={`staff-task-plan-card ${plan.status === "changes_requested" ? "needs-changes" : "draft"}`} onClick={() => void openWeeklyPlan(plan)}><span className="staff-task-icon">✎</span><span><strong>{plan.className}</strong><small>{dashboardArabic ? plan.status === "changes_requested" ? "أُعيدت للتعديل" : "مسودة تحتاج استكمالًا" : plan.status === "changes_requested" ? "Changes requested" : "Draft to complete"}</small></span><em>←</em></button>)}
                {unstartedClasses.slice(0, Math.max(0, 4 - actionablePlans.length)).map((schoolClass) => <button type="button" key={schoolClass.id} className="staff-task-plan-card not-started" disabled={!dashboardWeek?.teacher_entry_enabled || !weeklyPlanCreationOpen} onClick={() => void openWeeklyBuilder(dashboardWeekId, schoolClass.id)}><span className="staff-task-icon">＋</span><span><strong>{schoolClass.name}</strong><small>{dashboardArabic ? "لم تبدأ خطته بعد" : "Plan not started yet"}</small></span><em>←</em></button>)}
                {actionablePlans.length + unstartedClasses.length === 0 && <p className="staff-dashboard-empty">{dashboardArabic ? "لا توجد خطط تحتاج منك إجراء في هذا الأسبوع." : "No plans need your action this week."}</p>}
              </div>}</section>
              <section className="teacher-card staff-dashboard-panel timetable-preview"><header><div><span>{dashboardArabic ? "من جدول المدرسة" : "From the school timetable"}</span><h3>{dashboardArabic ? todayDayIndex >= 0 && todayDayIndex < 5 ? `حصص ${arabicDayNames[dayNames[todayDayIndex]]}` : "جدول حصصي" : todayDayIndex >= 0 && todayDayIndex < 5 ? `${dayNames[todayDayIndex]} lessons` : "My timetable"}</h3></div><button type="button" onClick={() => openWorkspaceSection("My Timetable")}>{dashboardArabic ? "الجدول كاملًا" : "Full timetable"} ←</button></header><div className="staff-task-list">
                {todayLessons.slice(0, 5).map((slot) => <div className="staff-lesson-row" key={slot.id}><span>{dashboardArabic ? `ح ${slot.period_number}` : `P${slot.period_number}`}</span><strong>{slot.subject}</strong><small>{slot.className}</small></div>)}
                {todayLessons.length === 0 && <p className="staff-dashboard-empty">{dashboardArabic ? todayDayIndex < 0 || todayDayIndex > 4 ? "لا توجد حصص اليوم. افتح الجدول لعرض أيام الدراسة." : "لا توجد حصص مسجلة لك اليوم." : todayDayIndex < 0 || todayDayIndex > 4 ? "No lessons today. Open the timetable for school days." : "No lessons are scheduled for you today."}</p>}
              </div></section>
            </div>
            {isSupervisor && <div className="staff-supervisor-followup">
              <section className="teacher-card staff-dashboard-panel staff-review-preview"><header><div><span>{dashboardArabic ? "متابعة معلمي القسم" : "Department follow-up"}</span><h3>{dashboardArabic ? "الخطط المنتظرة الآن" : "Plans waiting now"}</h3></div><button type="button" onClick={() => { setSelectedReviewWeekId(dashboardWeekId); setSelectedReviewClassId(""); openWorkspaceSection("Teacher Reviews"); }}>{dashboardArabic ? "فتح المراجعة" : "Open reviews"} ←</button></header><div className="staff-review-quick-list">{dashboardWaitingPlans.slice(0, 4).map((review) => <button type="button" key={`${review.teacherId}-${review.classId}`} onClick={() => { setSelectedReviewWeekId(dashboardWeekId); setSelectedReviewClassId(review.classId); openWorkspaceSection("Teacher Reviews"); }}><strong>{review.teacherName}</strong><span>{review.className}</span><em>{dashboardArabic ? "مراجعة" : "Review"} ←</em></button>)}{dashboardWaitingPlans.length === 0 && <p className="staff-dashboard-empty">{dashboardArabic ? "لا توجد خطط مرسلة تنتظر مراجعتك في هذا الأسبوع." : "No submitted plans are waiting for your review this week."}</p>}</div></section>
              <section className="teacher-card staff-dashboard-panel staff-missing-preview" id="staff-missing-teachers"><header><div><span>{dashboardArabic ? "متابعة الإرسال" : "Submission follow-up"}</span><h3>{dashboardArabic ? "فصول لم تُرسل خططها بعد" : "Classes still missing plans"}</h3></div><strong>{pendingTeacherCount} {dashboardArabic ? "معلم" : "teachers"}</strong></header><div className="staff-review-quick-list">{missingTeacherClassPlans.map((item) => <div className="staff-missing-row" key={`${item.teacherId}-${item.classId}`}><strong>{item.teacherName}</strong><span>{item.className}</span></div>)}{missingTeacherClassPlans.length === 0 && <p className="staff-dashboard-empty">{dashboardArabic ? "كل معلمي القسم المكلفين بحصص أرسلوا خططهم لهذا الأسبوع." : "All department teachers with scheduled lessons submitted their plans this week."}</p>}</div></section>
            </div>}
          </section>}

          {activeNav === "Weekly Plans" && <>
            <div className="staff-plan-filters"><label>{dashboardArabic ? "الأسبوع الدراسي" : "School week"}<select value={dashboardWeekId} onChange={(event) => setDashboardWeekId(event.target.value)}>{dashboardWeeks.map((week) => <option key={week.id} value={week.id}>{dashboardArabic ? `الأسبوع ${week.week_number}` : `Week ${week.week_number}`} · {academicWeekRange(week, dashboardArabic)}</option>)}</select></label><label>{dashboardArabic ? "حالة الخطة" : "Plan status"}<select value={planViewFilter} onChange={(event) => setPlanViewFilter(event.target.value as typeof planViewFilter)}><option value="all">{dashboardArabic ? "كل الخطط" : "All plans"}</option><option value="needs_action">{dashboardArabic ? "تحتاج إجراء" : "Need action"}</option><option value="submitted">{dashboardArabic ? "مرسلة للمراجعة" : "Submitted"}</option><option value="approved">{dashboardArabic ? "معتمدة" : "Approved"}</option></select></label><span>{dashboardArabic ? `${visibleWeeklyPlans.length} خطة في العرض` : `${visibleWeeklyPlans.length} plans shown`}</span></div>

            <section className="teacher-card teacher-plans-card teacher-live-plans-card">
              <div className="teacher-card-heading"><div><h2>{dashboardArabic ? "خططي الأسبوعية" : "My weekly plans"}</h2><p>{dashboardArabic ? "يمثل كل صف خطة فصل واحد لأسبوع دراسي واحد. افتحها لاستكمال كتابة جميع الحصص." : "One row represents one class plan for one school week. Open it to continue writing all of its lessons."}</p></div></div>
              <div className="teacher-plan-table-wrap"><table className="teacher-plan-table teacher-weekly-plan-table"><thead><tr><th>{dashboardArabic ? "الأسبوع" : "Week"}</th><th>{dashboardArabic ? "الفصل" : "Class"}</th><th>{dashboardArabic ? "المواد المكتوبة" : "Subjects written"}</th><th>{dashboardArabic ? "الحالة" : "Status"}</th><th>{dashboardArabic ? "آخر حفظ" : "Last saved"}</th><th>{dashboardArabic ? "الإجراءات" : "Actions"}</th></tr></thead><tbody>
                {visibleWeeklyPlans.map((plan) => {
                  const statusLabel = dashboardArabic ? plan.status === "submitted" ? "تم الإرسال للمشرف" : plan.status === "changes_requested" ? "مطلوب إجراء تعديلات" : plan.status === "approved" ? isSupervisor ? "خطة معتمدة تلقائيًا" : "تم الاعتماد من المشرف" : "مسودة قيد الإعداد" : plan.status === "submitted" ? "Sent to supervisor" : plan.status === "changes_requested" ? "Changes requested" : plan.status === "approved" ? isSupervisor ? "Auto-approved" : "Approved by supervisor" : "Draft in progress";
                  const statusEditable = plan.status === "draft" || plan.status === "changes_requested";
                  const weekOpen = Boolean(weeklyPlanCreationOpen && academicWeeks.find((week) => week.id === plan.weekId)?.teacher_entry_enabled);
                  const editable = statusEditable && weekOpen;
                  const canCopy = ["draft", "changes_requested", "submitted", "approved"].includes(plan.status);
                  const statusTone = plan.status === "approved" ? "green" : plan.status === "submitted" ? "navy" : plan.status === "changes_requested" ? "rose" : "amber";
                  return <tr key={plan.planId}>
                    <td><strong>{plan.week}</strong><small>{dashboardArabic ? `${plan.lessonCount} حصص` : `${plan.lessonCount} lesson${plan.lessonCount === 1 ? "" : "s"}`}</small></td>
                    <td><strong>{plan.className}</strong></td><td>{plan.subjects.join(", ")}</td>
                    <td><span className={`teacher-status ${statusTone}`}><i />{statusLabel}</span></td><td>{plan.updated}</td>
                    <td><div className="teacher-plan-actions">
                      <button type="button" className={`teacher-secondary-button ${editable ? "continue" : "preview"}`} disabled={saving} onClick={() => void openWeeklyPlan(plan)}>{dashboardArabic ? editable ? "استكمال الخطة" : "معاينة" : editable ? "Continue plan" : "Preview"}</button>
                      {plan.status === "approved" && weeklyPlanCreationOpen && <button type="button" className="teacher-secondary-button published-edit" disabled={saving} onClick={() => void openPublishedEdit(plan)}>{dashboardArabic ? plan.publicationStatus === "published" ? "تعديل الخطة المنشورة" : "تعديل الخطة المعتمدة" : plan.publicationStatus === "published" ? "Edit published plan" : "Edit approved plan"}</button>}
                      {canCopy && <button type="button" className="teacher-secondary-button copy" disabled={saving} onClick={() => openCopyPlanDialog(plan)}>{dashboardArabic ? "نسخ الخطة" : "Copy plan"}</button>}
                      {plan.status === "submitted" && weekOpen && <button type="button" className="teacher-secondary-button warning" disabled={saving} onClick={() => { const submission = mySubmissions.find((item) => item.weeklyPlanId === plan.planId && item.status === "submitted"); if (submission) void withdrawSubmissionForEditing(submission); }}>{dashboardArabic ? "سحب للتعديل" : "Withdraw"}</button>}
                      {editable && !workingOnBehalf && <button type="button" className="teacher-secondary-button danger" disabled={saving} onClick={() => void clearWeeklyDraft(plan)}>{dashboardArabic ? "مسح المسودة" : "Clear draft"}</button>}
                    </div></td>
                  </tr>;
                })}
                {!loading && visibleWeeklyPlans.length === 0 && <tr><td className="super-empty" colSpan={6}>{dashboardArabic ? "لا توجد خطط بهذه الحالة في الأسبوع المختار." : "No plans match this status in the selected week."}</td></tr>}
              </tbody></table></div>
            </section>
            {(planViewFilter === "all" || planViewFilter === "needs_action") && unstartedClasses.length > 0 && <section className="teacher-card staff-unstarted-card"><div className="teacher-card-heading"><div><h2>{dashboardArabic ? "فصول لم تبدأ خطتها" : "Classes not started yet"}</h2><p>{dashboardArabic ? "لن ينشئ الزر خطة إلا إذا كان هذا الأسبوع مفتوحًا للمعلمين." : "Writing is available only while this week is open for teachers."}</p></div></div><div className="staff-unstarted-list">{unstartedClasses.map((schoolClass) => <div key={schoolClass.id}><strong>{schoolClass.name}</strong><button type="button" className="teacher-secondary-button" disabled={!dashboardWeek?.teacher_entry_enabled || !weeklyPlanCreationOpen} onClick={() => void openWeeklyBuilder(dashboardWeekId, schoolClass.id)}>{dashboardArabic ? "ابدأ الخطة" : "Start plan"}</button></div>)}</div></section>}

            <section className="teacher-card teacher-review-status-card" hidden>
              <div className="teacher-card-heading"><div><p className="teacher-kicker">Plan follow-up</p><h2>My weekly plans</h2><p>The class plan becomes visible when every submitted plan is approved. Teachers who did not submit remain visible as Plan not published.</p></div></div>
              <div className="teacher-review-status-list">
                {mySubmissions.filter((submission) => submission.status !== "draft").map((submission) => <article key={submission.id}>
                  <div><span className={`teacher-status ${submission.status === "approved" ? "green" : submission.status === "changes_requested" ? "amber" : "navy"}`}><i />{submission.status.replaceAll("_", " ")}</span><strong>{submission.subject}</strong><small>{submission.className} · {submission.week}</small>{submission.reviewNote && <p><b>Supervisor note:</b> {submission.reviewNote}</p>}</div>
                  <div className="teacher-review-status-actions"><button type="button" className="teacher-secondary-button" disabled={saving} onClick={() => void openSavedPlan(submission)}>Preview & edit</button>{submission.status === "submitted" && <button type="button" className="teacher-secondary-button warning" disabled={saving} onClick={() => void withdrawSubmissionForEditing(submission)}>Withdraw for editing</button>}</div>
                </article>)}
                {mySubmissions.filter((submission) => submission.status !== "draft").length === 0 && <p className="supervisor-review-empty">No additional plan updates are waiting. Save your lesson work when it is ready.</p>}
              </div>
            </section>
          </>}

          {activeNav === "My Timetable" && <section className="staff-timetable-page"><div className="staff-timetable-intro"><div><span>{dashboardArabic ? "من جدول المدرسة المعتمد" : "From the approved school timetable"}</span><h2>{dashboardArabic ? "جدول حصصي الأسبوعي" : "My weekly lesson timetable"}</h2><p>{dashboardArabic ? "اعرض كل حصصك حسب اليوم ورقم الحصة. محرر الخطة يستخدم الحصص المطلوبة للخطة فقط." : "See every assigned lesson by day and period. The plan editor uses only slots that require a weekly plan."}</p></div><strong>{personalTimetable.length} {dashboardArabic ? "حصة" : "lessons"}</strong></div><div className="staff-timetable-grid">{dayNames.map((day, dayIndex) => { const daySlots = personalTimetable.filter((slot) => slot.day_of_week === dayIndex); return <article className={`staff-timetable-day ${dayIndex === todayDayIndex ? "today" : ""}`} key={day}><header><span>{dashboardArabic ? arabicDayNames[day] : day}</span><small>{dashboardArabic ? `${daySlots.length} حصص` : `${daySlots.length} lessons`}</small></header><div>{daySlots.length ? daySlots.map((slot) => <div className="staff-timetable-lesson" key={slot.id}><b>{dashboardArabic ? `الحصة ${slot.period_number}` : `Period ${slot.period_number}`}</b><strong>{slot.subject}</strong><small>{slot.className}</small></div>) : <p>{dashboardArabic ? "لا توجد حصص مسجلة" : "No lessons scheduled"}</p>}</div></article>; })}</div>{personalTimetable.length === 0 && !loading && <p className="staff-dashboard-empty">{dashboardArabic ? "لم يُربط جدول حصص بهذا الحساب بعد. اطلب من إدارة المدرسة مراجعة الجدول." : "No timetable is linked to this account yet. Ask school administration to check the timetable."}</p>}</section>}

          {(activeNav === "My Classes" || activeNav === "My Subjects" || activeNav === "Profile & assignments") && <section className="teacher-card teacher-live-assignment-panel"><div><h2>{navLabel(activeNav)}</h2><p>{dashboardArabic ? "تُحدّث التكليفات من إدارة المدرسة." : "School administration updates these assignments."}</p></div><div className="teacher-live-assignment-grid">
            {(activeNav === "My Classes" || activeNav === "Profile & assignments") && <article><small>{dashboardArabic ? "الفصول المكلف بها" : "Approved classes"}</small>{uniqueClasses.map((className) => <span key={className}>{className}</span>)}{uniqueClasses.length === 0 && <p>{dashboardArabic ? "لا توجد فصول مرتبطة بك حتى الآن." : "No classes assigned yet."}</p>}</article>}
            {(activeNav === "My Subjects" || activeNav === "Profile & assignments") && <article><small>{dashboardArabic ? "المواد المكلف بها" : "Approved subjects"}</small>{uniqueSubjects.map((subject) => <span key={subject}>{subject}</span>)}{uniqueSubjects.length === 0 && <p>{dashboardArabic ? "لا توجد مواد مرتبطة بك حتى الآن." : "No subjects assigned yet."}</p>}</article>}
          </div></section>}

          {activeNav === "Calendar" && <section className="teacher-card teacher-live-assignment-panel"><div><h2>{dashboardArabic ? "الأسابيع الدراسية" : "Academic weeks"}</h2><p>{dashboardArabic ? "الأسابيع المفتوحة حاليًا لكتابة الخطط." : "Weeks currently open for teacher entry."}</p></div><div className="teacher-week-list">{teacherEntryWeeks.map((week) => <span key={week.id} className={week.is_current ? "current" : ""}><strong>{dashboardArabic ? `الأسبوع ${week.week_number}` : `Week ${week.week_number}`}</strong><small>{academicWeekRange(week, dashboardArabic)}</small></span>)}{teacherEntryWeeks.length === 0 && <p>{dashboardArabic ? "لا يوجد أسبوع مفتوح حاليًا لكتابة الخطط." : "No academic week is currently open for teacher entry."}</p>}</div></section>}

          {activeNav === "Settings" && <><section className="teacher-card teacher-live-assignment-panel"><div><h2>{dashboardArabic ? "إعدادات الحساب" : "Account settings"}</h2><p>{dashboardArabic ? "بيانات حسابك المتصل بمنصة المدرسة." : "Your connected school account details."}</p></div><div className="teacher-settings-row"><span><small>{dashboardArabic ? "الاسم" : "Name"}</small><strong>{teacherName}</strong></span><span><small>{dashboardArabic ? "القسم" : "Department"}</small><strong>{departmentName}</strong></span><button className="teacher-secondary-button" onClick={() => void signOut()}>{dashboardArabic ? "تسجيل الخروج" : "Sign out"}</button></div></section><StaffLanguagePreference /></>}

          {isSupervisor && activeNav === "Department Teachers" && <section className="teacher-card department-teachers-card">
            <div className="teacher-card-heading"><div><p className="teacher-kicker">{dashboardArabic ? "إدارة القسم" : "Department management"}</p><h2>{dashboardArabic ? "معلمو القسم" : "Department teachers"}</h2><p>{dashboardArabic ? "اعرض معلميك المرتبطين بك وتكليفاتهم من الفصول والمواد." : "See your linked teachers and their class and subject assignments."}</p></div><span className="supervisor-review-authority">{departmentTeachers.length} {dashboardArabic ? "معلم" : "teachers"}</span></div>
            <div className="department-teachers-layout"><div className="department-teacher-list">{departmentTeachers.map((teacher, index) => <button key={teacher.userId || `${teacher.name}-${index}`} className={selectedDepartmentTeacherId === teacher.userId ? "active" : ""} onClick={() => selectDepartmentTeacher(teacher.userId)}><span>{initials(teacher.name)}</span><div><strong>{teacher.name}</strong><small>{teacher.userId ? dashboardArabic ? `${teacher.assignments.length} تكليف فصل ومادة` : `${teacher.assignments.length} class / subject assignments` : dashboardArabic ? "لم يُفعّل الحساب بعد" : "Account not registered yet"}</small></div><em>{dashboardArabic ? "إدارة" : "Manage"}</em></button>)}{departmentTeachers.length === 0 && <p className="supervisor-review-empty">{dashboardArabic ? "لا يوجد معلمون مرتبطون بقسمك حاليًا." : "No teachers are linked to your department yet."}</p>}</div>
              {selectedDepartmentTeacher && <section className="department-teacher-editor"><div><p className="teacher-kicker">{dashboardArabic ? "تكليفات المعلم" : "Teacher assignments"}</p><h3>{selectedDepartmentTeacher.name}</h3><p>{dashboardArabic ? "أضف الفصل والمادة أو احذف تكليفًا موجودًا." : "Assign classes and subjects, or remove an existing assignment."}</p></div>{!selectedDepartmentTeacher.userId ? <p className="supervisor-review-feedback">{dashboardArabic ? "يجب إنشاء حساب المعلم وتفعيله قبل تكليفه بفصل أو مادة." : "This teacher must create and activate a school account before classes and subjects can be assigned."}</p> : <><div className="department-assignment-picker"><label>{dashboardArabic ? "الفصل" : "Class"}<select value={departmentAssignmentDraft.classId} onChange={(event) => setDepartmentAssignmentDraft((current) => ({ ...current, classId: event.target.value }))}><option value="">{dashboardArabic ? "اختر الفصل" : "Select class"}</option>{schoolClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>Grade {schoolClass.grade} {schoolClass.section}</option>)}</select></label><label>{dashboardArabic ? "المادة" : "Subject"}<select value={departmentAssignmentDraft.subjectId} onChange={(event) => setDepartmentAssignmentDraft((current) => ({ ...current, subjectId: event.target.value }))}><option value="">{dashboardArabic ? "اختر المادة" : "Select subject"}</option>{schoolSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name_en}</option>)}</select></label><button disabled={workingOnBehalf || saving || !departmentAssignmentDraft.classId || !departmentAssignmentDraft.subjectId} type="button" className="teacher-primary-button" onClick={() => void addDepartmentAssignment(selectedDepartmentTeacher.userId)}>{dashboardArabic ? "إضافة التكليف" : "Assign to teacher"}</button></div><div className="department-assignment-chips">{selectedDepartmentTeacher.assignments.map((assignment) => <span key={assignment.id}>{`Grade ${assignment.grade} ${assignment.section} · ${assignment.subject}`}<button disabled={workingOnBehalf || saving} type="button" aria-label={dashboardArabic ? `حذف تكليف ${assignment.subject}` : `Remove ${assignment.subject}`} onClick={() => void removeDepartmentAssignment(assignment.id)}>×</button></span>)}{selectedDepartmentTeacher.assignments.length === 0 && <small>{dashboardArabic ? "لا توجد فصول أو مواد مكلف بها حاليًا." : "No classes or subjects assigned yet."}</small>}</div></>}</section>}</div>
          </section>}
          {isSupervisor && activeNav === "Teacher Reviews" && <section className="teacher-card supervisor-review-card">
            <div className="teacher-card-heading supervisor-review-heading">
              <div><p className="teacher-kicker">{dashboardArabic ? "مساحة عمل المشرف" : "Supervisor workspace"}</p><h2>{dashboardArabic ? "مراجعة الخطط الأسبوعية" : "Weekly plan review"}</h2><p>{dashboardArabic ? "اختر الأسبوع لعرض جميع خطط معلميك؛ ويمكنك تحديد فصل وشعبة لتضييق النتائج." : "Choose a week to see every linked teacher plan. Filter by class only when needed."}</p></div>
              <button type="button" className="supervisor-review-authority supervisor-review-shortcut" disabled={waitingReviews.length === 0} onClick={openFirstWaitingReview}><strong>{dashboardArabic ? `${waitingReviews.length} خطط تحتاج للمراجعة` : `${waitingReviews.length} subject entries waiting for review`}</strong><span>{dashboardArabic ? "عرض الخطط المعلقة" : "Open waiting plans"} ←</span></button>
            </div>
            <div className="supervisor-review-selector">
              <label>{dashboardArabic ? "١. الأسبوع الدراسي" : "1. School week"}<select value={selectedReviewWeekId} onChange={(event) => setSelectedReviewWeekId(event.target.value)}><option value="">{dashboardArabic ? "اختر الأسبوع" : "Select week"}</option>{academicWeeks.map((week) => <option key={week.id} value={week.id}>{dashboardArabic ? `الأسبوع ${week.week_number}` : `Week ${week.week_number}`} · {academicWeekRange(week, dashboardArabic)}</option>)}</select></label>
              <label>{dashboardArabic ? "٢. الفصل والشعبة · اختياري" : "2. Class & section · optional"}<select value={effectiveReviewClassId} onChange={(event) => setSelectedReviewClassId(event.target.value)} disabled={!selectedReviewWeek || supervisorReviewClasses.length === 0}><option value="">{dashboardArabic ? "كل الفصول والشعب" : "All classes and sections"}</option>{supervisorReviewClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
              <div className="supervisor-review-found"><span>{dashboardArabic ? `تم العثور على ${selectedClassReviewItems.length} خطة معلم في العرض` : `${selectedClassReviewItems.length} teacher plan${selectedClassReviewItems.length === 1 ? "" : "s"} shown`}</span>{selectedWeekPendingCount > 0 && <button type="button" onClick={openSelectedWeekWaitingReview}>{dashboardArabic ? `انتقل إلى خطة تنتظر مراجعتك (${selectedWeekPendingCount})` : `Jump to a plan awaiting review (${selectedWeekPendingCount})`}</button>}</div>
              <button type="button" className="teacher-primary-button supervisor-approve-all" disabled={saving || !selectedReviewWeekOpen || selectedWeekPendingCount === 0} onClick={requestBulkApproval}>{dashboardArabic ? `اعتماد جميع خطط معلمي القسم لهذا الأسبوع (${selectedWeekPendingCount})` : `Approve every submitted department plan this week (${selectedWeekPendingCount})`}</button>
            </div>
            {selectedReviewWeek && !selectedReviewWeekOpen && <p className="teacher-access-notice" role="status">{closedReviewWeekMessage(dashboardArabic)}</p>}
            <div className="supervisor-review-list" id="supervisor-review-results">
              {!selectedReviewWeek ? <p className="supervisor-review-empty">{dashboardArabic ? "اختر الأسبوع الدراسي لعرض خطط معلميك." : "Select a school week to view teacher plans."}</p> : selectedClassReviewItems.map((review) => <article key={review.id}>
                <header><div><span className={`teacher-status ${review.status === "approved" ? "green" : review.status === "changes_requested" ? "amber" : "navy"}`}><i />{reviewStatusLabel(review.status, dashboardArabic)}</span><h3>{review.teacherName}</h3><p>{review.subject} · {review.className} · {review.week}</p></div><small>{dashboardArabic ? `أُرسلت في ${review.submittedAt}` : `Submitted ${review.submittedAt}`}</small></header>
                <div className="supervisor-entry-grid">{review.entries.map((entry) => <section key={`${entry.subject}-${entry.day}-${entry.period}`}><strong>{entry.subject} · {dashboardArabic ? arabicDayNames[entry.day] ?? entry.day : entry.day} · {dashboardArabic ? `الحصة ${entry.period}` : `Period ${entry.period}`}</strong><p><b>{dashboardArabic ? "عمل الحصة" : "Classwork"}</b>{entry.classwork || "—"}</p><p><b>{dashboardArabic ? "الواجب المنزلي" : "Homework"}</b>{entry.homework || "—"}</p><p><b>{dashboardArabic ? "ملاحظات كلاسيرا" : "Classera"}</b>{entry.notes || "—"}</p></section>)}</div>
                {(review.quizzes.length > 0 || review.weeklyNotes.some((note) => Boolean(parseEnglishDictation(note)))) && <div className="supervisor-plan-extras">{review.quizzes.length > 0 && <section><strong>{dashboardArabic ? "الاختبارات والتقييمات" : "Quizzes & assessments"}</strong>{review.quizzes.map((quiz, index) => <p key={`${quiz.subject}-${index}`}><b>{quiz.subject}{quiz.date ? ` · ${quiz.date}` : ""}</b>{quiz.details}</p>)}</section>}{review.weeklyNotes.map(parseEnglishDictation).filter((dictation): dictation is EnglishDictation => Boolean(dictation)).map((dictation) => <section key={`dictation-${dictation.day}`}><strong>Vocabulary for Dictation on {dayNames[dictation.day]}</strong><div className="dictation-word-grid compact">{dictation.words.map((word) => <span key={word}>{word}</span>)}</div></section>)}</div>}
                {review.status === "submitted" && <div className="supervisor-review-actions"><label>{dashboardArabic ? "ملاحظة المراجعة" : "Review note"}<textarea disabled={saving || !selectedReviewWeekOpen} value={reviewNotes[review.id] ?? review.note} onChange={(event) => setReviewNotes((current) => ({ ...current, [review.id]: event.target.value }))} placeholder={dashboardArabic ? "اكتب التعديلات المطلوبة من المعلم" : "Write the required changes for the teacher"} rows={3} /></label><div><button disabled={saving || !selectedReviewWeekOpen} className="teacher-secondary-button" onClick={() => void reviewSubmission(review, "changes_requested")}>{dashboardArabic ? "إرجاع الخطة كاملة للتعديل" : "Return whole plan"}</button><button disabled={saving || !selectedReviewWeekOpen} className="teacher-primary-button" onClick={() => void reviewSubmission(review, "approved")}>{dashboardArabic ? "اعتماد الخطة كاملة" : "Approve whole plan"}</button></div></div>}
                {review.status === "changes_requested" && <p className="supervisor-review-feedback"><strong>{dashboardArabic ? "ملاحظتك للمراجعة" : "Your review note"}</strong>{review.note || (dashboardArabic ? "طُلب من المعلم مراجعة هذه الخطة وتعديلها." : "The teacher has been asked to revise this plan.")}</p>}
                {review.status === "approved" && <p className="supervisor-review-feedback approved"><strong>{dashboardArabic ? "معتمدة من هذه الشعبة" : "Approved for this department"}</strong>{dashboardArabic ? "تم اعتماد خطة الشعبة كاملة. ستظهر خطة الفصل عند عدم بقاء أي خطة مرسلة قيد المراجعة، وتظهر حصص غير المرسلين بعبارة Plan not published." : "This department plan was approved. The class plan is visible when no submitted plan remains under review; missing teachers show Plan not published."}</p>}
              </article>)}
              {selectedReviewWeek && selectedClassReviewItems.length === 0 && <p className="supervisor-review-empty">{dashboardArabic ? <>لا توجد خطط لمعلميك في <strong>{selectedReviewWeek.label}</strong> ضمن هذا الاختيار.</> : <>No linked teacher plans match this selection in <strong>{selectedReviewWeek.label}</strong>.</>}</p>}
            </div>
          </section>}
        </div>
      </section>

      {isSupervisor && activeNav === "Teacher Reviews" && selectedReviewWeek && !selectedReviewWeekOpen && <ClosedWeekAlert key={selectedReviewWeekId} arabic={dashboardArabic} />}
      {bulkApprovalConfirmationOpen && <div className="weekly-send-confirmation-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setBulkApprovalConfirmationOpen(false)}><section className="weekly-send-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="bulk-approval-title" dir={bulkApprovalArabic ? "rtl" : "ltr"}><span aria-hidden="true">✓</span><h3 id="bulk-approval-title">{bulkApprovalArabic ? "اعتماد كل خطط الأسبوع" : "Approve every plan this week"}</h3><p>{bulkApprovalArabic ? `سيتم اعتماد ${selectedWeekPendingCount} خطة مادة مرسلة لكل معلميك في جميع الفصول والشعب خلال الأسبوع المحدد، وضمن نطاق إشرافك فقط. ستُنشر خطة الفصل عندما لا تبقى أي خطة مرسلة قيد المراجعة، وتظهر حصص غير المرسلين بعبارة Plan not published.` : `${selectedWeekPendingCount} submitted subject plan${selectedWeekPendingCount === 1 ? "" : "s"} from all your linked teachers across every class and section in the selected week will be approved. Each class plan publishes when no submitted plan remains under review; missing teachers show Plan not published.`}</p><div><button type="button" className="teacher-secondary-button" onClick={() => setBulkApprovalConfirmationOpen(false)}>{bulkApprovalArabic ? "إلغاء" : "Cancel"}</button><button type="button" className="teacher-primary-button" disabled={saving || !selectedReviewWeekOpen} onClick={() => void approveAllSelectedWeekPlans()}>{bulkApprovalArabic ? "نعم، اعتماد الجميع" : "Yes, approve all"}</button></div></section></div>}

      {weeklyBuilderOpen && selectedClass && selectedWeek && <div className="teacher-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && closeWeeklyEditor()}><section className={`teacher-editor-modal weekly-builder-modal ${weeklyBuilderReadOnly ? "is-read-only" : ""}`} role="dialog" aria-modal="true" aria-labelledby="weekly-builder-title">
        <div className="teacher-modal-heading"><div><p>{dashboardArabic ? `الأسبوع ${selectedWeek.week_number}` : `Week ${selectedWeek.week_number}`} · {academicWeekRange(selectedWeek, dashboardArabic)}</p><h2 id="weekly-builder-title">{weeklyBuilderReadOnly ? dashboardArabic ? "معاينة الخطة الأسبوعية" : "Weekly plan preview" : publishedEditPlanId ? dashboardArabic ? approvedEditPublished ? "تعديل الخطة المنشورة" : "تعديل الخطة المعتمدة" : approvedEditPublished ? "Edit published plan" : "Edit approved plan" : dashboardArabic ? "إعداد الخطة الأسبوعية" : "Build the whole week"}</h2></div><button disabled={saving} aria-label={dashboardArabic ? "إغلاق محرر الخطة" : "Close weekly builder"} onClick={() => closeWeeklyEditor()}>×</button></div>
        <div className="teacher-editor-context">{workingOnBehalf && <strong>{dashboardArabic ? `نيابةً عن ${teacherName} — حفظ يدوي فقط` : `On behalf of ${teacherName} — manual save only`}</strong>}<span>{weeklyBuilderReadOnly ? dashboardArabic ? "وضع المعاينة فقط" : "Preview-only mode" : publishedEditPlanId ? dashboardArabic ? "تعديل خطة معتمدة — حفظ يدوي فقط" : "Approved edit — manual save only" : dashboardArabic ? "حفظ واحد لخطة الأسبوع كاملة" : "One save for the whole week"}</span><i />{weeklyBuilderReadOnly ? dashboardArabic ? "يمكنك مشاهدة الخطة، ولا يمكن تعديلها أو حفظها في هذا الوضع." : "You can view the plan, but it cannot be edited or saved in this mode." : publishedEditPlanId ? dashboardArabic ? "التغييرات لا تُحفظ تلقائيًا؛ اضغط حفظ التعديل بعد المراجعة." : "Changes are not saved automatically. Review and save explicitly." : dashboardArabic ? "تُرتب المدخلات تلقائيًا حسب حصص جدولك." : "Entries are placed according to your timetable slots."}{!workingOnBehalf && !weeklyBuilderReadOnly && !publishedEditPlanId && <b className={`teacher-autosave-state ${autoSaveState}`}>{autoSaveState === "saving" ? dashboardArabic ? "جارٍ حفظ المسودة…" : "Saving draft…" : autoSaveState === "saved" ? dashboardArabic ? "تم حفظ المسودة تلقائيًا" : "Draft saved automatically" : dashboardArabic ? "الحفظ التلقائي مُفعّل" : "Auto-save is on"}</b>}</div>
        <form onSubmit={(event) => { event.preventDefault(); if (!weeklyBuilderReadOnly) { if (publishedEditPlanId) setPublishedEditConfirmationOpen(true); else confirmAndSendWholeWeek(); } }}>
          {builderFeedback && <div className={`weekly-builder-feedback ${builderFeedback.tone}`} role="status">{builderFeedback.text}</div>}
          {builderStatus !== "new" && <div className={`weekly-builder-review-state ${builderStatus}`}><strong>{dashboardArabic ? builderStatus === "approved" ? isSupervisor ? "تم الاعتماد تلقائيًا" : "تم الاعتماد" : builderStatus === "submitted" ? "في انتظار اعتماد المشرف" : builderStatus === "changes_requested" ? "مطلوب إجراء تعديلات" : "تم حفظ المسودة" : builderStatus === "approved" ? isSupervisor ? "Approved automatically" : "Approved" : builderStatus === "submitted" ? "Waiting for supervisor approval" : builderStatus === "changes_requested" ? "Changes requested" : "Draft saved"}</strong><span>{dashboardArabic ? builderStatus === "approved" ? isSupervisor ? "تم اعتماد خطتك التعليمية تلقائيًا. تظهر خطة الفصل بعد انتهاء مراجعة الخطط المرسلة، وتظهر حصص غير المرسلين بعبارة Plan not published." : "تم اعتماد الجزء الخاص بك. تظهر خطة الفصل بعد انتهاء مراجعة الخطط المرسلة، وتظهر حصص غير المرسلين بعبارة Plan not published." : builderStatus === "submitted" ? "أُرسلت الخطة وأصبحت مقفلة حتى يراجعها المشرف أو تسحبها للتعديل." : builderStatus === "changes_requested" ? "راجع ملاحظة المشرف، وعدّل الخطة، ثم أرسلها مرة أخرى." : "عملك محفوظ كمسودة خاصة ولا يظهر لأولياء الأمور. أرسله للمشرف بعد اكتماله." : builderStatus === "approved" ? isSupervisor ? "Your teaching plan is approved automatically. The class plan is visible when no submitted plan is still waiting for review; missing teachers appear as Plan not published." : "Your part is approved. The class plan is visible when no submitted plan is still waiting for review; missing teachers appear as Plan not published." : builderStatus === "submitted" ? "This plan has been sent and is locked until the supervisor reviews it or you withdraw it." : builderStatus === "changes_requested" ? "Review the supervisor note, update the plan, then send it again." : "Your work is private and is not visible to families. Send it to the supervisor when it is complete."}</span></div>}
          <fieldset className="weekly-builder-fields" disabled={weeklyBuilderReadOnly}>
          <div className="weekly-builder-toolbar"><label>{dashboardArabic ? "١. الأسبوع الدراسي" : "1. Academic week"}<select disabled={Boolean(publishedEditPlanId)} value={selectedWeekId} onChange={(event) => setSelectedWeekId(event.target.value)}>{(weeklyBuilderReadOnly || publishedEditPlanId ? academicWeeks : teacherEntryWeeks).map((week) => <option key={week.id} value={week.id}>{dashboardArabic ? `الأسبوع ${week.week_number}` : `Week ${week.week_number}`} · {academicWeekRange(week, dashboardArabic)}</option>)}</select></label><label>{dashboardArabic ? "٢. الفصل" : "2. Class"}<select disabled={Boolean(publishedEditPlanId)} value={selectedClassId} onChange={(event) => { setSelectedClassId(event.target.value); setSlotDrafts({}); setQuizSubjectId(""); }}>{Array.from(new Map(assignments.map((assignment) => [assignment.classId, assignment])).values()).map((assignment) => <option key={assignment.classId} value={assignment.classId}>{dashboardArabic ? `الصف ${assignment.grade} · الشعبة ${assignment.section}` : `Grade ${assignment.grade} · ${assignment.section}`}</option>)}</select></label><span className={`teacher-timetable-ready ${selectedClassSlots.length > 0 ? "ready" : "missing"}`}>{selectedClassSlots.length > 0 ? dashboardArabic ? `${selectedClassSlots.length} حصص جاهزة لهذا الأسبوع` : `${selectedClassSlots.length} lessons ready for this week` : dashboardArabic ? "يلزم ربط جدول الحصص" : "Timetable connection required"}</span></div>
          </fieldset>
          {compactWeeklyBuilder && activeDayIndexes.length > 1 && <nav className="weekly-builder-mobile-days" aria-label={dashboardArabic ? "اختيار يوم الخطة" : "Choose plan day"}>{activeDayIndexes.map((index) => { const day = dayNames[index]; return <button type="button" className={selectedBuilderDay === index ? "active" : ""} key={day} onClick={() => setSelectedBuilderDay(index)}><strong>{dashboardArabic ? arabicDayNames[day] : day}</strong><small>{selectedClassSlots.filter((slot) => slot.day_of_week === index).length}</small></button>; })}</nav>}
          <fieldset className="weekly-builder-fields" disabled={weeklyBuilderReadOnly}>
          <div className={`weekly-builder-days days-${visibleBuilderDayIndexes.length}`}>{visibleBuilderDayIndexes.map((index) => { const day = dayNames[index]; const daySlots = selectedClassSlots.filter((slot) => slot.day_of_week === index); return <section className="weekly-builder-day" key={day}><header><strong>{dashboardArabic ? arabicDayNames[day] : day}</strong><small>{dashboardArabic ? `${daySlots.length} حصص` : `${daySlots.length} lesson${daySlots.length === 1 ? "" : "s"}`}</small></header>{daySlots.map((slot) => { const assignment = assignmentForSlot(slot); const draft = slotDraftFor(slot); const isEnglish = isEnglishSubject(assignment?.subject ?? ""); return <article key={slot.id}><header><span>{dashboardArabic ? `الحصة ${slot.period_number}` : `Period ${slot.period_number}`}</span><strong>{isEnglish ? "English" : assignment?.subject ?? (dashboardArabic ? "المادة" : "Subject")}</strong></header>{assignment?.subject === "Integrated Science" && <label>{dashboardArabic ? "فرع العلوم" : "Science component"}<select value={draft.scienceComponent} onChange={(event) => updateSlotDraft(slot.id, "scienceComponent", event.target.value)}><option value="">{dashboardArabic ? "اختر الكيمياء أو الفيزياء أو الأحياء" : "Select Chemistry, Physics or Biology"}</option>{scienceComponents.map((component) => <option key={component} value={component}>{component}</option>)}</select></label>}{isEnglish && <label>{dashboardArabic ? "برنامج اللغة الإنجليزية" : "English programme"}<select value={draft.englishProgramme} onChange={(event) => updateSlotDraft(slot.id, "englishProgramme", event.target.value)}><option value="">{dashboardArabic ? "اختر AL أو OL" : "Select AL or OL"}</option>{englishProgrammes.map((programme) => <option key={programme} value={programme}>{programme}</option>)}</select></label>}{isEnglish && <p className="teacher-programme-note">{dashboardArabic ? "يُضاف AL أو OL تلقائيًا قبل عمل الحصة بالصيغة: AL - Classwork." : "AL or OL is added automatically before Classwork using the format: AL - Classwork."}</p>}<label>{dashboardArabic ? "عمل الحصة" : "Classwork"}<textarea rows={3} value={draft.classwork} onChange={(event) => updateSlotDraft(slot.id, "classwork", event.target.value)} placeholder={dashboardArabic ? "اكتب الدرس والوحدة والصفحات" : "Lesson, unit and pages"} /></label><label>{dashboardArabic ? "الواجب المنزلي" : "Homework"}<textarea rows={3} value={draft.homework} onChange={(event) => updateSlotDraft(slot.id, "homework", event.target.value)} placeholder={dashboardArabic ? "اكتب واجب هذه الحصة" : "Homework for this lesson"} /></label><label>{dashboardArabic ? "ملاحظات كلاسيرا" : "Classera notes"}<textarea rows={3} value={draft.classeraNotes} onChange={(event) => updateSlotDraft(slot.id, "classeraNotes", event.target.value)} placeholder={dashboardArabic ? "تذكير أو مواد مطلوبة" : "Reminder or materials"} /></label></article>})}</section>})}</div>
          {departmentName === "English Department" && <section className="weekly-builder-extra english-dictation-editor"><div className="weekly-builder-section-heading"><div><span>DW</span><div><strong>{dashboardArabic ? "كلمات الإملاء باللغة الإنجليزية" : "English Dictation Words"}</strong><small>{dashboardArabic ? "اختر يوم الإملاء، ثم اكتب كل كلمة في سطر أو افصل الكلمات بفواصل." : "Choose the dictation day, then enter one word per line or separate words with commas."}</small></div></div></div><div className="weekly-builder-dictation-row"><label>{dashboardArabic ? "يوم الإملاء" : "Dictation day"}<select value={dictationDay} onChange={(event) => setDictationDay(event.target.value)}>{dayNames.map((day, index) => <option key={day} value={index}>{dashboardArabic ? arabicDayNames[day] : day}</option>)}</select></label><label>{dashboardArabic ? "الكلمات" : "Words"}<textarea className="weekly-builder-notes" rows={3} value={dictationWords} onChange={(event) => setDictationWords(event.target.value)} placeholder="school, teacher, classroom, homework" /></label></div></section>}
          {isFaridTeacher && <FaridQuizzesPanel weeks={academicWeeks} assignments={assignments} teacherId={profileId} initialWeekId={selectedWeekId} contextWeekId={selectedWeekId} contextClassId={selectedClassId} embedded readOnly={weeklyBuilderReadOnly || workingOnBehalf} arabic={dashboardArabic} />}
          </fieldset>
          <div className="teacher-editor-footer"><span>{weeklyBuilderReadOnly ? dashboardArabic ? "هذه معاينة فقط؛ لن يتم حفظ أو إرسال أي تغييرات." : "This is a read-only preview; no changes will be saved or submitted." : publishedEditPlanId ? dashboardArabic ? approvedEditPublished ? "بعد التأكيد سيظهر التعديل لولي الأمر إذا كان الأسبوع ظاهرًا له. لا حاجة لاعتماد المشرف مرة أخرى." : "سيُحفظ التعديل دون إعادة إرساله للمشرف، ولن يظهر لولي الأمر قبل استيفاء شروط النشر." : approvedEditPublished ? "After confirmation, changes appear for families if the week is visible. No new review is needed." : "Changes are saved without another review and remain hidden until publication conditions are met." : dashboardArabic ? selectedClassSlots.length > 0 ? isSupervisor ? "تُعتمد خطتك التعليمية تلقائيًا عند الإرسال. ولا تمنع حصص المعلمين غير المرسلة نشر باقي الخطة." : "احفظ عملك كمسودة خاصة، ثم أرسل الخطة المكتملة إلى المشرف للاعتماد." : "يتوقف الحفظ حتى يتم ربط جدول الحصص." : selectedClassSlots.length > 0 ? isSupervisor ? "Your teaching plan is approved automatically when sent. Missing teachers do not block the class plan and appear as Plan not published." : "Save privately as a draft, then send the completed plan to your supervisor. Missing teachers do not block an otherwise approved class plan." : "Saving is blocked until the timetable is connected."}</span><div><button disabled={saving || selectedClassSlots.length === 0} type="button" className="teacher-secondary-button teacher-preview-button" onClick={() => void openParentPreview()}>{dashboardArabic ? "معاينة خطة ولي الأمر" : "Preview parent plan"}</button><button disabled={saving} type="button" className="teacher-secondary-button" onClick={() => closeWeeklyEditor()}>{weeklyBuilderReadOnly ? dashboardArabic ? "إغلاق المعاينة" : "Close preview" : dashboardArabic ? "إلغاء" : "Cancel"}</button>{!weeklyBuilderReadOnly && (publishedEditPlanId ? <button disabled={saving || !builderHydrated || selectedClassSlots.length === 0} className="teacher-primary-button" type="submit">{saving ? dashboardArabic ? "جارٍ حفظ التعديل…" : "Saving changes…" : dashboardArabic ? "حفظ التعديل" : "Save changes"}</button> : <><button disabled={saving || selectedClassSlots.length === 0} type="button" className="teacher-secondary-button" onClick={() => void saveWholeWeek(false)}>{saving ? dashboardArabic ? "جارٍ الحفظ…" : "Saving…" : dashboardArabic ? "حفظ كمسودة" : "Save draft"}</button><button disabled={saving || selectedClassSlots.length === 0 || builderStatus === "submitted" || builderStatus === "approved"} className="teacher-primary-button" type="submit">{saving ? dashboardArabic ? "جارٍ إكمال الحفظ التلقائي…" : "Send after automatic save" : isSupervisor ? dashboardArabic ? "اعتماد خطتي التعليمية" : "Approve my teaching plan" : dashboardArabic ? "إرسال للمشرف للاعتماد" : "Send to supervisor for approval"}</button></>)}</div></div>
        </form>
        {sendConfirmationOpen && <div className="weekly-send-confirmation-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSendConfirmationOpen(false)}><section className="weekly-send-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="weekly-send-confirmation-title" dir={sendConfirmationArabic ? "rtl" : "ltr"}><span aria-hidden="true">{missingClassworkSlots.length ? "!" : "✓"}</span><h3 id="weekly-send-confirmation-title">{missingClassworkSlots.length ? sendConfirmationArabic ? "هناك حصص لم يُكتب لها عمل الحصة" : "Some lessons have no Classwork" : sendConfirmationArabic ? isSupervisor ? "تأكيد اعتماد خطتك" : "تأكيد إرسال الخطة" : isSupervisor ? "Confirm automatic approval" : "Confirm plan submission"}</h3>{missingClassworkSlots.length ? <><p>{sendConfirmationArabic ? "يمكنك العودة لاستكمالها، أو إرسال الخطة كما هي. الحصص الفارغة ستُنقص نسبة إنجازك حتى بعد الاعتماد." : "Return to complete these lessons, or send the plan anyway. Blank lessons reduce your completion percentage even after approval."}</p><ul className="weekly-missing-lessons">{missingClassworkSlots.map((slot) => <li key={slot.id}>{sendConfirmationArabic ? arabicDayNames[dayNames[slot.day_of_week]] : dayNames[slot.day_of_week]} · {sendConfirmationArabic ? "الحصة" : "Period"} {slot.period_number}</li>)}</ul></> : <p>{sendConfirmationArabic ? isSupervisor ? "سيتم اعتماد حصصك التعليمية تلقائيًا داخل المنصة. ستظهر خطة الفصل عند عدم وجود خطة مرسلة قيد المراجعة، وتظهر حصص غير المرسلين بعبارة Plan not published." : "هل تريد إرسال هذه الخطة الأسبوعية إلى المشرف للاعتماد؟ بعد الإرسال ستُغلق الخطة حتى يراجعها المشرف أو تسحبها للتعديل." : isSupervisor ? "Your own teaching lessons will be approved automatically. The class plan is visible when no submitted plan remains under review; missing teachers show Plan not published." : "Send this weekly plan to the supervisor for approval? After sending, the plan will be locked until it is reviewed or withdrawn."}</p>}<div><button type="button" className="teacher-secondary-button" onClick={() => { setSendConfirmationOpen(false); if (missingClassworkSlots.length) setSelectedBuilderDay(missingClassworkSlots[0].day_of_week); }}>{missingClassworkSlots.length ? sendConfirmationArabic ? "العودة لاستكمال الخطة" : "Return to complete plan" : sendConfirmationArabic ? "إلغاء" : "Cancel"}</button><button type="button" className="teacher-primary-button" onClick={sendConfirmedWeeklyPlan}>{saving ? sendConfirmationArabic ? "الحفظ التلقائي جارٍ — اعتمد بعدها" : "Autosaving — approve next" : missingClassworkSlots.length ? sendConfirmationArabic ? isSupervisor ? "اعتماد الخطة رغم النقص" : "إرسال للمشرف على أي حال" : isSupervisor ? "Approve anyway" : "Send to supervisor anyway" : sendConfirmationArabic ? isSupervisor ? "نعم، اعتماد خطتي" : "نعم، إرسال للمشرف" : isSupervisor ? "Yes, approve my plan" : "Yes, send to supervisor"}</button></div></section></div>}
      </section></div>}
      {publishedEditConfirmationOpen && <div className="weekly-send-confirmation-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPublishedEditConfirmationOpen(false)}><section className="weekly-send-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="published-edit-confirmation-title" dir={dashboardArabic ? "rtl" : "ltr"}><span aria-hidden="true">✎</span><h3 id="published-edit-confirmation-title">{dashboardArabic ? "تأكيد حفظ تعديل الخطة المعتمدة" : "Confirm approved plan changes"}</h3><p>{approvedEditPublished ? dashboardArabic ? "ستُحفظ تغييرات حصصك المنشورة وتظهر لولي الأمر إذا كان الأسبوع ظاهرًا له. لن تُرسل الخطة للمشرف مرة أخرى. هل تريد المتابعة؟" : "Your published changes will appear for families if the week is visible. No new supervisor review is needed. Continue?" : dashboardArabic ? "سيُحفظ تعديل الخطة المعتمدة دون إعادة إرساله للمشرف. لن يظهر لولي الأمر قبل استيفاء شروط نشر الفصل وإظهار الأسبوع. هل تريد المتابعة؟" : "Approved changes will be saved without another supervisor review. Families will not see them until the class and week are published. Continue?"}</p><div><button type="button" className="teacher-secondary-button" onClick={() => setPublishedEditConfirmationOpen(false)}>{dashboardArabic ? "إلغاء" : "Cancel"}</button><button type="button" className="teacher-primary-button" disabled={saving} onClick={() => void savePublishedEdit()}>{dashboardArabic ? "نعم، احفظ التعديل" : "Yes, save changes"}</button></div></section></div>}
      {submissionSuccessOpen && <div className="weekly-send-confirmation-backdrop" role="presentation"><section className={`weekly-send-confirmation weekly-submission-success ${editorCompletionKind === "error" ? "error" : ""}`} role="alertdialog" aria-modal="true" aria-labelledby="weekly-submission-success-title" dir={submissionSuccessArabic ? "rtl" : "ltr"}><span aria-hidden="true">{editorCompletionKind === "error" ? "!" : "✓"}</span><h3 id="weekly-submission-success-title">{submissionSuccessArabic ? editorCompletionKind === "draft" ? "تم حفظ المسودة بنجاح" : editorCompletionKind === "approved" ? "تم اعتماد خطتك بنجاح" : editorCompletionKind === "published_edit" ? "تم نشر التعديل بنجاح" : editorCompletionKind === "approved_edit" ? "تم حفظ تعديل الخطة المعتمدة" : editorCompletionKind === "error" ? "تعذر تنفيذ الأمر" : "تم إرسال الخطة بنجاح" : editorCompletionKind === "draft" ? "Draft saved successfully" : editorCompletionKind === "approved" ? "Your plan was approved" : editorCompletionKind === "published_edit" ? "Changes published successfully" : editorCompletionKind === "approved_edit" ? "Approved changes saved" : editorCompletionKind === "error" ? "Action could not be completed" : "Plan sent successfully"}</h3><p>{submissionSuccessArabic ? editorCompletionKind === "draft" ? "تم حفظ الخطة كمسودة، وأُغلق المحرر. يمكنك فتحها من الشاشة الرئيسية لاستكمالها وإرسالها للمشرف لاحقًا." : editorCompletionKind === "approved" ? "تم اعتماد حصصك التعليمية تلقائيًا، وتم تحديث حالة الخطة في الشاشة الرئيسية." : editorCompletionKind === "published_edit" ? "ظهر تعديل حصصك المنشورة مباشرة دون إعادة إرسالها للمشرف." : editorCompletionKind === "approved_edit" ? "بقيت موافقة المشرف كما هي. سيظهر التعديل لولي الأمر عند استيفاء شروط النشر وإظهار الأسبوع." : editorCompletionKind === "error" ? "لم يتم إغلاق المحرر حتى لا تفقد ما كتبته. راجع الرسالة الظاهرة داخل المحرر ثم حاول مرة أخرى." : "تم إرسال الخطة إلى المشرف للموافقة عليها، وأُغلق المحرر وتم تحديث حالتها إلى: تم الإرسال للمشرف." : editorCompletionKind === "draft" ? "The plan was saved as a draft and the editor was closed. You can reopen it from the main screen later." : editorCompletionKind === "approved" ? "Your teaching lessons were approved automatically and the plan status was updated on the main screen." : editorCompletionKind === "published_edit" ? "Your published lessons were updated without another supervisor review." : editorCompletionKind === "approved_edit" ? "Supervisor approval is unchanged. Families will see the update when publication and week-visibility conditions are met." : editorCompletionKind === "error" ? "The editor stayed open so your writing was not lost. Review the message in the editor and try again." : "Your weekly plan was sent to the supervisor, the editor was closed, and its status was updated."}</p><div><button type="button" className="teacher-primary-button" onClick={finishSuccessfulSubmission}>{submissionSuccessArabic ? editorCompletionKind === "error" ? "العودة إلى المحرر" : "حسنًا" : editorCompletionKind === "error" ? "Return to editor" : "OK"}</button></div></section></div>}
      {copyDialogOpen && copySourcePlan && <div className="weekly-send-confirmation-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeCopyPlanDialog()}>
        <section className="weekly-copy-dialog" style={{ maxHeight: "calc(100dvh - 40px)", overflowY: "auto" }} role="dialog" aria-modal="true" aria-labelledby="weekly-copy-dialog-title" dir={dashboardArabic ? "rtl" : "ltr"}>
          <div className="weekly-copy-dialog-heading"><span aria-hidden="true">CP</span><div><small>{copySourcePlan.week} · {copySourcePlan.className}</small><h3 id="weekly-copy-dialog-title">{dashboardArabic ? "أين تريد نسخ الخطة بالكامل؟" : "Where do you want to copy your full plan?"}</h3></div></div>
          <p>{dashboardArabic ? "سيتم نسخ محتوى جميع موادك المكتوبة: عمل الحصة والواجب وملاحظات كلاسيرا، وتوزيع كل مادة على حصصها حسب جدول الفصل المستهدف، حتى لو اختلف اليوم أو رقم الحصة." : "All your written subjects' Classwork, Homework and Classera notes will be copied. Each subject follows the target class timetable, even when the day or period differs."}</p>
          <div className="weekly-copy-dialog-fields" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}><label>{dashboardArabic ? "الفصل المستهدف" : "Target class"}<select value={copyTargetClassId} onChange={(event) => { setCopyTargetClassId(event.target.value); setCopyFeedback(""); setCopyConflict(null); }} disabled={saving}><option value="">{dashboardArabic ? "اختر الفصل" : "Select class"}</option>{copyTargetClasses.filter((target) => target.lessonCount > 0).map((target) => <option key={target.classId} value={target.classId}>{dashboardArabic ? `الصف ${target.grade} · ${target.section} — ${target.lessonCount} حصص` : `Grade ${target.grade} · ${target.section} — ${target.lessonCount} lessons`}</option>)}</select></label></div>
          {copySourceAssignments.length === 0 && <p className="weekly-copy-dialog-feedback info">{dashboardArabic ? "اكتب واحفظ حصة واحدة على الأقل قبل نسخ الخطة." : "Write and save at least one lesson before copying."}</p>}
          {copySourceAssignments.length > 0 && !copyTargetClasses.some((target) => target.lessonCount > 0) && <p className="weekly-copy-dialog-feedback info">{dashboardArabic ? "لا يوجد فصل آخر في الصف نفسه له حصص مسندة لك." : "No other class in the same grade has lessons assigned to you."}</p>}
          {copyFeedback && <p className="weekly-copy-dialog-feedback error" role="alert">{copyFeedback}</p>}
          {copyConflict && <div className="weekly-copy-dialog-conflict" role="alert"><strong>{dashboardArabic ? `توجد لك خطة محفوظة في ${copyConflict.targetLabel}` : `You already have a saved plan in ${copyConflict.targetLabel}`}</strong><p>{dashboardArabic ? "لم يتم نسخ أو استبدال أي محتوى. يمكنك معاينة الخطة الحالية أو اختيار فصل آخر." : "Nothing was copied or replaced. Preview the existing plan or choose another class."}</p><button type="button" className="teacher-secondary-button continue" disabled={saving} onClick={() => void openExistingCopyTarget()}>{dashboardArabic ? "معاينة الخطة الحالية" : "Preview existing plan"}</button></div>}
          <div className="weekly-copy-dialog-note">{dashboardArabic ? "النسخة الجديدة مسودة تحتاج المراجعة والإرسال للاعتماد. لا تُستبدل أي خطة مكتوبة أو مرسلة أو معتمدة. الإنجليزي يحتفظ باختيار AL أو OL مع المحتوى، مع تفضيل نفس اليوم ثم الحصة المتاحة التالية. الإعلانات والاختبارات وكلمات الإملاء المنفصلة لا يشملها نسخ الحصص." : "The copy is a draft that needs review and submission. Existing written, submitted or approved work is never replaced. English keeps its AL/OL choice, preferring the same day then the next available lesson. Separate announcements, quizzes and dictation words are not copied."}</div>
          <div className="weekly-copy-dialog-actions"><button type="button" className="teacher-secondary-button" disabled={saving} onClick={closeCopyPlanDialog}>{dashboardArabic ? "إلغاء" : "Cancel"}</button><button type="button" className="teacher-primary-button" disabled={saving || !copySourceAssignments.length || !copyTargetClassId || Boolean(copyConflict)} onClick={() => void copyPlanToOtherClasses()}>{saving ? dashboardArabic ? "جارٍ النسخ…" : "Copying…" : dashboardArabic ? "نسخ الخطة بالكامل وفتح المحرر" : "Copy full plan and open editor"}</button></div>
        </section>
      </div>}
      {parentPreviewOpen && selectedClass && selectedWeek && <div className="teacher-modal-backdrop parent-preview-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setParentPreviewOpen(false)}><section className="teacher-parent-preview" dir="ltr" role="dialog" aria-modal="true" aria-labelledby="parent-preview-title"><div className="teacher-modal-heading"><div><p>Preview only — nothing has been saved or sent</p><h2 id="parent-preview-title">Parent weekly-plan preview</h2></div><button aria-label="Close parent plan preview" onClick={() => setParentPreviewOpen(false)}>×</button></div><div className="parent-preview-intro">Your current writing is shown in its real timetable position. Other subjects are intentionally blank because this is only your private preview.</div>{parentPreviewLoading ? <p className="parent-preview-loading">Loading the class timetable…</p> : <section className="parent-preview-paper"><div className="parent-preview-paper-header"><img src={`${basePath}/school-logo.png`} alt="AlAndalus Private Schools" /><div><strong>ALANDALUS PRIVATE SCHOOLS</strong><span>The Egyptian Section</span><h3>WEEKLY STUDY PLAN</h3></div></div><div className="parent-preview-meta"><span><small>Class</small><strong>Grade {selectedClass.grade} · Class {selectedClass.section}</strong></span><span><small>Week No.</small><strong>{selectedWeek.week_number}</strong></span><span><small>Date</small><strong>{academicWeekRange(selectedWeek)}</strong></span></div>{departmentName === "English Department" && parseDictationWords(dictationWords).length > 0 && <section className="parent-dictation-block"><h3>Vocabulary for Dictation on {dayNames[Number(dictationDay)]}</h3><table><tbody>{chunkWords(parseDictationWords(dictationWords)).map((row, rowIndex) => <tr key={rowIndex}>{row.map((word) => <td key={word}>{word}</td>)}</tr>)}</tbody></table></section>}<div className="table-wrap"><table className="weekly-table parent-preview-table"><colgroup><col className="day-column" /><col className="course-column" /><col className="classwork-column" /><col className="homework-column" /><col className="classera-column" /></colgroup><thead><tr><th>Day</th><th>Course</th><th>Classwork</th><th>Homework</th><th>Classera Notes</th></tr></thead>{dayNames.map((day, dayIndex) => { const daySlots = parentPreviewSlots.filter((slot) => slot.day_of_week === dayIndex); return daySlots.length > 0 ? <tbody className="weekly-day-group" key={day}>{daySlots.map((slot, index) => { const ownSlot = selectedClassSlots.find((teacherSlot) => teacherSlot.id === slot.id); const draft = ownSlot ? slotDraftFor(ownSlot) : null; return <tr key={slot.id} className={index === 0 ? "new-day" : ""}>{index === 0 && <td className="day-cell" rowSpan={daySlots.length}>{day}</td>}<td className="course-cell">{slot.subject}</td><td className={draft?.classwork.trim() ? "preview-written" : "preview-empty"}>{ownSlot ? previewClasswork(ownSlot) || "—" : "—"}</td><td className={draft?.homework.trim() ? "preview-written" : "preview-empty"}>{ownSlot ? draft?.homework.trim() || "—" : "—"}</td><td className={draft?.classeraNotes.trim() ? "preview-written" : "preview-empty"}>{ownSlot ? draft?.classeraNotes.trim() || "—" : "—"}</td></tr>; })}</tbody> : null; })}</table>{parentPreviewSlots.length === 0 && <p className="parent-preview-loading">No timetable lessons are available for this class yet.</p>}</div></section>}<div className="teacher-editor-footer parent-preview-footer"><span>This preview does not submit, approve, or publish the weekly plan.</span><div><button type="button" className="teacher-primary-button" onClick={() => setParentPreviewOpen(false)}>Return to editor</button></div></div></section></div>}
    </main>
  );
}
