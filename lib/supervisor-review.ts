type Requirement = { teacherId: string; teacherName: string; classId: string; className: string; subjectId: string };
type Submission = { teacherId: string; classId: string; subjectId: string; status: string };

export function summarizeTeacherCompletion(requirements: Requirement[], submissions: Submission[]) {
  const teachers = new Map<string, { id: string; name: string; required: number; missingClasses: string[]; returnedClasses: string[]; waiting: number }>();
  for (const requirement of requirements) {
    const teacher = teachers.get(requirement.teacherId) ?? { id: requirement.teacherId, name: requirement.teacherName, required: 0, missingClasses: [], returnedClasses: [], waiting: 0 };
    teachers.set(teacher.id, teacher);
  }
  for (const teacher of teachers.values()) {
    const classes = new Map(requirements.filter((item) => item.teacherId === teacher.id).map((item) => [item.classId, item.className]));
    teacher.required = classes.size;
    for (const [classId, className] of classes) {
      const requiredSubjects = new Set(requirements.filter((item) => item.teacherId === teacher.id && item.classId === classId).map((item) => item.subjectId));
      const records = submissions.filter((item) => item.teacherId === teacher.id && item.classId === classId && requiredSubjects.has(item.subjectId));
      if ([...requiredSubjects].some((subjectId) => !records.some((item) => item.subjectId === subjectId && ["submitted", "approved", "changes_requested"].includes(item.status)))) teacher.missingClasses.push(className);
      if (records.some((item) => item.status === "changes_requested")) teacher.returnedClasses.push(className);
      if (records.some((item) => item.status === "submitted")) teacher.waiting++;
    }
  }
  return [...teachers.values()].sort((a,b) => a.name.localeCompare(b.name));
}

/** Preflight the whole selection before writing; stop and report confirmed writes on failure. */
export async function reviewSelectedSubmissions(ids: string[], preflight: (ids: string[]) => Promise<void>, review: (id: string) => Promise<void>) {
  const uniqueIds = [...new Set(ids)];
  let completed = 0;
  try {
    if (!uniqueIds.length) throw new Error("No submitted plans selected.");
    await preflight(uniqueIds);
    for (const id of uniqueIds) { await review(id); completed++; }
    return { completed, error: null };
  } catch (error) {
    return { completed, error };
  }
}
