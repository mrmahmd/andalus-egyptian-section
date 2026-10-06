"use client";

export type ExceptionalTeacherTarget = {
  planId: string; teacherId: string; teacherName: string; className: string;
  weekId: string; weekLabel: string; stage: string; lessonCount: number;
};

export default function TeacherPublicationDialog({ targets, busy, arabic = false, onCancel, onConfirm }: {
  targets: ExceptionalTeacherTarget[]; busy: boolean; arabic?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const stages: Record<string, string> = { "not started": "لم تبدأ", draft: "مسودة — لم تُرسل", submitted: "بانتظار المشرف", "changes requested": "مُعادة للتعديل", "approved waiting": "معتمدة — بانتظار النشر", published: "منشورة" };
  return <div className="weekly-send-confirmation-backdrop" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onCancel(); }}>
    <section className="weekly-send-confirmation teacher-exception-confirmation" dir={arabic ? "rtl" : "ltr"} role="alertdialog" aria-modal="true" aria-labelledby="teacher-exception-title">
      <span aria-hidden="true">{arabic ? "✓" : "GS"}</span><h3 id="teacher-exception-title">{arabic ? targets.length === 1 ? "نشر خطة هذا المعلم استثنائيًا؟" : "نشر كل الخطط غير المعتمدة استثنائيًا؟" : targets.length === 1 ? "Publish this teacher's plan exceptionally?" : "Publish all unapproved teacher plans exceptionally?"}</h3>
      <p><strong>{targets[0]?.weekLabel}</strong> · {arabic ? `${targets.length} خطة. ينشر المشرف العام الخطط المختارة المرسلة للمشرف مع الحفاظ على قرارات المشرفين. النشر متاح حتى مع غلق الأسبوع، وتظهر الخطط لأولياء الأمور فقط عندما يكون الأسبوع ظاهرًا.` : `${targets.length} teacher plan${targets.length === 1 ? "" : "s"}. The General Supervisor publishes the selected work sent to supervisors without changing any supervisor decision. Closed weeks are allowed; families can view content only when the week is visible.`}</p>
      <div className="teacher-exception-targets"><table><thead><tr><th>{arabic ? "المعلم" : "Teacher"}</th><th>{arabic ? "الفصل" : "Class"}</th><th>{arabic ? "المرحلة الحالية" : "Current stage"}</th><th>{arabic ? "الحصص المكتوبة" : "Written lessons"}</th></tr></thead><tbody>{targets.map((target) => <tr key={`${target.planId}-${target.teacherId}`}><td>{target.teacherName}</td><td>{target.className}</td><td>{arabic ? stages[target.stage] ?? target.stage : target.stage}</td><td>{target.lessonCount}</td></tr>)}</tbody></table></div>
      <div><button type="button" className="teacher-secondary-button" disabled={busy} onClick={onCancel}>{arabic ? "إلغاء" : "Cancel"}</button><button type="button" className="teacher-primary-button" disabled={busy || !targets.length} onClick={onConfirm}>{arabic ? busy ? "جارٍ النشر…" : "تأكيد النشر الاستثنائي" : busy ? "Publishing…" : "Confirm exceptional publication"}</button></div>
    </section>
  </div>;
}
