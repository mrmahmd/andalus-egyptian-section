"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StaffLanguagePreference } from "../language-switcher";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

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
const englishSubjectNames = new Set(["English", "Connect Plus", "English Hello", "Hello Plus", "Hello", "Upstream"]);

function englishProgrammesForGrade(grade: number) {
  if (grade >= 1 && grade <= 6) return ["English", "Connect Plus"];
  if (grade >= 7 && grade <= 9) return ["Hello", "Hello Plus"];
  if (grade === 10) return ["Hello", "Upstream"];
  return [];
}

function defaultEnglishProgramme(grade: number, subject: string) {
  if (subject === "Connect Plus") return "Connect Plus";
  if (subject === "Hello Plus") return "Hello Plus";
  if (subject === "Upstream") return "Upstream";
  if (subject === "English Hello" || subject === "Hello") return "Hello";
  return englishProgrammesForGrade(grade)[0] ?? "";
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
  const [selectedReviewTeacherId, setSelectedReviewTeacherId] = useState("");
  const [selectedReviewClassId, setSelectedReviewClassId] = useState("");
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
  const [weeklyNote, setWeeklyNote] = useState("");
  const [weeklyPlanCreationOpen, setWeeklyPlanCreationOpen] = useState(true);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [builderHydrated, setBuilderHydrated] = useState(false);
  const autoSaveTimer = useRef<number | null>(null);
  const autoSavedSignature = useRef("");
  const [savedPlanId, setSavedPlanId] = useState("");
  const [copyPanelOpen, setCopyPanelOpen] = useState(false);
  const [copySubjectId, setCopySubjectId] = useState("");
  const [copyTargetClassIds, setCopyTargetClassIds] = useState<string[]>([]);
  const [parentPreviewOpen, setParentPreviewOpen] = useState(false);
  const [parentPreviewLoading, setParentPreviewLoading] = useState(false);
  const [parentPreviewSlots, setParentPreviewSlots] = useState<ParentPreviewSlot[]>([]);

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
        supabase.from("academic_weeks").select("id, week_number, label, starts_on, ends_on, is_current").order("week_number"),
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
      setSelectedReviewTeacherId((current) => realDepartmentTeachers.some((teacher) => teacher.userId === current) ? current : realDepartmentTeachers[0]?.userId ?? "");
      setSelectedReviewWeekId((current) => weeks.some((week) => week.id === current) ? current : weeks.find((week) => week.is_current)?.id ?? weeks[0]?.id ?? "");
      if (departmentTeachersResult.error) {
        setMessage("Your dashboard is ready. Department teacher assignments could not be loaded yet; please refresh once.");
        setMessageTone("info");
      }
      setSelectedClassId((current) => realAssignments.some((assignment) => assignment.classId === current) ? current : realAssignments[0]?.classId ?? "");
      setSelectedWeekId((current) => weeks.some((week) => week.id === current) ? current : weeks.find((week) => week.is_current)?.id ?? weeks[0]?.id ?? "");
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

  const selectedWeek = academicWeeks.find((week) => week.id === selectedWeekId);
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
  const sourceSubjectAssignments = selectedClassAssignments.filter((assignment) => selectedClassSlots.some((slot) => slot.subject_id === assignment.subjectId) && !approvedSubjectIds.has(assignment.subject));
  const copyTargetClasses = useMemo(() => {
    const sourceSubject = selectedClassAssignments.find((assignment) => assignment.subjectId === copySubjectId);
    if (!sourceSubject) return [];
    return Array.from(new Map(assignments
      .filter((assignment) => assignment.classId !== selectedClassId && assignment.grade === sourceSubject.grade && assignment.subjectId === sourceSubject.subjectId)
      .map((assignment) => [assignment.classId, assignment])).values())
      .map((assignment) => ({ ...assignment, lessonCount: timetableSlots.filter((slot) => slot.class_id === assignment.classId && slot.subject_id === copySubjectId).length }));
  }, [assignments, copySubjectId, selectedClassAssignments, selectedClassId, timetableSlots]);

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
        if (englishSubjectNames.has(assignment?.subject ?? "")) {
          englishProgramme = englishProgrammesForGrade(assignment?.grade ?? 0).find((programme) => classwork.startsWith(`${programme} — `)) ?? "";
          if (englishProgramme) classwork = classwork.slice(englishProgramme.length + 3);
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
      setWeeklyNote(note?.note_text ?? "");
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
    if (academicWeeks.length === 0) {
      setMessage("Academic weeks have not been configured yet.");
      setMessageTone("info");
      return;
    }
    const firstAssignment = selectedClass ?? assignments[0];
    const firstWeek = selectedWeek ?? academicWeeks.find((week) => week.is_current) ?? academicWeeks[0];
    if (!selectedClassId && firstAssignment) setSelectedClassId(firstAssignment.classId);
    if (!selectedWeekId && firstWeek) setSelectedWeekId(firstWeek.id);
    setWeeklyBuilderOpen(true);
  };

  const updateSlotDraft = (slotId: string, field: keyof SlotDraft, value: string) => {
    setSlotDrafts((current) => ({ ...current, [slotId]: { ...(current[slotId] ?? emptySlotDraft()), [field]: value } }));
  };

  const previewClasswork = (slot: TimetableSlot) => {
    const assignment = assignmentForSlot(slot);
    const draft = slotDraftFor(slot);
    const prefix = assignment?.subject === "Integrated Science"
      ? draft.scienceComponent
      : englishSubjectNames.has(assignment?.subject ?? "")
        ? draft.englishProgramme || defaultEnglishProgramme(assignment?.grade ?? 0, assignment?.subject ?? "")
        : "";
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
      setMessage("No timetable lessons are linked to this class yet. Ask the Super Admin to review the timetable connection.");
      setMessageTone("error");
      return;
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
        const prefix = assignment?.subject === "Integrated Science" ? draft.scienceComponent : englishSubjectNames.has(assignment?.subject ?? "") ? draft.englishProgramme || defaultEnglishProgramme(assignment?.grade ?? 0, assignment?.subject ?? "") : "";
        return {
          weekly_plan_id: weeklyPlanId,
          timetable_slot_id: slot.id,
          teacher_id: profileId,
          subject_id: slot.subject_id,
          day_of_week: slot.day_of_week,
          period_number: slot.period_number,
          classwork: prefix && classwork ? `${prefix} — ${classwork}` : classwork,
          homework: draft.homework.trim(),
          classera_notes: draft.classeraNotes.trim(),
          updated_at: new Date().toISOString(),
        };
      });
      if (entryRows.length) {
        const { error: entriesError } = await supabase.from("plan_entries").upsert(entryRows, { onConflict: "weekly_plan_id,day_of_week,period_number" });
        if (entriesError) throw entriesError;
      }

      const submissionRows = Array.from(new Set(editableClassSlots.filter((slot) => !approvedSubjectIds.has(slot.subject_id)).map((slot) => slot.subject_id))).map((subjectId) => ({
        weekly_plan_id: weeklyPlanId, teacher_id: profileId, subject_id: subjectId,
        status: submitForReview ? "submitted" : "draft", reviewed_by: null, reviewed_at: null,
        submitted_at: submitForReview ? new Date().toISOString() : null,
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
        if (submitForReview && (
          (savedSubmissionRows ?? []).length !== writableSubmissionRows.length
          || (savedSubmissionRows ?? []).some((row) => row.status !== "submitted" || !row.submitted_at)
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
      if (weeklyNote.trim()) {
        const { error: noteError } = await supabase.from("plan_notes").insert({ weekly_plan_id: weeklyPlanId, teacher_id: profileId, note_text: weeklyNote.trim() });
        if (noteError) throw noteError;
      }

      setSavedPlanId(weeklyPlanId);
      autoSavedSignature.current = autosaveSignature;
      setCopyPanelOpen(false);
      if (!silent) {
        setMessage(submitForReview ? "Your weekly plan was sent to your department supervisor for review." : "The whole week was saved successfully to Supabase.");
        setMessageTone("success");
        await loadTeacherDashboard();
      } else {
        setAutoSaveState("saved");
      }
      if (submitForReview) setWeeklyBuilderOpen(false);
    } catch (error) {
      if (silent) { autoSavedSignature.current = ""; setAutoSaveState("idle"); }
      else { setMessage(error instanceof Error ? error.message : "The weekly plan could not be saved."); setMessageTone("error"); }
    } finally {
      setSaving(false);
    }
  };

  const hasAutosaveContent = useMemo(() => Object.values(slotDrafts).some((draft) => Boolean(draft.classwork.trim() || draft.homework.trim() || draft.classeraNotes.trim())) || Boolean(quizDetails.trim() || weeklyNote.trim()), [slotDrafts, quizDetails, weeklyNote]);
  const autosaveSignature = useMemo(() => JSON.stringify({ selectedClassId, selectedWeekId, slotDrafts, quizDay, quizDetails, quizSubjectId, weeklyNote }), [selectedClassId, selectedWeekId, slotDrafts, quizDay, quizDetails, quizSubjectId, weeklyNote]);
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
      const { error } = await getSupabaseBrowserClient().from("plan_submissions").update({ status: "draft", submitted_at: null, review_note: null, reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() }).eq("id", submission.id).eq("teacher_id", profileId);
      if (error) throw error;
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
    setCopyPanelOpen(false);
    setWeeklyBuilderOpen(true);
  };

  const openEntryEditor = (entry: TeacherEntry) => {
    setSelectedClassId(entry.classId);
    setSelectedWeekId(entry.weekId);
    setCopyPanelOpen(false);
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
    setCopyPanelOpen(false);
    setWeeklyBuilderOpen(true);
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

  const toggleCopyTarget = (classId: string) => setCopyTargetClassIds((current) => current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId]);

  const copyPlanToOtherClasses = async () => {
    if (!savedPlanId || !copySubjectId || copyTargetClassIds.length === 0 || !selectedWeek) return;
    const sourceSlots = selectedClassSlots.filter((slot) => slot.subject_id === copySubjectId).sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number);
    if (sourceSlots.length === 0) return;
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sourceRows, error: sourceError } = await supabase.from("plan_entries")
        .select("classwork, homework, classera_notes").eq("weekly_plan_id", savedPlanId).eq("teacher_id", profileId).eq("subject_id", copySubjectId).order("day_of_week").order("period_number");
      if (sourceError) throw sourceError;
      if (!sourceRows?.length) throw new Error("Save the source class plan before copying it.");

      const copied: string[] = [];
      const skipped: string[] = [];
      for (const targetClassId of copyTargetClassIds) {
        const target = copyTargetClasses.find((item) => item.classId === targetClassId);
        if (!target || target.lessonCount === 0) { if (target) skipped.push(`Grade ${target.grade} ${target.section}`); continue; }
        const { data: existingPlan, error: existingPlanError } = await supabase.from("weekly_plans").select("id").eq("class_id", target.classId).eq("week_id", selectedWeek.id).maybeSingle();
        if (existingPlanError) throw existingPlanError;
        let targetPlanId = existingPlan?.id ? String(existingPlan.id) : "";
        if (!targetPlanId) {
          const { data: createdPlan, error: createdPlanError } = await supabase.from("weekly_plans").insert({ class_id: target.classId, week_id: selectedWeek.id, class_teacher_name: teacherName, status: "draft" }).select("id").single();
          if (createdPlanError) throw createdPlanError;
          targetPlanId = String(createdPlan.id);
        }
        const { data: targetExistingEntries, error: targetEntriesError } = await supabase.from("plan_entries").select("id").eq("weekly_plan_id", targetPlanId).eq("teacher_id", profileId).eq("subject_id", copySubjectId);
        if (targetEntriesError) throw targetEntriesError;
        if ((targetExistingEntries?.length ?? 0) > 0) { skipped.push(`Grade ${target.grade} ${target.section}`); continue; }
        const targetSlots = timetableSlots.filter((slot) => slot.class_id === target.classId && slot.subject_id === copySubjectId).sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number);
        const rowsToCopy = targetSlots.slice(0, sourceRows.length).map((slot, index) => ({ weekly_plan_id: targetPlanId, timetable_slot_id: slot.id, teacher_id: profileId, subject_id: copySubjectId, day_of_week: slot.day_of_week, period_number: slot.period_number, classwork: sourceRows[index].classwork, homework: sourceRows[index].homework, classera_notes: sourceRows[index].classera_notes, updated_at: new Date().toISOString() }));
        const { error: insertError } = await supabase.from("plan_entries").insert(rowsToCopy);
        if (insertError) throw insertError;
        const { error: submissionError } = await supabase.from("plan_submissions").upsert({ weekly_plan_id: targetPlanId, teacher_id: profileId, subject_id: copySubjectId, status: "draft", submitted_at: null, reviewed_by: null, reviewed_at: null, review_note: null }, { onConflict: "weekly_plan_id,teacher_id,subject_id" });
        if (submissionError) throw submissionError;
        copied.push(`Grade ${target.grade} ${target.section} (${rowsToCopy.length} lessons)`);
      }
      setCopyTargetClassIds([]);
      setCopyPanelOpen(false);
      setMessage(`Copied as drafts: ${copied.join(", ") || "no eligible classes"}.${skipped.length ? ` Skipped because a plan already exists or has no slots: ${skipped.join(", ")}.` : ""}`);
      setMessageTone(copied.length ? "success" : "info");
      await loadTeacherDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The plan could not be copied.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  };

  const reviewWeeklyPlan = async (review: SupervisorPlanReview, decision: "approved" | "changes_requested") => {
    const note = reviewNotes[review.key]?.trim() ?? "";
    if (decision === "changes_requested" && !note) {
      setMessage("Write a review note before returning the weekly plan to the teacher.");
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
      setMessage(decision === "approved" ? "The full weekly plan was approved. It becomes visible to families when every required department plan for this class and week is approved." : "The full weekly plan was returned to the teacher with your note.");
      setMessageTone("success");
      setReviewNotes((current) => ({ ...current, [review.key]: "" }));
      await loadTeacherDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The review action could not be completed.");
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
  const selectedReviewTeacher = departmentTeachers.find((teacher) => teacher.userId === selectedReviewTeacherId);
  const selectedReviewWeek = academicWeeks.find((week) => week.id === selectedReviewWeekId);
  const selectedTeacherReviewRawItems = reviewItems.filter((item) => item.teacherId === selectedReviewTeacherId && item.weekId === selectedReviewWeekId);
  const selectedTeacherReviewPlans = useMemo(() => Array.from(selectedTeacherReviewRawItems.reduce((groups, item) => {
    const key = item.weeklyPlanId || `${item.teacherId}-${item.weekId}-${item.classId}`;
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
  }, new Map<string, SupervisorPlanReview>()).values()).map((plan) => ({ ...plan, entries: plan.entries.sort((a, b) => dayNames.indexOf(a.day) - dayNames.indexOf(b.day) || a.period - b.period), quizzes: Array.from(new Map(plan.quizzes.map((quiz) => [`${quiz.subject}-${quiz.date}-${quiz.details}`, quiz])).values()), weeklyNotes: Array.from(new Set(plan.weeklyNotes)) })), [selectedTeacherReviewRawItems]);
  const selectedTeacherReviewClasses = useMemo(() => {
    const assignedClasses = (selectedReviewTeacher?.assignments ?? []).map((assignment) => [
      assignment.classId,
      { id: assignment.classId, name: `Grade ${assignment.grade} · ${assignment.section}` },
    ] as const);
    const submittedClasses = selectedTeacherReviewPlans.map((plan) => [
      plan.classId,
      { id: plan.classId, name: plan.className },
    ] as const);
    return Array.from(new Map([...assignedClasses, ...submittedClasses]).values());
  }, [selectedReviewTeacher, selectedTeacherReviewPlans]);
  const selectedTeacherClassPlan = selectedTeacherReviewPlans.find((plan) => plan.classId === selectedReviewClassId) ?? null;
  const selectedTeacherReviewItems = useMemo(() => selectedTeacherReviewPlans
    .filter((plan) => !selectedReviewClassId || plan.classId === selectedReviewClassId)
    .map((plan) => ({
      id: plan.key, weeklyPlanId: plan.weeklyPlanId, teacherId: plan.teacherId, weekId: plan.weekId, classId: plan.classId,
      teacherName: plan.teacherName, className: plan.className, week: plan.week,
      subject: plan.reviews.map((item) => item.subject).join(" + "), status: plan.status, note: plan.note, submittedAt: plan.submittedAt, entries: plan.entries, quizzes: plan.quizzes, weeklyNotes: plan.weeklyNotes,
    })), [selectedTeacherReviewPlans, selectedReviewClassId]);
  useEffect(() => {
    setSelectedReviewClassId((current) => selectedTeacherReviewClasses.some((schoolClass) => schoolClass.id === current) ? current : selectedTeacherReviewClasses[0]?.id ?? "");
  }, [selectedTeacherReviewClasses]);
  const selectedDepartmentTeacher = departmentTeachers.find((teacher) => teacher.userId === selectedDepartmentTeacherId);
  const workspaceNavigation = isSupervisor ? [...navigation, ["Teacher Reviews", "RV"] as const, ["Department Teachers", "DT"] as const] : navigation;
  const openWorkspaceSection = (label: string) => {
    setActiveNav(label);
    setMobileNavigationOpen(false);
  };

  return (
    <main className="teacher-portal">
      <aside className="teacher-sidebar">
        <div className="teacher-brand"><img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" /><div><strong>ALANDALUS</strong><span>Teacher Workspace</span></div></div>
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
            <div className="teacher-mobile-menu-heading"><div className="teacher-brand"><img src={`${basePath}/school-logo.jpeg`} alt="" /><div><strong>ALANDALUS</strong><span>Teacher Workspace</span></div></div><button type="button" aria-label="Close menu" onClick={() => setMobileNavigationOpen(false)}>×</button></div>
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
        <header className="teacher-topbar"><button type="button" className="teacher-mobile-menu-button" aria-label="Open workspace menu" aria-expanded={mobileNavigationOpen} onClick={() => setMobileNavigationOpen(true)}>☰</button><div className="teacher-mobile-brand"><img src={`${basePath}/school-logo.jpeg`} alt="" /><strong>Teacher Workspace</strong></div><label className="teacher-search"><span>⌕</span><input type="search" placeholder="Search plans, classes or subjects" /></label><div className="teacher-top-actions"><span className="teacher-sync"><i /> Supabase connected</span><button className="teacher-profile-chip"><span className="teacher-avatar">{initials(teacherName)}</span><span><strong>{teacherName}</strong><small>{departmentName}</small></span></button></div></header>
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
                {weeklyPlanRows.map((plan) => { const statusLabel = plan.status === "published" ? "Published for families" : plan.status === "submitted" ? "Sent to supervisor" : plan.status === "changes_requested" ? "Changes requested" : plan.status === "approved" ? "Approved — waiting for class" : "Draft in progress"; const editable = plan.status === "draft" || plan.status === "changes_requested"; const statusTone = plan.status === "published" ? "purple" : plan.status === "approved" ? "green" : plan.status === "submitted" ? "navy" : plan.status === "changes_requested" ? "rose" : "amber"; return <tr key={plan.planId}><td><strong>{plan.week}</strong><small>{plan.lessonCount} lesson{plan.lessonCount === 1 ? "" : "s"}</small></td><td><strong>{plan.className}</strong></td><td>{plan.subjects.join(", ")}</td><td><span className={`teacher-status ${statusTone}`}><i />{statusLabel}</span></td><td>{plan.updated}</td><td><div className="teacher-plan-actions"><button type="button" className="teacher-secondary-button" disabled={saving} onClick={() => openWeeklyPlan(plan)}>{editable ? "Continue plan" : "Preview"}</button>{plan.status === "submitted" && <button type="button" className="teacher-secondary-button warning" disabled={saving} onClick={() => { const submission = mySubmissions.find((item) => item.weeklyPlanId === plan.planId && item.status === "submitted"); if (submission) void withdrawSubmissionForEditing(submission); }}>Withdraw</button>}{editable && <button type="button" className="teacher-secondary-button danger" disabled={saving} onClick={() => void clearWeeklyDraft(plan)}>Clear draft</button>}</div></td></tr>; })}
                {!loading && weeklyPlanRows.length === 0 && <tr><td className="super-empty" colSpan={6}>No weekly plans have been started yet.</td></tr>}
              </tbody></table></div>
            </section>

            <section className="teacher-card teacher-review-status-card" hidden>
              <div className="teacher-card-heading"><div><p className="teacher-kicker">Plan follow-up</p><h2>My submitted plans</h2><p>Plans remain editable until the supervisor starts reviewing them. A returned plan includes the supervisor&apos;s note.</p></div></div>
              <div className="teacher-review-status-list">
                {mySubmissions.filter((submission) => submission.status !== "draft").map((submission) => <article key={submission.id}>
                  <div><span className={`teacher-status ${submission.status === "approved" ? "green" : submission.status === "changes_requested" ? "amber" : "navy"}`}><i />{submission.status.replaceAll("_", " ")}</span><strong>{submission.subject}</strong><small>{submission.className} · {submission.week}</small>{submission.reviewNote && <p><b>Supervisor note:</b> {submission.reviewNote}</p>}</div>
                  <div className="teacher-review-status-actions"><button type="button" className="teacher-secondary-button" disabled={saving} onClick={() => openSavedPlan(submission)}>Preview & edit</button>{submission.status === "submitted" && <button type="button" className="teacher-secondary-button warning" disabled={saving} onClick={() => void withdrawSubmissionForEditing(submission)}>Withdraw for editing</button>}</div>
                </article>)}
                {mySubmissions.filter((submission) => submission.status !== "draft").length === 0 && <p className="supervisor-review-empty">No plans are currently waiting for review. Save a draft when you are ready to continue later.</p>}
              </div>
            </section>
          </>}

          {(activeNav === "My Classes" || activeNav === "My Subjects" || activeNav === "Profile & assignments") && <section className="teacher-card teacher-live-assignment-panel"><div><h2>{activeNav}</h2><p>Only the Super Admin can change these assignments.</p></div><div className="teacher-live-assignment-grid">
            {(activeNav === "My Classes" || activeNav === "Profile & assignments") && <article><small>Approved Classes</small>{uniqueClasses.map((className) => <span key={className}>{className}</span>)}{uniqueClasses.length === 0 && <p>No classes assigned yet.</p>}</article>}
            {(activeNav === "My Subjects" || activeNav === "Profile & assignments") && <article><small>Approved Subjects</small>{uniqueSubjects.map((subject) => <span key={subject}>{subject}</span>)}{uniqueSubjects.length === 0 && <p>No subjects assigned yet.</p>}</article>}
          </div></section>}

          {activeNav === "Calendar" && <section className="teacher-card teacher-live-assignment-panel"><div><h2>Academic Weeks</h2><p>Available weekly-plan periods from Supabase.</p></div><div className="teacher-week-list">{academicWeeks.map((week) => <span key={week.id} className={week.is_current ? "current" : ""}><strong>Week {week.week_number}</strong><small>{week.label}</small><i>{formatDate(week.starts_on)}–{formatDate(week.ends_on)}</i></span>)}{academicWeeks.length === 0 && <p>No academic weeks configured yet.</p>}</div></section>}

          {activeNav === "Settings" && <><section className="teacher-card teacher-live-assignment-panel"><div><h2>Account Settings</h2><p>Your account is authenticated and connected to Supabase.</p></div><div className="teacher-settings-row"><span><small>Name</small><strong>{teacherName}</strong></span><span><small>Department</small><strong>{departmentName}</strong></span><button className="teacher-secondary-button" onClick={() => void signOut()}>Sign out</button></div></section><StaffLanguagePreference /></>}

          {isSupervisor && activeNav === "Department Teachers" && <section className="teacher-card department-teachers-card">
            <div className="teacher-card-heading"><div><p className="teacher-kicker">Department management</p><h2>Department Teachers</h2><p>Manage only the teachers assigned to your supervision group.</p></div><span className="supervisor-review-authority">{departmentTeachers.length} teachers</span></div>
            <div className="department-teachers-layout"><div className="department-teacher-list">{departmentTeachers.map((teacher, index) => <button key={teacher.userId || `${teacher.name}-${index}`} className={selectedDepartmentTeacherId === teacher.userId ? "active" : ""} onClick={() => selectDepartmentTeacher(teacher.userId)}><span>{initials(teacher.name)}</span><div><strong>{teacher.name}</strong><small>{teacher.userId ? `${teacher.assignments.length} class / subject assignments` : "Account not registered yet"}</small></div><em>Manage</em></button>)}{departmentTeachers.length === 0 && <p className="supervisor-review-empty">No teachers are linked to your department yet.</p>}</div>
              {selectedDepartmentTeacher && <section className="department-teacher-editor"><div><p className="teacher-kicker">Teacher assignments</p><h3>{selectedDepartmentTeacher.name}</h3><p>Assign classes and subjects, or remove an existing assignment.</p></div>{!selectedDepartmentTeacher.userId ? <p className="supervisor-review-feedback">This teacher must create and activate a school account before classes and subjects can be assigned.</p> : <><div className="department-assignment-picker"><label>Class<select value={departmentAssignmentDraft.classId} onChange={(event) => setDepartmentAssignmentDraft((current) => ({ ...current, classId: event.target.value }))}><option value="">Select class</option>{schoolClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>Grade {schoolClass.grade} {schoolClass.section}</option>)}</select></label><label>Subject<select value={departmentAssignmentDraft.subjectId} onChange={(event) => setDepartmentAssignmentDraft((current) => ({ ...current, subjectId: event.target.value }))}><option value="">Select subject</option>{schoolSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name_en}</option>)}</select></label><button disabled={saving || !departmentAssignmentDraft.classId || !departmentAssignmentDraft.subjectId} type="button" className="teacher-primary-button" onClick={() => void addDepartmentAssignment(selectedDepartmentTeacher.userId)}>Assign to teacher</button></div><div className="department-assignment-chips">{selectedDepartmentTeacher.assignments.map((assignment) => <span key={assignment.id}>{`Grade ${assignment.grade} ${assignment.section} · ${assignment.subject}`}<button disabled={saving} type="button" aria-label={`Remove ${assignment.subject}`} onClick={() => void removeDepartmentAssignment(assignment.id)}>×</button></span>)}{selectedDepartmentTeacher.assignments.length === 0 && <small>No classes or subjects assigned yet.</small>}</div></>}</section>}</div>
          </section>}
          {isSupervisor && activeNav === "Teacher Reviews" && <section className="teacher-card supervisor-review-card">
            <div className="teacher-card-heading supervisor-review-heading">
              <div><p className="teacher-kicker">Supervisor workspace</p><h2>Weekly plan review</h2><p>Choose a school week, teacher, then class. All subjects the teacher wrote for that class are reviewed together as one weekly plan.</p></div>
              <span className="supervisor-review-authority">{waitingReviews.length} subject entries waiting for review</span>
            </div>
            <div className="supervisor-review-selector">
              <label>1. School week<select value={selectedReviewWeekId} onChange={(event) => setSelectedReviewWeekId(event.target.value)}><option value="">Select week</option>{academicWeeks.map((week) => <option key={week.id} value={week.id}>{week.label}</option>)}</select></label>
              <label>2. Teacher<select value={selectedReviewTeacherId} onChange={(event) => { setSelectedReviewTeacherId(event.target.value); setSelectedReviewClassId(""); }}><option value="">Select teacher</option>{departmentTeachers.filter((teacher) => teacher.userId).map((teacher) => <option key={teacher.userId} value={teacher.userId}>{teacher.name}</option>)}</select></label>
              <label>3. Class<select value={selectedReviewClassId} onChange={(event) => setSelectedReviewClassId(event.target.value)} disabled={!selectedReviewTeacher || selectedTeacherReviewClasses.length === 0}><option value="">Select class</option>{selectedTeacherReviewClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}</select></label>
              <span>{selectedTeacherReviewClasses.length} class plan{selectedTeacherReviewClasses.length === 1 ? "" : "s"} found</span>
            </div>
            <div className="supervisor-review-list">
              {!selectedReviewWeek || !selectedReviewTeacher ? <p className="supervisor-review-empty">Select the school week and teacher to open their weekly-plan review.</p> : selectedTeacherReviewItems.map((review) => <article key={review.id}>
                <header><div><span className={`teacher-status ${review.status === "approved" ? "green" : review.status === "changes_requested" ? "amber" : "navy"}`}><i />{review.status.replaceAll("_", " ")}</span><h3>{review.teacherName}</h3><p>{review.subject} · {review.className} · {review.week}</p></div><small>Submitted {review.submittedAt}</small></header>
                <div className="supervisor-entry-grid">{review.entries.map((entry) => <section key={`${entry.day}-${entry.period}`}><strong>{entry.day} · Period {entry.period}</strong><p><b>Classwork</b>{entry.classwork || "—"}</p><p><b>Homework</b>{entry.homework || "—"}</p><p><b>Classera</b>{entry.notes || "—"}</p></section>)}</div>
                {(review.quizzes.length > 0 || review.weeklyNotes.length > 0) && <div className="supervisor-plan-extras">{review.quizzes.length > 0 && <section><strong>Quizzes & assessments</strong>{review.quizzes.map((quiz, index) => <p key={`${quiz.subject}-${index}`}><b>{quiz.subject}{quiz.date ? ` · ${quiz.date}` : ""}</b>{quiz.details}</p>)}</section>}{review.weeklyNotes.length > 0 && <section><strong>Weekly notes for families</strong>{review.weeklyNotes.map((note, index) => <p key={`${note}-${index}`}>{note}</p>)}</section>}</div>}
                {review.status === "submitted" && <div className="supervisor-review-actions"><label>Review note<textarea value={reviewNotes[review.id] ?? review.note} onChange={(event) => setReviewNotes((current) => ({ ...current, [review.id]: event.target.value }))} placeholder="Write the required changes for the teacher" rows={3} /></label><div><button disabled={saving} className="teacher-secondary-button" onClick={() => void reviewSubmission(review, "changes_requested")}>Return whole plan</button><button disabled={saving} className="teacher-primary-button" onClick={() => void reviewSubmission(review, "approved")}>Approve whole plan</button></div></div>}
                {review.status === "changes_requested" && <p className="supervisor-review-feedback"><strong>Your review note</strong>{review.note || "The teacher has been asked to revise this plan."}</p>}
                {review.status === "approved" && <p className="supervisor-review-feedback approved"><strong>Approved for this department</strong>This complete department plan was approved. It will be visible to families once every required department plan for the class and week is approved.</p>}
              </article>)}
              {selectedReviewWeek && selectedReviewTeacher && selectedTeacherReviewItems.length === 0 && <p className="supervisor-review-empty"><strong>{selectedReviewTeacher.name}</strong> has not sent a weekly plan for {selectedReviewWeek.label} yet.</p>}
            </div>
          </section>}
        </div>
      </section>

      {weeklyBuilderOpen && selectedClass && selectedWeek && <div className="teacher-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && setWeeklyBuilderOpen(false)}><section className="teacher-editor-modal weekly-builder-modal" role="dialog" aria-modal="true" aria-labelledby="weekly-builder-title">
        <div className="teacher-modal-heading"><div><p>{selectedWeek.label}</p><h2 id="weekly-builder-title">Build the whole week</h2></div><button disabled={saving} aria-label="Close weekly builder" onClick={() => setWeeklyBuilderOpen(false)}>×</button></div>
        <div className="teacher-editor-context"><span>One save for the whole week</span><i />Entries are placed according to your timetable slots.<b className={`teacher-autosave-state ${autoSaveState}`}>{autoSaveState === "saving" ? "Saving draft…" : autoSaveState === "saved" ? "Draft saved automatically" : "Auto-save is on"}</b></div>
        <form onSubmit={(event) => { event.preventDefault(); void saveWholeWeek(true); }}>
          {builderStatus !== "new" && <div className={`weekly-builder-review-state ${builderStatus}`}><strong>{builderStatus === "submitted" ? "Under supervisor review" : builderStatus === "changes_requested" ? "Changes requested by supervisor" : builderStatus === "approved" ? "Approved" : "Saved as draft"}</strong><span>{builderStatus === "submitted" ? "You can preview it, or withdraw it to make changes before the supervisor decides." : builderStatus === "changes_requested" ? "Update the required items, then submit the plan for review again." : builderStatus === "approved" ? "This subject has already been approved. Contact your supervisor if a correction is needed." : "This plan is saved privately and has not been sent for review."}</span></div>}
          <div className="weekly-builder-toolbar"><label>1. Academic week<select value={selectedWeekId} onChange={(event) => setSelectedWeekId(event.target.value)}>{academicWeeks.map((week) => <option key={week.id} value={week.id}>{week.label}</option>)}</select></label><label>2. Class<select value={selectedClassId} onChange={(event) => { setSelectedClassId(event.target.value); setSlotDrafts({}); setQuizSubjectId(""); }}>{Array.from(new Map(assignments.map((assignment) => [assignment.classId, assignment])).values()).map((assignment) => <option key={assignment.classId} value={assignment.classId}>Grade {assignment.grade} · {assignment.section}</option>)}</select></label><span className={`teacher-timetable-ready ${selectedClassSlots.length > 0 ? "ready" : "missing"}`}>{selectedClassSlots.length > 0 ? `${selectedClassSlots.length} lessons ready for this week` : "Timetable connection required"}</span></div>
          <div className={`weekly-builder-days days-${activeDayIndexes.length}`}>{activeDayIndexes.map((index) => { const day = dayNames[index]; const daySlots = selectedClassSlots.filter((slot) => slot.day_of_week === index); return <section className="weekly-builder-day" key={day}><header><strong>{day}</strong><small>{daySlots.length} lesson{daySlots.length === 1 ? "" : "s"}</small></header>{daySlots.map((slot) => { const assignment = assignmentForSlot(slot); const draft = slotDraftFor(slot); const isEnglish = englishSubjectNames.has(assignment?.subject ?? ""); return <article key={slot.id}><header><span>Period {slot.period_number}</span><strong>{assignment?.subject ?? "Subject"}</strong></header>{assignment?.subject === "Integrated Science" && <label>Science component<select value={draft.scienceComponent} onChange={(event) => updateSlotDraft(slot.id, "scienceComponent", event.target.value)}><option value="">Select Chemistry, Physics or Biology</option>{scienceComponents.map((component) => <option key={component} value={component}>{component}</option>)}</select></label>}{isEnglish && <label>English programme<select value={draft.englishProgramme || defaultEnglishProgramme(assignment?.grade ?? 0, assignment?.subject ?? "")} onChange={(event) => updateSlotDraft(slot.id, "englishProgramme", event.target.value)}>{englishProgrammesForGrade(assignment?.grade ?? 0).map((programme) => <option key={programme} value={programme}>{programme}</option>)}</select></label>}{isEnglish && <p className="teacher-programme-note">The programme name is added automatically before Classwork.</p>}<label>Classwork<textarea rows={3} value={draft.classwork} onChange={(event) => updateSlotDraft(slot.id, "classwork", event.target.value)} placeholder="Lesson, unit and pages" /></label><label>Homework<textarea rows={3} value={draft.homework} onChange={(event) => updateSlotDraft(slot.id, "homework", event.target.value)} placeholder="Homework for this lesson" /></label><label>Classera notes<textarea rows={3} value={draft.classeraNotes} onChange={(event) => updateSlotDraft(slot.id, "classeraNotes", event.target.value)} placeholder="Reminder or materials" /></label></article>})}</section>})}</div>
          <section className="weekly-builder-extra"><div className="weekly-builder-section-heading"><div><span>QZ</span><div><strong>Quiz or assessment</strong><small>Choose the subject, then add the quiz for this class.</small></div></div></div><div className="weekly-builder-quiz-row"><label>Subject<select value={quizSubjectId} onChange={(event) => setQuizSubjectId(event.target.value)}><option value="">Select subject</option>{selectedClassAssignments.map((assignment) => <option key={assignment.subjectId} value={assignment.subjectId}>{assignment.subject}</option>)}</select></label><label>Quiz day<select value={quizDay} onChange={(event) => setQuizDay(event.target.value)}>{dayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>Quiz details<input value={quizDetails} onChange={(event) => setQuizDetails(event.target.value)} placeholder="Title, scope or revision pages" /></label></div></section>
          <section className="weekly-builder-extra"><div className="weekly-builder-section-heading"><div><span>NT</span><div><strong>Weekly notes for families</strong><small>Spelling words, reminders or important announcements.</small></div></div></div><textarea className="weekly-builder-notes" rows={3} value={weeklyNote} onChange={(event) => setWeeklyNote(event.target.value)} placeholder="Weekly notes" /></section>
          <section className="weekly-copy-panel"><div><strong>Copy this subject plan to other classes</strong><p>{savedPlanId ? "Only classes in the same grade where you teach the same subject appear here. The copied plans are saved as drafts; quizzes and weekly notes stay with the original class." : "Save this class as a draft first, then you can copy one subject plan to your other eligible classes."}</p></div><button type="button" className="teacher-secondary-button" disabled={saving || !savedPlanId || builderStatus === "approved"} onClick={() => { setCopyPanelOpen((open) => !open); setCopySubjectId((current) => current || sourceSubjectAssignments[0]?.subjectId || ""); }}>Copy plan</button>{savedPlanId && copyPanelOpen && <div className="weekly-copy-controls"><label>Subject to copy<select value={copySubjectId} onChange={(event) => { setCopySubjectId(event.target.value); setCopyTargetClassIds([]); }}><option value="">Select subject</option>{sourceSubjectAssignments.map((assignment) => <option key={assignment.subjectId} value={assignment.subjectId}>{assignment.subject}</option>)}</select></label><div className="weekly-copy-targets">{copyTargetClasses.map((target) => <label key={target.classId}><input type="checkbox" checked={copyTargetClassIds.includes(target.classId)} onChange={() => toggleCopyTarget(target.classId)} /><span><strong>Grade {target.grade} · {target.section}</strong><small>{target.lessonCount} matching timetable lesson{target.lessonCount === 1 ? "" : "s"}</small></span></label>)}{copySubjectId && copyTargetClasses.length === 0 && <p>No other eligible class is assigned to you for this subject and grade.</p>}</div><div className="weekly-copy-actions"><small>Different lesson dates or periods are matched by lesson order: first lesson to first lesson, second to second, and so on.</small><button type="button" className="teacher-primary-button" disabled={saving || !copySubjectId || copyTargetClassIds.length === 0} onClick={() => void copyPlanToOtherClasses()}>Save copied drafts</button></div></div>}</section>
          <div className="teacher-editor-footer"><span>{selectedClassSlots.length > 0 ? "Every card is one of your real timetable lessons. Save once when the whole class week is ready." : "Saving is blocked until the timetable is connected."}</span><div><button disabled={saving || selectedClassSlots.length === 0} type="button" className="teacher-secondary-button teacher-preview-button" onClick={() => void openParentPreview()}>Preview parent plan</button><button disabled={saving} type="button" className="teacher-secondary-button" onClick={() => setWeeklyBuilderOpen(false)}>Cancel</button><button disabled={saving || selectedClassSlots.length === 0 || builderStatus === "approved"} type="button" className="teacher-secondary-button" onClick={() => void saveWholeWeek(false)}>Save draft</button>{builderStatus === "submitted" && <button disabled={saving} type="button" className="teacher-secondary-button warning" onClick={() => { const submission = mySubmissions.find((item) => item.classId === selectedClassId && item.weekId === selectedWeekId && item.status === "submitted"); if (submission) void withdrawSubmissionForEditing(submission); }}>Withdraw</button>}<button disabled={saving || selectedClassSlots.length === 0 || builderStatus === "approved"} className="teacher-primary-button" type="submit">{saving ? "Saving…" : builderStatus === "changes_requested" ? "Resubmit for review" : "Submit for review"}</button></div></div>
        </form>
      </section></div>}
      {parentPreviewOpen && selectedClass && selectedWeek && <div className="teacher-modal-backdrop parent-preview-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setParentPreviewOpen(false)}><section className="teacher-parent-preview" dir="ltr" role="dialog" aria-modal="true" aria-labelledby="parent-preview-title"><div className="teacher-modal-heading"><div><p>Preview only — nothing has been saved or sent</p><h2 id="parent-preview-title">Parent weekly-plan preview</h2></div><button aria-label="Close parent plan preview" onClick={() => setParentPreviewOpen(false)}>×</button></div><div className="parent-preview-intro">Your current writing is shown in its real timetable position. Other subjects are intentionally blank because this is only your private preview.</div>{parentPreviewLoading ? <p className="parent-preview-loading">Loading the class timetable…</p> : <section className="parent-preview-paper"><div className="parent-preview-paper-header"><img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" /><div><strong>ALANDALUS PRIVATE SCHOOLS</strong><span>The Egyptian Section</span><h3>WEEKLY STUDY PLAN</h3></div></div><div className="parent-preview-meta"><span><small>Class</small><strong>Grade {selectedClass.grade} · Class {selectedClass.section}</strong></span><span><small>Week No.</small><strong>{selectedWeek.week_number}</strong></span><span><small>Date</small><strong>{selectedWeek.label}</strong></span></div><div className="table-wrap"><table className="weekly-table parent-preview-table"><thead><tr><th>Day</th><th>Course</th><th>Classwork</th><th>Homework</th><th>Classera Notes</th></tr></thead>{dayNames.map((day, dayIndex) => { const daySlots = parentPreviewSlots.filter((slot) => slot.day_of_week === dayIndex); return daySlots.length > 0 ? <tbody className="weekly-day-group" key={day}>{daySlots.map((slot, index) => { const ownSlot = selectedClassSlots.find((teacherSlot) => teacherSlot.id === slot.id); const draft = ownSlot ? slotDraftFor(ownSlot) : null; return <tr key={slot.id} className={index === 0 ? "new-day" : ""}>{index === 0 && <td className="day-cell" rowSpan={daySlots.length}>{day}</td>}<td className="course-cell">{slot.subject}</td><td className={draft?.classwork.trim() ? "preview-written" : "preview-empty"}>{ownSlot ? previewClasswork(ownSlot) || "—" : "—"}</td><td className={draft?.homework.trim() ? "preview-written" : "preview-empty"}>{ownSlot ? draft?.homework.trim() || "—" : "—"}</td><td className={draft?.classeraNotes.trim() ? "preview-written" : "preview-empty"}>{ownSlot ? draft?.classeraNotes.trim() || "—" : "—"}</td></tr>; })}</tbody> : null; })}</table>{parentPreviewSlots.length === 0 && <p className="parent-preview-loading">No timetable lessons are available for this class yet.</p>}</div><div className="important-notes"><strong>Important Notes</strong><p>Your weekly notes and quiz details will appear here after they are saved and approved.</p></div></section>}<div className="teacher-editor-footer parent-preview-footer"><span>This preview does not submit, approve, or publish the weekly plan.</span><div><button type="button" className="teacher-primary-button" onClick={() => setParentPreviewOpen(false)}>Return to editor</button></div></div></section></div>}
    </main>
  );
}
