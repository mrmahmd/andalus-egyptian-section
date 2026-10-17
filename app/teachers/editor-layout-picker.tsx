import type { TeacherEditorLayout, EditorLayoutSyncState } from "../../lib/teacher-editor-layout";

export default function EditorLayoutPicker({ value, arabic, syncState, onChange }: {
  value: TeacherEditorLayout;
  arabic: boolean;
  syncState: EditorLayoutSyncState;
  onChange: (layout: TeacherEditorLayout) => void;
}) {
  const options = [
    { value: "columns" as const, title: arabic ? "عرض الأعمدة" : "Column view", description: arabic ? "الأيام بجوار بعضها" : "Days side by side" },
    { value: "rows" as const, title: arabic ? "العرض الأفقي" : "Horizontal view", description: arabic ? "كل يوم في صف وحصصه تحته" : "One day per row, lessons below" },
  ];
  return <fieldset className="teacher-editor-layout-picker" dir={arabic ? "rtl" : "ltr"}>
    <legend>{arabic ? "طريقة عرض المحرر" : "Editor layout"}</legend>
    <div className="teacher-editor-layout-options">{options.map((option) => <label key={option.value} title={option.description} className={value === option.value ? "selected" : ""}>
      <input type="radio" name="teacher-editor-layout" value={option.value} checked={value === option.value} disabled={syncState === "saving"} onChange={() => onChange(option.value)} />
      <span className={`editor-layout-icon ${option.value}`} aria-hidden="true"><i /><i /><i /></span>
      <span><strong>{option.title}</strong><small className="editor-layout-description">{option.description}</small></span>
      <span className="editor-layout-check" aria-hidden="true">{value === option.value ? "✓" : ""}</span>
    </label>)}</div>
    <p role="status" aria-live="polite">{syncState === "saved" ? arabic ? "محفوظ في حسابك على كل أجهزتك." : "Saved to your account across devices."
      : syncState === "saving" ? arabic ? "جارٍ حفظ الاختيار في حسابك…" : "Saving your account preference…"
      : syncState === "delegated" ? arabic ? "اختيار مؤقت أثناء العمل بالنيابة." : "Temporary view in the delegated workspace."
      : syncState === "error" ? arabic ? "تعذر الحفظ في الحساب؛ العرض مؤقت هنا." : "Account save failed; this view is temporary."
      : arabic ? "اختر طريقة العرض لحفظها في حسابك." : "Choose a layout to save it to your account."}
      {syncState === "error" && <button type="button" className="editor-layout-retry" onClick={() => onChange(value)}>{arabic ? "إعادة المحاولة" : "Retry"}</button>}
    </p>
  </fieldset>;
}
