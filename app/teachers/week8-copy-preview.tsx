export type Week8CopyPreviewData = {
  token: string;
  source_lessons: number;
  target_lessons: number;
  merged_slots: number;
  mappings: {
    subject: string;
    slot: { id: string; day_of_week: number; period_number: number };
    sources: { id: string; day_of_week: number; period_number: number }[];
    classwork: string;
    homework: string;
    classera_notes: string;
  }[];
};

export default function Week8CopyPreview({ preview, arabic }: { preview: Week8CopyPreviewData; arabic: boolean }) {
  const days = arabic ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
  return <section className="week8-copy-preview" aria-label={arabic ? "معاينة النسخ مع الدمج" : "Merge copy preview"}>
    <h4>{arabic ? "راجع التوزيع قبل تأكيد النسخ" : "Review the distribution before confirming"}</h4>
    <p>{arabic ? `${preview.source_lessons} حصص مكتوبة ← ${preview.target_lessons} حصص في الفصل المستهدف؛ ${preview.merged_slots} حصص تحتوي دمجًا.` : `${preview.source_lessons} written lessons → ${preview.target_lessons} target lessons; ${preview.merged_slots} merged slots.`}</p>
    <p>{arabic ? "الدمج لنفس المادة وفي نفس اليوم فقط. كل عمل الحصة والواجب وملاحظات كلاسيرا محفوظة؛ الخطة الأصلية لا تتغير. ستفتح النسخة كمسودة للمراجعة ولن تُرسل أو تُعتمد تلقائيًا." : "Merging is limited to the same subject and day. All Classwork, Homework and Classera notes are retained; the original is unchanged. The copy opens as a draft, not a submission or approval."}</p>
    {preview.mappings.map((mapping) => <article key={mapping.slot.id} className={mapping.sources.length > 1 ? "merged" : ""}>
      <strong>{mapping.subject} · {days[mapping.slot.day_of_week]} · {arabic ? "الحصة" : "Period"} {mapping.slot.period_number}</strong>
      <small>{arabic ? "من الحصص الأصلية: " : "From source lessons: "}{mapping.sources.map((source) => `${days[source.day_of_week]} / ${source.period_number}`).join(" + ")}</small>
      {([["classwork", arabic ? "عمل الحصة" : "Classwork"], ["homework", arabic ? "الواجب" : "Homework"], ["classera_notes", arabic ? "ملاحظات كلاسيرا" : "Classera notes"]] as const).map(([field, label]) => <details key={field} open={field === "classwork"}><summary>{label}</summary><div dir="auto">{mapping[field] || "—"}</div></details>)}
    </article>)}
  </section>;
}
