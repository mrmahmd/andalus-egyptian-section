import type { TeacherEditorLayout } from "../../lib/teacher-editor-layout";

export default function EditorLayoutPicker({ value, arabic, sessionOnly, onChange }: {
  value: TeacherEditorLayout;
  arabic: boolean;
  sessionOnly: boolean;
  onChange: (layout: TeacherEditorLayout) => void;
}) {
  const options = [
    { value: "columns" as const, title: arabic ? "عرض الأعمدة" : "Column view", description: arabic ? "الأيام بجوار بعضها" : "Days side by side" },
    { value: "rows" as const, title: arabic ? "العرض الأفقي" : "Horizontal view", description: arabic ? "كل يوم في صف وحصصه تحته" : "One day per row, lessons below" },
  ];
  return <fieldset className="teacher-editor-layout-picker" dir={arabic ? "rtl" : "ltr"}>
    <legend>{arabic ? "طريقة عرض المحرر" : "Editor layout"}</legend>
    <div className="teacher-editor-layout-options">{options.map((option) => <label key={option.value} title={option.description} className={value === option.value ? "selected" : ""}>
      <input type="radio" name="teacher-editor-layout" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
      <span className={`editor-layout-icon ${option.value}`} aria-hidden="true"><i /><i /><i /></span>
      <span><strong>{option.title}</strong><small className="editor-layout-description">{option.description}</small></span>
      <span className="editor-layout-check" aria-hidden="true">{value === option.value ? "✓" : ""}</span>
    </label>)}</div>
    <p role="status">{sessionOnly
      ? arabic ? "الاختيار لهذه الجلسة فقط؛ المتصفح لا يسمح بحفظ التفضيلات. محتوى الخطة لا يتغير." : "This choice lasts for this session only; your browser blocked preference storage. Plan content is unchanged."
      : arabic ? "اختيارك محفوظ على هذا الجهاز فقط." : "Remembered on this device only."}</p>
  </fieldset>;
}
