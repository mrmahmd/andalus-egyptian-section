"use client";

export type ExceptionalTeacherTarget = {
  planId: string; teacherId: string; teacherName: string; className: string;
  weekId: string; weekLabel: string; stage: string; lessonCount: number;
};

export default function TeacherPublicationDialog({ targets, busy, onCancel, onConfirm }: {
  targets: ExceptionalTeacherTarget[]; busy: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return <div className="weekly-send-confirmation-backdrop" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onCancel(); }}>
    <section className="weekly-send-confirmation teacher-exception-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="teacher-exception-title">
      <span aria-hidden="true">GS</span><h3 id="teacher-exception-title">{targets.length === 1 ? "Publish this teacher's plan exceptionally?" : "Publish all unapproved teacher plans exceptionally?"}</h3>
      <p><strong>{targets[0]?.weekLabel}</strong> · {targets.length} teacher plan{targets.length === 1 ? "" : "s"}. The General Supervisor publishes the selected saved work without changing any supervisor decision. Closed weeks are allowed; families can view content only when the week is visible.</p>
      <div className="teacher-exception-targets"><table><thead><tr><th>Teacher</th><th>Class</th><th>Current stage</th><th>Written lessons</th></tr></thead><tbody>{targets.map((target) => <tr key={`${target.planId}-${target.teacherId}`}><td>{target.teacherName}</td><td>{target.className}</td><td>{target.stage}</td><td>{target.lessonCount}</td></tr>)}</tbody></table></div>
      <div><button type="button" className="teacher-secondary-button" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="teacher-primary-button" disabled={busy || !targets.length} onClick={onConfirm}>{busy ? "Publishing…" : "Confirm exceptional publication"}</button></div>
    </section>
  </div>;
}
