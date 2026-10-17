import type { TeacherEditorLayout } from "../../lib/teacher-editor-layout";

export default function EditorLayoutPicker({ value, arabic, sessionOnly, onChange }: {
  value: TeacherEditorLayout;
  arabic: boolean;
  sessionOnly: boolean;
  onChange: (layout: TeacherEditorLayout) => void;
}) {
  const options = [
    { value: "columns" as const, title: arabic ? "العرض الحالي" : "Column view", description: arabic ? "الأيام بجوار بعضها" : "Days side by side" },
    { value: "rows" as const, title: arabic ? "العرض الأفقي" : "Horizontal view", description: arabic ? "كل يوم في صف وحصصه تحته" : "One day per row, lessons below" },
  ];
  return <fieldset className="teacher-editor-layout-picker" dir={arabic ? "rtl" : "ltr"}>
    <legend>{arabic ? "طريقة عرض المحرر" : "Editor layout"}</legend>
    <div className="teacher-editor-layout-options">{options.map((option) => <label key={option.value} className={value === option.value ? "selected" : ""}>
      <input type="radio" name="teacher-editor-layout" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
      <span className={`editor-layout-icon ${option.value}`} aria-hidden="true"><i /><i /><i /></span>
      <span><strong>{option.title}</strong><small>{option.description}</small></span>
      <span className="editor-layout-check" aria-hidden="true">{value === option.value ? "✓" : ""}</span>
    </label>)}</div>
    <p role="status">{sessionOnly
      ? arabic ? "الاختيار لهذه الجلسة فقط؛ المتصفح لا يسمح بحفظ التفضيلات. محتوى الخطة لا يتغير." : "This choice lasts for this session only; your browser blocked preference storage. Plan content is unchanged."
      : arabic ? "يحفظ اختيارك على هذا الجهاز. التبديل لا يغيّر كتابتك أو حالة الخطة." : "Your choice is remembered on this device. Switching does not change your writing or plan status."}</p>
  </fieldset>;
}
