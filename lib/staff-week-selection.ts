type StaffWeek = { id: string; week_number: number; is_current: boolean; teacher_entry_enabled: boolean };
type WeekStorage = Pick<Storage, "getItem" | "setItem">;
type WeekStorageSource = WeekStorage | (() => WeekStorage);

/** Uses the established per-account preference for teachers and supervisors. */
export function readStaffWeek(storage: WeekStorageSource, staffId: string) {
  try { return (typeof storage === "function" ? storage() : storage).getItem(`andalus-teacher-week:${staffId}`) ?? ""; }
  catch { return ""; }
}

export function rememberStaffWeek(storage: WeekStorageSource, staffId: string, weekId: string) {
  if (!staffId) return;
  try { (typeof storage === "function" ? storage() : storage).setItem(`andalus-teacher-week:${staffId}`, weekId); }
  catch { /* The current in-memory selection still works when storage is unavailable. */ }
}

/** Closed weeks remain valid selections: viewing is independent of write access. */
export function resolveStaffWeek(weeks: StaffWeek[], currentId = "", rememberedId = "") {
  for (const id of [currentId, rememberedId]) {
    if (id && weeks.some((week) => week.id === id)) return id;
  }
  return weeks.find((week) => week.is_current && week.teacher_entry_enabled)?.id
    ?? [...weeks].filter((week) => week.teacher_entry_enabled).sort((a,b) => b.week_number - a.week_number)[0]?.id
    ?? weeks.find((week) => week.is_current)?.id
    ?? weeks[0]?.id ?? "";
}
