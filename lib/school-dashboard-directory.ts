import type { SupabaseClient } from "@supabase/supabase-js";

/** Account/configuration data is independent of the selected report week.
 * A full refresh (including every mutation and printable report) re-reads it.
 */
export function readSchoolDashboardDirectory(supabase: SupabaseClient) {
  return Promise.all([
    supabase.from("staff_directory").select("id, full_name, account_kind, administrative_role, department_id, departments(name_en)").eq("is_active", true).order("full_name"),
    supabase.from("registration_requests").select("id, user_id, staff_id, username, status, requested_at, reviewed_at").order("requested_at", { ascending: false }),
    supabase.from("profiles").select("user_id, staff_id, username, display_name, role, status, approved_at, updated_at"),
    supabase.from("teacher_assignments").select("id, teacher_id, class_id, subject_id, school_classes(grade, section), subjects(name_en)"),
    supabase.from("subjects").select("id, name_en, minimum_grade, maximum_grade").eq("is_active", true).eq("include_in_weekly_plan", true).order("name_en"),
    supabase.from("school_classes").select("id, grade, section").eq("is_active", true).order("grade").order("section"),
    supabase.from("weekly_plan_access_control").select("is_open").eq("id", 1).maybeSingle(),
    supabase.from("weekly_plan_teacher_access").select("teacher_id, is_open"),
    supabase.from("timetable_slots").select("class_id, teacher_id, subject_id, day_of_week, period_number, requires_weekly_plan_submission, subjects(name_en)").eq("requires_weekly_plan_submission", true),
    supabase.from("supervisor_staff_links").select("supervisor_staff_id, teacher_staff_id"),
  ] as const);
}

export type SchoolDashboardDirectory = {
  userId: string;
  loadedAt: number;
  results: Awaited<ReturnType<typeof readSchoolDashboardDirectory>>;
};
