export type SchoolPublicationPlan = { id: string; weekId: string; classId: string; status: string; manualPublicationOverride: boolean };
type Submission = { weeklyPlanId: string; teacherId: string; subjectId: string; status: string };
type Entry = { weeklyPlanId: string; teacherId: string; subjectId: string; hasContent: boolean };
type Requirement = { teacherId: string; subjectId: string };
type Exception = { planId: string; teacherId: string };
export type ClassApprovalState = "not_started" | "draft" | "submitted" | "changes_requested" | "partial" | "approved";

// Approval, saved publication and family visibility are three independent facts.
export function classApprovalState(planId: string | undefined, requirements: Requirement[], submissions: Submission[]): ClassApprovalState {
  if (!planId) return "not_started";
  const pairs = new Map(requirements.map(row => [`${row.teacherId}:${row.subjectId}`, row]));
  const statuses = [...pairs.values()].map(row => submissions.find(submission => submission.weeklyPlanId === planId && submission.teacherId === row.teacherId && submission.subjectId === row.subjectId)?.status);
  if (statuses.length && statuses.every(status => status === "approved")) return "approved";
  if (statuses.some(status => status === "approved")) return "partial";
  if (statuses.some(status => status === "changes_requested")) return "changes_requested";
  if (statuses.some(status => status === "submitted")) return "submitted";
  return "draft";
}
export function classApprovalLabel(state: ClassApprovalState, arabic: boolean) {
  const labels = {
    not_started: ["لم تبدأ", "Not started"], draft: ["مسودة", "Draft"], submitted: ["بانتظار الاعتماد", "Awaiting approval"],
    changes_requested: ["مُعادة للتعديل", "Returned for changes"], partial: ["معتمدة جزئيًا", "Partially approved"], approved: ["معتمدة", "Approved"],
  };
  return labels[state][arabic ? 0 : 1];
}
export function schoolPublicationSummary(plans: SchoolPublicationPlan[], classIds: string[], weekId: string) {
  const required = new Set(classIds);
  const published = new Set(plans.filter(plan => plan.weekId === weekId && plan.status === "published" && required.has(plan.classId)).map(plan => plan.classId)).size;
  return { published, total: required.size, percent: required.size ? Math.round(published / required.size * 100) : 0 };
}
export function schoolPublicationCandidates<T extends SchoolPublicationPlan>(plans: T[], weekId: string, entries: Entry[], submissions: Submission[], exceptions: Exception[]): T[] {
  const content = new Set(entries.filter(entry => entry.hasContent).map(entry => `${entry.weeklyPlanId}:${entry.teacherId}:${entry.subjectId}`));
  const overrides = new Set(exceptions.map(exception => `${exception.planId}:${exception.teacherId}`));
  const sentByPlan = new Map<string, Submission[]>();
  for (const submission of submissions) {
    if (!["submitted", "approved"].includes(submission.status) || !content.has(`${submission.weeklyPlanId}:${submission.teacherId}:${submission.subjectId}`)) continue;
    const rows = sentByPlan.get(submission.weeklyPlanId) ?? [];
    rows.push(submission); sentByPlan.set(submission.weeklyPlanId, rows);
  }
  return plans.filter(plan => plan.weekId === weekId && plan.status !== "archived" && (sentByPlan.get(plan.id) ?? []).some(submission => {
    if (plan.status !== "published") return true;
    // A later submitted teacher can be unpublished inside an already published class.
    return submission.status === "submitted" && !plan.manualPublicationOverride && !overrides.has(`${plan.id}:${submission.teacherId}`);
  }));
}
export type SchoolPublicationTarget = { id: string; label: string };
export type SchoolPublicationResult = { published: string[]; failed: string[]; uncertain: string[] };
export async function publishSchoolTargets(targets: SchoolPublicationTarget[], weekId: string, publish: (id: string) => Promise<boolean>, verify: (id: string) => Promise<{ weekId: string; status: string; manualPublicationOverride: boolean } | null>): Promise<SchoolPublicationResult> {
  const result: SchoolPublicationResult = { published: [], failed: [], uncertain: [] };
  // Independent class transactions: expose partial failure honestly, never claim rollback of the whole batch.
  await Promise.all([...new Map(targets.map(target => [target.id, target])).values()].map(async target => {
    try {
      if (!await publish(target.id)) { result.failed.push(target.label); return; }
    } catch { result.uncertain.push(target.label); return; }
    try {
      const saved = await verify(target.id);
      if (saved?.weekId === weekId && saved.status === "published" && saved.manualPublicationOverride) result.published.push(target.label);
      else result.uncertain.push(target.label);
    } catch { result.uncertain.push(target.label); }
  }));
  return result;
}
