import { editorTimetableCopy, type EditorTimetableAvailability } from "../../lib/editor-timetable-availability";

export default function EditorTimetableNotice({ availability, arabic }: { availability: EditorTimetableAvailability; arabic: boolean }) {
  if (availability === "ready") return null;
  const copy = editorTimetableCopy(availability, arabic);
  return <section className={`editor-timetable-notice ${availability === "missing" ? "needs-link" : "not-required"}`} role="status" dir={arabic ? "rtl" : "ltr"}>
    <strong>{copy.title}</strong><p>{copy.detail}</p>
  </section>;
}
