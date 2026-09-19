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
  assert.match(source, /from\("plan_entries"\)\.upsert/);
  assert.match(source, /from\("plan_quizzes"\)/);
  assert.match(source, /from\("plan_notes"\)/);
  assert.match(source, /Timetable connection required/);
  assert.doesNotMatch(source, /Changes in this prototype are not saved/);
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

test("publishes only after required supervisor approvals unless Super Admin explicitly overrides", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const publishingSql = await readFile(new URL("../supabase/migrations/20260919120000_restore_supervisor_approval_publication.sql", import.meta.url), "utf8");

  assert.match(teacherSource, /Approve all submitted plans/);
  assert.match(teacherSource, /published for families/);
  assert.match(publishingSql, /required_submission/);
  assert.match(publishingSql, /submission\.status = 'approved'/);
  assert.match(publishingSql, /manual_publication_override/);
  assert.match(publishingSql, /sync_weekly_plan_publication_on_submission/);
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
