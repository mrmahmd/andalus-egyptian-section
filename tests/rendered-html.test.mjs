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

test("renders the Super Admin account approval center", async () => {
  const html = await readFile(
    new URL("super-admin/index.html", outputRoot),
    "utf8",
  );

  assert.match(html, /Super Admin Control Center/);
  assert.match(html, /Account Approvals/);
  assert.match(html, /Live school directory/);
  assert.match(html, /Manage Public Plans/);
  assert.match(html, /Real school staff directory/);
  assert.match(html, /Loading the real school directory/);
  assert.match(html, /All Accounts/);
  assert.match(html, /Roles &amp; Permissions/);
  assert.match(html, /Classes &amp; Subjects/);
  assert.match(html, /Activity Log/);
  assert.match(html, /System Settings/);
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
  assert.match(teacherSource, /Manage only the teachers assigned to your supervision group/);
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
  assert.match(teacherSource, /const firstAssignment = selectedClass \?\? assignments\[0\]/);
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

test("queues supervisor submission behind autosave and auto-approves supervisors' own lessons", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260919194546_resync_mohamed_hamad_and_autoapprove_supervisor_teaching_plans.sql", import.meta.url), "utf8");

  assert.match(teacherSource, /pendingSupervisorSubmission/);
  assert.match(teacherSource, /if \(saving\) \{[\s\S]*pendingSupervisorSubmission\.current = true/);
  assert.match(teacherSource, /if \(!submitForReview && pendingSupervisorSubmission\.current\)/);
  assert.match(teacherSource, /status: submitForReview \? \(isSupervisor \? "approved" : "submitted"\) : "draft"/);
  assert.match(teacherSource, /reviewed_by: submitForReview && isSupervisor \? profileId : null/);
  assert.match(teacherSource, /disabled=\{selectedClassSlots\.length === 0 \|\| builderStatus === "submitted" \|\| builderStatus === "approved"\}/);
  assert.match(migration, /Supervisors create their own approved teaching submissions/);
  assert.match(migration, /teacher_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /reviewed_by = \(select auth\.uid\(\)\)/);
  assert.match(migration, /staff\.administrative_role like '%Supervisor%'/);
  assert.match(migration, /slot\.teacher_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /slot\.subject_id = plan_submissions\.subject_id/);
  assert.match(migration, /plan\.id = plan_submissions\.weekly_plan_id/);
});

test("confirms teacher submission, reports success, and copies completed plans as independent drafts", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");

  assert.match(teacherSource, /Confirm plan submission/);
  assert.match(teacherSource, /Plan sent successfully/);
  assert.match(teacherSource, /setSubmissionSuccessOpen\(true\)/);
  assert.match(teacherSource, /finishSuccessfulSubmission[\s\S]*setWeeklyBuilderOpen\(false\)[\s\S]*setActiveNav\("Overview"\)/);
  assert.doesNotMatch(teacherSource, /className="weekly-copy-panel"/);
  assert.match(teacherSource, /canCopy && <button[\s\S]*openCopyPlanDialog\(plan\)[\s\S]*Copy plan/);
  assert.match(teacherSource, /hasMeaningfulDraft && !replaceExistingDraft/);
  assert.match(teacherSource, /Open existing draft/);
  assert.match(teacherSource, /Replace my draft/);
  assert.match(teacherSource, /targetSubmission\?\.status === "submitted"/);
  assert.match(teacherSource, /targetSubmission\?\.status === "approved"/);
  assert.match(teacherSource, /status: "draft", submitted_at: null/);
  assert.match(teacherSource, /setSelectedClassId\(copiedClassId\)[\s\S]*setSelectedWeekId\(copiedWeekId\)[\s\S]*setWeeklyBuilderOpen\(true\)/);
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

  assert.match(source, /completionPercent: requiredTeachers\.length > 0/);
  assert.match(source, /schoolWeeklyCompletionPercent = requiredTeacherClassCount > 0/);
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
