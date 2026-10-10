// Current timetable corrections start at Week 7. Earlier plans retain the
// original subject at each position; slot IDs and saved lesson text never move.
export function gradeEightHistoricalCounterpart(grade: number, section: string, weekNumber: number, day: number, period: number): [number, number] | null {
  if (grade !== 8 || weekNumber >= 7) return null;
  if (section === "A") {
    if (day === 2 && period === 8) return [4, 3];
    if (day === 4 && period === 3) return [2, 8];
  }
  if (section === "B") {
    if (day === 3 && period === 3) return [4, 6];
    if (day === 4 && period === 6) return [3, 3];
  }
  return null;
}

// The static JSON is the original timetable snapshot. Only these four subject
// labels change in the current, non-week-specific timetable directory.
export function currentGradeEightSubject(grade: number, section: string, day: number, period: number, original: string): string {
  if (grade !== 8) return original;
  if (section === "A" && day === 2 && period === 8) return "دين";
  if (section === "A" && day === 4 && period === 3) return "عربي";
  if (section === "B" && day === 3 && period === 3) return "عربي";
  if (section === "B" && day === 4 && period === 6) return "دين";
  return original;
}
