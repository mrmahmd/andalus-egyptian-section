"use client";

import { useEffect, useState } from "react";
import { getSupabasePublicClient } from "../../lib/supabase/client";

type Announcement = { id: string; day_of_week: number; title: string; body: string };
type Quiz = { id: string; day_of_week: number; programme: string; content: string };
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

function compactAnnouncementText(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/\n[\t ]*\n+/g, "\n").trim();
}

export default function ParentSpecialExtras({ weekId, classId, refreshVersion }: { weekId: string; classId: string; refreshVersion: number }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setAnnouncements([]); setQuizzes([]); setError(false);
      const supabase = getSupabasePublicClient();
      const [announcementResult, quizResult] = await Promise.all([
        supabase.from("weekly_plan_announcements").select("id, day_of_week, title, body")
          .eq("week_id", weekId).eq("class_id", classId).order("day_of_week"),
        supabase.from("farid_weekly_quizzes").select("id, day_of_week, programme, content")
          .eq("week_id", weekId).eq("class_id", classId).order("day_of_week").order("programme"),
      ]);
      if (cancelled) return;
      if (announcementResult.error || quizResult.error) { setError(true); return; }
      setAnnouncements((announcementResult.data ?? []) as Announcement[]);
      setQuizzes((quizResult.data ?? []) as Quiz[]);
    };
    void load();
    return () => { cancelled = true; };
  }, [weekId, classId, refreshVersion]);

  return <div className="parent-special-extras">
    {error && <p className="parent-special-error" role="alert">School announcements and quizzes could not be refreshed. Please try again.</p>}
    {announcements.length > 0 && <section className="parent-announcement-block" aria-label="School announcements"><h3>Announcement</h3><table><thead><tr><th>Day</th><th>Details</th></tr></thead><tbody>{announcements.map((announcement) => <tr key={announcement.id}><td>{days[announcement.day_of_week] ?? "School day"}</td><td><strong>{announcement.title}</strong><span>{compactAnnouncementText(announcement.body)}</span></td></tr>)}</tbody></table></section>}
    {quizzes.length > 0 && <section className="parent-special-quizzes" aria-label="Quizzes"><div className="parent-special-label"><span>Q</span> QUIZZES THIS WEEK</div><table><thead><tr><th>Day</th><th>Subject</th><th>Quiz content</th></tr></thead><tbody>{quizzes.map((quiz) => <tr key={quiz.id}><td>{days[quiz.day_of_week] ?? "School day"}</td><td>{quiz.programme}</td><td>{quiz.content}</td></tr>)}</tbody></table></section>}
  </div>;
}
