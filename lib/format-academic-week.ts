export type AcademicWeekDateRange = {
  starts_on: string;
  ends_on: string;
};

function localDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

export function formatAcademicWeekRange(
  week: AcademicWeekDateRange,
  locale = "en-GB",
) {
  const start = localDate(week.starts_on);
  const end = localDate(week.ends_on);
  const day = new Intl.DateTimeFormat(locale, { day: "numeric" });
  const month = new Intl.DateTimeFormat(locale, { month: "long" });
  const year = new Intl.DateTimeFormat(locale, { year: "numeric" });

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${day.format(start)} - ${day.format(end)} ${month.format(end)} ${year.format(end)}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${day.format(start)} ${month.format(start)} - ${day.format(end)} ${month.format(end)} ${year.format(end)}`;
  }

  return `${day.format(start)} ${month.format(start)} ${year.format(start)} - ${day.format(end)} ${month.format(end)} ${year.format(end)}`;
}
