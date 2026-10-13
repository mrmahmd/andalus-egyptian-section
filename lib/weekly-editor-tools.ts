export type LessonDraft = {
  classwork: string; homework: string; classeraNotes: string;
  englishProgramme: string; scienceComponent: string;
};
export type EditorLesson = {
  id: string; class_id: string; subject_id: string; day_of_week: number; period_number: number;
  requires_weekly_plan_submission: boolean;
};
export type CopyFields = { classwork: boolean; homework: boolean; classeraNotes: boolean };
export const blankLessonDraft = (): LessonDraft => ({ classwork: "", homework: "", classeraNotes: "", englishProgramme: "", scienceComponent: "" });

/** Callers supply their own assigned, exam/holiday-filtered timetable, never raw school slots. */
export function editorLessonProgress(slots: EditorLesson[], drafts: Record<string, LessonDraft>) {
  const required = [...new Map(slots.filter((slot) => slot.requires_weekly_plan_submission).map((slot) => [slot.id, slot])).values()];
  const missing = required.filter((slot) => !drafts[slot.id]?.classwork.trim());
  const completed = required.length - missing.length;
  return { total: required.length, completed, missing, percent: required.length ? Math.floor(completed / required.length * 100) : 0 };
}

export function copyLessonDraft(
  writableSlots: EditorLesson[], drafts: Record<string, LessonDraft>, sourceId: string,
  targetIds: string[], fields: CopyFields, overwriteToken = "",
): { status: "invalid" } | { status: "conflict"; targetIds: string[]; confirmationToken: string } | { status: "copied"; drafts: Record<string, LessonDraft>; count: number } {
  const source = writableSlots.find((slot) => slot.id === sourceId);
  const sourceDraft = drafts[sourceId];
  const ids = [...new Set(targetIds)];
  const selected = (["classwork", "homework", "classeraNotes"] as const).filter((field) => fields[field]);
  if (!source || !source.requires_weekly_plan_submission || !sourceDraft || !ids.length || !selected.length || !selected.some((field) => sourceDraft[field].trim())) return { status: "invalid" };
  const targets = ids.map((id) => writableSlots.find((slot) => slot.id === id));
  if (targets.some((slot) => !slot || slot.id === sourceId || slot.class_id !== source.class_id || slot.subject_id !== source.subject_id || !slot.requires_weekly_plan_submission)) return { status: "invalid" };
  const keys: (keyof LessonDraft)[] = [...selected];
  if (fields.classwork) keys.push("englishProgramme", "scienceComponent");
  const conflicts = ids.filter((id) => keys.some((key) => Boolean(drafts[id]?.[key].trim()) && drafts[id][key] !== sourceDraft[key]));
  // Confirmation is bound to the exact writing shown in the dialog, not just a boolean.
  const confirmationToken = JSON.stringify({ sourceId, ids, keys, source: keys.map((key) => sourceDraft[key]), targets: ids.map((id) => keys.map((key) => drafts[id]?.[key] ?? "")) });
  if (conflicts.length && overwriteToken !== confirmationToken) return { status: "conflict", targetIds: conflicts, confirmationToken };
  const next = { ...drafts };
  for (const id of ids) {
    const target = { ...(drafts[id] ?? blankLessonDraft()) };
    for (const key of keys) target[key] = sourceDraft[key];
    next[id] = target;
  }
  return { status: "copied", drafts: next, count: ids.length };
}
