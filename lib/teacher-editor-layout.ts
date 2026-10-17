/** Default only: every teacher may override the presentation on their own device. */
export function hasHorizontalTeacherEditor(profile: { username?: string | null; role?: string | null; status?: string | null } | null | undefined) {
  return profile?.username === "m.abdelhameed" && profile.role === "teacher" && profile.status === "active";
}

export type TeacherEditorLayout = "columns" | "rows";
type LayoutStorage = Pick<Storage, "getItem" | "setItem">;
const layoutKey = (staffId: string) => `andalus:teacher-editor-layout:v1:${staffId}`;

/** Storage is optional (private browsing / blocked storage). Never stores plan text. */
export function readTeacherEditorLayout(storage: () => LayoutStorage, staffId: string, fallback: TeacherEditorLayout): TeacherEditorLayout {
  if (!staffId) return fallback;
  try {
    const value = storage().getItem(layoutKey(staffId));
    return value === "columns" || value === "rows" ? value : fallback;
  } catch { return fallback; }
}

export function rememberTeacherEditorLayout(storage: () => LayoutStorage, staffId: string, layout: TeacherEditorLayout) {
  if (!staffId || (layout !== "columns" && layout !== "rows")) return false;
  try { storage().setItem(layoutKey(staffId), layout); return true; }
  catch { return false; }
}
