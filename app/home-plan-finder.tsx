"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";

type PublishedPlan = { grade: number; section: string; weekNumber: number; weekLabel: string };
const one = <T,>(value: T | T[] | null) => Array.isArray(value) ? value[0] ?? null : value;

export default function HomePlanFinder() {
  const [grade, setGrade] = useState("4");
  const [section, setSection] = useState("A");
  const [week, setWeek] = useState("");
  const [publishedPlans, setPublishedPlans] = useState<PublishedPlan[]>([]);
  const [isArabic, setIsArabic] = useState(false);

  useEffect(() => {
    setIsArabic(window.localStorage.getItem("andalus-language") === "ar");
    const loadPublishedPlans = async () => {
      const { data } = await getSupabaseBrowserClient().from("weekly_plans")
        .select("school_classes(grade, section), academic_weeks(week_number, label)")
        .eq("status", "published");
      setPublishedPlans(((data ?? []) as unknown as Record<string, unknown>[]).map((item) => {
        const schoolClass = one(item.school_classes as { grade: number; section: string } | { grade: number; section: string }[] | null);
        const academicWeek = one(item.academic_weeks as { week_number: number; label: string } | { week_number: number; label: string }[] | null);
        return schoolClass && academicWeek ? { grade: schoolClass.grade, section: schoolClass.section, weekNumber: academicWeek.week_number, weekLabel: academicWeek.label } : null;
      }).filter((plan): plan is PublishedPlan => plan !== null));
    };
    void loadPublishedPlans();
  }, []);

  const availableWeeks = useMemo(() => publishedPlans.filter((plan) => plan.grade === Number(grade) && plan.section === section).sort((a, b) => b.weekNumber - a.weekNumber), [grade, publishedPlans, section]);
  useEffect(() => setWeek((current) => availableWeeks.some((item) => String(item.weekNumber) === current) ? current : String(availableWeeks[0]?.weekNumber ?? "")), [availableWeeks]);
  const planUrl = `/weekly-plan/?grade=${grade}&section=${section}&week=${week}`;
  const gradeLabel = (number: number) => isArabic ? `الصف ${number}` : `Grade ${number}`;
  const classLabel = (value: string) => isArabic ? `الشعبة ${value === "A" ? "أ" : "ب"}` : `Class ${value}`;

  return <section id="plan-finder" className="finder-shell page-width" aria-label="Find your weekly plan" data-reveal>
    <div className="finder-heading"><span className="finder-icon">W</span><div><p className="eyebrow">{isArabic ? "مخطط أسبوعي" : "Weekly planner"}</p><h2>{isArabic ? "ابحث عن خطة الفصل" : "Find your class plan"}</h2></div></div>
    <div className="finder-fields">
      <label><span>{isArabic ? "الصف" : "Grade"}</span><select value={grade} onChange={(event) => setGrade(event.target.value)}>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{gradeLabel(index + 1)}</option>)}</select></label>
      <label><span>{isArabic ? "الشعبة" : "Class"}</span><select value={section} onChange={(event) => setSection(event.target.value)}><option value="A">{classLabel("A")}</option><option value="B">{classLabel("B")}</option></select></label>
      <label className="week-field"><span>{isArabic ? "الأسبوع الدراسي" : "School week"}</span><select value={week} disabled={availableWeeks.length === 0} onChange={(event) => setWeek(event.target.value)}>{availableWeeks.length === 0 ? <option value="">{isArabic ? "لا توجد خطط معتمدة بعد" : "No approved plans yet"}</option> : availableWeeks.map((item) => <option key={item.weekNumber} value={item.weekNumber}>{isArabic ? `الأسبوع ${item.weekNumber} · ${item.weekLabel}` : `Week ${item.weekNumber} · ${item.weekLabel}`}</option>)}</select></label>
      {week ? <Link href={planUrl} className="button button-primary finder-button">{isArabic ? "عرض الخطة" : "View plan"} <span>→</span></Link> : <span className="button button-primary finder-button" aria-disabled="true">{isArabic ? "عرض الخطة" : "View plan"} <span>→</span></span>}
    </div>
  </section>;
}
