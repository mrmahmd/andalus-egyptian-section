export type GapRequirement = { subjectId: string; subjectName: string; dayOfWeek: number; periodNumber: number };
export type GapLesson = GapRequirement & { reason: "unsent" | "returned" | "empty"; written: boolean };
export type TeacherGapClass = { key: string; teacherId: string; teacherName: string; grade: number; section: string; completed: number; total: number; missing: GapLesson[] };
export type ApprovalGap = { key: string; supervisorId: string; supervisorName: string; teacherName: string; grade: number; section: string; subjects: string[]; submittedAt: string | null };
export type GapGroup = { id: string; name: string; count: number; blocks: { title: string; rows: { cells: string[]; tone: "red" | "orange" | "blue" }[] }[] };
const arabicDays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const englishDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

export function missingTeacherLessons(requirements: GapRequirement[], entries: { subjectId: string; dayOfWeek: number; periodNumber: number; hasClasswork: boolean }[], submissions: { subjectId: string; status: string }[]): GapLesson[] {
  const written = new Set(entries.filter((entry) => entry.hasClasswork).map((entry) => `${entry.subjectId}:${entry.dayOfWeek}:${entry.periodNumber}`));
  const statuses = new Map(submissions.map((submission) => [submission.subjectId, submission.status]));
  const unique = new Map(requirements.map((requirement) => [`${requirement.subjectId}:${requirement.dayOfWeek}:${requirement.periodNumber}`, requirement]));
  return [...unique.values()].flatMap((requirement): GapLesson[] => {
    const status = statuses.get(requirement.subjectId);
    const hasWriting = written.has(`${requirement.subjectId}:${requirement.dayOfWeek}:${requirement.periodNumber}`);
    if (["submitted", "approved"].includes(status ?? "") && hasWriting) return [];
    return [{ ...requirement, written: hasWriting, reason: status === "changes_requested" ? "returned" : ["submitted", "approved"].includes(status ?? "") ? "empty" : "unsent" }];
  }).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.periodNumber - b.periodNumber || a.subjectName.localeCompare(b.subjectName));
}

export function teacherGapGroups(classes: TeacherGapClass[], arabic: boolean): GapGroup[] {
  const groups = new Map<string, TeacherGapClass[]>();
  for (const row of classes) { const rows = groups.get(row.teacherId) ?? []; rows.push(row); groups.set(row.teacherId, rows); }
  return [...groups].map(([id, rows]) => ({ id, name: rows[0].teacherName, count: rows.reduce((sum, row) => sum + row.missing.length, 0), blocks: rows.sort((a, b) => a.grade - b.grade || a.section.localeCompare(b.section)).map((row) => {
    const grouped = new Map<string, GapLesson[]>();
    for (const lesson of row.missing) { const key = `${lesson.dayOfWeek}:${lesson.subjectId}:${lesson.reason}:${lesson.written}`; const lessons = grouped.get(key) ?? []; lessons.push(lesson); grouped.set(key, lessons); }
    return { title: `${arabic ? "الصف" : "Grade"} ${row.grade} · ${arabic ? "الشعبة" : "Class"} ${row.section} · ${row.completed}/${row.total} ${arabic ? "حصة مكتملة ومُرسلة" : "completed and sent lessons"}`, rows: [...grouped.values()].map((lessons) => {
      const first = lessons[0];
      const reason = first.reason === "empty" ? arabic ? "بلا محتوى عمل الحصة" : "Missing Classwork" : first.reason === "returned" ? arabic ? "أُعيدت للتعديل — أعد إرسالها" : "Returned — resubmit" : first.written ? arabic ? "لم تُرسل — المحتوى مكتوب" : "Not sent — content written" : arabic ? "لم تُرسل — بلا محتوى عمل الحصة" : "Not sent — missing Classwork";
      return { cells: [(arabic ? arabicDays : englishDays)[first.dayOfWeek], first.subjectName, lessons.map((lesson) => lesson.periodNumber).sort((a,b)=>a-b).join("، "), reason], tone: first.reason === "unsent" ? "red" as const : "orange" as const };
    }) };
  }) })).sort((a, b) => a.name.localeCompare(b.name, arabic ? "ar" : "en"));
}

export function supervisorGapGroups(approvals: ApprovalGap[], arabic: boolean, now = Date.now()): GapGroup[] {
  const groups = new Map<string, ApprovalGap[]>();
  for (const row of approvals) { const rows = groups.get(row.supervisorId) ?? []; rows.push(row); groups.set(row.supervisorId, rows); }
  return [...groups].map(([id, rows]) => ({ id, name: rows[0].supervisorName, count: rows.length, blocks: [{ title: arabic ? "خطط مرسلة تنتظر قرار المشرف — الأقدم أولًا" : "Submitted plans awaiting review — oldest first", rows: rows.sort((a,b)=>(a.submittedAt ? Date.parse(a.submittedAt) : Infinity) - (b.submittedAt ? Date.parse(b.submittedAt) : Infinity) || a.grade-b.grade || a.section.localeCompare(b.section) || a.teacherName.localeCompare(b.teacherName)).map((row) => {
    const elapsed = row.submittedAt ? Math.max(0, Math.floor((now - Date.parse(row.submittedAt)) / 86400000)) : null;
    const date = row.submittedAt ? new Date(row.submittedAt).toLocaleString(arabic ? "ar-EG" : "en-GB", {timeZone:"Asia/Riyadh",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
    return { cells: [row.teacherName, `${arabic ? "الصف" : "Grade"} ${row.grade} · ${row.section}`, row.subjects.join("، "), `${date} · ${elapsed === null ? "—" : elapsed === 0 ? arabic ? "أقل من يوم" : "Under one day" : `${elapsed} ${arabic ? "يوم" : "days"}`}`], tone: "blue" as const };
  }) }] })).sort((a,b)=>a.name.localeCompare(b.name,arabic ? "ar" : "en"));
}
