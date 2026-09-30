type ReviewSubmission = {
  weeklyPlanId: string;
  teacherId: string;
  subjectId: string;
  status: "draft" | "submitted" | "changes_requested" | "approved";
  reviewedAt: string | null;
};

type TeacherClass = {
  classId: string;
  teacherId: string;
  subjectIds: string[];
};

export function supervisorReportProgress(
  teacherClasses: TeacherClass[],
  planIdByClass: Map<string, string>,
  submissions: ReviewSubmission[],
) {
  let approved = 0;
  let total = 0;
  let lastApproval: string | null = null;

  for (const teacherClass of teacherClasses) {
    const planId = planIdByClass.get(teacherClass.classId);
    if (!planId) continue;
    const subjectIds = new Set(teacherClass.subjectIds);
    const sent = submissions.filter((submission) =>
      submission.weeklyPlanId === planId
      && submission.teacherId === teacherClass.teacherId
      && subjectIds.has(submission.subjectId)
      && (submission.status === "submitted" || submission.status === "changes_requested" || submission.status === "approved"));

    // One teacher/class is one report item; drafts and unstarted classes are not owed to the supervisor.
    if (sent.length === 0) continue;
    total += 1;
    if (sent.every((submission) => submission.status === "approved")) approved += 1;
    for (const submission of sent) {
      if (submission.status === "approved" && submission.reviewedAt && (!lastApproval || submission.reviewedAt > lastApproval)) {
        lastApproval = submission.reviewedAt;
      }
    }
  }

  return { approved, total, percent: total ? Math.round(approved / total * 100) : null, lastApproval };
}
