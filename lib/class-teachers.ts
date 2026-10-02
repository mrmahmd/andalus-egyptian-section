// Owner-approved class teachers for the 2026–2027 academic year.
const classTeachers: Readonly<Record<string, string>> = {
  "1/A": "Ahmed Salem",
  "1/B": "Mohamed Abdelhamid",
  "2/A": "Wael Aboul Ela",
  "3/A": "Mohamed Shaaban",
  "3/B": "Moamen Ahmed",
  "4/A": "Mohamed Hamad",
  "4/B": "Wael Shokry",
  "5/A": "Ahmed Adas",
  "5/B": "Ahmed Hassan",
  "6/A": "Maged Moussa",
  "6/B": "Abdel Nasser Khalil",
  "7/A": "Mohamed Saeed",
  "7/B": "Mohamed Badr",
  "8/A": "Mohamed Bakr",
  "8/B": "Osama Hassan",
  "9/A": "Mohamed Fouda",
  "9/B": "Essam El-Gazzar",
  "10/A": "Amr Rizk",
};

export function getClassTeacherName(grade: number, section: string): string {
  return classTeachers[`${grade}/${section.trim().toUpperCase()}`] ?? "—";
}
