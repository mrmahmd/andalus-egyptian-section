"use client";

import { useEffect, useRef, useState } from "react";

export default function ClosedWeekAlert({ arabic }: { arabic: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
      if (event.key === "Tab") { event.preventDefault(); closeButton.current?.focus(); }
    };
    if (!dismissed) document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); previousFocus?.focus(); };
  }, [dismissed]);
  if (dismissed) return null;
  return <div className="closed-week-alert-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDismissed(true); }}>
    <section className="closed-week-alert" role="alertdialog" aria-modal="true" aria-labelledby="closed-week-alert-title" aria-describedby="closed-week-alert-text" dir={arabic ? "rtl" : "ltr"}>
      <span className="closed-week-alert-icon" aria-hidden="true">!</span>
      <h2 id="closed-week-alert-title">{arabic ? "الأسبوع مغلق" : "This week is closed"}</h2>
      <p id="closed-week-alert-text">{arabic ? "تواصل مع الإدارة." : "Contact administration."}</p>
      <button ref={closeButton} type="button" onClick={() => setDismissed(true)}>{arabic ? "حسنًا" : "OK"}</button>
    </section>
  </div>;
}
