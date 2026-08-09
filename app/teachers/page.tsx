"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type TimetableSlot = {
  id: string;
  class_id: string;
  subject_id: string;
  day_of_week: number;
  period_number: number;
};

type TeacherEntry = {
  id: string;
  day: string;
  className: string;
  subject: string;
  status: string;
  updated: string;
};

type ReviewItem = {
  id: string;
  teacherName: string;
  subject: string;
  className: string;
  week: string;
  status: string;
  note: string;
  submittedAt: string;
  entries: { day: string; classwork: string; homework: string; notes: string }[];
};

type SlotDraft = { classwork: string; homework: string; classeraNotes: string; englishProgramme: string; scienceComponent: string };
type SchoolClass = { id: string; grade: number; section: string };
type SchoolSubject = { id: string; name_en: string };
type DepartmentTeacher = { userId: string; name: string; assignments: Assignment[] };

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
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [entries, setEntries] = useState<TeacherEntry[]>([]);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewStatusFilter, setReviewStatusFilter] = useState<"waiting" | "changes_requested" | "approved">("waiting");
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

      const reviewsPromise = supervisorAccount
        ? supabase.from("plan_submissions").select("id, status, review_note, submitted_at, teacher_id, subjects(name_en), profiles!plan_submissions_teacher_id_fkey(display_name), weekly_plans(school_classes(grade, section), academic_weeks(label), plan_entries(day_of_week, classwork, homework, classera_notes))").in("status", ["submitted", "changes_requested", "approved"]).order("submitted_at", { ascending: false })
        : Promise.resolve({ data: [], error: null });
      const departmentTeachersPromise = supervisorAccount ? supabase.rpc("get_my_department_teachers") : Promise.resolve({ data: [], error: null });
      const [assignmentsResult, weeksResult, slotsResult, entriesResult, reviewsResult, departmentTeachersResult, classesResult, subjectsResult, accessResult, teacherAccessResult] = await Promise.all([
        supabase.from("teacher_assignments").select("id, class_id, subject_id, school_classes(grade, section), subjects(name_en, include_in_weekly_plan)").eq("teacher_id", userData.user.id),
        supabase.from("academic_weeks").select("id, week_number, label, starts_on, ends_on, is_current").order("week_number"),
        supabase.from("timetable_slots").select("id, class_id, subject_id, day_of_week, period_number").eq("teacher_id", userData.user.id).order("day_of_week").order("period_number"),
        supabase.from("plan_entries").select("id, day_of_week, updated_at, subjects(name_en), weekly_plans(status, school_classes(grade, section), academic_weeks(label))").eq("teacher_id", userData.user.id).order("updated_at", { ascending: false }),
        reviewsPromise,
        departmentTeachersPromise,
        supabase.from("school_classes").select("id, grade, section").eq("is_active", true).order("grade").order("section"),
        supabase.from("subjects").select("id, name_en").eq("is_active", true).eq("include_in_weekly_plan", true).order("name_en"),
        supabase.from("weekly_plan_access_control").select("is_open").eq("id", 1).maybeSingle(),
        supabase.from("weekly_plan_teacher_access").select("is_open").eq("teacher_id", userData.user.id).maybeSingle(),
      ]);
      const firstError = [assignmentsResult.error, weeksResult.error, slotsResult.error, entriesResult.error, reviewsResult.error, classesResult.error, subjectsResult.error].find(Boolean);
      if (firstError) throw firstError;

      const realAssignments: Assignment[] = (assignmentsResult.data ?? []).map((assignment) => {
        const schoolClass = one(assignment.school_classes as { grade: number; section: string } | { grade: number; section: string }[] | null);
        const subject = one(assignment.subjects as { name_en: string; include_in_weekly_plan: boolean } | { name_en: string; include_in_weekly_plan: boolean }[] | null);
        if (!subject?.include_in_weekly_plan) return null;
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
        const weeklyPlan = one(entry.weekly_plans as unknown as { status: string; school_classes: { grade: number; section: string } | { grade: number; section: string }[] | null; academic_weeks: { label: string } | { label: string }[] | null } | { status: string; school_classes: { grade: number; section: string } | { grade: number; section: string }[] | null; academic_weeks: { label: string } | { label: string }[] | null }[] | null);
        const schoolClass = one(weeklyPlan?.school_classes);
        return {
          id: String(entry.id),
          day: dayNames[Number(entry.day_of_week)] ?? "School day",
          className: `Grade ${schoolClass?.grade ?? "—"} · ${schoolClass?.section ?? ""}`,
          subject: subject?.name_en ?? "Subject",
          status: weeklyPlan?.status ?? "draft",
          updated: formatDate(String(entry.updated_at)),
        };
      });

      const realReviews: ReviewItem[] = ((reviewsResult.data ?? []) as unknown as Record<string, unknown>[]).map((item) => {
        const subject = one(item.subjects as { name_en: string } | { name_en: string }[] | null);
        const teacher = one(item.profiles as { display_name: string } | { display_name: string }[] | null);
        const plan = one(item.weekly_plans as { school_classes: { grade: number; section: string } | { grade: number; section: string }[] | null; academic_weeks: { label: string } | { label: string }[] | null; plan_entries: { day_of_week: number; classwork: string; homework: string; classera_notes: string }[] | null } | { school_classes: { grade: number; section: string } | { grade: number; section: string }[] | null; academic_weeks: { label: string } | { label: string }[] | null; plan_entries: { day_of_week: number; classwork: string; homework: string; classera_notes: string }[] | null }[] | null);
        const schoolClass = one(plan?.school_classes);
        const week = one(plan?.academic_weeks);
        return {
          id: String(item.id), teacherName: teacher?.display_name ?? "Teacher", subject: subject?.name_en ?? "Subject",
          className: `Grade ${schoolClass?.grade ?? ""} · ${schoolClass?.section ?? ""}`, week: week?.label ?? "Academic week",
          status: String(item.status), note: String(item.review_note ?? ""), submittedAt: item.submitted_at ? formatDate(String(item.submitted_at)) : "Not submitted",
          entries: (plan?.plan_entries ?? []).sort((a, b) => a.day_of_week - b.day_of_week).map((entry) => ({ day: dayNames[entry.day_of_week] ?? "School day", classwork: entry.classwork, homework: entry.homework, notes: entry.classera_notes })),
        };
      });
      const departmentTeacherRows = (departmentTeachersResult.data ?? []) as Record<string, unknown>[];
      const departmentTeacherIds = departmentTeacherRows.map((item) => String(item.user_id ?? "")).filter(Boolean);
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
      setTimetableSlots((slotsResult.data ?? []) as TimetableSlot[]);
      setEntries(realEntries);
      setReviewItems(realReviews);
      setDepartmentTeachers(realDepartmentTeachers);
      setSchoolClasses((classesResult.data ?? []) as SchoolClass[]);
      setSchoolSubjects((subjectsResult.data ?? []) as SchoolSubject[]);
      setSelectedDepartmentTeacherId((current) => realDepartmentTeachers.some((teacher) => teacher.userId === current) ? current : realDepartmentTeachers[0]?.userId ?? "");
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
  const selectedClassAssignments = assignments.filter((assignment) => assignment.classId === selectedClassId);
  const selectedClass = selectedClassAssignments[0];
  const selectedClassSlots = timetableSlots
    .filter((slot) => slot.class_id === selectedClassId && selectedClassAssignments.some((assignment) => assignment.subjectId === slot.subject_id))
    .sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number);
  const activeDayIndexes = dayNames.map((_, index) => index).filter((index) => selectedClassSlots.some((slot) => slot.day_of_week === index));
  const assignmentForSlot = (slot: TimetableSlot) => selectedClassAssignments.find((assignment) => assignment.subjectId === slot.subject_id);
  const slotDraftFor = (slot: TimetableSlot) => slotDrafts[slot.id] ?? emptySlotDraft();
  const uniqueClasses = useMemo(() => Array.from(new Map(assignments.map((assignment) => [assignment.classId, `Grade ${assignment.grade} · ${assignment.section}`])).values()), [assignments]);
  const uniqueSubjects = useMemo(() => Array.from(new Set(assignments.map((assignment) => assignment.subject))), [assignments]);

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

  const saveWholeWeek = async (submitForReview = false) => {
    if (!profileId || !selectedClass || !selectedWeek) return;
    if (selectedClassSlots.length === 0) {
      setMessage("No timetable lessons are linked to this class yet. Ask the Super Admin to review the timetable connection.");
      setMessageTone("error");
      return;
    }

    setSaving(true);
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

      const entryRows = selectedClassSlots.map((slot) => {
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
      const { error: entriesError } = await supabase.from("plan_entries").upsert(entryRows, { onConflict: "weekly_plan_id,day_of_week,period_number" });
      if (entriesError) throw entriesError;

      const submissionRows = Array.from(new Set(selectedClassSlots.map((slot) => slot.subject_id))).map((subjectId) => ({
        weekly_plan_id: weeklyPlanId, teacher_id: profileId, subject_id: subjectId,
        status: submitForReview ? "submitted" : "draft", reviewed_by: null, reviewed_at: null,
        submitted_at: submitForReview ? new Date().toISOString() : null,
      }));
      const { error: submissionError } = await supabase.from("plan_submissions").upsert(submissionRows, { onConflict: "weekly_plan_id,teacher_id,subject_id" });
      if (submissionError) throw submissionError;

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

      setWeeklyBuilderOpen(false);
      setSlotDrafts({});
      setQuizDetails("");
      setQuizSubjectId("");
      setWeeklyNote("");
      setMessage(submitForReview ? "Your weekly plan was sent to your department supervisor for review." : "The whole week was saved successfully to Supabase.");
      setMessageTone("success");
      await loadTeacherDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The weekly plan could not be saved.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
  };

  const reviewSubmission = async (review: ReviewItem, decision: "approved" | "changes_requested") => {
    const note = reviewNotes[review.id]?.trim() ?? "";
    if (decision === "changes_requested" && !note) {
      setMessage("Write a review note before returning this plan to the teacher.");
      setMessageTone("error");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("review_plan_submission", { submission_id: review.id, decision, note: note || null });
      if (error) throw error;
      setMessage(decision === "approved" ? "The plan was approved and is now published for families." : "The plan was returned to the teacher with your note.");
      setMessageTone("success");
      setReviewNotes((current) => ({ ...current, [review.id]: "" }));
      await loadTeacherDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The review action could not be completed.");
      setMessageTone("error");
    } finally {
      setSaving(false);
    }
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
  const publishedCount = entries.filter((entry) => entry.status === "published").length;
  const draftCount = entries.filter((entry) => entry.status === "draft").length;
  const waitingReviews = reviewItems.filter((item) => item.status === "submitted");
  const changeRequestReviews = reviewItems.filter((item) => item.status === "changes_requested");
  const approvedReviews = reviewItems.filter((item) => item.status === "approved");
  const visibleReviewItems = reviewItems.filter((item) => reviewStatusFilter === "waiting" ? item.status === "submitted" : item.status === reviewStatusFilter);
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
              <div className="teacher-card-heading"><div><h2>{activeNav === "Overview" ? "Recent weekly entries" : "All my weekly entries"}</h2><p>{currentWeek ? `${formatDate(currentWeek.starts_on)}–${formatDate(currentWeek.ends_on)} · ${currentWeek.label}` : "Academic weeks are not configured yet"}</p></div></div>
              <div className="teacher-plan-table-wrap"><table className="teacher-plan-table"><thead><tr><th>Day</th><th>Class</th><th>Course</th><th>Status</th><th>Last updated</th></tr></thead><tbody>
                {entries.map((entry) => <tr key={entry.id}><td><span className="teacher-day-badge">{entry.day.slice(0, 3)}</span>{entry.day}</td><td><strong>{entry.className}</strong></td><td>{entry.subject}</td><td><span className={`teacher-status ${entry.status === "published" ? "green" : "amber"}`}><i />{entry.status}</span></td><td>{entry.updated}</td></tr>)}
                {!loading && entries.length === 0 && <tr><td className="super-empty" colSpan={5}>No weekly-plan entries saved yet.</td></tr>}
              </tbody></table></div>
            </section>
          </>}

          {(activeNav === "My Classes" || activeNav === "My Subjects" || activeNav === "Profile & assignments") && <section className="teacher-card teacher-live-assignment-panel"><div><h2>{activeNav}</h2><p>Only the Super Admin can change these assignments.</p></div><div className="teacher-live-assignment-grid">
            {(activeNav === "My Classes" || activeNav === "Profile & assignments") && <article><small>Approved Classes</small>{uniqueClasses.map((className) => <span key={className}>{className}</span>)}{uniqueClasses.length === 0 && <p>No classes assigned yet.</p>}</article>}
            {(activeNav === "My Subjects" || activeNav === "Profile & assignments") && <article><small>Approved Subjects</small>{uniqueSubjects.map((subject) => <span key={subject}>{subject}</span>)}{uniqueSubjects.length === 0 && <p>No subjects assigned yet.</p>}</article>}
          </div></section>}

          {activeNav === "Calendar" && <section className="teacher-card teacher-live-assignment-panel"><div><h2>Academic Weeks</h2><p>Available weekly-plan periods from Supabase.</p></div><div className="teacher-week-list">{academicWeeks.map((week) => <span key={week.id} className={week.is_current ? "current" : ""}><strong>Week {week.week_number}</strong><small>{week.label}</small><i>{formatDate(week.starts_on)}–{formatDate(week.ends_on)}</i></span>)}{academicWeeks.length === 0 && <p>No academic weeks configured yet.</p>}</div></section>}

          {activeNav === "Settings" && <section className="teacher-card teacher-live-assignment-panel"><div><h2>Account Settings</h2><p>Your account is authenticated and connected to Supabase.</p></div><div className="teacher-settings-row"><span><small>Name</small><strong>{teacherName}</strong></span><span><small>Department</small><strong>{departmentName}</strong></span><button className="teacher-secondary-button" onClick={() => void signOut()}>Sign out</button></div></section>}

          {isSupervisor && activeNav === "Department Teachers" && <section className="teacher-card department-teachers-card">
            <div className="teacher-card-heading"><div><p className="teacher-kicker">Department management</p><h2>Department Teachers</h2><p>Manage only the teachers assigned to your supervision group.</p></div><span className="supervisor-review-authority">{departmentTeachers.length} teachers</span></div>
            <div className="department-teachers-layout"><div className="department-teacher-list">{departmentTeachers.map((teacher, index) => <button key={teacher.userId || `${teacher.name}-${index}`} className={selectedDepartmentTeacherId === teacher.userId ? "active" : ""} onClick={() => selectDepartmentTeacher(teacher.userId)}><span>{initials(teacher.name)}</span><div><strong>{teacher.name}</strong><small>{teacher.userId ? `${teacher.assignments.length} class / subject assignments` : "Account not registered yet"}</small></div><em>Manage</em></button>)}{departmentTeachers.length === 0 && <p className="supervisor-review-empty">No teachers are linked to your department yet.</p>}</div>
              {selectedDepartmentTeacher && <section className="department-teacher-editor"><div><p className="teacher-kicker">Teacher assignments</p><h3>{selectedDepartmentTeacher.name}</h3><p>Assign classes and subjects, or remove an existing assignment.</p></div>{!selectedDepartmentTeacher.userId ? <p className="supervisor-review-feedback">This teacher must create and activate a school account before classes and subjects can be assigned.</p> : <><div className="department-assignment-picker"><label>Class<select value={departmentAssignmentDraft.classId} onChange={(event) => setDepartmentAssignmentDraft((current) => ({ ...current, classId: event.target.value }))}><option value="">Select class</option>{schoolClasses.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>Grade {schoolClass.grade} {schoolClass.section}</option>)}</select></label><label>Subject<select value={departmentAssignmentDraft.subjectId} onChange={(event) => setDepartmentAssignmentDraft((current) => ({ ...current, subjectId: event.target.value }))}><option value="">Select subject</option>{schoolSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name_en}</option>)}</select></label><button disabled={saving || !departmentAssignmentDraft.classId || !departmentAssignmentDraft.subjectId} type="button" className="teacher-primary-button" onClick={() => void addDepartmentAssignment(selectedDepartmentTeacher.userId)}>Assign to teacher</button></div><div className="department-assignment-chips">{selectedDepartmentTeacher.assignments.map((assignment) => <span key={assignment.id}>{`Grade ${assignment.grade} ${assignment.section} · ${assignment.subject}`}<button disabled={saving} type="button" aria-label={`Remove ${assignment.subject}`} onClick={() => void removeDepartmentAssignment(assignment.id)}>×</button></span>)}{selectedDepartmentTeacher.assignments.length === 0 && <small>No classes or subjects assigned yet.</small>}</div></>}</section>}</div>
          </section>}
          {isSupervisor && activeNav === "Teacher Reviews" && <section className="teacher-card supervisor-review-card">
            <div className="teacher-card-heading supervisor-review-heading">
              <div><p className="teacher-kicker">Supervisor workspace</p><h2>Teacher plans for review</h2><p>Only your assigned teachers appear here. Read every lesson, homework item and Classera note before making a decision.</p></div>
              <span className="supervisor-review-authority">Your approval publishes the subject for families</span>
            </div>
            <div className="supervisor-review-stats" aria-label="Review summary">
              <button className={reviewStatusFilter === "waiting" ? "active" : ""} onClick={() => setReviewStatusFilter("waiting")}><small>Waiting for review</small><strong>{waitingReviews.length}</strong><span>Need your decision</span></button>
              <button className={reviewStatusFilter === "changes_requested" ? "active" : ""} onClick={() => setReviewStatusFilter("changes_requested")}><small>Returned for changes</small><strong>{changeRequestReviews.length}</strong><span>Waiting for teacher update</span></button>
              <button className={reviewStatusFilter === "approved" ? "active" : ""} onClick={() => setReviewStatusFilter("approved")}><small>Approved & published</small><strong>{approvedReviews.length}</strong><span>Visible to families</span></button>
            </div>
            <div className="supervisor-review-list">
              {visibleReviewItems.map((review) => <article key={review.id}>
                <header><div><span className={`teacher-status ${review.status === "approved" ? "green" : review.status === "changes_requested" ? "amber" : "navy"}`}><i />{review.status.replaceAll("_", " ")}</span><h3>{review.teacherName}</h3><p>{review.subject} · {review.className} · {review.week}</p></div><small>Submitted {review.submittedAt}</small></header>
                <div className="supervisor-entry-grid">{review.entries.map((entry) => <section key={entry.day}><strong>{entry.day}</strong><p><b>Classwork</b>{entry.classwork || "—"}</p><p><b>Homework</b>{entry.homework || "—"}</p><p><b>Classera</b>{entry.notes || "—"}</p></section>)}</div>
                {review.status === "submitted" && <div className="supervisor-review-actions"><label>Review note<textarea value={reviewNotes[review.id] ?? review.note} onChange={(event) => setReviewNotes((current) => ({ ...current, [review.id]: event.target.value }))} placeholder="Write the required changes for the teacher" rows={3} /></label><div><button disabled={saving} className="teacher-secondary-button" onClick={() => void reviewSubmission(review, "changes_requested")}>Return for changes</button><button disabled={saving} className="teacher-primary-button" onClick={() => void reviewSubmission(review, "approved")}>Approve & publish</button></div></div>}
                {review.status === "changes_requested" && <p className="supervisor-review-feedback"><strong>Your review note</strong>{review.note || "The teacher has been asked to revise this plan."}</p>}
                {review.status === "approved" && <p className="supervisor-review-feedback approved"><strong>Published for families</strong>This subject was approved and is currently visible in the family weekly plan.</p>}
              </article>)}
              {visibleReviewItems.length === 0 && <p className="supervisor-review-empty">{reviewStatusFilter === "waiting" ? "No teacher plans are waiting for review in your department." : "No plans match this review status yet."}</p>}
            </div>
          </section>}
        </div>
      </section>

      {weeklyBuilderOpen && selectedClass && selectedWeek && <div className="teacher-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && setWeeklyBuilderOpen(false)}><section className="teacher-editor-modal weekly-builder-modal" role="dialog" aria-modal="true" aria-labelledby="weekly-builder-title">
        <div className="teacher-modal-heading"><div><p>{selectedWeek.label}</p><h2 id="weekly-builder-title">Build the whole week</h2></div><button disabled={saving} aria-label="Close weekly builder" onClick={() => setWeeklyBuilderOpen(false)}>×</button></div>
        <div className="teacher-editor-context"><span>One save for the whole week</span><i />Entries are placed according to your timetable slots.</div>
        <form onSubmit={(event) => { event.preventDefault(); void saveWholeWeek(true); }}>
          <div className="weekly-builder-toolbar"><label>1. Academic week<select value={selectedWeekId} onChange={(event) => setSelectedWeekId(event.target.value)}>{academicWeeks.map((week) => <option key={week.id} value={week.id}>{week.label}</option>)}</select></label><label>2. Class<select value={selectedClassId} onChange={(event) => { setSelectedClassId(event.target.value); setSlotDrafts({}); setQuizSubjectId(""); }}>{Array.from(new Map(assignments.map((assignment) => [assignment.classId, assignment])).values()).map((assignment) => <option key={assignment.classId} value={assignment.classId}>Grade {assignment.grade} · {assignment.section}</option>)}</select></label><span className={`teacher-timetable-ready ${selectedClassSlots.length > 0 ? "ready" : "missing"}`}>{selectedClassSlots.length > 0 ? `${selectedClassSlots.length} lessons ready for this week` : "Timetable connection required"}</span></div>
          <div className={`weekly-builder-days days-${activeDayIndexes.length}`}>{activeDayIndexes.map((index) => { const day = dayNames[index]; const daySlots = selectedClassSlots.filter((slot) => slot.day_of_week === index); return <section className="weekly-builder-day" key={day}><header><strong>{day}</strong><small>{daySlots.length} lesson{daySlots.length === 1 ? "" : "s"}</small></header>{daySlots.map((slot) => { const assignment = assignmentForSlot(slot); const draft = slotDraftFor(slot); const isEnglish = englishSubjectNames.has(assignment?.subject ?? ""); return <article key={slot.id}><header><span>Period {slot.period_number}</span><strong>{assignment?.subject ?? "Subject"}</strong></header>{assignment?.subject === "Integrated Science" && <label>Science component<select value={draft.scienceComponent} onChange={(event) => updateSlotDraft(slot.id, "scienceComponent", event.target.value)}><option value="">Select Chemistry, Physics or Biology</option>{scienceComponents.map((component) => <option key={component} value={component}>{component}</option>)}</select></label>}{isEnglish && <label>English programme<select value={draft.englishProgramme || defaultEnglishProgramme(assignment?.grade ?? 0, assignment?.subject ?? "")} onChange={(event) => updateSlotDraft(slot.id, "englishProgramme", event.target.value)}>{englishProgrammesForGrade(assignment?.grade ?? 0).map((programme) => <option key={programme} value={programme}>{programme}</option>)}</select></label>}{isEnglish && <p className="teacher-programme-note">The programme name is added automatically before Classwork.</p>}<label>Classwork<textarea rows={3} value={draft.classwork} onChange={(event) => updateSlotDraft(slot.id, "classwork", event.target.value)} placeholder="Lesson, unit and pages" /></label><label>Homework<textarea rows={3} value={draft.homework} onChange={(event) => updateSlotDraft(slot.id, "homework", event.target.value)} placeholder="Homework for this lesson" /></label><label>Classera notes<textarea rows={3} value={draft.classeraNotes} onChange={(event) => updateSlotDraft(slot.id, "classeraNotes", event.target.value)} placeholder="Reminder or materials" /></label></article>})}</section>})}</div>
          <section className="weekly-builder-extra"><div className="weekly-builder-section-heading"><div><span>QZ</span><div><strong>Quiz or assessment</strong><small>Choose the subject, then add the quiz for this class.</small></div></div></div><div className="weekly-builder-quiz-row"><label>Subject<select value={quizSubjectId} onChange={(event) => setQuizSubjectId(event.target.value)}><option value="">Select subject</option>{selectedClassAssignments.map((assignment) => <option key={assignment.subjectId} value={assignment.subjectId}>{assignment.subject}</option>)}</select></label><label>Quiz day<select value={quizDay} onChange={(event) => setQuizDay(event.target.value)}>{dayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>Quiz details<input value={quizDetails} onChange={(event) => setQuizDetails(event.target.value)} placeholder="Title, scope or revision pages" /></label></div></section>
          <section className="weekly-builder-extra"><div className="weekly-builder-section-heading"><div><span>NT</span><div><strong>Weekly notes for families</strong><small>Spelling words, reminders or important announcements.</small></div></div></div><textarea className="weekly-builder-notes" rows={3} value={weeklyNote} onChange={(event) => setWeeklyNote(event.target.value)} placeholder="Weekly notes" /></section>
          <div className="teacher-editor-footer"><span>{selectedClassSlots.length > 0 ? "Every card is one of your real timetable lessons. Save once when the whole class week is ready." : "Saving is blocked until the timetable is connected."}</span><div><button disabled={saving} type="button" className="teacher-secondary-button" onClick={() => setWeeklyBuilderOpen(false)}>Cancel</button><button disabled={saving || selectedClassSlots.length === 0} type="button" className="teacher-secondary-button" onClick={() => void saveWholeWeek(false)}>Save draft</button><button disabled={saving || selectedClassSlots.length === 0} className="teacher-primary-button" type="submit">{saving ? "Saving…" : "Submit for review"}</button></div></div>
        </form>
      </section></div>}
    </main>
  );
}
