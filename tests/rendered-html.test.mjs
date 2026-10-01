import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../out/", import.meta.url);

test("renders the parent-facing homepage", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");

  assert.match(html, /ALANDALUS PRIVATE SCHOOLS/);
  assert.match(html, /One clear plan/);
  assert.match(html, /Find your weekly plan/);
  assert.doesNotMatch(html, /teacher login|create teacher account/i);
});

test("teacher editor never hydrates or overwrites another teacher's displaced lesson", async () => {
  const source = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");

  assert.match(source, /\.eq\("plan_entries\.teacher_id", profileId\)/);
  assert.match(source, /entry\.teacher_id === profileId && entry\.subject_id === slot\.subject_id && entry\.timetable_slot_id === slot\.id/);
  assert.match(source, /entry\.teacher_id === profileId && entry\.subject_id === slot\.subject_id && entry\.day_of_week === slot\.day_of_week/);
  assert.match(source, /const conflictingSlot = writableSlots\.find/);
  assert.match(source, /entry\.teacher_id !== profileId \|\| entry\.subject_id !== slot\.subject_id/);
  assert.match(source, /لن تُستبدل خطة المعلم الآخر/);
});

test("renders published timetable lessons in merged school-day groups", async () => {
  const source = await readFile(new URL("../app/weekly-plan/page.tsx", import.meta.url), "utf8");

  assert.match(source, /const dayNames = \["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"\]/);
  for (const day of ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]) {
    assert.match(source, new RegExp(day));
  }
  assert.match(source, /weekly-day-group/);
  assert.match(source, /className="day-cell" rowSpan=\{lessons\.length\}/);
  assert.match(source, /eq\("status", "published"\)/);
  assert.match(source, /plan_quizzes/);
});

test("shows real academic-week dates and keeps long parent-plan text readable", async () => {
  const parentSource = await readFile(new URL("../app/weekly-plan/page.tsx", import.meta.url), "utf8");
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const finderSource = await readFile(new URL("../app/home-plan-finder.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(parentSource, /formatAcademicWeekRange/);
  assert.match(parentSource, /academic_weeks!inner\(week_number, label, starts_on, ends_on, parent_portal_visible\)/);
  assert.match(teacherSource, /academicWeekRange\(selectedWeek/);
  assert.match(finderSource, /academic_weeks!inner\(week_number, label, starts_on, ends_on, parent_portal_visible\)/);
  assert.match(styles, /\.weekly-table \{[^}]*table-layout: fixed/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /\.weekly-table td:not\(\.day-cell\):not\(\.course-cell\) \{ font-size: 11px/);
  assert.match(styles, /\.weekly-day-group:nth-of-type\(5\)/);
});

test("uses the supplied full-colour school logo across the platform", async () => {
  const pages = [
    "../app/page.tsx",
    "../app/weekly-plan/page.tsx",
    "../app/timetable/page.tsx",
    "../app/support/page.tsx",
    "../app/teachers/page.tsx",
    "../app/teachers/login/page.tsx",
    "../app/admin/page.tsx",
    "../app/super-admin/page.tsx",
  ];

  for (const page of pages) {
    const source = await readFile(new URL(page, import.meta.url), "utf8");
    assert.match(source, /school-logo\.png/);
    assert.doesNotMatch(source, /school-logo\.jpeg/);
  }
});

test("gives Super Admin independent teacher-entry and parent-visibility controls per week", async () => {
  const superAdminSource = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const parentSource = await readFile(new URL("../app/weekly-plan/page.tsx", import.meta.url), "utf8");
  const finderSource = await readFile(new URL("../app/home-plan-finder.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260921002000_add_academic_week_visibility_controls.sql", import.meta.url), "utf8");

  assert.match(superAdminSource, /Week Visibility Control/);
  assert.match(superAdminSource, /updateAcademicWeekVisibility/);
  assert.match(superAdminSource, /teacher_entry_enabled/);
  assert.match(superAdminSource, /parent_portal_visible/);
  assert.match(teacherSource, /weeks\.filter\(\(week\) => week\.teacher_entry_enabled\)/);
  assert.match(teacherSource, /teacherEntryWeeks\.map/);
  assert.match(parentSource, /eq\("academic_weeks\.parent_portal_visible", true\)/);
  assert.match(finderSource, /eq\("academic_weeks\.parent_portal_visible", true\)/);
  assert.match(migration, /add column if not exists teacher_entry_enabled boolean not null default true/);
  assert.match(migration, /add column if not exists parent_portal_visible boolean not null default true/);
  assert.match(migration, /enforce_teacher_entry_week/);
  assert.match(migration, /reviews of other teachers remain available/);
  assert.doesNotMatch(migration, /delete from public\.weekly_plans/);
});

test("keeps parent-plan reads anonymous and refreshes stale public data", async () => {
  const clientSource = await readFile(new URL("../lib/supabase/client.ts", import.meta.url), "utf8");
  const parentSource = await readFile(new URL("../app/weekly-plan/page.tsx", import.meta.url), "utf8");
  const finderSource = await readFile(new URL("../app/home-plan-finder.tsx", import.meta.url), "utf8");
  const superAdminSource = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");
  const publicRlsMigration = await readFile(new URL("../supabase/migrations/20260922094500_fix_anonymous_parent_plan_content_rls.sql", import.meta.url), "utf8");

  assert.match(clientSource, /export function getSupabasePublicClient/);
  assert.match(clientSource, /persistSession: false/);
  assert.match(clientSource, /autoRefreshToken: false/);
  assert.match(clientSource, /detectSessionInUrl: false/);
  assert.match(parentSource, /getSupabasePublicClient/);
  assert.doesNotMatch(parentSource, /getSupabaseBrowserClient/);
  assert.match(parentSource, /visibilitychange/);
  assert.match(parentSource, /Refresh plans/);
  assert.match(finderSource, /getSupabasePublicClient/);
  assert.match(finderSource, /visibilitychange/);
  assert.match(superAdminSource, /select\("id, teacher_entry_enabled, parent_portal_visible"\)/);
  assert.match(superAdminSource, /savedWeek\[field\] !== value/);
  assert.match(publicRlsMigration, /security definer/);
  assert.match(publicRlsMigration, /private\.parent_can_read_approved_plan_content/);
  assert.match(publicRlsMigration, /revoke all on function private\.parent_can_read_approved_plan_content/);
  assert.match(publicRlsMigration, /grant execute on function private\.parent_can_read_approved_plan_content/);
  assert.doesNotMatch(publicRlsMigration, /grant select on public\.plan_submissions to anon/);
});

test("renders teacher sign in and account creation entry point", async () => {
  const html = await readFile(
    new URL("teachers/login/index.html", outputRoot),
    "utf8",
  );

  assert.match(html, /Sign In/);
  assert.match(html, /Create New Account/);
  assert.match(html, /Username/);
  assert.match(html, /Plus\+Jakarta\+Sans/);
});

test("loads the approved staff directory and defers class assignments to Super Admin", async () => {
  const source = await readFile(
    new URL("../app/teachers/login/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /from\("staff_directory"\)/);
  assert.match(source, /registration_requests/);
  assert.match(source, /waiting for Super Admin approval/i);
  assert.match(source, /Account Type/);
  assert.match(source, />Teacher</);
  assert.match(source, />Admin</);
  assert.doesNotMatch(source, /Add Assignment/);
  assert.doesNotMatch(source, /Class A/);
  assert.doesNotMatch(source, /Class B/);
});

test("connects the teacher workspace to approved Supabase data", async () => {
  const source = await readFile(
    new URL("../app/teachers/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /from\("teacher_assignments"\)/);
  assert.match(source, /from\("academic_weeks"\)/);
  assert.match(source, /from\("timetable_slots"\)/);
  assert.match(source, /from\("plan_entries"\)[\s\S]*\.upsert\(entryRows/);
  assert.match(source, /from\("plan_quizzes"\)/);
  assert.match(source, /from\("plan_notes"\)/);
  assert.match(source, /Timetable connection required/);
  assert.doesNotMatch(source, /Changes in this prototype are not saved/);
});

test("replaces family notes with English-only dictation words above the parent plan", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const parentSource = await readFile(new URL("../app/weekly-plan/page.tsx", import.meta.url), "utf8");

  assert.match(teacherSource, /departmentName === "English Department"/);
  assert.match(teacherSource, /English Dictation Words/);
  assert.match(teacherSource, /encodeEnglishDictation\(dictationDay, dictationWords\)/);
  assert.doesNotMatch(teacherSource, />Weekly notes for families</);
  assert.doesNotMatch(teacherSource, />Quiz or assessment</);
  assert.match(parentSource, /Vocabulary for Dictation on/);
  assert.match(parentSource, /parent-dictation-block/);
  assert.ok(parentSource.indexOf("liveDictations.map") < parentSource.indexOf('<div className="table-wrap">'));
  assert.doesNotMatch(parentSource, /Weekly Notes for Families/);
});

test("adds fixed Quran, Swimming and PE rows only to published parent plans", async () => {
  const source = await readFile(
    new URL("../app/weekly-plan/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /quran: \{ course: "Quran", classwork: "المدرسة القرآنية - حفظ كتاب الله" \}/);
  assert.match(source, /swimming: \{ course: "Swimming", classwork: "School swimming pool" \}/);
  assert.match(source, /pe: \{ course: "PE", classwork: "School playground" \}/);
  assert.match(source, /from\("timetable_slots"\)/);
  assert.match(source, /eq\("status", "published"\)/);
  assert.match(source, /a\.day_of_week - b\.day_of_week \|\| a\.period_number - b\.period_number/);
});

test("uses the high-readability teacher typography scale", async () => {
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /High-readability type scale/);
  assert.match(css, /\.teacher-portal, \.teacher-auth-page[\s\S]*font-size: 18px/);
  assert.match(css, /\.teacher-auth-assignment-row select \{[^}]*font-size: 14px/);
  assert.match(css, /\.teacher-plan-table \{[^}]*font-size: 13px/);
});

test("renders the read-only administrator published-plan report", async () => {
  const html = await readFile(
    new URL("admin/index.html", outputRoot),
    "utf8",
  );

  assert.match(html, /Administration Reports/);
  assert.match(html, /Published Weekly Plan Report/);
  assert.match(html, /Full published-plan directory/);
  assert.match(html, /Read-only access/);
  assert.match(html, /This account cannot create, edit or submit plans/);
  assert.match(html, /<th>Report<\/th>/);
});

test("opens Super Admin on the weekly overview with account navigation", async () => {
  const html = await readFile(
    new URL("super-admin/index.html", outputRoot),
    "utf8",
  );
  const source = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");

  assert.match(html, /Super Admin Control Center/);
  assert.match(html, /Account Approvals/);
  assert.match(html, /School dashboard/);
  assert.match(html, /Teacher and supervisor achievement/);
  assert.match(html, /View report/);
  assert.match(html, /Manage Public Plans/);
  assert.match(source, /Real school staff directory/);
  assert.match(source, /Loading the real school directory/);
  assert.match(html, /All Accounts/);
  assert.match(html, /Roles &amp; Permissions/);
  assert.match(html, /Classes &amp; Subjects/);
  assert.match(html, /Activity Log/);
  assert.match(html, /System Settings/);
  assert.match(source, /setActiveSection\] = useState<DashboardSection>\("overview"\)/);
  assert.match(source, /if \(requestedSection && allowedSections\.includes\(requestedSection\)\)/);
  assert.doesNotMatch(source, /savedSection && allowedSections/);
  assert.match(source, /تقرير إنجاز المعلمين والمشرفين للأسبوع رقم/);
  assert.match(source, /setReportPending\(true\);\s*const loaded = await loadDashboard\(\)/);
  assert.match(source, /publishedClassPlanCount = weeklyClassCoverage\.filter\(\(coverage\) => coverage\.plan\?\.status === "published"\)\.length/);
  assert.match(source, /parentVisibleClassPlanCount = selectedPlanWeek\?\.parent_portal_visible \? publishedClassPlanCount : 0/);
  assert.match(source, /className="super-overview-visibility-line"/);
});

test("offers two selected-week switches on the Super Admin overview instead of the account stat", async () => {
  const source = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const overview = source.match(/activeSection === "overview" && <div className="super-overview"[\s\S]*?<\/div>\}/)?.[0] ?? "";

  assert.match(overview, /className="super-overview-week-control"/);
  assert.doesNotMatch(overview, /"طلبات حسابات" : "Account requests"/);
  assert.match(overview, /selectedPlanWeek\?\.teacher_entry_enabled/);
  assert.match(overview, /selectedPlanWeek\?\.parent_portal_visible/);
  assert.match(overview, /updateAcademicWeekVisibility\(selectedPlanWeek\.id, "teacher_entry_enabled", next\)/);
  assert.match(overview, /updateAcademicWeekVisibility\(selectedPlanWeek\.id, "parent_portal_visible", next\)/);
  assert.match(source, /role="switch"[\s\S]*aria-checked=\{checked\}/);
  assert.match(source, /const next = event\.clientX < startX/);
  assert.match(styles, /\.super-week-toggle\.is-off \.super-week-toggle-track i/);
  assert.match(styles, /\.super-overview-stats article\.super-overview-week-control \{ grid-column: 1 \/ -1/);
});

test("offers a current-session sign-out button in Super Admin settings", async () => {
  const source = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");
  assert.match(source, /activeSection === "settings"[\s\S]*?super-signout-card/);
  assert.match(source, /auth\.signOut\(\{ scope: "local" \}\)/);
  assert.match(source, /window\.location\.replace\(`\$\{basePath\}\/teachers\/login\/`\)/);
  assert.match(source, /if \(error\) throw error/);
  assert.match(source, /dashboardArabic \? "تسجيل الخروج" : "Sign out"/);
});

test("keeps the achievement report readable with separate completed and incomplete class rows", async () => {
  const source = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const report = source.split("{achievementReport && (")[1]?.split("{bulkPublishConfirmationOpen")[0] ?? "";

  assert.match(report, /super-report-class-line done/);
  assert.match(report, /super-report-class-line pending/);
  assert.match(report, /teacher\.completedClasses\.map/);
  assert.match(report, /teacher\.sentWithGapsClasses\.map/);
  assert.match(report, /teacher\.incompleteClasses\.map/);
  assert.match(report, /super-report-class-line sent-with-gaps/);
  assert.doesNotMatch(report, /teacher\.department|supervisor\.department|supervisor\.teacherNames/);
  assert.match(css, /\.super-report-paper table \{ table-layout: fixed; font-size: 13px; \}/);
  assert.match(css, /\.super-report-class-line\.done \{ background:/);
  assert.match(css, /\.super-report-class-line\.sent-with-gaps \{ background:/);
  assert.match(css, /\.super-report-class-line\.pending \{ background:/);
});

test("keeps weekly teacher percentages intact while separating sent plans with empty lessons", async () => {
  const source = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");
  const report = source.split("{achievementReport && (")[1]?.split("{bulkPublishConfirmationOpen")[0] ?? "";
  assert.match(source, /const sentWithGapsRows = rows\.filter\(\(row\) => !isCompleted\(row\) && hasSentAllClassSubjects\(row\)\)/);
  assert.match(source, /subjectIds\.size > 0 && \[\.\.\.subjectIds\]\.every/);
  assert.match(source, /sentWithGapsClasses: sentWithGapsRows\.map/);
  assert.match(source, /incompleteClasses: rows\.filter\(\(row\) => !isCompleted\(row\) && !sentWithGapsKeys\.has\(row\.key\)\)/);
  assert.match(source, /const percent = lessonCompletionPercent\(lessonProgress\.completed, lessonProgress\.total\)/);
  assert.match(source, /percent > 0 \|\| sentWithGapsRows\.length > 0 \? "مكتمل جزئيًا"/);
  assert.match(report, /<th>المعلم<\/th><th>فصول المعلم<\/th><th>المنجز<\/th><th>النسبة<\/th><th>الحالة<\/th>/);
});

test("counts supervisor achievement from received teacher-class plans only", async () => {
  const { supervisorReportProgress } = await import("../lib/supervisor-report-progress.ts");
  const plans = new Map([["5A", "week5-5A"], ["5B", "week5-5B"], ["6A", "week5-6A"]]);
  const rows = [
    { classId: "5A", teacherId: "teacher-1", subjectIds: ["Arabic", "Religion"] },
    { classId: "5B", teacherId: "teacher-1", subjectIds: ["Arabic"] },
    { classId: "6A", teacherId: "teacher-2", subjectIds: ["English"] },
  ];
  const submissions = [
    { weeklyPlanId: "week5-5A", teacherId: "teacher-1", subjectId: "Arabic", status: "approved", reviewedAt: "2026-09-29T10:00:00Z" },
    { weeklyPlanId: "week5-5A", teacherId: "teacher-1", subjectId: "Religion", status: "approved", reviewedAt: "2026-09-29T11:00:00Z" },
    { weeklyPlanId: "week5-5B", teacherId: "teacher-1", subjectId: "Arabic", status: "draft", reviewedAt: null },
  ];

  assert.deepEqual(supervisorReportProgress(rows, plans, submissions), {
    approved: 1, total: 1, percent: 100, lastApproval: "2026-09-29T11:00:00Z",
  });
  assert.deepEqual(supervisorReportProgress(rows, plans, submissions.slice(2)), {
    approved: 0, total: 0, percent: null, lastApproval: null,
  });

  const partlyReviewed = [submissions[0], { ...submissions[1], status: "changes_requested", reviewedAt: null }, submissions[2]];
  assert.deepEqual(supervisorReportProgress(rows, plans, partlyReviewed), {
    approved: 0, total: 1, percent: 0, lastApproval: "2026-09-29T10:00:00Z",
  });

  const pending = [...submissions.slice(0, 2), { ...submissions[2], status: "submitted" }];
  assert.deepEqual(supervisorReportProgress(rows, plans, pending), {
    approved: 1, total: 2, percent: 50, lastApproval: "2026-09-29T11:00:00Z",
  });
});

test("loads every plan-content page and separates supervisor approval from full-week completion", async () => {
  const source = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");
  const language = await readFile(new URL("../app/language-switcher.tsx", import.meta.url), "utf8");

  assert.match(source, /from\("plan_entries"\)[\s\S]*?\.order\("id"\)\.range\(offset, offset \+ 499\)/);
  assert.match(source, /from\("plan_submissions"\)[\s\S]*?\.order\("id"\)\.range\(offset, offset \+ 499\)/);
  assert.match(source, /if \(page\.length < pageSize\) return rows/);
  assert.match(source, /requirements\.every\(\(requirement\) => writtenSlots\.has/);
  assert.match(source, /hasCompletedTeachingWeek\(plan\?\.id, teacherId/);
  assert.match(source, /teacher\.role === "Admin" \? "Automatic approval \(supervisor plan\)"/);
  assert.match(source, /بعض حصص المعلم في هذا الأسبوع ما زالت فارغة/);
  assert.match(language, /"Automatic approval \(supervisor plan\)": "اعتماد تلقائي لخطة المشرف"/);
});

test("saves teacher assignments immediately and enforces English programme grades", async () => {
  const superAdminSource = await readFile(
    new URL("../app/super-admin/page.tsx", import.meta.url),
    "utf8",
  );
  const programmeSql = await readFile(
    new URL("../supabase/update_english_programmes.sql", import.meta.url),
    "utf8",
  );

  assert.match(superAdminSource, /Add & save assignment/);
  assert.match(superAdminSource, /saved to Supabase immediately/);
  assert.match(superAdminSource, /from\("teacher_assignments"\)\.insert/);
  assert.match(programmeSql, /\('english', 'English'.*1, 6\)/);
  assert.match(programmeSql, /\('connect_plus', 'Connect Plus'.*1, 6\)/);
  assert.match(programmeSql, /\('hello', 'English Hello'.*7, 10\)/);
  assert.match(programmeSql, /\('hello_plus', 'Hello Plus'.*7, 10\)/);
  assert.match(programmeSql, /\('discover', 'Discover'.*1, 3\)/);
});

test("adds a department-supervisor review workflow without removing the supervisor teaching workspace", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const loginSource = await readFile(new URL("../app/teachers/login/page.tsx", import.meta.url), "utf8");
  const workflowSql = await readFile(new URL("../supabase/20260802_supervisor_workflow.sql", import.meta.url), "utf8");

  assert.match(teacherSource, /Teacher Reviews/);
  assert.match(teacherSource, /plan_submissions/);
  assert.match(teacherSource, /review_plan_submission/);
  assert.match(teacherSource, /Send to supervisor for approval/);
  assert.match(teacherSource, /Waiting for supervisor approval/);
  assert.match(teacherSource, /Approve whole plan/);
  assert.match(teacherSource, /See your linked teachers and their class and subject assignments/);
  assert.match(loginSource, /administrative_role/);
  assert.match(loginSource, /isSupervisor/);
  assert.match(workflowSql, /create table if not exists public\.plan_submissions/);
  assert.match(workflowSql, /is_department_supervisor_for/);
  assert.match(workflowSql, /review_plan_submission/);
  assert.match(workflowSql, /enable row level security/);
});

test("stores explicit supervisor-to-teacher links for the approved department groups", async () => {
  const linksSql = await readFile(new URL("../supabase/20260802_supervisor_staff_links.sql", import.meta.url), "utf8");

  assert.match(linksSql, /create table if not exists public\.supervisor_staff_links/);
  assert.match(linksSql, /teacher\.department_id = supervisor\.department_id/);
  assert.match(linksSql, /administrative_role like '%Supervisor%'/);
  assert.match(linksSql, /is_department_supervisor_for/);
  assert.match(linksSql, /enable row level security/);
});

test("lets supervisors manage assignments only for their linked department teachers", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const assignmentSql = await readFile(new URL("../supabase/20260802_supervisor_teacher_assignments.sql", import.meta.url), "utf8");

  assert.match(teacherSource, /Department Teachers/);
  assert.match(teacherSource, /Assign to teacher/);
  assert.match(teacherSource, /addDepartmentAssignment/);
  assert.match(assignmentSql, /private\.is_department_supervisor_for\(teacher_id\)/);
  assert.match(assignmentSql, /for insert to authenticated/);
  assert.match(assignmentSql, /for delete to authenticated/);
});

test("keeps supervisor teacher assignments scoped to the selected teacher and reachable on mobile", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(teacherSource, /const addDepartmentAssignment = async \(teacherId: string\)/);
  assert.match(teacherSource, /teacher_id: teacherId/);
  assert.match(teacherSource, /addDepartmentAssignment\(selectedDepartmentTeacher\.userId\)/);
  assert.match(teacherSource, /teacher-mobile-supervisor-nav/);
  assert.match(styles, /\.teacher-mobile-supervisor-nav \{ position: sticky/);
  assert.match(styles, /\.department-teachers-layout, \.department-assignment-picker \{ grid-template-columns: 1fr; \}/);
});

test("keeps weekly-plan creation responsive while data is loading", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");

  assert.match(teacherSource, /if \(loading\)[\s\S]*still loading/);
  assert.match(teacherSource, /const firstAssignment = assignments\.find\(\(assignment\) => assignment\.classId === targetClassId\) \?\? selectedClass \?\? assignments\[0\]/);
  assert.match(teacherSource, /type=\"button\" className=\"teacher-primary-button\" disabled=\{saving[^}]*\}/);
  assert.match(teacherSource, /aria-busy=\{loading\}/);
});

test("publishes approved partial class plans without exposing missing teachers' drafts", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const parentSource = await readFile(new URL("../app/weekly-plan/page.tsx", import.meta.url), "utf8");
  const publishingSql = await readFile(new URL("../supabase/migrations/20260920225647_publish_approved_partial_class_plans.sql", import.meta.url), "utf8");

  assert.match(teacherSource, /Approve every submitted department plan this week/);
  assert.match(teacherSource, /no submitted plan is still waiting for review/);
  assert.match(teacherSource, /missing teachers appear as Plan not published/);
  assert.match(parentSource, /publishedEntryByPeriod/);
  assert.match(parentSource, /classwork: publishedEntry\?\.classwork \|\| "Plan not published"/);
  assert.match(parentSource, /slot\.requires_weekly_plan_submission \|\| !subject\.include_in_weekly_plan/);
  assert.match(publishingSql, /approved_submission\.status = 'approved'/);
  assert.match(publishingSql, /unresolved_submission\.status in \('submitted', 'changes_requested'\)/);
  assert.doesNotMatch(publishingSql, /unresolved_submission\.status in \('draft'/);
  assert.match(publishingSql, /Never publish an empty or completely unstarted class plan/);
  assert.match(publishingSql, /Public reads supervisor-approved plan entries/);
  assert.match(publishingSql, /submission\.teacher_id = plan_entries\.teacher_id/);
  assert.match(publishingSql, /submission\.subject_id = plan_entries\.subject_id/);
  assert.match(publishingSql, /manual_publication_override/);
  assert.match(publishingSql, /select private\.refresh_weekly_plan_publication_state\(id\)/);
});

test("shows submitted content under every Super Admin publication override without approving it", async () => {
  const overrideSql = await readFile(new URL("../supabase/20260930_fix_parent_read_for_super_admin_override.sql", import.meta.url), "utf8");
  const schemaSql = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  const adminSource = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");

  for (const sql of [overrideSql, schemaSql]) {
    assert.match(sql, /plan_record\.status = 'published'/);
    assert.match(sql, /week_record\.parent_portal_visible/);
    assert.match(sql, /submission\.status = 'approved'/);
    assert.match(sql, /plan_record\.manual_publication_override\s+and submission\.status = 'submitted'/);
    assert.doesNotMatch(sql, /submission\.status = 'draft'/);
  }
  assert.match(overrideSql, /create or replace function private\.parent_can_read_approved_plan_content/);
  assert.doesNotMatch(overrideSql, /update public\.(?:weekly_plans|plan_submissions|plan_entries)/);
  assert.match(adminSource, /const publishAllSchoolPlans = async \(\) =>[\s\S]*?supabase\.rpc\("set_weekly_plan_publication_override"/);
  assert.match(adminSource, /const setPlanPublicationOverride = async \(plan: ManagedPlan, shouldPublish: boolean\) =>[\s\S]*?supabase\.rpc\("set_weekly_plan_publication_override"/);
});

test("queues supervisor submission behind autosave and auto-approves supervisors' own lessons", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260919194546_resync_mohamed_hamad_and_autoapprove_supervisor_teaching_plans.sql", import.meta.url), "utf8");

  assert.match(teacherSource, /pendingSupervisorSubmission/);
  assert.match(teacherSource, /if \(saving\) \{[\s\S]*pendingSupervisorSubmission\.current = true/);
  assert.match(teacherSource, /if \(!submitForReview && pendingSupervisorSubmission\.current\)/);
  assert.match(teacherSource, /status: submitForReview \? \(isSupervisor \? "approved" : "submitted"\) : "draft"/);
  assert.match(teacherSource, /reviewed_by: submitForReview && isSupervisor \? profileId : null/);
  assert.match(teacherSource, /disabled=\{(?:saving \|\| )?selectedClassSlots\.length === 0 \|\| builderStatus === "submitted" \|\| builderStatus === "approved"\}/);
  assert.match(migration, /Supervisors create their own approved teaching submissions/);
  assert.match(migration, /teacher_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /reviewed_by = \(select auth\.uid\(\)\)/);
  assert.match(migration, /staff\.administrative_role like '%Supervisor%'/);
  assert.match(migration, /slot\.teacher_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /slot\.subject_id = plan_submissions\.subject_id/);
  assert.match(migration, /plan\.id = plan_submissions\.weekly_plan_id/);
});

test("confirms teacher submission and copies each written subject as an independent draft", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const globalCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(teacherSource, /Confirm plan submission/);
  assert.match(teacherSource, /Plan sent successfully/);
  assert.match(teacherSource, /setSubmissionSuccessOpen\(true\)/);
  assert.match(teacherSource, /finishSuccessfulSubmission[\s\S]*closeWeeklyEditor\(true\)/);
  assert.doesNotMatch(teacherSource, /className="weekly-copy-panel"/);
  assert.match(teacherSource, /const canCopy = \["draft", "changes_requested", "submitted", "approved"\]\.includes\(plan\.status\)/);
  assert.match(teacherSource, /canCopy && <button[\s\S]*openCopyPlanDialog\(plan\)[\s\S]*Copy plan/);
  assert.match(teacherSource, /entry\.weeklyPlanId === copySourcePlan\.planId && entry\.hasMeaningfulContent/);
  assert.match(teacherSource, /const meaningfulSourceRows = [\s\S]*\.filter\(hasMeaningfulPlanContent\)/);
  assert.match(teacherSource, /if \(hasMeaningfulDraft\) \{[\s\S]*setCopyConflict/);
  assert.match(teacherSource, /Open existing draft/);
  assert.doesNotMatch(teacherSource, /Replace my draft/);
  assert.match(teacherSource, /targetStatuses\.has\("submitted"\)/);
  assert.match(teacherSource, /targetStatuses\.has\("approved"\)/);
  assert.match(teacherSource, /status: "draft", submitted_at: null/);
  assert.match(teacherSource, /const englishCopyKey = "__english_plan__"/);
  assert.match(teacherSource, /mapCopyRowsToTargetSlots\(meaningfulSourceRows, targetSlots, isEnglishCopy\)/);
  assert.match(teacherSource, /subject_id: slot\.subject_id/);
  assert.match(teacherSource, /isEnglishCopy \? isEnglishSubject\(assignment\.subject\)/);
  assert.match(globalCss, /teacher-plan-actions \.teacher-secondary-button\.continue[\s\S]*linear-gradient/);
  assert.match(globalCss, /teacher-plan-actions \.teacher-secondary-button\.copy[\s\S]*linear-gradient/);
  assert.match(teacherSource, /setSelectedClassId\(copiedClassId\)[\s\S]*setSelectedWeekId\(copiedWeekId\)[\s\S]*openWeeklyEditor\(\)/);
});

test("keeps teacher and class publication states truthful for partial plans", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const superAdminSource = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260926193000_block_meaningful_drafts_before_partial_publication.sql", import.meta.url), "utf8");

  assert.match(teacherSource, /entryReviewStatus = \(entry: TeacherEntry\)[\s\S]*\?\.status \?\? "draft"/);
  assert.doesNotMatch(teacherSource, /if \(entry\.status === "published"\) existing\.status = "published"/);
  assert.match(teacherSource, /Approved by supervisor/);
  assert.match(superAdminSource, /publicationState: "not_published" \| "partially_published" \| "fully_published"/);
  assert.match(superAdminSource, /Partially published/);
  assert.match(superAdminSource, /Each row reflects that teacher&apos;s own work only/);
  assert.match(superAdminSource, /meaningfulSubmissions\.some\(\(submission\) => submission\.status === "draft"\)/);
  assert.match(migration, /unresolved_submission\.status = 'draft'/);
  assert.match(migration, /btrim\(coalesce\(draft_entry\.classwork, ''\)\) <> ''/);
  assert.match(migration, /select private\.refresh_weekly_plan_publication_state\(id\)[\s\S]*from public\.weekly_plans/);
});

test("rechecks live week access before opening or saving a teacher plan", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");

  assert.match(teacherSource, /verifyTeacherWeekAccess = useCallback/);
  assert.match(teacherSource, /from\("academic_weeks"\)[\s\S]*select\("id, teacher_entry_enabled"\)[\s\S]*\.eq\("id", weekId\)/);
  assert.match(teacherSource, /if \(!\(await verifyTeacherWeekAccess\(selectedWeek\.id\)\)\)/);
  assert.match(teacherSource, /openWeeklyPlan = async[\s\S]*verifyTeacherWeekAccess\(plan\.weekId, false\)/);
  assert.match(teacherSource, /window\.addEventListener\("focus", recheckOpenEditor\)/);
  assert.match(teacherSource, /document\.addEventListener\("visibilitychange", recheckOpenEditor\)/);
  assert.match(teacherSource, /This week is now closed by school administration/);
});

test("repairs stale supervisor submissions and supports one-click approval for the selected week", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260920054000_autoapprove_supervisors_and_add_week_bulk_approval.sql", import.meta.url), "utf8");

  assert.match(teacherSource, /approve_my_week_submissions/);
  assert.match(teacherSource, /item\.weekId === selectedReviewWeekId && item\.status === "submitted"/);
  assert.match(teacherSource, /اعتماد جميع خطط معلمي القسم لهذا الأسبوع/);
  assert.doesNotMatch(teacherSource, /approveAllSelectedClassPlans/);
  assert.match(migration, /create or replace function public\.approve_my_week_submissions/);
  assert.match(migration, /plan\.week_id = target_week_id/);
  assert.doesNotMatch(migration, /plan\.class_id = target_class_id/);
  assert.match(migration, /link\.teacher_staff_id = teacher\.staff_id/);
  assert.match(migration, /staff\.administrative_role like '%Supervisor%'/);
  assert.match(migration, /submission\.teacher_id = supervisor\.user_id[\s\S]*submission\.status = 'submitted'/);
  assert.match(migration, /reviewed_by = submission\.teacher_id/);
  assert.match(migration, /revoke all on function public\.approve_my_week_submissions\(uuid\) from public/);
  assert.match(migration, /grant execute on function public\.approve_my_week_submissions\(uuid\) to authenticated/);
});

test("verifies lesson saves and withdraws the whole teacher plan", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");

  assert.match(teacherSource, /\.upsert\(entryRows,[\s\S]*\.select\("id"\)/);
  assert.match(teacherSource, /savedEntryRows \?\? \[\]\)\.length !== entryRows\.length/);
  assert.match(teacherSource, /\.eq\("weekly_plan_id", submission\.weeklyPlanId\)[\s\S]*\.eq\("teacher_id", profileId\)[\s\S]*\.eq\("status", "submitted"\)[\s\S]*\.select\("id, status"\)/);
  assert.match(teacherSource, /Supabase did not confirm the complete plan withdrawal/);
});

test("keeps Mohamed Hamad's complete verified Grade 4 timetable", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260919194546_resync_mohamed_hamad_and_autoapprove_supervisor_teaching_plans.sql", import.meta.url), "utf8");

  assert.match(migration, /teacher\.username = 'm\.mhamad'/);
  assert.match(migration, /\('4\/A', 'التربية الإسلامية', 4, 6\)/);
  assert.doesNotMatch(migration, /\('4\/A', 'التربية الإسلامية', 4, 5\)/);
  assert.equal((migration.match(/^\s*\('4\/[AB]',/gm) ?? []).length, 20);
});

test("adds Super Admin teacher completion reporting, self password change and bulk weekly publishing", async () => {
  const source = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");
  const languageSource = await readFile(new URL("../app/language-switcher.tsx", import.meta.url), "utf8");

  assert.match(source, /completionPercent: lessonCompletionPercent\(completedLessons, requirements\.length\)/);
  assert.match(source, /schoolWeeklyCompletionPercent = lessonCompletionPercent\(completedLessonTotal, requiredLessonCount\)/);
  assert.match(source, /Selected week:/);
  assert.match(source, /supervisor_staff_links/);
  assert.match(source, /submitted_at, reviewed_at, updated_at/);
  assert.match(source, /Track every teacher plan/);
  assert.match(source, /Waiting for \$\{row\.supervisorName\}/);
  assert.match(source, /View route/);
  assert.match(source, /new Set\(requirements\.map\(\(requirement\) => requirement\.teacherId\)\)/);
  assert.match(source, /submission\.status === "submitted" \|\| submission\.status === "approved"/);
  assert.match(source, /Weekly school publication report/);
  assert.match(source, /Approve & publish all school plans/);
  assert.match(source, /set_weekly_plan_publication_override/);
  assert.match(source, /Change my password/);
  assert.match(source, /current_password: ownPassword\.current/);
  assert.match(languageSource, /"School publication rate": "نسبة النشر على مستوى المدرسة"/);
  assert.match(languageSource, /"School weekly-plan completion": "نسبة إنجاز الخطة الأسبوعية للمدرسة"/);
  assert.match(languageSource, /"Approve & publish all school plans": "اعتماد ونشر جميع خطط المدرسة"/);
  assert.match(languageSource, /"All sections": "كل الشعب"/);
  assert.match(languageSource, /"Change my password": "تغيير كلمة المرور"/);
  assert.match(languageSource, /"Track every teacher plan": "متابعة مسار خطة كل معلم"/);
  assert.match(languageSource, /في انتظار اعتماد/);
});

test("adds French and the new English-department teachers", async () => {
  const migration = await readFile(
    new URL("../supabase/20260804_add_french_and_english_staff.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /'french',\s*\n\s*'French'/);
  assert.match(migration, /'اللغة الفرنسية'/);
  assert.match(migration, /\n\s*5,\s*\n\s*10,/);
  assert.match(migration, /'محمد النمر'/);
  assert.match(migration, /'أسامة حسن'/);
  assert.match(migration, /supervisor\.full_name = 'محمود حلمي'/);
});

test("routes Moamen El Haddad submissions to Mahmoud Helmy", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260919200946_link_moamen_to_mahmoud_helmy.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /teacher\.username = 'moamen'/);
  assert.match(migration, /supervisor\.username = 'mhelmy'/);
  assert.match(migration, /teacher\.role = 'teacher'/);
  assert.match(migration, /supervisor\.role = 'admin'/);
  assert.match(migration, /insert into public\.supervisor_staff_links/);
  assert.match(migration, /on conflict \(supervisor_staff_id, teacher_staff_id\) do nothing/);
});

test("keeps the Super Admin section on refresh and exposes every section on mobile", async () => {
  const source = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");

  assert.match(source, /const requestedSection = new URLSearchParams\(window\.location\.search\)\.get\("section"\)/);
  assert.match(source, /url\.searchParams\.set\("section", section\)/);
  assert.match(source, /aria-label="Open navigation"/);
  assert.match(source, /teacher-mobile-menu/);
  assert.match(source, /Mobile Super administrator navigation/);
  assert.match(source, /openSection\("settings"\)/);
});

test("removes untimetabled classes from Super Admin selectors without deleting class records", async () => {
  const source = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");

  assert.match(source, /const timetabledClassIds = new Set/);
  assert.match(source, /filter\(\(schoolClass\) => timetabledClassIds\.has\(String\(schoolClass\.id\)\)\)/);
  assert.doesNotMatch(source, /from\("school_classes"\)\.delete/);
});

test("uses a lightweight one-day-at-a-time weekly editor on mobile", async () => {
  const source = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");

  assert.match(source, /matchMedia\("\(max-width: 760px\)"\)/);
  assert.match(source, /visibleBuilderDayIndexes/);
  assert.match(source, /weekly-builder-mobile-days/);
  assert.match(source, /setSelectedBuilderDay\(index\)/);
});

test("lets supervisors jump directly to submitted plans in the selected week", async () => {
  const source = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");

  assert.match(source, /const selectedWeekWaitingReviews = reviewItems\.filter/);
  assert.match(source, /const openSelectedWeekWaitingReview = \(\) =>/);
  assert.match(source, /انتقل إلى خطة تنتظر مراجعتك/);
  assert.match(source, /nextReview\.classId/);
});

test("organizes teacher and supervisor home around the selected week and personal timetable", async () => {
  const source = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /const dashboardPlans = weeklyPlanRows\.filter\(\(plan\) => plan\.weekId === dashboardWeekId\)/);
  assert.match(source, /const dashboardWeeks = academicWeeks\.filter\(\(week\) => week\.teacher_entry_enabled/);
  assert.match(source, /const dashboardWaitingReviews = waitingReviews\.filter\(\(review\) => review\.weekId === dashboardWeekId\)/);
  assert.match(source, /const missingTeacherClassPlans = departmentTeachers\.flatMap/);
  assert.match(source, /id="staff-missing-teachers"/);
  assert.match(source, /eq\("teacher_id", userData\.user\.id\)\.order\("day_of_week"\)\.order\("period_number"\)/);
  assert.match(source, /activeNav === "My Timetable"/);
  assert.match(source, /كل الفصول والشعب/);
  assert.match(source, /openWeeklyPlan\(plan\)/);
  assert.match(styles, /\.staff-dashboard-hero/);
  assert.match(styles, /\.staff-timetable-grid/);
  assert.match(styles, /\.staff-supervisor-followup/);
});

test("shows missing Classwork alerts separately for teachers and supervisors without changing plan status", async () => {
  const source = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /assignedPlanSlotsForWeek\(timetableSlots, assignments, profileId, plan\.classId, week, schoolHolidays\)/);
  assert.match(source, /!holidays\.some\(\(holiday\) => holiday\.week_id === week\?\.id/);
  assert.match(source, /entry\.hasClasswork/);
  assert.match(source, /const incompleteSupervisedPlanMap = new Map/);
  assert.match(source, /slot\.subject_id === review\.subjectId/);
  assert.match(source, /incompleteOwnPlans\.length > 0 \|\| incompleteSupervisedPlans\.length > 0/);
  assert.match(source, /openIncompleteOwnPlan\(plan\)/);
  assert.match(source, /if \(allSubjectsApproved\) return "edit_approved"/);
  assert.match(source, /action === "complete" && plan\.status === "approved"\) void openWeeklyBuilder\(plan\.weekId, plan\.classId\)/);
  assert.match(source, /openIncompleteSupervisedPlan\(item\.classId\)/);
  assert.match(styles, /\.staff-attention-panel/);
});

test("keeps staff sessions and dashboard history intact when using browser back", async () => {
  const dashboard = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const login = await readFile(new URL("../app/teachers/login/page.tsx", import.meta.url), "utf8");

  assert.match(dashboard, /window\.history\.pushState\(\{ staffSection: label \}/);
  assert.match(dashboard, /window\.addEventListener\("popstate", restoreLocation\)/);
  assert.match(dashboard, /window\.history\.pushState\(\{ staffEditor: true \}/);
  assert.match(dashboard, /const closeWeeklyEditor = useCallback/);
  assert.match(dashboard, /if \(userError\) throw userError;\s*if \(!userData\.user\)/);
  assert.match(login, /async function restoreSignedInStaff\(\)/);
  assert.match(login, /window\.addEventListener\("pageshow", restoreFromBrowserCache\)/);
  assert.match(login, /window\.location\.replace\(`\$\{basePath\}\$\{destination\}`\)/);
});

test("localizes the academic-week visibility controls in Arabic", async () => {
  const source = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");

  assert.match(source, /التحكم في الأسابيع الدراسية/);
  assert.match(source, /dashboardArabic \? "إظهار الأسابيع" : "Week Visibility"/);
  assert.match(source, /إدخال خطة المعلمين/);
  assert.match(source, /منصة ولي الأمر/);
});

test("keeps the class report focused by hiding department names below each class", async () => {
  const source = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /className="super-plan-class-departments"/);
  assert.match(source, /<strong>Grade \{coverage\.grade\} · \{coverage\.section\}<\/strong><\/td>/);
});

test("right-aligns the Super Admin page heading in Arabic only", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /\.arabic-ui \.super-admin-portal \.teacher-page-heading \{ direction: rtl; \}/);
  assert.match(styles, /\.arabic-ui \.super-admin-portal \.teacher-page-heading > div:first-child \{ width: 100%; margin-inline-start: auto; text-align: right; \}/);
});

test("keeps the class publication table inside the page without a horizontal scrollbar", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /\.super-plan-report-card \.super-admin-table-wrap \{ overflow-x: hidden; \}/);
  assert.match(styles, /\.super-plan-report-table \{ min-width: 0; table-layout: fixed; \}/);
  assert.match(styles, /\.super-plan-report-table \.super-row-actions \{ display: grid;/);
});

test("offers explicit owner-only approved corrections without reopening normal drafts", async () => {
  const teacher = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260929120000_allow_owner_published_plan_corrections.sql", import.meta.url), "utf8");
  const approvedMigration = await readFile(new URL("../supabase/migrations/20260929180000_allow_approved_unpublished_plan_corrections.sql", import.meta.url), "utf8");

  assert.match(teacher, /plan\.status === "approved" && weeklyPlanCreationOpen/);
  assert.match(teacher, /"تعديل الخطة المعتمدة"/);
  assert.match(teacher, /if \(!weeklyBuilderOpen \|\| weeklyBuilderReadOnly \|\| publishedEditPlanId \|\|/);
  assert.match(teacher, /\.rpc\("update_my_published_plan"/);
  assert.match(teacher, /"Save changes"/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /submission\.status = 'approved'/);
  assert.match(migration, /plan_record\.status = 'published'/);
  assert.match(migration, /revoke all on function public\.update_my_published_plan/);
  assert.doesNotMatch(migration, /update public\.plan_submissions/);
  assert.match(approvedMigration, /plan_record\.status in \('draft', 'published'\)/);
  assert.match(approvedMigration, /security invoker/);
  assert.doesNotMatch(approvedMigration, /update public\.plan_submissions/);
});

test("removes dictation from approved plans without rewriting unchanged lessons", async () => {
  const source = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  assert.match(source, /approvedLessonSnapshot\.current\[slot\.id\]/);
  assert.match(source, /if \(lessonsUnchanged && dictationNote === ""\)/);
  assert.match(source, /\.delete\(\)\.in\("id", dictationIds\)\.eq\("weekly_plan_id", publishedEditPlanId\)\.eq\("teacher_id", profileId\)\.select\("id"\)/);
  assert.match(source, /deletedNotes\?\.length !== dictationIds\.length/);
  assert.match(source, /"message" in error && typeof error\.message === "string"/);
});

test("guards closed-week note edits without reading lesson-only record fields", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20261001120000_fix_closed_week_note_trigger.sql", import.meta.url), "utf8");
  assert.match(migration, /if tg_table_name = 'plan_entries' then[\s\S]*?old\.timetable_slot_id[\s\S]*?elsif tg_table_name = 'plan_notes' then/);
  assert.doesNotMatch(migration, /if tg_table_name = 'plan_entries' and tg_op = 'UPDATE'/);
  assert.match(migration, /submission\.status = 'approved'/);
  assert.match(migration, /raise exception 'This academic week is closed for teacher entry\.'/);
});

test("warns before sending missing Classwork and keeps the report design while recalculating percentages", async () => {
  const teacher = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const admin = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");

  assert.match(teacher, /missingClassworkSlots = editableClassSlots\.filter/);
  assert.match(teacher, /العودة لاستكمال الخطة/);
  assert.match(teacher, /إرسال للمشرف على أي حال/);
  assert.match(admin, /hasClasswork: String\(entry\.classwork \?\? ""\)\.trim\(\)\.length > 0/);
  assert.match(admin, /completedLessonCount\(/);
  assert.match(admin, /overviewTeacherGaps/);
  assert.match(admin, /overviewSupervisorGaps/);
  assert.match(admin, /super-report-class-line done/);
  assert.match(admin, /super-report-class-line pending/);
});

test("scopes Mohamed Farid announcements and quizzes and puts public extras above the timetable", async () => {
  const admin = await readFile(new URL("../app/super-admin/page.tsx", import.meta.url), "utf8");
  const teacher = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const parent = await readFile(new URL("../app/weekly-plan/page.tsx", import.meta.url), "utf8");
  const quizzes = await readFile(new URL("../app/teachers/farid-quizzes-panel.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20261001150000_farid_announcements_and_quizzes.sql", import.meta.url), "utf8");

  assert.match(admin, /ownerProfile\.username === "mohamed\.farid"/);
  assert.match(admin, /activeSection === "announcements" && isFaridSuperAdmin/);
  assert.match(teacher, /profile\.role === "teacher" && profile\.username === "mrmahmd"/);
  assert.match(teacher, /activeNav === "Quizzes" && isFaridTeacher/);
  assert.match(quizzes, /programme === "English OL" \? "English OL" : "English AL"/);
  assert.match(parent, /<ParentSpecialExtras[^>]+\/>\{liveDictations\.map/);
  assert.match(migration, /alter table public\.weekly_plan_announcements enable row level security/);
  assert.match(migration, /alter table public\.farid_weekly_quizzes enable row level security/);
  assert.match(migration, /private\.parent_can_read_approved_plan_content/);
  assert.match(migration, /profile\.username = 'mohamed\.farid'/);
  assert.match(migration, /profile\.username = 'mrmahmd'/);
});

test("allows a separate announcement for each school day in a compact parent table", async () => {
  const admin = await readFile(new URL("../app/super-admin/announcements-panel.tsx", import.meta.url), "utf8");
  const parent = await readFile(new URL("../app/weekly-plan/parent-special-extras.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20261001180000_announcement_days.sql", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(admin, /onConflict: "week_id,class_id,day_of_week"/);
  assert.match(admin, /item\.day_of_week === day/);
  assert.match(parent, /\.order\("day_of_week"\)/);
  assert.match(parent, /<h3>Announcement<\/h3><table><thead><tr><th>Day<\/th><th>Details<\/th>/);
  assert.match(migration, /unique index if not exists weekly_plan_announcements_week_class_day_key/);
  assert.match(migration, /check \(day_of_week between 0 and 4\)/);
  assert.match(styles, /\.plan-paper \.parent-announcement-block h3 \{[^}]*font-size: 21px;[^}]*text-align: center/);
  assert.match(styles, /\.plan-paper \.parent-announcement-block th \{[^}]*text-align: center/);
  assert.match(parent, /compactAnnouncementText\(announcement\.body\)/);
  assert.match(admin, /className="farid-feature-edit" onClick=\{\(\) => edit\(item\)\}/);
  assert.match(admin, /\.update\(\{ class_id: classId, day_of_week: day, title: title\.trim\(\), body: body\.trim\(\)/);
  assert.match(admin, /\.eq\("id", editingId\)\.eq\("created_by", adminId\)\.eq\("week_id", weekId\)\.select\("id"\)\.single\(\)/);
});

test("places Mohamed Farid's quizzes inside the selected weekly editor", async () => {
  const teacher = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const quizzes = await readFile(new URL("../app/teachers/farid-quizzes-panel.tsx", import.meta.url), "utf8");

  assert.match(teacher, /isFaridTeacher && <FaridQuizzesPanel[^>]*contextWeekId=\{selectedWeekId\} contextClassId=\{selectedClassId\} embedded readOnly=\{weeklyBuilderReadOnly\}/);
  assert.match(quizzes, /const selectedWeekId = contextWeekId \?\? weekId/);
  assert.match(quizzes, /const selectedClassId = contextClassId \?\? classId/);
  assert.match(quizzes, /!embedded && <label>\{arabic \? "الأسبوع"/);
  assert.match(quizzes, /if \(readOnly\) return/);
  assert.match(quizzes, /Save quiz/);
});
