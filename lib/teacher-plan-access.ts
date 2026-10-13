import type { SupabaseClient } from "@supabase/supabase-js";

export type TeacherAccessWeek = {
  id: string; week_number: number; label: string; starts_on: string; ends_on: string;
  is_current: boolean; teacher_entry_enabled: boolean; parent_portal_visible: boolean;
};

/** Re-read live switches without reloading or resetting any editor content. */
export async function fetchTeacherPlanAccess(client: SupabaseClient, teacherId: string) {
  const [weeks, globalAccess, personalAccess] = await Promise.all([
    client.from("academic_weeks").select("id, week_number, label, starts_on, ends_on, is_current, teacher_entry_enabled, parent_portal_visible").order("week_number"),
    client.from("weekly_plan_access_control").select("is_open").eq("id", 1).maybeSingle(),
    client.from("weekly_plan_teacher_access").select("is_open").eq("teacher_id", teacherId).maybeSingle(),
  ]);
  const error = [weeks.error, globalAccess.error, personalAccess.error].find(Boolean);
  if (error) throw error;
  return { weeks: (weeks.data ?? []) as TeacherAccessWeek[], creationOpen: personalAccess.data?.is_open ?? globalAccess.data?.is_open ?? true };
}

/** Keep unchanged week objects stable so polling never rehydrates unsaved text. */
export function mergeTeacherAccessWeeks(current: TeacherAccessWeek[], incoming: TeacherAccessWeek[]) {
  return incoming.map((week) => {
    const previous = current.find((item) => item.id === week.id);
    return previous && JSON.stringify(previous) === JSON.stringify(week) ? previous : week;
  });
}
