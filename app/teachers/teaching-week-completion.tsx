"use client";

import { useEffect, useState } from "react";
import { getStaffWorkspaceClient } from "../../lib/supabase/staff-workspace";
import { fetchTeachingWeek, summarizeTeachingWeek, teachingWeekMessage, type CompletionRequirement, type CompletionSnapshot, type TeachingWeekSummary } from "../../lib/teacher-week-completion";

export function TeachingWeekCompletionCard({ summary, arabic, weekNumber, busy, error, onRefresh, onOpenPlans }: {
  summary: TeachingWeekSummary | null; arabic: boolean; weekNumber: number; busy: boolean; error: boolean; onRefresh: () => void; onOpenPlans: () => void;
}) {
  const copy = summary && !error ? teachingWeekMessage(summary, arabic) : null;
  const success = summary && ["approved", "submitted", "partial"].includes(summary.state) && !error;
  return <section className={`teaching-week-completion ${error ? "unverified" : summary?.state ?? "checking"}`} dir={arabic ? "rtl" : "ltr"} aria-label={arabic ? "حالة إنجاز خططي" : "My weekly plan completion"}>
    <div className="teaching-week-icon" aria-hidden="true">{success ? summary?.state === "approved" ? "✓" : "✦" : error ? "!" : "☷"}</div>
    <div className="teaching-week-content"><small>{arabic ? `خططي · الأسبوع ${weekNumber}` : `My plans · Week ${weekNumber}`}</small>
      <div role="status" aria-live="polite"><h3>{error ? arabic ? "تعذر التحقق من حالة الخطط" : "Plan status could not be verified" : copy?.title ?? (arabic ? "جارٍ التحقق من خططك…" : "Checking your plans…")}</h3>
        <p>{error ? arabic ? "حاول تحديث الحالة. لم يتم تغيير أي خطة أو كتابة محفوظة." : "Refresh the status and try again. No plans or saved writing were changed." : copy?.detail}</p></div>
      {summary && !error && summary.lessons > 0 && <div className="teaching-week-counts"><span>{arabic ? `الفصول المطلوبة: ${summary.classes}` : `Required classes: ${summary.classes}`}</span><span>{arabic ? `حصص مكتملة: ${summary.lessons - summary.missing} / ${summary.lessons}` : `Complete lessons: ${summary.lessons - summary.missing} / ${summary.lessons}`}</span></div>}
    </div>
    <div className="teaching-week-actions"><button type="button" disabled={busy} onClick={onRefresh}>{busy ? arabic ? "جارٍ التحديث…" : "Refreshing…" : arabic ? "تحديث الحالة" : "Refresh status"}</button>{summary && !error && summary.lessons > 0 && <button type="button" onClick={onOpenPlans}>{arabic ? "عرض خططي" : "View my plans"}</button>}</div>
  </section>;
}

export default function TeachingWeekCompletion({ teacherId, weekId, weekNumber, requirements, arabic, enabled, onOpenPlans, onVerified }: {
  teacherId: string; weekId: string; weekNumber: number; requirements: CompletionRequirement[]; arabic: boolean; enabled: boolean; onOpenPlans: () => void;
  onVerified?: (weekId: string, data: CompletionSnapshot) => void;
}) {
  const [snapshot, setSnapshot] = useState<{ teacherId: string; weekId: string; data: CompletionSnapshot | null; error: boolean } | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!enabled || !teacherId || !weekId) return;
    let active = true, inFlight = false;
    const refresh = async () => {
      if (!active || inFlight || document.visibilityState !== "visible") return;
      inFlight = true; setBusy(true);
      try {
        const data = await fetchTeachingWeek(getStaffWorkspaceClient(), teacherId, weekId);
        if (active) { setSnapshot({ teacherId, weekId, data, error: false }); onVerified?.(weekId, data); }
      } catch { if (active) setSnapshot({ teacherId, weekId, data: null, error: true }); }
      finally { inFlight = false; if (active) setBusy(false); }
    };
    void refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [teacherId, weekId, enabled, refreshVersion, onVerified]);
  if (!enabled || !teacherId || !weekId) return null;
  const scoped = snapshot?.teacherId === teacherId && snapshot.weekId === weekId ? snapshot : null;
  const summary = scoped?.data ? summarizeTeachingWeek(requirements, scoped.data) : null;
  return <TeachingWeekCompletionCard summary={summary} arabic={arabic} weekNumber={weekNumber} busy={busy} error={Boolean(scoped?.error)} onRefresh={() => setRefreshVersion(v => v + 1)} onOpenPlans={onOpenPlans} />;
}
