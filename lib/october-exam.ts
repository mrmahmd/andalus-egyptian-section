/** School-wide fixed lesson: Week 7 only, Sunday–Thursday, period 3. */
export function isOctoberExam(weekNumber: number | undefined, period: number, day = 0): boolean {
  return weekNumber === 7 && period === 3 && day >= 0 && day <= 4;
}
export const octoberExamText = "October Exam";
