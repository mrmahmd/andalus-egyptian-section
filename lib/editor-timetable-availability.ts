export type EditorTimetableAvailability = "ready" | "missing" | "holiday" | "exam" | "excluded";

/** Presentation only. Never add excluded lessons back to the writable timetable. */
export function editorTimetableAvailability(scheduled: { holiday: boolean; exam: boolean }[], editableCount: number): EditorTimetableAvailability {
  if (editableCount > 0) return "ready";
  if (!scheduled.length) return "missing";
  if (scheduled.every((slot) => slot.holiday)) return "holiday";
  if (scheduled.every((slot) => slot.exam)) return "exam";
  if (scheduled.every((slot) => slot.holiday || slot.exam)) return "excluded";
  return "missing"; // Do not disguise a real mapping inconsistency as an exemption.
}

export function editorTimetableCopy(availability: EditorTimetableAvailability, arabic: boolean, count = 0) {
  if (availability === "ready") return { title: arabic ? `✓ ${count} حصص في جدولك` : `✓ ${count} timetable lessons`, detail: "" };
  if (availability === "holiday") return {
    title: arabic ? "لا توجد حصص مطلوبة — إجازة" : "No lessons required — holiday",
    detail: arabic ? "جدول حصصك مرتبط بالفعل. كل حصصك لهذا الفصل تقع في يوم إجازة هذا الأسبوع؛ لذلك لا يُطلب منك حفظ أو إرسال خطة لهذا الفصل في هذا الأسبوع. اختر فصلًا آخر أو أسبوعًا آخر من القوائم أعلاه. لم يتم تغيير جدولك أو أي كتابة محفوظة." : "Your timetable is already linked. All your lessons for this class fall on a school holiday this week, so no plan needs to be saved or submitted for this class this week. Choose another class or week above. Your timetable and saved writing are unchanged.",
  };
  if (availability === "exam" || availability === "excluded") return {
    title: arabic ? "لا توجد حصص مطلوبة لهذا الأسبوع" : "No lessons required this week",
    detail: arabic ? "جدول حصصك مرتبط بالفعل. حصصك لهذا الفصل مستثناة هذا الأسبوع بسبب الاختبار الموحد أو الإجازة؛ لا تحتاج إلى حفظ أو إرسال خطة لهذا الفصل. اختر فصلًا آخر أو أسبوعًا آخر. أي كتابة محفوظة لم تتغير." : "Your timetable is already linked. Your lessons for this class are excluded this week by the shared exam or a school holiday; no plan needs to be saved or submitted for this class. Choose another class or week. Saved writing is unchanged.",
  };
  return {
    title: arabic ? "يلزم ربط جدول الحصص" : "Timetable connection required",
    detail: arabic ? "لم يتم العثور على حصص مرتبطة بحسابك لهذا الفصل. اطلب من مسؤول المنصة مراجعة ربط الجدول والتكليفات. لم يتم تغيير أي كتابة محفوظة." : "No timetable lessons linked to your account were found for this class. Ask school administration to check the timetable and assignments. Saved writing is unchanged.",
  };
}
