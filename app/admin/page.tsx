"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type PlanEntry = {
  id: string;
  day_of_week: number;
  period_number: number;
  classwork: string;
  homework: string;
  classera_notes: string;
  subjects: { name_en: string } | { name_en: string }[] | null;
  profiles: { display_name: string } | { display_name: string }[] | null;
};

type PublishedPlan = {
  id: string;
  updated_at: string;
  grade: number;
  section: string;
  week: string;
  weekNumber: number;
  entries: PlanEntry[];
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function AdminDashboardPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [administratorName, setAdministratorName] = useState("School Administrator");
  const [plans, setPlans] = useState<PublishedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [weekFilter, setWeekFilter] = useState("all");
  const [expandedPlanId, setExpandedPlanId] = useState("");

  const loadPublishedReport = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        window.location.assign(`${basePath}/teachers/login/`);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, role, status, staff_directory(administrative_role)")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      const staff = one(profile?.staff_directory as { administrative_role: string | null } | { administrative_role: string | null }[] | null);
      const isDeputy = profile?.role === "admin" && !String(staff?.administrative_role ?? "").includes("Supervisor");
      if (!profile || !isDeputy || profile.status !== "active") {
        window.location.assign(`${basePath}/teachers/login/`);
        return;
      }
      setAdministratorName(profile.display_name || "School Administrator");

      const { data, error } = await supabase
        .from("weekly_plans")
        .select("id, updated_at, school_classes(grade, section), academic_weeks(label, week_number), plan_entries(id, day_of_week, period_number, classwork, homework, classera_notes, subjects(name_en), profiles!plan_entries_teacher_id_fkey(display_name))")
        .eq("status", "published")
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const mappedPlans = (data ?? []).map((plan) => {
        const schoolClass = one(plan.school_classes as { grade: number; section: string } | { grade: number; section: string }[] | null);
        const week = one(plan.academic_weeks as { label: string; week_number: number } | { label: string; week_number: number }[] | null);
        return {
          id: String(plan.id),
          updated_at: String(plan.updated_at),
          grade: Number(schoolClass?.grade ?? 0),
          section: schoolClass?.section ?? "",
          week: week?.label ?? "Academic week",
          weekNumber: Number(week?.week_number ?? 0),
          entries: ((plan.plan_entries ?? []) as PlanEntry[]).sort((a, b) => a.day_of_week - b.day_of_week || a.period_number - b.period_number),
        } satisfies PublishedPlan;
      });
      setPlans(mappedPlans);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The published-plan report could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => { void loadPublishedReport(); }, [loadPublishedReport]);

  const grades = useMemo(() => Array.from(new Set(plans.map((plan) => plan.grade))).filter(Boolean).sort((a, b) => a - b), [plans]);
  const sections = useMemo(() => Array.from(new Set(plans.map((plan) => plan.section))).filter(Boolean).sort(), [plans]);
  const weeks = useMemo(() => Array.from(new Map(plans.map((plan) => [plan.weekNumber, plan.week])).entries()).sort(([a], [b]) => b - a), [plans]);
  const filteredPlans = useMemo(() => plans.filter((plan) =>
    (gradeFilter === "all" || String(plan.grade) === gradeFilter)
    && (sectionFilter === "all" || plan.section === sectionFilter)
    && (weekFilter === "all" || String(plan.weekNumber) === weekFilter),
  ), [plans, gradeFilter, sectionFilter, weekFilter]);
  const publishedEntries = filteredPlans.reduce((total, plan) => total + plan.entries.length, 0);

  const signOut = async () => {
    await getSupabaseBrowserClient().auth.signOut();
    window.location.assign(`${basePath}/teachers/login/`);
  };

  return (
    <main className="teacher-portal admin-portal admin-report-portal">
      <aside className="teacher-sidebar admin-sidebar">
        <div className="teacher-brand"><img src={`${basePath}/school-logo.jpeg`} alt="AlAndalus Private Schools" /><div><strong>ALANDALUS</strong><span>Administration Reports</span></div></div>
        <div className="teacher-school-year"><span>Academic year</span><strong>2026–2027</strong></div>
        <nav className="teacher-nav" aria-label="Administrative report navigation"><p>Administration</p><button className="active"><span className="teacher-nav-icon">RP</span>Published Plan Report<small>{plans.length}</small></button><p>Access</p><Link href="/weekly-plan/"><span className="teacher-nav-icon">FP</span>Family Plan Page</Link></nav>
        <div className="admin-permission-card report-access-card"><span>AR</span><div><strong>Read-only access</strong><p>View published plans for every grade and class.</p></div></div>
        <div className="teacher-sidebar-profile"><span className="teacher-avatar admin-avatar">AR</span><div><strong>{administratorName}</strong><small>Administrative account</small></div><button aria-label="Sign out" onClick={() => void signOut()}>↵</button></div>
      </aside>

      <section className="teacher-main">
        <header className="teacher-topbar"><div className="teacher-mobile-brand"><img src={`${basePath}/school-logo.jpeg`} alt="" /><strong>Administration Reports</strong></div><div className="teacher-top-actions"><span className="teacher-sync"><i /> Live school data</span><button className="teacher-profile-chip"><span className="teacher-avatar admin-avatar">AR</span><span><strong>{administratorName}</strong><small>Read-only reporting</small></span></button></div></header>
        <div className="teacher-content admin-content">
          <div className="teacher-page-heading"><div><p className="teacher-kicker">Administrative workspace</p><h1>Published Weekly Plan Report</h1><span>Review every published weekly plan by grade, class and academic week. This account cannot create, edit or submit plans.</span></div><Link className="teacher-primary-button admin-preview-link" href="/weekly-plan/">Open family plan <span>→</span></Link></div>
          {message && <p className="super-admin-live-message error" role="alert">{message}</p>}
          <section className="teacher-stats" aria-label="Published plan report summary"><article><span className="stat-icon navy">PL</span><div><small>Published plans</small><strong>{plans.length}</strong><p>Across the school</p></div></article><article><span className="stat-icon magenta">CL</span><div><small>Classes in view</small><strong>{new Set(filteredPlans.map((plan) => `${plan.grade}-${plan.section}`)).size}</strong><p>Selected report filters</p></div></article><article><span className="stat-icon cyan">EN</span><div><small>Published lessons</small><strong>{publishedEntries}</strong><p>Visible in these plans</p></div></article><article><span className="stat-icon amber">WK</span><div><small>School weeks</small><strong>{weeks.length}</strong><p>Available in the report</p></div></article></section>

          <section className="teacher-card admin-plans-card admin-report-card"><div className="admin-plan-toolbar"><div><h2>Full published-plan directory</h2><p>{loading ? "Loading live reports…" : `${filteredPlans.length} published plans shown`}</p></div><div className="admin-filters"><label>Grade<select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}><option value="all">All Grades</option>{grades.map((grade) => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label><label>Class<select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}><option value="all">All Classes</option>{sections.map((section) => <option key={section} value={section}>Class {section}</option>)}</select></label><label>Week<select value={weekFilter} onChange={(event) => setWeekFilter(event.target.value)}><option value="all">All Weeks</option>{weeks.map(([weekNumber, label]) => <option key={weekNumber} value={weekNumber}>{label}</option>)}</select></label></div></div>
            <div className="admin-plan-table-wrap"><table className="admin-plan-table"><thead><tr><th>Week</th><th>Class</th><th>Published lessons</th><th>Last updated</th><th>Report</th></tr></thead><tbody>{filteredPlans.map((plan) => <><tr key={plan.id}><td><strong>{plan.week}</strong></td><td><span className="admin-class-badge">Grade {plan.grade} · {plan.section}</span></td><td>{plan.entries.length}</td><td>{formatDate(plan.updated_at)}</td><td><button className="edit" onClick={() => setExpandedPlanId((current) => current === plan.id ? "" : plan.id)}>{expandedPlanId === plan.id ? "Close report" : "View full report"}</button></td></tr>{expandedPlanId === plan.id && <tr className="admin-report-details" key={`${plan.id}-details`}><td colSpan={5}><table><thead><tr><th>Day</th><th>Period</th><th>Subject & teacher</th><th>Classwork</th><th>Homework</th><th>Classera notes</th></tr></thead><tbody>{plan.entries.map((entry) => { const subject = one(entry.subjects); const teacher = one(entry.profiles); return <tr key={entry.id}><td>{dayNames[entry.day_of_week] ?? "School day"}</td><td>{entry.period_number}</td><td><strong>{subject?.name_en ?? "Subject"}</strong><small>{teacher?.display_name ?? "Teacher"}</small></td><td>{entry.classwork || "—"}</td><td>{entry.homework || "—"}</td><td>{entry.classera_notes || "—"}</td></tr>; })}</tbody></table></td></tr>}</>)}{!loading && filteredPlans.length === 0 && <tr><td className="admin-empty" colSpan={5}>No published plans match these filters yet.</td></tr>}</tbody></table></div>
          </section>
        </div>
      </section>
    </main>
  );
}
