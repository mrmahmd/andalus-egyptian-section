/** Week 7 only, Sunday–Thursday, period 3, Grades 3–10. */
export function isOctoberExam(weekNumber: number | undefined, period: number, day: number, grade: number | undefined): boolean {
  return weekNumber === 7 && period === 3 && day >= 0 && day <= 4 && grade !== undefined && grade >= 3;
}
export const octoberExamText = "October Exam";
