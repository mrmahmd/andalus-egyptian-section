"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StaffLanguagePreference } from "../language-switcher";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { formatAcademicWeekRange } from "../../lib/format-academic-week";

const navigation = [
  ["Overview", "OV"],
  ["Weekly Plans", "WP"],
  ["My Classes", "CL"],
  ["My Subjects", "SB"],
  ["Calendar", "CA"],
] as const;

const supervisorNavigation = [
  ["Overview", "OV"],
  ["Weekly Plans", "WP"],
  ["Teacher Reviews", "RV"],
  ["Department Teachers", "DT"],
  ["Profile & assignments", "PR"],
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
  day_of_week: number;
  period_number: number;
  requires_weekly_plan_submission: boolean;
};

type ParentPreviewSlot = TimetableSlot & {
  subject: string;
};

type TeacherEntry = {
  id: string;
  weeklyPlanId: string;
  classId: string;
  weekId: string;
  subjectId: string;
  day: string;
  className: string;
  subject: string;
  week: string;
  status: string;
  updated: string;
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
type SchoolClass = { id: string; grade: number; section: string };
type SchoolSubject = { id: string; name_en: string };
type DepartmentTeacher = { userId: string; name: string; assignments: Assignment[] };
type WeeklyPlanRow = { planId: string; classId: string; weekId: string; className: string; week: string; subjects: string[]; lessonCount: number; status: string; updated: string };

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
  const [profileId, setProfileId] = useState("");
  const [teacherName, setTeacherName] = useState("Teacher");
  const [departmentName, setDepartmentName] = useState("Teacher Department");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [academicWeeks, setAcademicWeeks] = useState<AcademicWeek[]>([]);
  const [schoolHolidays, setSchoolHolidays] = useState<SchoolHoliday[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
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
  const [copySubjectId, setCopySubjectId] = useState("");
  const [copyTargetClassId, setCopyTargetClassId] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [parentPreviewOpen, setParentPreviewOpen] = useState(false);
  const [parentPreviewLoading, setParentPreviewLoading] = useState(false);
  const [parentPreviewSlots, setParentPreviewSlots] = useState<ParentPreviewSlot[]>([]);
  const [sendConfirmationOpen, setSendConfirmationOpen] = useState(false);
  const [sendConfirmationArabic, setSendConfirmationArabic] = useState(false);
  const [submissionSuccessOpen, setSubmissionSuccessOpen] = useState(false);
  const [submissionSuccessArabic, setSubmissionSuccessArabic] = useState(false);

  useEffect(() => {
    setDashboardArabic(window.localStorage.getItem("andalus-language") === "ar");
  }, []);

  const loadTeacherDashboard = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        window.location.assign(`${basePath}/teachers/login/`);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, display_name, role, status, department_id, departments(name_en), staff_directory(administrative_role)")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      const staffRecord = one(profile?.staff_directory as { administrative_role: string | null } | { administrative_role: string | null }[] | null);
      const supervisorAccount = profile?.role === "admin" && String(staffRecord?.administrative_role ?? "").includes("Supervisor");
      if (!profile || (profile.role !== "teacher" && !supervisorAccount) || profile.status !== "active") {
        const destination = profile?.role === "super_admin" ? "/super-admin/" : profile?.role === "admin" ? "/admin/" : "/teachers/login/";
        window.location.assign(`${basePath}${destination}`);
        return;
      }

      const departmentTeachersPromise = supervisorAccount ? supabase.rpc("get_my_department_teachers") : Promise.resolve({ data: [], error: null });
      const [assignmentsResult, weeksResult, slotsResult, entriesResult, mySubmissionsResult, reviewsResult, departmentTeachersResult, classesResult, subjectsResult, accessResult, teacherAccessResult, holidaysResult] = await Promise.all([
        supabase.from("teacher_assignments").select("id, class_id, subject_id, school_classes(grade, section), subjects(name_en, include_in_weekly_plan)").eq("teacher_id", userData.user.id),
        supabase.from("academic_weeks").select("id, week_number, label, starts_on, ends_on, is_current, teacher_entry_enabled, parent_portal_visible").order("week_number"),
        supabase.from("timetable_slots").select("id, class_id, subject_id, day_of_week, period_number, requires_weekly_plan_submission").eq("teacher_id", userData.user.id).eq("requires_weekly_plan_submission", true).order("day_of_week").order("period_number"),
        supabase.from("plan_entries").select("id, weekly_plan_id, subject_id, day_of_week, updated_at, subjects(name_en), weekly_plans(class_id, week_id, status, school_classes(grade, section), academic_weeks(label))").eq("teacher_id", userData.user.id).order("updated_at", { ascending: false }),
        supabase.from("plan_submissions").select("id, weekly_plan_id, subject_id, status, review_note, weekly_plans(class_id, week_id, school_classes(grade, section), academic_weeks(label)), subjects(name_en)").eq("teacher_id", userData.user.id).order("updated_at", { ascending: false }),
        Promise.resolve({ data: [], error: null }),
        departmentTeachersPromise,
        supabase.from("school_classes").select("id, grade, section").eq("is_active", true).order("grade").order("section"),
        supabase.from("subjects").select("id, name_en").eq("is_active", true).eq("include_in_weekly_plan", true).order("name_en"),
        supabase.from("weekly_plan_access_control").select("is_open").eq("id", 1).maybeSingle(),
        supabase.from("weekly_plan_teacher_access").select("is_open").eq("teacher_id", userData.user.id).maybeSingle(),
        supabase.from("weekly_plan_holidays").select("id, week_id, day_of_week, title, note"),
      ]);
      const firstError = [assignmentsResult.error, weeksResult.error, slotsResult.error, entriesResult.error, mySubmissionsResult.error, reviewsResult.error, classesResult.error, subjectsResult.error, holidaysResult.error].find(Boolean);
      if (firstError) throw firstError;

      const requiredSlotRows = (slotsResult.data ?? []) as TimetableSlot[];
      const realAssignments: Assignment[] = (assignmentsResult.data ?? []).map((assignment) => {
        const schoolClass = one(assignment.school_classes as { grade: number; section: string } | { grade: number; section: string }[] | null);
        const subject = one(assignment.subjects as { name_en: string; include_in_weekly_plan: boolean } | { name_en: string; include_in_weekly_plan: boolean }[] | null);
        if (!subject?.include_in_weekly_plan || !requiredSlotRows.some((slot) => String(slot.class_id) === String(assignment.class_id) && String(slot.subject_id) === String(assignment.subject_id))) return null;
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
          id: String(entry.id), weeklyPlanId: String(entry.weekly_plan_id), classId: String(weeklyPlan?.class_id ?? ""), weekId: String(weeklyPlan?.week_id ?? ""), subjectId: String(entry.subject_id),
          day: dayNames[Number(entry.day_of_week)] ?? "School day",
          className: `Grade ${schoolClass?.grade ?? "—"} · ${schoolClass?.section ?? ""}`,
          subject: subject?.name_en ?? "Subject",
          week: week?.label ?? "Academic week",
          status: weeklyPlan?.status ?? "draft",
          updated: formatDate(String(entry.updated_at)),
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
          id: String(item.id), weeklyPlanId: String(item.weekly_plan_id ?? ""), teacherId: String(item.teacher_id), weekId: String(item.week_id ?? ""), classId: String(item.class_id ?? ""), teacherName: String(item.teacher_name ?? "Teacher"), subject: String(item.subject_name ?? "Subject"),
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
      setProfileId(userData.user.id);
      setTeacherName(profile.display_name);
      setDepartmentName(department?.name_en ?? "Teacher Department");
      setWeeklyPlanCreationOpen(teacherAccessResult.data?.is_open ?? accessResult.data?.is_open ?? true);
      setIsSupervisor(supervisorAccount);
      setAssignments(realAssignments);
      setAcademicWeeks(weeks);
      setSchoolHolidays((holidaysResult.data ?? []) as SchoolHoliday[]);
      setTimetableSlots(requiredSlotRows);
      setEntries(realEntries);
      setMySubmissions(realMySubmissions);
      setReviewItems(realReviews);
      setDepartmentTeachers(realDepartmentTeachers);
      setSchoolClasses((classesResult.data ?? []) as SchoolClass[]);
      setSchoolSubjects((subjectsResult.data ?? []) as SchoolSubject[]);
      setSelectedDepartmentTeacherId((current) => realDepartmentTeachers.some((teacher) => teacher.userId === current) ? current : realDepartmentTeachers[0]?.userId ?? "");
      setSelectedReviewWeekId((current) => weeks.some((week) => week.id === current) ? current : weeks.find((week) => week.is_current)?.id ?? weeks[0]?.id ?? "");
      if (departmentTeachersResult.error) {
        setMessage("Your dashboard is ready. Department teacher assignments could not be loaded yet; please refresh once.");
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

  const teacherEntryWeeks = useMemo(() => academicWeeks.filter((week) => week.teacher_entry_enabled), [academicWeeks]);
  const selectedWeek = teacherEntryWeeks.find((week) => week.id === selectedWeekId);
  const holidayForDay = (dayOfWeek: number) => schoolHolidays.find((holiday) => holiday.week_id === selectedWeekId && holiday.day_of_week === dayOfWeek) ?? null;
  const selectedClassAssignments = useMemo(() => assignments.filter((assignment) => assignment.classId === selectedClassId), [assignments, selectedClassId]);
  const selectedClass = selectedClassAssignments[0];
  const selectedClassSlots = useMemo(() => timetableSlots
    .filter((slot) => slot.class_id === selectedClassId && selectedClassAssignments.some((assignment) => assignment.subjectId === slot.subject_id) && !schoolHolidays.some((holiday) => holiday.week_id === selectedWeekId && holiday.day_of_week === slot.day_of_week))
    .sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number), [timetableSlots, selectedClassAssignments, selectedClassId, selectedWeekId, schoolHolidays]);
  const editableClassSlots = useMemo(() => selectedClassSlots.filter((slot) => !holidayForDay(slot.day_of_week)), [selectedClassSlots, selectedWeekId, schoolHolidays]);
  const activeDayIndexes = dayNames.map((_, index) => index).filter((index) => selectedClassSlots.some((slot) => slot.day_of_week === index) || Boolean(holidayForDay(index)));
  const assignmentForSlot = (slot: TimetableSlot) => selectedClassAssignments.find((assignment) => assignment.subjectId === slot.subject_id);
  const slotDraftFor = (slot: TimetableSlot) => slotDrafts[slot.id] ?? emptySlotDraft();
  const uniqueClasses = useMemo(() => Array.from(new Map(assignments.map((assignment) => [assignment.classId, `Grade ${assignment.grade} · ${assignment.section}`])).values()), [assignments]);
  const uniqueSubjects = useMemo(() => Array.from(new Set(assignments.map((assignment) => assignment.subject))), [assignments]);

  const approvedSubjectIds = useMemo(() => new Set(mySubmissions
    .filter((submission) => submission.classId === selectedClassId && submission.weekId === selectedWeekId && submission.status === "approved")
    .map((submission) => submission.subjectId)), [mySubmissions, selectedClassId, selectedWeekId]);
  const copySourceAssignments = useMemo(() => {
    if (!copySourcePlan) return [];
    const writtenSubjectIds = new Set(entries.filter((entry) => entry.weeklyPlanId === copySourcePlan.planId).map((entry) => entry.subjectId));
    return assignments.filter((assignment) => assignment.classId === copySourcePlan.classId && writtenSubjectIds.has(assignment.subjectId));
  }, [assignments, copySourcePlan, entries]);
  const copyTargetClasses = useMemo(() => {
    const sourceSubject = copySourceAssignments.find((assignment) => assignment.subjectId === copySubjectId);
    if (!sourceSubject || !copySourcePlan) return [];
    return Array.from(new Map(assignments
      .filter((assignment) => assignment.classId !== copySourcePlan.classId && assignment.grade === sourceSubject.grade && assignment.subjectId === sourceSubject.subjectId)
      .map((assignment) => [assignment.classId, assignment])).values())
      .map((assignment) => ({ ...assignment, lessonCount: timetableSlots.filter((slot) => slot.class_id === assignment.classId && slot.subject_id === copySubjectId).length }));
  }, [assignments, copySourceAssignments, copySourcePlan, copySubjectId, timetableSlots]);

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
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: plan, error: planError } = await supabase.from("weekly_plans")
        .select("id, plan_entries(timetable_slot_id, subject_id, day_of_week, period_number, classwork, homework, classera_notes), plan_quizzes(subject_id, quiz_date, details), plan_notes(note_text, teacher_id)")
        .eq("class_id", selectedClassId).eq("week_id", selectedWeekId).maybeSingle();
      if (planError) throw planError;
      setSavedPlanId(plan?.id ? String(plan.id) : "");
      const rows = (plan?.plan_entries ?? []) as Array<{ timetable_slot_id: string | null; subject_id: string; day_of_week: number; period_number: number; classwork: string; homework: string; classera_notes: string }>;
      const nextDrafts: Record<string, SlotDraft> = {};
      selectedClassSlots.forEach((slot) => {
        const row = rows.find((entry) => entry.timetable_slot_id === slot.id) ?? rows.find((entry) => entry.day_of_week === slot.day_of_week && entry.period_number === slot.period_number && entry.subject_id === slot.subject_id);
        if (!row) return;
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

  const openWeeklyBuilder = () => {
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
      setMessage("No classes or subjects are assigned yet. Ask the Super Admin to complete your assignments.");
      setMessageTone("info");
      return;
    }
    if (teacherEntryWeeks.length === 0) {
      setMessage("No academic week is currently open for teacher entry. Your saved and submitted plans remain available in plan history.");
      setMessageTone("info");
      return;
    }
    const firstAssignment = selectedClass ?? assignments[0];
    const firstWeek = selectedWeek ?? teacherEntryWeeks.find((week) => week.is_current) ?? teacherEntryWeeks[0];
    if (!selectedClassId && firstAssignment) setSelectedClassId(firstAssignment.classId);
    if (!selectedWeekId && firstWeek) setSelectedWeekId(firstWeek.id);
    setBuilderFeedback(null);
    setWeeklyBuilderOpen(true);
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
      const { data, error } = await getSupabaseBrowserClient().from("timetable_slots")
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
    if (!profileId || !selectedClass || !selectedWeek) return;
    if (submitForReview && autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    if (!submitForReview && builderStatus === "submitted") {
      if (!silent) {
        setMessage("This weekly plan is already with your supervisor. Withdraw it before making or saving changes.");
        setMessageTone("info");
      }
      return;
    }
    if (selectedClassSlots.length === 0) {
      const text = "No timetable lessons are linked to this class yet. Ask the Super Admin to review the timetable connection.";
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
        const text = `Choose AL or OL for ${dayNames[englishSlotMissingProgramme.day_of_week]} · Period ${englishSlotMissingProgramme.period_number} before saving Classwork.`;
        setMessage(text);
        setMessageTone("error");
        setBuilderFeedback({ tone: "error", text });
      }
      return;
    }
    if (submitForReview) {
      pendingSupervisorSubmission.current = false;
      setBuilderFeedback({ tone: "info", text: isSupervisor ? "Approving your teaching plan automatically…" : "Sending the weekly plan to your supervisor…" });
    }
    setSaving(true);
    if (silent) setAutoSaveState("saving");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: existingPlan, error: planReadError } = await supabase.from("weekly_plans").select("id").eq("class_id", selectedClassId).eq("week_id", selectedWeek.id).maybeSingle();
      if (planReadError) throw planReadError;
      let weeklyPlanId = existingPlan?.id ? String(existingPlan.id) : "";
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

      const entryRows = editableClassSlots.filter((slot) => !approvedSubjectIds.has(slot.subject_id)).map((slot) => {
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

      setSavedPlanId(weeklyPlanId);
      autoSavedSignature.current = autosaveSignature;
      if (!silent) {
        const successText = submitForReview
          ? isSupervisor
            ? "Your teaching plan was approved automatically. The class plan is visible when no submitted plan is still waiting for review; missing teachers appear as Plan not published."
            : "Your weekly plan was sent to the supervisor for approval. The class plan is visible when every submitted plan has been approved; missing teachers appear as Plan not published."
          : "Your weekly plan was saved as a draft. Send it to the supervisor when it is complete.";
        setMessage(successText);
        setMessageTone("success");
        setBuilderFeedback({ tone: "success", text: successText });
        await loadTeacherDashboard();
        if (submitForReview) {
          setSubmissionSuccessArabic(sendConfirmationArabic);
          setSubmissionSuccessOpen(true);
        }
      } else {
        setAutoSaveState("saved");
      }
    } catch (error) {
      if (silent) { autoSavedSignature.current = ""; setAutoSaveState("idle"); }
      else {
        const errorText = error instanceof Error ? error.message : "The weekly plan could not be saved.";
        setMessage(errorText);
        setMessageTone("error");
        setBuilderFeedback({ tone: "error", text: errorText });
      }
    } finally {
      setSaving(false);
      if (!submitForReview && pendingSupervisorSubmission.current) {
        pendingSupervisorSubmission.current = false;
        window.setTimeout(() => { void saveWholeWeek(true); }, 0);
      }
    }
  };

  const confirmAndSendWholeWeek = () => {
    const arabic = window.localStorage.getItem("andalus-language") === "ar";
    const hasWrittenClasswork = editableClassSlots.some((slot) => !approvedSubjectIds.has(slot.subject_id) && Boolean(slotDraftFor(slot).classwork.trim()));
    if (!hasWrittenClasswork) {
      setBuilderFeedback({ tone: "error", text: arabic ? "اكتب عمل الحصة لحصة واحدة على الأقل قبل إرسال الخطة الأسبوعية إلى المشرف." : "Write Classwork for at least one lesson before sending the weekly plan to your supervisor." });
      window.alert(arabic ? "اكتب عمل الحصة لحصة واحدة على الأقل قبل إرسال الخطة الأسبوعية إلى المشرف." : "Write Classwork for at least one lesson before sending the weekly plan to your supervisor.");
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
    setWeeklyBuilderOpen(false);
    setActiveNav("Overview");
  };

  const hasAutosaveContent = useMemo(() => Object.values(slotDrafts).some((draft) => Boolean(draft.classwork.trim() || draft.homework.trim() || draft.classeraNotes.trim())) || Boolean(quizDetails.trim() || (departmentName === "English Department" && dictationWords.trim())), [slotDrafts, quizDetails, departmentName, dictationWords]);
  const autosaveSignature = useMemo(() => JSON.stringify({ selectedClassId, selectedWeekId, slotDrafts, quizDay, quizDetails, quizSubjectId, dictationDay, dictationWords }), [selectedClassId, selectedWeekId, slotDrafts, quizDay, quizDetails, quizSubjectId, dictationDay, dictationWords]);
  useEffect(() => {
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    if (!weeklyBuilderOpen || !builderHydrated || !hasAutosaveContent || saving || builderStatus === "submitted" || builderStatus === "approved" || autoSavedSignature.current === autosaveSignature) return;
    setAutoSaveState("idle");
    autoSaveTimer.current = window.setTimeout(() => { autoSavedSignature.current = autosaveSignature; void saveWholeWeek(false, true); }, 1400);
    return () => { if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current); };
  }, [weeklyBuilderOpen, builderHydrated, hasAutosaveContent, autosaveSignature, saving, builderStatus]);

  const withdrawSubmissionForEditing = async (submission: MySubmission) => {
    if (submission.status !== "submitted") return;
    setSaving(true);
    try {
      const { data: withdrawnRows, error } = await getSupabaseBrowserClient()
        .from("plan_submissions")
        .update({ status: "draft", submitted_at: null, review_note: null, reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() })
        .eq("weekly_plan_id", submission.weeklyPlanId)
        .eq("teacher_id", profileId)
        .eq("status", "submitted")
        .select("id, status");
      if (error) throw error;
      if (!(withdrawnRows ?? []).length || (withdrawnRows ?? []).some((row) => row.status !== "draft")) throw new Error("Supabase did not confirm the complete plan withdrawal. Please try again.");
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

  const openSavedPlan = (submission: MySubmission) => {
    setSelectedClassId(submission.classId);
    setSelectedWeekId(submission.weekId);
    setBuilderFeedback(null);
    setWeeklyBuilderOpen(true);
  };

  const openEntryEditor = (entry: TeacherEntry) => {
    setSelectedClassId(entry.classId);
    setSelectedWeekId(entry.weekId);
    setBuilderFeedback(null);
    setWeeklyBuilderOpen(true);
  };

  const entryReviewStatus = (entry: TeacherEntry) => mySubmissions.find((submission) => submission.classId === entry.classId && submission.weekId === entry.weekId && submission.subjectId === entry.subjectId)?.status ?? entry.status;

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
      const supabase = getSupabaseBrowserClient();
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

  const openWeeklyPlan = (plan: WeeklyPlanRow) => {
    setSelectedClassId(plan.classId);
    setSelectedWeekId(plan.weekId);
    setWeeklyBuilderOpen(true);
  };

  const openCopyPlanDialog = (plan: WeeklyPlanRow) => {
    const sourceSubjectIds = Array.from(new Set(entries.filter((entry) => entry.weeklyPlanId === plan.planId).map((entry) => entry.subjectId)));
    setCopySourcePlan(plan);
    setCopySubjectId(sourceSubjectIds[0] ?? "");
    setCopyTargetClassId("");
    setCopyFeedback("");
    setCopyDialogOpen(true);
  };

  const closeCopyPlanDialog = () => {
    if (saving) return;
    setCopyDialogOpen(false);
    setCopySourcePlan(null);
    setCopySubjectId("");
    setCopyTargetClassId("");
    setCopyFeedback("");
  };

  const clearWeeklyDraft = async (plan: WeeklyPlanRow) => {
    if (plan.status !== "draft" && plan.status !== "changes_requested") return;
    if (!window.confirm(`Clear your saved draft for ${plan.className}, ${plan.week}? This removes only your lessons and keeps other teachers' work unchanged.`)) return;
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
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
    if (!copySourcePlan || !copySubjectId || !copyTargetClassId) return;
    const target = copyTargetClasses.find((item) => item.classId === copyTargetClassId);
    if (!target || target.lessonCount === 0) {
      setCopyFeedback("The selected class has no matching timetable lessons for this subject.");
      return;
    }
    const sourceWeek = academicWeeks.find((week) => week.id === copySourcePlan.weekId);
    if (!sourceWeek?.teacher_entry_enabled) {
      setCopyFeedback("This week is closed for teacher entry, so a new copied draft cannot be created.");
      return;
    }
    setSaving(true);
    setCopyFeedback("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sourceRows, error: sourceError } = await supabase.from("plan_entries")
        .select("classwork, homework, classera_notes").eq("weekly_plan_id", copySourcePlan.planId).eq("teacher_id", profileId).eq("subject_id", copySubjectId).order("day_of_week").order("period_number");
      if (sourceError) throw sourceError;
      if (!sourceRows?.length) throw new Error("Save the source class plan before copying it.");

      const { data: existingPlan, error: existingPlanError } = await supabase.from("weekly_plans").select("id").eq("class_id", target.classId).eq("week_id", copySourcePlan.weekId).maybeSingle();
      if (existingPlanError) throw existingPlanError;
      let targetPlanId = existingPlan?.id ? String(existingPlan.id) : "";
      if (targetPlanId) {
        const [{ data: targetExistingEntries, error: targetEntriesError }, { data: targetSubmission, error: targetSubmissionError }] = await Promise.all([
          supabase.from("plan_entries").select("id").eq("weekly_plan_id", targetPlanId).eq("teacher_id", profileId).eq("subject_id", copySubjectId).limit(1),
          supabase.from("plan_submissions").select("status").eq("weekly_plan_id", targetPlanId).eq("teacher_id", profileId).eq("subject_id", copySubjectId).maybeSingle(),
        ]);
        if (targetEntriesError) throw targetEntriesError;
        if (targetSubmissionError) throw targetSubmissionError;
        if ((targetExistingEntries?.length ?? 0) > 0 || targetSubmission) {
          setCopyFeedback(`Grade ${target.grade} · ${target.section} already has your ${copySourceAssignments.find((assignment) => assignment.subjectId === copySubjectId)?.subject ?? "subject"} plan for this week. Nothing was overwritten; open that plan from the main screen if you want to edit it.`);
          return;
        }
      }
      if (!targetPlanId) {
        const { data: createdPlan, error: createdPlanError } = await supabase.from("weekly_plans").insert({ class_id: target.classId, week_id: copySourcePlan.weekId, class_teacher_name: teacherName, status: "draft" }).select("id").single();
        if (createdPlanError) throw createdPlanError;
        targetPlanId = String(createdPlan.id);
      }
      const targetSlots = timetableSlots.filter((slot) => slot.class_id === target.classId && slot.subject_id === copySubjectId).sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number);
      const rowsToCopy = targetSlots.slice(0, sourceRows.length).map((slot, index) => ({ weekly_plan_id: targetPlanId, timetable_slot_id: slot.id, teacher_id: profileId, subject_id: copySubjectId, day_of_week: slot.day_of_week, period_number: slot.period_number, classwork: sourceRows[index].classwork, homework: sourceRows[index].homework, classera_notes: sourceRows[index].classera_notes, updated_at: new Date().toISOString() }));
      if (!rowsToCopy.length) throw new Error("No matching timetable lessons were available in the target class.");
      const { data: insertedRows, error: insertError } = await supabase.from("plan_entries").insert(rowsToCopy).select("id");
      if (insertError) throw insertError;
      if ((insertedRows ?? []).length !== rowsToCopy.length) throw new Error("Supabase did not confirm every copied lesson. Please try again.");
      const { data: savedSubmission, error: submissionError } = await supabase.from("plan_submissions").insert({ weekly_plan_id: targetPlanId, teacher_id: profileId, subject_id: copySubjectId, status: "draft", submitted_at: null, reviewed_by: null, reviewed_at: null, review_note: null }).select("id, status").single();
      if (submissionError) {
        const insertedIds = (insertedRows ?? []).map((row) => String(row.id));
        const { error: cleanupError } = insertedIds.length ? await supabase.from("plan_entries").delete().in("id", insertedIds).eq("teacher_id", profileId) : { error: null };
        if (cleanupError) throw new Error(`${submissionError.message} The copied lessons also need administrator cleanup before retrying.`);
        throw submissionError;
      }
      if (savedSubmission.status !== "draft") throw new Error("The copied plan was not confirmed as a draft.");
      const copiedClassId = target.classId;
      const copiedWeekId = copySourcePlan.weekId;
      const copiedMessage = `The plan was copied to Grade ${target.grade} · ${target.section} as a new draft. Review it before sending it for approval.`;
      await loadTeacherDashboard();
      setCopyDialogOpen(false);
      setCopySourcePlan(null);
      setCopySubjectId("");
      setCopyTargetClassId("");
      setSelectedClassId(copiedClassId);
      setSelectedWeekId(copiedWeekId);
      setSlotDrafts({});
      setQuizSubjectId("");
      autoSavedSignature.current = "";
      setMessage(copiedMessage);
      setMessageTone("success");
      setBuilderFeedback({ tone: "success", text: copiedMessage });
      setWeeklyBuilderOpen(true);
    } catch (error) {
      setCopyFeedback(error instanceof Error ? error.message : "The plan could not be copied.");
    } finally {
      setSaving(false);
    }
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
      const supabase = getSupabaseBrowserClient();
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
      setMessage(arabic ? "تعذر إكمال إجراء المراجعة." : error instanceof Error ? error.message : "The review action could not be completed.");
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
      const { data, error } = await getSupabaseBrowserClient().rpc("approve_my_week_submissions", {
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
      setMessage(arabic ? "تعذر اعتماد خطط الأسبوع المحدد." : error instanceof Error ? error.message : "The selected week plans could not be approved.");
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
      const supabase = getSupabaseBrowserClient();
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
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("teacher_assignments").delete().eq("id", assignmentId);
      if (error) throw error;
      setMessage("The assignment was removed from the teacher.");
      setMessageTone("success");
      await loadTeacherDashboard();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The assignment could not be removed."); setMessageTone("error"); } finally { setSaving(false); }
  };

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.assign(`${basePath}/teachers/login/`);
  };

  const currentWeek = academicWeeks.find((week) => week.is_current) ?? academicWeeks[0];
  const weeklyPlanRows = useMemo(() => Array.from(entries.reduce((groups, entry) => {
    const existing = groups.get(entry.weeklyPlanId) ?? { planId: entry.weeklyPlanId, classId: entry.classId, weekId: entry.weekId, className: entry.className, week: entry.week, subjects: [], lessonCount: 0, status: "draft", updated: entry.updated } as WeeklyPlanRow;
    if (!existing.subjects.includes(entry.subject)) existing.subjects.push(entry.subject);
    existing.lessonCount += 1;
    const status = entryReviewStatus(entry);
    if (entry.status === "published") existing.status = "published";
    else if (existing.status !== "published" && status === "submitted") existing.status = "submitted";
    else if (existing.status !== "published" && existing.status !== "submitted" && status === "changes_requested") existing.status = "changes_requested";
    else if (existing.status === "draft" && status === "approved") existing.status = "approved";
    groups.set(entry.weeklyPlanId, existing);
    return groups;
  }, new Map<string, WeeklyPlanRow>()).values()).sort((a, b) => Number(b.weekId === currentWeek?.id) - Number(a.weekId === currentWeek?.id) || a.week.localeCompare(b.week)), [entries, mySubmissions, currentWeek?.id]);
  const publishedCount = entries.filter((entry) => entry.status === "published").length;
  const draftCount = entries.filter((entry) => entry.status === "draft").length;
  const waitingReviews = reviewItems.filter((item) => item.status === "submitted");
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
  const selectedClassReviewRawItems = reviewItems.filter((item) => item.classId === selectedReviewClassId && item.weekId === selectedReviewWeekId);
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
      id: plan.key, weeklyPlanId: plan.weeklyPlanId, teacherId: plan.teacherId, weekId: plan.weekId, classId: plan.classId,
      teacherName: plan.teacherName, className: plan.className, week: plan.week,
      subject: plan.reviews.map((item) => item.subject).join(" + "), status: plan.status, note: plan.note, submittedAt: plan.submittedAt, entries: plan.entries, quizzes: plan.quizzes, weeklyNotes: plan.weeklyNotes,
    })), [selectedClassTeacherPlans]);
  const selectedWeekPendingCount = reviewItems.filter((item) => item.weekId === selectedReviewWeekId && item.status === "submitted").length;
  useEffect(() => {
    setSelectedReviewClassId((current) => supervisorReviewClasses.some((schoolClass) => schoolClass.id === current) ? current : supervisorReviewClasses[0]?.id ?? "");
  }, [supervisorReviewClasses]);
  const selectedDepartmentTeacher = departmentTeachers.find((teacher) => teacher.userId === selectedDepartmentTeacherId);
  const workspaceNavigation = isSupervisor ? [...navigation, ["Teacher Reviews", "RV"] as const, ["Department Teachers", "DT"] as const] : navigation;
  const openWorkspaceSection = (label: string) => {
    setActiveNav(label);
    setMobileNavigationOpen(false);
  };
  const openFirstWaitingReview = () => {
    const firstWaitingReview = waitingReviews[0];
    if (!firstWaitingReview) return;
    setSelectedReviewWeekId(firstWaitingReview.weekId);
    setSelectedReviewClassId(firstWaitingReview.classId);
    setActiveNav("Teacher Reviews");
    window.setTimeout(() => document.getElementById("supervisor-review-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return (
    <main className="teacher-portal">
      <aside className="teacher-sidebar">
        <div className="teacher-brand"><img src={`${basePath}/school-logo.png`} alt="AlAndalus Private Schools" /><div><strong>ALANDALUS</strong><span>Teacher Workspace</span></div></div>
        <div className="teacher-school-year"><span>Academic year</span><strong>2026–2027</strong></div>
        <nav className="teacher-nav" aria-label="Teacher workspace navigation">
          <p>Workspace</p>
          {workspaceNavigation.map(([label, icon]) => <button key={label} className={activeNav === label ? "active" : ""} onClick={() => openWorkspaceSection(label)}><span className="teacher-nav-icon">{icon}</span>{label}{label === "Weekly Plans" && <small>{entries.length}</small>}{label === "Teacher Reviews" && <small>{reviewItems.filter((item) => item.status === "submitted").length}</small>}{label === "Department Teachers" && <small>{departmentTeachers.length}</small>}</button>)}
          <p>Account</p>
          <button className={activeNav === "Profile & assignments" ? "active" : ""} onClick={() => openWorkspaceSection("Profile & assignments")}><span className="teacher-nav-icon">PR</span>Profile & assignments</button>
          <button className={activeNav === "Settings" ? "active" : ""} onClick={() => openWorkspaceSection("Settings")}><span className="teacher-nav-icon">ST</span>Settings</button>
        </nav>
        <div className="teacher-help-card"><span>?</span><strong>Need help?</strong><p>Contact the academic coordinator for account or assignment changes.</p><Link href="/support/">Open support</Link></div>
        <div className="teacher-sidebar-profile"><span className="teacher-avatar">{initials(teacherName)}</span><div><strong>{teacherName}</strong><small>Teacher</small></div><button aria-label="Sign out" onClick={() => void signOut()}>↪</button></div>
      </aside>

      <section className="teacher-main">
        <div className={`teacher-mobile-menu ${mobileNavigationOpen ? "is-open" : ""}`} aria-hidden={!mobileNavigationOpen}>
          <button type="button" className="teacher-mobile-menu-backdrop" aria-label="Close workspace menu" onClick={() => setMobileNavigationOpen(false)} />
          <div className="teacher-mobile-menu-panel" role="dialog" aria-modal="true" aria-label="Teacher workspace menu">
            <div className="teacher-mobile-menu-heading"><div className="teacher-brand"><img src={`${basePath}/school-logo.png`} alt="" /><div><strong>ALANDALUS</strong><span>Teacher Workspace</span></div></div><button type="button" aria-label="Close menu" onClick={() => setMobileNavigationOpen(false)}>×</button></div>
            <nav className="teacher-nav" aria-label="Teacher workspace navigation">
              <p>Workspace</p>
              {workspaceNavigation.map(([label, icon]) => <button key={label} className={activeNav === label ? "active" : ""} onClick={() => openWorkspaceSection(label)}><span className="teacher-nav-icon">{icon}</span>{label}{label === "Weekly Plans" && <small>{entries.length}</small>}{label === "Teacher Reviews" && <small>{reviewItems.filter((item) => item.status === "submitted").length}</small>}{label === "Department Teachers" && <small>{departmentTeachers.length}</small>}</button>)}
              <p>Account</p>
              <button className={activeNav === "Profile & assignments" ? "active" : ""} onClick={() => openWorkspaceSection("Profile & assignments")}><span className="teacher-nav-icon">PR</span>Profile & assignments</button>
              <button className={activeNav === "Settings" ? "active" : ""} onClick={() => openWorkspaceSection("Settings")}><span className="teacher-nav-icon">ST</span>Settings</button>
            </nav>
            <div className="teacher-sidebar-profile"><span className="teacher-avatar">{initials(teacherName)}</span><div><strong>{teacherName}</strong><small>Teacher</small></div><button aria-label="Sign out" onClick={() => void signOut()}>↪</button></div>
          </div>
        </div>
        <header className="teacher-topbar"><button type="button" className="teacher-mobile-menu-button" aria-label="Open workspace menu" aria-expanded={mobileNavigationOpen} onClick={() => setMobileNavigationOpen(true)}>☰</button><div className="teacher-mobile-brand"><img src={`${basePath}/school-logo.png`} alt="" /><strong>Teacher Workspace</strong></div><label className="teacher-search"><span>⌕</span><input type="search" placeholder="Search plans, classes or subjects" /></label><div className="teacher-top-actions"><span className="teacher-sync"><i /> Supabase connected</span><button className="teacher-profile-chip"><span className="teacher-avatar">{initials(teacherName)}</span><span><strong>{teacherName}</strong><small>{departmentName}</small></span></button></div></header>
        {isSupervisor && <nav className="teacher-mobile-supervisor-nav" aria-label="Supervisor workspace navigation">{supervisorNavigation.map(([label, icon]) => <button key={label} className={activeNav === label ? "active" : ""} onClick={() => setActiveNav(label)}><span>{icon}</span><b>{label}</b>{label === "Teacher Reviews" && reviewItems.filter((item) => item.status === "submitted").length > 0 && <i>{reviewItems.filter((item) => item.status === "submitted").length}</i>}{label === "Department Teachers" && <i>{departmentTeachers.length}</i>}</button>)}</nav>}

        <div className="teacher-content">
          <div className="teacher-page-heading"><div><p className="teacher-kicker">{currentWeek?.label ?? "Teacher workspace"}</p><h1>{activeNav === "Overview" ? `Welcome, ${teacherName}.` : activeNav}</h1><span>{activeNav === "Overview" ? "Your live assignments and weekly-plan progress are shown below." : "This section is connected to your approved school profile."}</span></div><div className="teacher-heading-actions"><button type="button" className="teacher-primary-button" disabled={saving || !weeklyPlanCreationOpen} aria-busy={loading} onClick={openWeeklyBuilder}><span>＋</span> {loading ? "Loading teacher data…" : weeklyPlanCreationOpen ? "Create weekly plan" : "Weekly plan creation closed"}</button></div></div>

          {message && <p className={`super-admin-live-message ${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{message}</p>}

          {(activeNav === "Overview" || activeNav === "Weekly Plans") && <>
            <section className="teacher-stats" aria-label="Weekly plan summary">
              <article><span className="stat-icon navy">AS</span><div><small>Assignments</small><strong>{assignments.length}</strong><p>Approved by Super Admin</p></div></article>
              <article><span className="stat-icon magenta">PB</span><div><small>Published entries</small><strong>{publishedCount}</strong><p>Visible after plan publication</p></div></article>
              <article><span className="stat-icon cyan">DR</span><div><small>Draft entries</small><strong>{draftCount}</strong><p>Saved in Supabase</p></div></article>
              <article><span className="stat-icon amber">TS</span><div><small>Timetable slots</small><strong>{timetableSlots.length}</strong><p>Controls plan placement</p></div></article>
            </section>

            <section className="teacher-card teacher-plans-card teacher-live-plans-card">
              <div className="teacher-card-heading"><div><h2>{activeNav === "Overview" ? "My weekly plans" : "All my weekly plans"}</h2><p>One row represents one class plan for one school week. Open it to continue writing all of its lessons.</p></div></div>
              <div className="teacher-plan-table-wrap"><table className="teacher-plan-table teacher-weekly-plan-table"><thead><tr><th>Week</th><th>Class</th><th>Subjects written</th><th>Status</th><th>Last saved</th><th>Actions</th></tr></thead><tbody>
                {weeklyPlanRows.map((plan) => { const statusLabel = plan.status === "published" ? "Published for families" : plan.status === "submitted" ? "Sent to supervisor" : plan.status === "changes_requested" ? "Changes requested" : plan.status === "approved" ? "Approved — waiting for class" : "Draft in progress"; const editable = plan.status === "draft" || plan.status === "changes_requested"; const canCopy = plan.status === "submitted" || plan.status === "approved" || plan.status === "published"; const statusTone = plan.status === "published" ? "purple" : plan.status === "approved" ? "green" : plan.status === "submitted" ? "navy" : plan.status === "changes_requested" ? "rose" : "amber"; return <tr key={plan.planId}><td><strong>{plan.week}</strong><small>{plan.lessonCount} lesson{plan.lessonCount === 1 ? "" : "s"}</small></td><td><strong>{plan.className}</strong></td><td>{plan.subjects.join(", ")}</td><td><span className={`teacher-status ${statusTone}`}><i />{statusLabel}</span></td><td>{plan.updated}</td><td><div className="teacher-plan-actions"><button type="button" className="teacher-secondary-button" disabled={saving} onClick={() => openWeeklyPlan(plan)}>{editable ? "Continue plan" : "Preview"}</button>{canCopy && <button type="button" className="teacher-secondary-button copy" disabled={saving} onClick={() => openCopyPlanDialog(plan)}>Copy plan</button>}{plan.status === "submitted" && <button type="button" className="teacher-secondary-button warning" disabled={saving} onClick={() => { const submission = mySubmissions.find((item) => item.weeklyPlanId === plan.planId && item.status === "submitted"); if (submission) void withdrawSubmissionForEditing(submission); }}>Withdraw</button>}{editable && <button type="button" className="teacher-secondary-button danger" disabled={saving} onClick={() => void clearWeeklyDraft(plan)}>Clear draft</button>}</div></td></tr>; })}
                {!loading && weeklyPlanRows.length === 0 && <tr><td className="super-empty" colSpan={6}>No weekly plans have been started yet.</td></tr>}
              </tbody></table></div>
            </section>

            <section className="teacher-card teacher-review-status-card" hidden>
              <div className="teacher-card-heading"><div><p className="teacher-kicker">Plan follow-up</p><h2>My weekly plans</h2><p>The class plan becomes visible when every submitted plan is approved. Teachers who did not submit remain visible as Plan not published.</p></div></div>
              <div className="teacher-review-status-list">
                {mySubmissions.filter((submission) => submission.status !== "draft").map((submission) => <article key={submission.id}>
                  <div><span className={`teacher-status ${submission.status === "approved" ? "green" : submission.status === "changes_requested" ? "amber" : "navy"}`}><i />{submission.status.replaceAll("_", " ")}</span><strong>{submission.subject}</strong><small>{submission.className} · {submission.week}</small>{submission.reviewNote && <p><b>Supervisor note:</b> {submission.reviewNote}</p>}</div>
                  <div className="teacher-review-status-actions"><button type="button" className="teacher-secondary-button" disabled={saving} onClick={() => openSavedPlan(submission)}>Preview & edit</button>{submission.status === "submitted" && <button type="button" className="teacher-secondary-button warning" disabled={saving} onClick={() => void withdrawSubmissionForEditing(submission)}>Withdraw for editing</button>}</div>
                </article>)}
                {mySubmissions.filter((submission) => submission.status !== "draft").length === 0 && <p className="supervisor-review-empty">No additional plan updates are waiting. Save your lesson work when it is ready.</p>}
              </div>
            </section>
          </>}

          {(activeNav === "My Classes" || activeNav === "My Subjects" || activeNav === "Profile & assignments") && <section className="teacher-card teacher-live-assignment-panel"><div><h2>{activeNav}</h2><p>Only the Super Admin can change these assignments.</p></div><div className="teacher-live-assignment-grid">
            {(activeNav === "My Classes" || activeNav === "Profile & assignments") && <article><small>Approved Classes</small>{uniqueClasses.map((className) => <span key={className}>{className}</span>)}{uniqueClasses.length === 0 && <p>No classes assigned yet.</p>}</article>}
            {(activeNav === "My Subjects" || activeNav === "Profile & assignments") && <article><small>Approved Subjects</small>{uniqueSubjects.map((subject) => <span key={subject}>{subject}</span>)}{uniqueSubjects.length === 0 && <p>No subjects assigned yet.</p>}</article>}
          </div></section>}

          {activeNav === "Calendar" && <section className="teacher-card teacher-live-assignment-panel"><div><h2>Academic Weeks</h2><p>Weeks currently open for teacher entry.</p></div><div className="teacher-week-list">{teacherEntryWeeks.map((week) => <span key={week.id} className={week.is_current ? "current" : ""}><strong>{dashboardArabic ? `الأسبوع ${week.week_number}` : `Week ${week.week_number}`}</strong><small>{academicWeekRange(week, dashboardArabic)}</small></span>)}{teacherEntryWeeks.length === 0 && <p>No academic week is currently open for teacher entry.</p>}</div></section>}

          {activeNav === "Settings" && <><section className="teacher-card teacher-live-assignment-panel"><div><h2>Account Settings</h2><p>Your account is authenticated and connected to Supabase.</p></div><div className="teacher-settings-row"><span><small>Name</small><strong>{teacherName}</strong></span><span><small>Department</small><strong>{departmentName}</strong></span><button className="teacher-secondary-button" onClick={() => void signOut()}>Sign out</button></div></section><StaffLanguagePreference /></>}

          {isSupervisor && activeNav === "Department Teachers" && <section className="teacher-card department-teachers-card">
            <div className="teacher-card-heading"><div><p className="teacher-kicker">Department management</p><h2>Department Teachers</h2><p>Manage only the teachers assigned to your supervision group.</p></div><span className="supervisor-review-authority">{departmentTeachers.length} teachers</span></div>
            <div className="department-teachers-layout"><div className="department-teacher-list">{departmentTeachers.map((teacher, index) => <button key={teacher.userId || `${teacher.name}-${index}`} className={selectedDepartmentTeacherId === teacher.userId ? "active" : ""} onClick={() => selectDepartmentTeacher(teacher.userId)}><span>{initials(teacher.name)}</span><div><strong>{teacher.name}</strong><small>{teacher.userId ? `${teacher.assignments.length} class / subject assignments` : "Account not registered yet"}</small></div><em>Manage</em></button>)}{departmentTeachers.length === 0 && <p className="supervisor-review-empty">No teachers are linked to your department yet.</p>}</div>
              {selectedDepartmentTeacher && <section className="department-teacher-editor"><div><p className="teacher-kicker">Teacher assignments</p><h3>{selectedDepartmentTeacher.name}</h3><p>Assign classes and subjects, or remove an existing assignment.</p></div>{!selectedDepartmentTeacher.userId ? <p className="supervisor-review-feedback">This teacher must create and activate a school account before classes and subjects can be assigned.</p> : <><div className="department-assignment-picker"><label>Class<select value={departmentAssignmentDraft.classId} onChange={(event) => setDepartmentAssignmentDraft((current) => ({ ...current, classId: event.target.value }))}><option value="">Select class</option>{schoolClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>Grade {schoolClass.grade} {schoolClass.section}</option>)}</select></label><label>Subject<select value={departmentAssignmentDraft.subjectId} onChange={(event) => setDepartmentAssignmentDraft((current) => ({ ...current, subjectId: event.target.value }))}><option value="">Select subject</option>{schoolSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name_en}</option>)}</select></label><button disabled={saving || !departmentAssignmentDraft.classId || !departmentAssignmentDraft.subjectId} type="button" className="teacher-primary-button" onClick={() => void addDepartmentAssignment(selectedDepartmentTeacher.userId)}>Assign to teacher</button></div><div className="department-assignment-chips">{selectedDepartmentTeacher.assignments.map((assignment) => <span key={assignment.id}>{`Grade ${assignment.grade} ${assignment.section} · ${assignment.subject}`}<button disabled={saving} type="button" aria-label={`Remove ${assignment.subject}`} onClick={() => void removeDepartmentAssignment(assignment.id)}>×</button></span>)}{selectedDepartmentTeacher.assignments.length === 0 && <small>No classes or subjects assigned yet.</small>}</div></>}</section>}</div>
          </section>}
          {isSupervisor && activeNav === "Teacher Reviews" && <section className="teacher-card supervisor-review-card">
            <div className="teacher-card-heading supervisor-review-heading">
              <div><p className="teacher-kicker">{dashboardArabic ? "مساحة عمل المشرف" : "Supervisor workspace"}</p><h2>{dashboardArabic ? "مراجعة الخطط الأسبوعية" : "Weekly plan review"}</h2><p>{dashboardArabic ? "اختر الأسبوع ثم الفصل والشعبة؛ سيظهر كل معلم مرتبط بك وجميع المواد التي أرسلها لهذا الفصل معًا." : "Choose the week, then the class. Every linked teacher and all subjects they submitted for that class appear together."}</p></div>
              <button type="button" className="supervisor-review-authority supervisor-review-shortcut" disabled={waitingReviews.length === 0} onClick={openFirstWaitingReview}><strong>{dashboardArabic ? `${waitingReviews.length} خطط تحتاج للمراجعة` : `${waitingReviews.length} subject entries waiting for review`}</strong><span>{dashboardArabic ? "عرض الخطط المعلقة" : "Open waiting plans"} ←</span></button>
            </div>
            <div className="supervisor-review-selector">
              <label>{dashboardArabic ? "١. الأسبوع الدراسي" : "1. School week"}<select value={selectedReviewWeekId} onChange={(event) => setSelectedReviewWeekId(event.target.value)}><option value="">{dashboardArabic ? "اختر الأسبوع" : "Select week"}</option>{academicWeeks.map((week) => <option key={week.id} value={week.id}>{dashboardArabic ? `الأسبوع ${week.week_number}` : `Week ${week.week_number}`} · {academicWeekRange(week, dashboardArabic)}</option>)}</select></label>
              <label>{dashboardArabic ? "٢. الفصل والشعبة" : "2. Class & section"}<select value={selectedReviewClassId} onChange={(event) => setSelectedReviewClassId(event.target.value)} disabled={!selectedReviewWeek || supervisorReviewClasses.length === 0}><option value="">{dashboardArabic ? "اختر الفصل" : "Select class"}</option>{supervisorReviewClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
              <span>{dashboardArabic ? `تم العثور على ${selectedClassReviewItems.length} خطة معلم` : `${selectedClassReviewItems.length} teacher plan${selectedClassReviewItems.length === 1 ? "" : "s"} found`}</span>
              <button type="button" className="teacher-primary-button supervisor-approve-all" disabled={saving || selectedWeekPendingCount === 0} onClick={requestBulkApproval}>{dashboardArabic ? `اعتماد جميع خطط معلمي القسم لهذا الأسبوع (${selectedWeekPendingCount})` : `Approve every submitted department plan this week (${selectedWeekPendingCount})`}</button>
            </div>
            <div className="supervisor-review-list" id="supervisor-review-results">
              {!selectedReviewWeek || !selectedReviewClassId ? <p className="supervisor-review-empty">{dashboardArabic ? "اختر الأسبوع الدراسي ثم الفصل والشعبة." : "Select the school week, then the class and section."}</p> : selectedClassReviewItems.map((review) => <article key={review.id}>
                <header><div><span className={`teacher-status ${review.status === "approved" ? "green" : review.status === "changes_requested" ? "amber" : "navy"}`}><i />{reviewStatusLabel(review.status, dashboardArabic)}</span><h3>{review.teacherName}</h3><p>{review.subject} · {review.className} · {review.week}</p></div><small>{dashboardArabic ? `أُرسلت في ${review.submittedAt}` : `Submitted ${review.submittedAt}`}</small></header>
                <div className="supervisor-entry-grid">{review.entries.map((entry) => <section key={`${entry.subject}-${entry.day}-${entry.period}`}><strong>{entry.subject} · {dashboardArabic ? arabicDayNames[entry.day] ?? entry.day : entry.day} · {dashboardArabic ? `الحصة ${entry.period}` : `Period ${entry.period}`}</strong><p><b>{dashboardArabic ? "عمل الحصة" : "Classwork"}</b>{entry.classwork || "—"}</p><p><b>{dashboardArabic ? "الواجب المنزلي" : "Homework"}</b>{entry.homework || "—"}</p><p><b>{dashboardArabic ? "ملاحظات كلاسيرا" : "Classera"}</b>{entry.notes || "—"}</p></section>)}</div>
                {(review.quizzes.length > 0 || review.weeklyNotes.some((note) => Boolean(parseEnglishDictation(note)))) && <div className="supervisor-plan-extras">{review.quizzes.length > 0 && <section><strong>{dashboardArabic ? "الاختبارات والتقييمات" : "Quizzes & assessments"}</strong>{review.quizzes.map((quiz, index) => <p key={`${quiz.subject}-${index}`}><b>{quiz.subject}{quiz.date ? ` · ${quiz.date}` : ""}</b>{quiz.details}</p>)}</section>}{review.weeklyNotes.map(parseEnglishDictation).filter((dictation): dictation is EnglishDictation => Boolean(dictation)).map((dictation) => <section key={`dictation-${dictation.day}`}><strong>Vocabulary for Dictation on {dayNames[dictation.day]}</strong><div className="dictation-word-grid compact">{dictation.words.map((word) => <span key={word}>{word}</span>)}</div></section>)}</div>}
                {review.status === "submitted" && <div className="supervisor-review-actions"><label>{dashboardArabic ? "ملاحظة المراجعة" : "Review note"}<textarea value={reviewNotes[review.id] ?? review.note} onChange={(event) => setReviewNotes((current) => ({ ...current, [review.id]: event.target.value }))} placeholder={dashboardArabic ? "اكتب التعديلات المطلوبة من المعلم" : "Write the required changes for the teacher"} rows={3} /></label><div><button disabled={saving} className="teacher-secondary-button" onClick={() => void reviewSubmission(review, "changes_requested")}>{dashboardArabic ? "إرجاع الخطة كاملة للتعديل" : "Return whole plan"}</button><button disabled={saving} className="teacher-primary-button" onClick={() => void reviewSubmission(review, "approved")}>{dashboardArabic ? "اعتماد الخطة كاملة" : "Approve whole plan"}</button></div></div>}
                {review.status === "changes_requested" && <p className="supervisor-review-feedback"><strong>{dashboardArabic ? "ملاحظتك للمراجعة" : "Your review note"}</strong>{review.note || (dashboardArabic ? "طُلب من المعلم مراجعة هذه الخطة وتعديلها." : "The teacher has been asked to revise this plan.")}</p>}
                {review.status === "approved" && <p className="supervisor-review-feedback approved"><strong>{dashboardArabic ? "معتمدة من هذه الشعبة" : "Approved for this department"}</strong>{dashboardArabic ? "تم اعتماد خطة الشعبة كاملة. ستظهر خطة الفصل عند عدم بقاء أي خطة مرسلة قيد المراجعة، وتظهر حصص غير المرسلين بعبارة Plan not published." : "This department plan was approved. The class plan is visible when no submitted plan remains under review; missing teachers show Plan not published."}</p>}
              </article>)}
              {selectedReviewWeek && selectedReviewClassId && selectedClassReviewItems.length === 0 && <p className="supervisor-review-empty">{dashboardArabic ? <>لم يرسل أي معلم خطة لهذا الفصل في <strong>{selectedReviewWeek.label}</strong> حتى الآن.</> : <>No teacher has sent a plan for this class in <strong>{selectedReviewWeek.label}</strong> yet.</>}</p>}
            </div>
          </section>}
        </div>
      </section>

      {bulkApprovalConfirmationOpen && <div className="weekly-send-confirmation-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setBulkApprovalConfirmationOpen(false)}><section className="weekly-send-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="bulk-approval-title" dir={bulkApprovalArabic ? "rtl" : "ltr"}><span aria-hidden="true">✓</span><h3 id="bulk-approval-title">{bulkApprovalArabic ? "اعتماد كل خطط الأسبوع" : "Approve every plan this week"}</h3><p>{bulkApprovalArabic ? `سيتم اعتماد ${selectedWeekPendingCount} خطة مادة مرسلة لكل معلميك في جميع الفصول والشعب خلال الأسبوع المحدد، وضمن نطاق إشرافك فقط. ستُنشر خطة الفصل عندما لا تبقى أي خطة مرسلة قيد المراجعة، وتظهر حصص غير المرسلين بعبارة Plan not published.` : `${selectedWeekPendingCount} submitted subject plan${selectedWeekPendingCount === 1 ? "" : "s"} from all your linked teachers across every class and section in the selected week will be approved. Each class plan publishes when no submitted plan remains under review; missing teachers show Plan not published.`}</p><div><button type="button" className="teacher-secondary-button" onClick={() => setBulkApprovalConfirmationOpen(false)}>{bulkApprovalArabic ? "إلغاء" : "Cancel"}</button><button type="button" className="teacher-primary-button" disabled={saving} onClick={() => void approveAllSelectedWeekPlans()}>{bulkApprovalArabic ? "نعم، اعتماد الجميع" : "Yes, approve all"}</button></div></section></div>}

      {weeklyBuilderOpen && selectedClass && selectedWeek && <div className="teacher-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && setWeeklyBuilderOpen(false)}><section className="teacher-editor-modal weekly-builder-modal" role="dialog" aria-modal="true" aria-labelledby="weekly-builder-title">
        <div className="teacher-modal-heading"><div><p>{dashboardArabic ? `الأسبوع ${selectedWeek.week_number}` : `Week ${selectedWeek.week_number}`} · {academicWeekRange(selectedWeek, dashboardArabic)}</p><h2 id="weekly-builder-title">Build the whole week</h2></div><button disabled={saving} aria-label="Close weekly builder" onClick={() => setWeeklyBuilderOpen(false)}>×</button></div>
        <div className="teacher-editor-context"><span>One save for the whole week</span><i />Entries are placed according to your timetable slots.<b className={`teacher-autosave-state ${autoSaveState}`}>{autoSaveState === "saving" ? "Saving draft…" : autoSaveState === "saved" ? "Draft saved automatically" : "Auto-save is on"}</b></div>
        <form onSubmit={(event) => { event.preventDefault(); confirmAndSendWholeWeek(); }}>
          {builderFeedback && <div className={`weekly-builder-feedback ${builderFeedback.tone}`} role="status">{builderFeedback.text}</div>}
          {builderStatus !== "new" && <div className={`weekly-builder-review-state ${builderStatus}`}><strong>{builderStatus === "approved" ? isSupervisor ? "Approved automatically" : "Approved" : builderStatus === "submitted" ? "Waiting for supervisor approval" : builderStatus === "changes_requested" ? "Changes requested" : "Draft saved"}</strong><span>{builderStatus === "approved" ? isSupervisor ? "Your teaching plan is approved automatically. The class plan is visible when no submitted plan is still waiting for review; missing teachers appear as Plan not published." : "Your part is approved. The class plan is visible when no submitted plan is still waiting for review; missing teachers appear as Plan not published." : builderStatus === "submitted" ? "This plan has been sent and is locked until the supervisor reviews it or you withdraw it." : builderStatus === "changes_requested" ? "Review the supervisor note, update the plan, then send it again." : "Your work is private and is not visible to families. Send it to the supervisor when it is complete."}</span></div>}
          <div className="weekly-builder-toolbar"><label>1. Academic week<select value={selectedWeekId} onChange={(event) => setSelectedWeekId(event.target.value)}>{teacherEntryWeeks.map((week) => <option key={week.id} value={week.id}>{dashboardArabic ? `الأسبوع ${week.week_number}` : `Week ${week.week_number}`} · {academicWeekRange(week, dashboardArabic)}</option>)}</select></label><label>2. Class<select value={selectedClassId} onChange={(event) => { setSelectedClassId(event.target.value); setSlotDrafts({}); setQuizSubjectId(""); }}>{Array.from(new Map(assignments.map((assignment) => [assignment.classId, assignment])).values()).map((assignment) => <option key={assignment.classId} value={assignment.classId}>Grade {assignment.grade} · {assignment.section}</option>)}</select></label><span className={`teacher-timetable-ready ${selectedClassSlots.length > 0 ? "ready" : "missing"}`}>{selectedClassSlots.length > 0 ? `${selectedClassSlots.length} lessons ready for this week` : "Timetable connection required"}</span></div>
          <div className={`weekly-builder-days days-${activeDayIndexes.length}`}>{activeDayIndexes.map((index) => { const day = dayNames[index]; const daySlots = selectedClassSlots.filter((slot) => slot.day_of_week === index); return <section className="weekly-builder-day" key={day}><header><strong>{day}</strong><small>{daySlots.length} lesson{daySlots.length === 1 ? "" : "s"}</small></header>{daySlots.map((slot) => { const assignment = assignmentForSlot(slot); const draft = slotDraftFor(slot); const isEnglish = isEnglishSubject(assignment?.subject ?? ""); return <article key={slot.id}><header><span>Period {slot.period_number}</span><strong>{isEnglish ? "English" : assignment?.subject ?? "Subject"}</strong></header>{assignment?.subject === "Integrated Science" && <label>Science component<select value={draft.scienceComponent} onChange={(event) => updateSlotDraft(slot.id, "scienceComponent", event.target.value)}><option value="">Select Chemistry, Physics or Biology</option>{scienceComponents.map((component) => <option key={component} value={component}>{component}</option>)}</select></label>}{isEnglish && <label>English programme<select value={draft.englishProgramme} onChange={(event) => updateSlotDraft(slot.id, "englishProgramme", event.target.value)}><option value="">Select AL or OL</option>{englishProgrammes.map((programme) => <option key={programme} value={programme}>{programme}</option>)}</select></label>}{isEnglish && <p className="teacher-programme-note">AL or OL is added automatically before Classwork using the format: AL - Classwork.</p>}<label>Classwork<textarea rows={3} value={draft.classwork} onChange={(event) => updateSlotDraft(slot.id, "classwork", event.target.value)} placeholder="Lesson, unit and pages" /></label><label>Homework<textarea rows={3} value={draft.homework} onChange={(event) => updateSlotDraft(slot.id, "homework", event.target.value)} placeholder="Homework for this lesson" /></label><label>Classera notes<textarea rows={3} value={draft.classeraNotes} onChange={(event) => updateSlotDraft(slot.id, "classeraNotes", event.target.value)} placeholder="Reminder or materials" /></label></article>})}</section>})}</div>
          {departmentName === "English Department" && <section className="weekly-builder-extra english-dictation-editor"><div className="weekly-builder-section-heading"><div><span>DW</span><div><strong>English Dictation Words</strong><small>Choose the dictation day, then enter one word per line or separate words with commas.</small></div></div></div><div className="weekly-builder-dictation-row"><label>Dictation day<select value={dictationDay} onChange={(event) => setDictationDay(event.target.value)}>{dayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>Words<textarea className="weekly-builder-notes" rows={3} value={dictationWords} onChange={(event) => setDictationWords(event.target.value)} placeholder="school, teacher, classroom, homework" /></label></div></section>}
          <div className="teacher-editor-footer"><span>{selectedClassSlots.length > 0 ? isSupervisor ? "Your teaching plan is approved automatically when sent. Missing teachers do not block the class plan and appear as Plan not published." : "Save privately as a draft, then send the completed plan to your supervisor. Missing teachers do not block an otherwise approved class plan." : "Saving is blocked until the timetable is connected."}</span><div><button disabled={saving || selectedClassSlots.length === 0} type="button" className="teacher-secondary-button teacher-preview-button" onClick={() => void openParentPreview()}>Preview parent plan</button><button disabled={saving} type="button" className="teacher-secondary-button" onClick={() => setWeeklyBuilderOpen(false)}>Cancel</button><button disabled={saving || selectedClassSlots.length === 0} type="button" className="teacher-secondary-button" onClick={() => void saveWholeWeek(false)}>Save draft</button><button disabled={selectedClassSlots.length === 0 || builderStatus === "submitted" || builderStatus === "approved"} className="teacher-primary-button" type="submit">{saving ? "Send after automatic save" : isSupervisor ? "Approve my teaching plan" : "Send to supervisor for approval"}</button></div></div>
        </form>
        {sendConfirmationOpen && <div className="weekly-send-confirmation-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSendConfirmationOpen(false)}><section className="weekly-send-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="weekly-send-confirmation-title" dir={sendConfirmationArabic ? "rtl" : "ltr"}><span aria-hidden="true">✓</span><h3 id="weekly-send-confirmation-title">{sendConfirmationArabic ? isSupervisor ? "تأكيد اعتماد خطتك" : "تأكيد إرسال الخطة" : isSupervisor ? "Confirm automatic approval" : "Confirm plan submission"}</h3><p>{sendConfirmationArabic ? isSupervisor ? "سيتم اعتماد حصصك التعليمية تلقائيًا داخل المنصة. ستظهر خطة الفصل عند عدم وجود خطة مرسلة قيد المراجعة، وتظهر حصص غير المرسلين بعبارة Plan not published." : "هل تريد إرسال هذه الخطة الأسبوعية إلى المشرف للاعتماد؟ بعد الإرسال ستُغلق الخطة حتى يراجعها المشرف أو تسحبها للتعديل." : isSupervisor ? "Your own teaching lessons will be approved automatically. The class plan is visible when no submitted plan remains under review; missing teachers show Plan not published." : "Send this weekly plan to the supervisor for approval? After sending, the plan will be locked until it is reviewed or withdrawn."}</p><div><button type="button" className="teacher-secondary-button" onClick={() => setSendConfirmationOpen(false)}>{sendConfirmationArabic ? "إلغاء" : "Cancel"}</button><button type="button" className="teacher-primary-button" onClick={sendConfirmedWeeklyPlan}>{saving ? sendConfirmationArabic ? "الحفظ التلقائي جارٍ — اعتمد بعدها" : "Autosaving — approve next" : sendConfirmationArabic ? isSupervisor ? "نعم، اعتماد خطتي" : "نعم، إرسال للمشرف" : isSupervisor ? "Yes, approve my plan" : "Yes, send to supervisor"}</button></div></section></div>}
        {submissionSuccessOpen && <div className="weekly-send-confirmation-backdrop" role="presentation"><section className="weekly-send-confirmation weekly-submission-success" role="alertdialog" aria-modal="true" aria-labelledby="weekly-submission-success-title" dir={submissionSuccessArabic ? "rtl" : "ltr"}><span aria-hidden="true">✓</span><h3 id="weekly-submission-success-title">{submissionSuccessArabic ? isSupervisor ? "تم اعتماد خطتك بنجاح" : "تم إرسال الخطة بنجاح" : isSupervisor ? "Your plan was approved" : "Plan sent successfully"}</h3><p>{submissionSuccessArabic ? isSupervisor ? "تم اعتماد حصصك التعليمية تلقائيًا، وتم تحديث حالة الخطة في الشاشة الرئيسية." : "تم إرسال الخطة إلى المشرف للموافقة عليها، وتم تحديث حالتها في الشاشة الرئيسية إلى: تم الإرسال للمشرف." : isSupervisor ? "Your teaching lessons were approved automatically and the plan status is updated on the main screen." : "Your weekly plan was sent to the supervisor for approval. Its main-screen status is now Sent to supervisor."}</p><div><button type="button" className="teacher-primary-button" onClick={finishSuccessfulSubmission}>{submissionSuccessArabic ? "العودة إلى الشاشة الرئيسية" : "Return to main screen"}</button></div></section></div>}
      </section></div>}
      {copyDialogOpen && copySourcePlan && <div className="weekly-send-confirmation-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeCopyPlanDialog()}><section className="weekly-copy-dialog" role="dialog" aria-modal="true" aria-labelledby="weekly-copy-dialog-title" dir={dashboardArabic ? "rtl" : "ltr"}><div className="weekly-copy-dialog-heading"><span aria-hidden="true">CP</span><div><small>{copySourcePlan.week} · {copySourcePlan.className}</small><h3 id="weekly-copy-dialog-title">{dashboardArabic ? "أين تريد نسخ أيام الخطة؟" : "Where do you want to copy this plan?"}</h3></div></div><p>{dashboardArabic ? "اختر المادة ثم الفصل المستهدف. ستُنسخ الحصص كمسودة جديدة، وبعد النسخ سيفتح محرر الخطة لمراجعتها قبل إرسالها في مسار اعتماد مستقل." : "Choose the subject and target class. Lessons are copied as a new draft, then the editor opens so you can review it before starting its own approval workflow."}</p><div className="weekly-copy-dialog-fields"><label>{dashboardArabic ? "المادة المطلوب نسخها" : "Subject to copy"}<select value={copySubjectId} onChange={(event) => { setCopySubjectId(event.target.value); setCopyTargetClassId(""); setCopyFeedback(""); }}><option value="">{dashboardArabic ? "اختر المادة" : "Select subject"}</option>{copySourceAssignments.map((assignment) => <option key={assignment.subjectId} value={assignment.subjectId}>{assignment.subject}</option>)}</select></label><label>{dashboardArabic ? "الفصل المستهدف" : "Target class"}<select value={copyTargetClassId} onChange={(event) => { setCopyTargetClassId(event.target.value); setCopyFeedback(""); }} disabled={!copySubjectId}><option value="">{dashboardArabic ? "اختر الفصل" : "Select class"}</option>{copyTargetClasses.filter((target) => target.lessonCount > 0).map((target) => <option key={target.classId} value={target.classId}>Grade {target.grade} · {target.section} — {target.lessonCount} lesson{target.lessonCount === 1 ? "" : "s"}</option>)}</select></label></div>{copySubjectId && copyTargetClasses.filter((target) => target.lessonCount > 0).length === 0 && <p className="weekly-copy-dialog-feedback info">{dashboardArabic ? "لا يوجد فصل آخر مؤهل تدرّس فيه المادة نفسها بالصف نفسه." : "No other eligible class in the same grade is assigned to you for this subject."}</p>}{copyFeedback && <p className="weekly-copy-dialog-feedback error" role="alert">{copyFeedback}</p>}<div className="weekly-copy-dialog-note">{dashboardArabic ? "لن يتم استبدال أي خطة موجودة. يُنسخ عمل الحصة والواجب وملاحظات كلاسيرا فقط، وتبقى كلمات الإملاء والاختبارات مع الفصل الأصلي." : "Existing work is never overwritten. Classwork, Homework and Classera Notes are copied; dictation words and quizzes stay with the original class."}</div><div className="weekly-copy-dialog-actions"><button type="button" className="teacher-secondary-button" disabled={saving} onClick={closeCopyPlanDialog}>{dashboardArabic ? "إلغاء" : "Cancel"}</button><button type="button" className="teacher-primary-button" disabled={saving || !copySubjectId || !copyTargetClassId} onClick={() => void copyPlanToOtherClasses()}>{saving ? dashboardArabic ? "جارٍ النسخ…" : "Copying…" : dashboardArabic ? "نسخ وفتح المحرر" : "Copy and open editor"}</button></div></section></div>}
      {parentPreviewOpen && selectedClass && selectedWeek && <div className="teacher-modal-backdrop parent-preview-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setParentPreviewOpen(false)}><section className="teacher-parent-preview" dir="ltr" role="dialog" aria-modal="true" aria-labelledby="parent-preview-title"><div className="teacher-modal-heading"><div><p>Preview only — nothing has been saved or sent</p><h2 id="parent-preview-title">Parent weekly-plan preview</h2></div><button aria-label="Close parent plan preview" onClick={() => setParentPreviewOpen(false)}>×</button></div><div className="parent-preview-intro">Your current writing is shown in its real timetable position. Other subjects are intentionally blank because this is only your private preview.</div>{parentPreviewLoading ? <p className="parent-preview-loading">Loading the class timetable…</p> : <section className="parent-preview-paper"><div className="parent-preview-paper-header"><img src={`${basePath}/school-logo.png`} alt="AlAndalus Private Schools" /><div><strong>ALANDALUS PRIVATE SCHOOLS</strong><span>The Egyptian Section</span><h3>WEEKLY STUDY PLAN</h3></div></div><div className="parent-preview-meta"><span><small>Class</small><strong>Grade {selectedClass.grade} · Class {selectedClass.section}</strong></span><span><small>Week No.</small><strong>{selectedWeek.week_number}</strong></span><span><small>Date</small><strong>{academicWeekRange(selectedWeek)}</strong></span></div>{departmentName === "English Department" && parseDictationWords(dictationWords).length > 0 && <section className="parent-dictation-block"><h3>Vocabulary for Dictation on {dayNames[Number(dictationDay)]}</h3><table><tbody>{chunkWords(parseDictationWords(dictationWords)).map((row, rowIndex) => <tr key={rowIndex}>{row.map((word) => <td key={word}>{word}</td>)}</tr>)}</tbody></table></section>}<div className="table-wrap"><table className="weekly-table parent-preview-table"><colgroup><col className="day-column" /><col className="course-column" /><col className="classwork-column" /><col className="homework-column" /><col className="classera-column" /></colgroup><thead><tr><th>Day</th><th>Course</th><th>Classwork</th><th>Homework</th><th>Classera Notes</th></tr></thead>{dayNames.map((day, dayIndex) => { const daySlots = parentPreviewSlots.filter((slot) => slot.day_of_week === dayIndex); return daySlots.length > 0 ? <tbody className="weekly-day-group" key={day}>{daySlots.map((slot, index) => { const ownSlot = selectedClassSlots.find((teacherSlot) => teacherSlot.id === slot.id); const draft = ownSlot ? slotDraftFor(ownSlot) : null; return <tr key={slot.id} className={index === 0 ? "new-day" : ""}>{index === 0 && <td className="day-cell" rowSpan={daySlots.length}>{day}</td>}<td className="course-cell">{slot.subject}</td><td className={draft?.classwork.trim() ? "preview-written" : "preview-empty"}>{ownSlot ? previewClasswork(ownSlot) || "—" : "—"}</td><td className={draft?.homework.trim() ? "preview-written" : "preview-empty"}>{ownSlot ? draft?.homework.trim() || "—" : "—"}</td><td className={draft?.classeraNotes.trim() ? "preview-written" : "preview-empty"}>{ownSlot ? draft?.classeraNotes.trim() || "—" : "—"}</td></tr>; })}</tbody> : null; })}</table>{parentPreviewSlots.length === 0 && <p className="parent-preview-loading">No timetable lessons are available for this class yet.</p>}</div></section>}<div className="teacher-editor-footer parent-preview-footer"><span>This preview does not submit, approve, or publish the weekly plan.</span><div><button type="button" className="teacher-primary-button" onClick={() => setParentPreviewOpen(false)}>Return to editor</button></div></div></section></div>}
    </main>
  );
}
