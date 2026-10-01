"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { formatAcademicWeekRange } from "../../lib/format-academic-week";

type Week = { id: string; week_number: number; starts_on: string; ends_on: string };
type SchoolClass = { id: string; grade: number; section: string };
type Announcement = { id: string; week_id: string; class_id: string; title: string; body: string };

function errorText(error: unknown) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message : "The announcement could not be saved.";
}

export default function AnnouncementsPanel({ weeks, classes, adminId, weekId, onWeekChange, arabic }: {
  weeks: Week[]; classes: SchoolClass[]; adminId: string; weekId: string;
  onWeekChange: (value: string) => void; arabic: boolean;
}) {
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [items, setItems] = useState<Announcement[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (!classes.some((item) => item.id === classId)) setClassId(classes[0]?.id ?? "");
  }, [classes, classId]);

  const loadItems = useCallback(async () => {
    if (!weekId || !adminId) { setItems([]); return; }
    setLoading(true);
    try {
      const { data, error } = await getSupabaseBrowserClient().from("weekly_plan_announcements")
        .select("id, week_id, class_id, title, body")
        .eq("week_id", weekId).eq("created_by", adminId).order("class_id");
      if (error) throw error;
      setItems((data ?? []) as Announcement[]);
    } catch (error) {
      setFeedback(errorText(error));
    } finally {
      setLoading(false);
    }
  }, [weekId, adminId]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  useEffect(() => {
    const current = items.find((item) => item.class_id === classId);
    setTitle(current?.title ?? "");
    setBody(current?.body ?? "");
  }, [classId, items]);

  const save = async () => {
    if (!weekId || !classId || !adminId || !title.trim() || !body.trim()) {
      setFeedback(arabic ? "اختر الأسبوع والفصل واكتب عنوان الإعلان ونصه." : "Choose a week and class, then enter a title and announcement.");
      return;
    }
    setBusy(true); setFeedback("");
    try {
      const { error } = await getSupabaseBrowserClient().from("weekly_plan_announcements").upsert({
        week_id: weekId, class_id: classId, created_by: adminId,
        title: title.trim(), body: body.trim(), updated_at: new Date().toISOString(),
      }, { onConflict: "week_id,class_id" });
      if (error) throw error;
      await loadItems();
      setFeedback(arabic ? "تم حفظ الإعلان لهذا الفصل. سيظهر عند نشر الخطة وإظهار الأسبوع لولي الأمر." : "Announcement saved for this class. Families will see it when the plan and week are visible.");
    } catch (error) { setFeedback(errorText(error)); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    const current = items.find((item) => item.class_id === classId);
    if (!current || !window.confirm(arabic ? "حذف إعلان هذا الفصل؟" : "Delete this class announcement?")) return;
    setBusy(true); setFeedback("");
    try {
      const { error } = await getSupabaseBrowserClient().from("weekly_plan_announcements")
        .delete().eq("id", current.id).eq("created_by", adminId);
      if (error) throw error;
      await loadItems();
      setFeedback(arabic ? "تم حذف الإعلان." : "Announcement deleted.");
    } catch (error) { setFeedback(errorText(error)); }
    finally { setBusy(false); }
  };

  const classLabel = (item: SchoolClass) => arabic ? `الصف ${item.grade} · الشعبة ${item.section}` : `Grade ${item.grade} · Class ${item.section}`;

  return <section className="teacher-card farid-admin-announcements" dir={arabic ? "rtl" : "ltr"}>
    <div className="farid-feature-head"><span className="farid-feature-icon">✦</span><div><small>{arabic ? "مساحة إعلانات خاصة" : "PRIVATE ANNOUNCEMENT CONTROL"}</small><h2>{arabic ? "إعلانات الخطة الأسبوعية" : "Weekly plan announcements"}</h2><p>{arabic ? "اختر الأسبوع والفصل، ثم اكتب الإعلان الذي سيظهر فوق خطة ولي الأمر." : "Choose a week and class. The announcement appears above the family weekly plan."}</p></div></div>
    <div className="farid-feature-grid">
      <label>{arabic ? "الأسبوع" : "Week"}<select value={weekId} onChange={(event) => onWeekChange(event.target.value)}>{weeks.map((week) => <option key={week.id} value={week.id}>{arabic ? `الأسبوع ${week.week_number}` : `Week ${week.week_number}`} · {formatAcademicWeekRange(week, arabic ? "ar-EG" : "en-GB")}</option>)}</select></label>
      <label>{arabic ? "الفصل المستهدف" : "Target class"}<select value={classId} onChange={(event) => setClassId(event.target.value)}>{classes.map((item) => <option key={item.id} value={item.id}>{classLabel(item)}</option>)}</select></label>
      <label>{arabic ? "عنوان الإعلان" : "Announcement title"}<input maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Important announcement" /></label>
      <label className="farid-feature-wide">{arabic ? "نص الإعلان" : "Announcement text"}<textarea rows={4} maxLength={2500} value={body} onChange={(event) => setBody(event.target.value)} placeholder={arabic ? "اكتب الإعلان الذي سيظهر لأولياء أمور الفصل المختار" : "Write the announcement for this class"} /></label>
    </div>
    <div className="farid-feature-actions"><button type="button" className="teacher-primary-button" onClick={() => void save()} disabled={busy || loading}>{busy ? arabic ? "جارٍ الحفظ…" : "Saving…" : arabic ? "حفظ الإعلان" : "Save announcement"}</button>{items.some((item) => item.class_id === classId) && <button type="button" className="farid-feature-remove" onClick={() => void remove()} disabled={busy}>{arabic ? "حذف الإعلان" : "Delete announcement"}</button>}</div>
    {feedback && <p className="farid-feature-feedback" role="status">{feedback}</p>}
    <div className="farid-feature-list"><h3>{arabic ? "إعلانات الأسبوع المختار" : "Announcements for this week"}</h3>{items.length ? items.map((item) => <article key={item.id}><strong>{classLabel(classes.find((entry) => entry.id === item.class_id) ?? { id: item.class_id, grade: 0, section: "?" })}</strong><b>{item.title}</b><p>{item.body}</p></article>) : <p>{loading ? arabic ? "جارٍ تحميل الإعلانات…" : "Loading announcements…" : arabic ? "لا توجد إعلانات لهذا الأسبوع." : "No announcements for this week."}</p>}</div>
  </section>;
}
