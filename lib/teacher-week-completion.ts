import type { SupabaseClient } from "@supabase/supabase-js";

export type CompletionRequirement = { id: string; classId: string; subjectId: string; dayOfWeek: number; periodNumber: number };
type CompletionEntry = { planId: string; classId: string; subjectId: string; slotId: string | null; dayOfWeek: number; periodNumber: number; written: boolean };
type CompletionSubmission = { planId: string; classId: string; subjectId: string; status: string; reviewNote?: string };
export type CompletionSnapshot = { entries: CompletionEntry[]; submissions: CompletionSubmission[] };
export type TeachingWeekSummary = { state: "none" | "action" | "returned" | "submitted" | "partial" | "approved"; classes: number; lessons: number; missing: number; approved: number; waiting: number; subjectPlans: number; unsent: number };

/** Requirements must already be scoped to the teacher/week, excluding holidays and exams. */
export function summarizeTeachingWeek(requirements: CompletionRequirement[], snapshot: CompletionSnapshot): TeachingWeekSummary {
  const unique = [...new Map(requirements.map(r => [r.id, r])).values()];
  const groups = [...new Map(unique.map(r => [`${r.classId}:${r.subjectId}`, r])).values()];
  let missing = 0, approved = 0, waiting = 0, unsent = 0, returned = 0;
  for (const group of groups) {
    const records = snapshot.submissions.filter(s => s.classId === group.classId && s.subjectId === group.subjectId);
    // A contradictory response must never produce a congratulatory approval message.
    const submission = records.length === 1 ? records[0] : undefined;
    if (submission?.status === "approved") approved++;
    else if (submission?.status === "submitted") waiting++;
    else { unsent++; if (records.some(s => s.status === "changes_requested")) returned++; }
    for (const slot of unique.filter(r => r.classId === group.classId && r.subjectId === group.subjectId)) {
      const written = snapshot.entries.some(e => e.classId === slot.classId && e.subjectId === slot.subjectId && e.written
        && (!submission || e.planId === submission.planId)
        && (e.slotId ? e.slotId === slot.id : e.dayOfWeek === slot.dayOfWeek && e.periodNumber === slot.periodNumber));
      if (!written) missing++;
    }
  }
  const state = !unique.length ? "none" : returned ? "returned" : missing || unsent ? "action" : waiting ? approved ? "partial" : "submitted" : "approved";
  return { state, classes: new Set(unique.map(r => r.classId)).size, lessons: unique.length, missing, approved, waiting, subjectPlans: groups.length, unsent };
}

/** Read-only; existing teacher RLS and delegated workspace boundaries remain authoritative. */
export async function fetchTeachingWeek(client: Pick<SupabaseClient, "from">, teacherId: string, weekId: string): Promise<CompletionSnapshot> {
  if (!teacherId || !weekId) throw new Error("Missing teacher/week scope");
  const [entries, submissions] = await Promise.all([
    client.from("plan_entries").select("weekly_plan_id, teacher_id, subject_id, timetable_slot_id, day_of_week, period_number, classwork, weekly_plans!inner(class_id, week_id)").eq("teacher_id", teacherId).eq("weekly_plans.week_id", weekId),
    client.from("plan_submissions").select("weekly_plan_id, teacher_id, subject_id, status, review_note, weekly_plans!inner(class_id, week_id)").eq("teacher_id", teacherId).eq("weekly_plans.week_id", weekId),
  ]);
  if (entries.error || submissions.error || !Array.isArray(entries.data) || !Array.isArray(submissions.data)) throw new Error("Week status could not be verified");
  const scope = (row: Record<string, unknown>) => {
    const relation = Array.isArray(row.weekly_plans) ? row.weekly_plans[0] : row.weekly_plans;
    const plan = relation as { class_id?: string; week_id?: string } | null;
    if (row.teacher_id !== teacherId || plan?.week_id !== weekId || !plan.class_id || !row.weekly_plan_id || !row.subject_id) return null;
    return { planId: String(row.weekly_plan_id), classId: plan.class_id, subjectId: String(row.subject_id) };
  };
  return {
    entries: (entries.data as unknown as Record<string, unknown>[]).flatMap(row => {
      const base = scope(row); return base ? [{ ...base, slotId: row.timetable_slot_id ? String(row.timetable_slot_id) : null, dayOfWeek: Number(row.day_of_week), periodNumber: Number(row.period_number), written: Boolean(String(row.classwork ?? "").trim()) }] : [];
    }),
    submissions: (submissions.data as unknown as Record<string, unknown>[]).flatMap(row => { const base = scope(row); return base ? [{ ...base, status: String(row.status), reviewNote: String(row.review_note ?? "") }] : []; }),
  };
}

export function teachingWeekMessage(summary: TeachingWeekSummary, arabic: boolean) {
  const copy = {
    none: ["لا توجد حصص مطلوبة لهذا الأسبوع", "No teaching lessons required this week", "لا توجد حصص تعليمية مطلوبة منك في الأسبوع المختار بعد استبعاد الإجازات والاختبارات.", "No teaching lessons are required for the selected week after excluding holidays and shared exams."],
    action: ["خططك تحتاج منك إجراء", "Your plans need attention", summary.missing ? `باقي ${summary.missing} حصة بلا محتوى عمل الحصة. أكمل النواقص وراجع حالة الإرسال؛ الاعتماد لا يلغي الحصص الفارغة.` : "اكتملت كتابة الحصص المطلوبة. ما زالت هناك خطط لم تُرسل للمشرف؛ راجعها ثم أرسلها للاعتماد.", summary.missing ? `${summary.missing} lessons still need Classwork. Complete the gaps and check submission status; approval does not remove empty lessons.` : "Your required lessons are written. Some plans have not been sent yet; review and submit them for approval."],
    returned: ["هناك خطط أُعيدت للتعديل", "Some plans were returned", "راجع ملاحظات المشرف، واستكمل أي حصص ناقصة، ثم أعد إرسال الخطط المطلوبة.", "Review your supervisor's notes, complete any missing Classwork, then resubmit the returned plans."],
    submitted: ["أحسنت! انتهيت من المطلوب لهذا الأسبوع", "Well done! Your weekly plans are complete", "أكملت جميع الحصص المطلوبة وأرسلت كل خططك للمشرف. لا يوجد إجراء مطلوب منك حاليًا؛ الخطط بانتظار الاعتماد.", "All required lessons are complete and all your plans have been sent to your supervisor. No action is needed from you now; approval is pending."],
    partial: ["اكتملت خططك — الاعتماد جارٍ", "Plans complete — approval in progress", `أكملت كل الحصص وأرسلت جميع خططك. تم اعتماد ${summary.approved} من ${summary.subjectPlans} خطط المواد، والباقي بانتظار المراجعة. لا يوجد إجراء مطلوب منك حاليًا.`, `All lessons are complete and all plans are sent. ${summary.approved} of ${summary.subjectPlans} subject plans are approved; the rest await review. No action is needed from you now.`],
    approved: ["تم اعتماد جميع خططك لهذا الأسبوع", "All your weekly plans are approved", "شكرًا لإنجازك! جميع حصصك المطلوبة مكتملة وخططك معتمدة. لا يوجد إجراء مطلوب منك لهذا الأسبوع.", "Thank you! All required lessons are complete and all your plans are approved. No action is needed from you for this week."],
  }[summary.state];
  return { title: copy[arabic ? 0 : 1], detail: copy[arabic ? 2 : 3] };
}
