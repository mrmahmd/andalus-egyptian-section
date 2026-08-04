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

test("renders one merged day cell for each school day", async () => {
  const html = await readFile(
    new URL("weekly-plan/index.html", outputRoot),
    "utf8",
  );

  const dayCells = html.match(/class="day-cell"/g) ?? [];
  assert.equal(dayCells.length, 5);
  assert.match(html, /Mr\.Mohamed Farid/);
  for (const day of ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]) {
    assert.match(html, new RegExp(`<td[^>]*rowspan="8"[^>]*>${day}<\\/td>`, "i"));
  }
  assert.match(html, /QUIZZES &amp; ASSESSMENTS/);
  assert.match(html, /class="quiz-table"/);
  assert.match(html, /Spelling Quiz/);
  assert.match(html, /Quick Check/);
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
  assert.match(teacherSource, /Submit for review/);
  assert.match(teacherSource, /Waiting for review/);
  assert.match(teacherSource, /Approved & published/);
  assert.match(teacherSource, /Only your assigned teachers appear here/);
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

test("publishes only supervisor-approved subject content without a Super Admin gate", async () => {
  const teacherSource = await readFile(new URL("../app/teachers/page.tsx", import.meta.url), "utf8");
  const publishingSql = await readFile(new URL("../supabase/20260802_supervisor_approval_publishing.sql", import.meta.url), "utf8");

  assert.match(teacherSource, /Approve & publish/);
  assert.match(teacherSource, /published for families/);
  assert.match(publishingSql, /set status = 'published'/);
  assert.match(publishingSql, /s\.status = 'approved'/);
  assert.match(publishingSql, /Public reads supervisor-approved plan entries/);
  assert.match(publishingSql, /Public reads supervisor-approved quizzes/);
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
