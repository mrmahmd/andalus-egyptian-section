import "./plan-holiday.css";

export function holidayDisplayTitle(title: string) {
  return /^long\s+weekend$/i.test(title.trim()) ? "Long weekend" : title.trim();
}

export function PlanHolidayLabel({ title }: { title: string }) {
  return <span className="parent-holiday-label" dir="ltr">{holidayDisplayTitle(title)}</span>;
}

export function PlanHolidayRow({ title, day }: { title: string; day: string }) {
  return <tr className="new-day parent-holiday-row" aria-label={`${day} school holiday`}>
    <td className="day-cell" aria-label={day}>{day.slice(0, 3)}</td>
    <td colSpan={4} className="parent-holiday-cell"><PlanHolidayLabel title={title} /></td>
  </tr>;
}
