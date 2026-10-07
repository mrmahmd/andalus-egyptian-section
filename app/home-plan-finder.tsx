"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabasePublicClient } from "../lib/supabase/client";
import { formatAcademicWeekRange } from "../lib/format-academic-week";

type PublishedPlan = { grade: number; section: string; weekNumber: number; weekLabel: string; startsOn: string; endsOn: string };
const one = <T,>(value: T | T[] | null) => Array.isArray(value) ? value[0] ?? null : value;

export default function HomePlanFinder() {
  const [grade, setGrade] = useState("1");
  const [section, setSection] = useState("A");
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [publishedPlans, setPublishedPlans] = useState<PublishedPlan[]>([]);
  const [loadError, setLoadError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isArabic, setIsArabic] = useState(false);

  useEffect(() => {
    const initialization = window.setTimeout(() => setIsArabic(window.localStorage.getItem("andalus-language") === "ar"), 0);
    return () => window.clearTimeout(initialization);
  }, []);

  const refreshPlans = useCallback(() => setRefreshVersion((current) => current + 1), []);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshPlans();
    };
    window.addEventListener("focus", refreshPlans);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshPlans);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshPlans]);

  useEffect(() => {
    let cancelled = false;
    const loadPublishedPlans = async () => {
      setLoadingPlans(true);
      setLoadError("");
      try {
        const { data, error } = await getSupabasePublicClient().from("weekly_plans")
          .select("school_classes(grade, section), academic_weeks!inner(week_number, label, starts_on, ends_on, parent_portal_visible)")
          .eq("status", "published")
          .eq("academic_weeks.parent_portal_visible", true);
        if (error) throw error;
        if (cancelled) return;
        setPublishedPlans(((data ?? []) as unknown as Record<string, unknown>[]).map((item) => {
          const schoolClass = one(item.school_classes as { grade: number; section: string } | { grade: number; section: string }[] | null);
          const academicWeek = one(item.academic_weeks as { week_number: number; label: string; starts_on: string; ends_on: string; parent_portal_visible: boolean } | { week_number: number; label: string; starts_on: string; ends_on: string; parent_portal_visible: boolean }[] | null);
          return schoolClass && academicWeek ? { grade: schoolClass.grade, section: schoolClass.section, weekNumber: academicWeek.week_number, weekLabel: academicWeek.label, startsOn: academicWeek.starts_on, endsOn: academicWeek.ends_on } : null;
        }).filter((plan): plan is PublishedPlan => plan !== null));
      } catch (error) {
        if (cancelled) return;
        setPublishedPlans([]);
        setLoadError(error instanceof Error ? error.message : "Published plans could not be loaded.");
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    };
    void loadPublishedPlans();
    return () => { cancelled = true; };
  }, [refreshVersion]);

  const availableWeeks = useMemo(() => publishedPlans.filter((plan) => plan.grade === Number(grade) && plan.section === section).sort((a, b) => b.weekNumber - a.weekNumber), [grade, publishedPlans, section]);
  const latestPlan = availableWeeks[0];
  const libraryUrl = `/weekly-plan/?grade=${grade}&section=${section}`;
  const planUrl = latestPlan ? `${libraryUrl}&week=${latestPlan.weekNumber}` : libraryUrl;
  const gradeLabel = (number: number) => isArabic ? `الصف ${number}` : `Grade ${number}`;
  const classLabel = (value: string) => isArabic ? `الشعبة ${value === "A" ? "أ" : "ب"}` : `Class ${value}`;

  return <section id="plan-finder" className="finder-shell page-width family-home-finder" aria-label={isArabic ? "اختر فصل طفلك" : "Choose your child’s class"} data-reveal>
    <div className="finder-heading"><span className="finder-icon" aria-hidden="true">WP</span><div><p className="eyebrow">{isArabic ? "ابدأ من هنا" : "START HERE"}</p><h2>{isArabic ? "اختر فصل طفلك" : "Choose your child’s class"}</h2><p className="family-finder-description">{isArabic ? "حدد الصف والشعبة، وسنفتح لك أحدث خطة متاحة." : "Choose a grade and class. We’ll find the latest available plan."}</p></div></div>
    <div className="finder-fields family-finder-fields">
      <label><span className="parent-selector-label"><b aria-hidden="true">1</b>{isArabic ? "الصف الدراسي" : "Grade"}</span><select value={grade} onChange={(event) => { setGrade(event.target.value); if(event.target.value === "2") setSection("A"); }}>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{gradeLabel(index + 1)}</option>)}</select></label>
      <fieldset className="parent-section-field"><legend><span className="parent-selector-label"><b aria-hidden="true">2</b>{isArabic ? "الشعبة" : "Class"}</span></legend><div className="parent-section-options">{(grade === "2" ? ["A"] : ["A","B"]).map(value => <button type="button" key={value} aria-pressed={section === value} onClick={() => setSection(value)}><span>{classLabel(value)}</span>{section === value && <span aria-hidden="true">✓</span>}</button>)}</div></fieldset>
    </div>
    <div className="family-finder-result"><div aria-live="polite" aria-atomic="true"><strong>{gradeLabel(Number(grade))} · {classLabel(section)}</strong><span>{loadingPlans ? (isArabic ? "جارٍ تحديث الخطط…" : "Updating plans…") : loadError ? (isArabic ? "تعذر تحميل الخطط" : "Plans could not be loaded") : latestPlan ? (isArabic ? `أحدث خطة: الأسبوع ${latestPlan.weekNumber}` : `Latest plan: Week ${latestPlan.weekNumber}`) : (isArabic ? "لا توجد خطط منشورة لهذا الفصل بعد" : "No published plans for this class yet")}</span>{!loadingPlans && !loadError && latestPlan && <small>{formatAcademicWeekRange({starts_on:latestPlan.startsOn,ends_on:latestPlan.endsOn},isArabic ? "ar-EG" : "en-GB")}</small>}</div>{!loadingPlans && !loadError && latestPlan ? <Link href={planUrl} className="button button-primary finder-button">{isArabic ? "عرض أحدث خطة" : "View latest plan"}<span aria-hidden="true">↗</span></Link> : <span className="button button-primary finder-button" aria-disabled="true">{isArabic ? "عرض أحدث خطة" : "View latest plan"}</span>}</div>
    <div className="family-finder-foot"><span>{isArabic ? "الخطط المنشورة من المدرسة فقط" : "School-published plans only"}</span><Link href={libraryUrl}>{isArabic ? "تصفح الأسابيع السابقة" : "Browse previous weeks"}<span aria-hidden="true">{isArabic ? "←" : "→"}</span></Link></div>
    {loadError && <p className="finder-load-error" role="alert">{isArabic ? "تعذر تحديث الخطط." : "Plans could not be refreshed."} <button type="button" onClick={refreshPlans}>{isArabic ? "إعادة المحاولة" : "Try again"}</button></p>}
  </section>;
}
