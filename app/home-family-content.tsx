"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HomeReveal from "./home-reveal";
import HomePlanFinder from "./home-plan-finder";

function ServiceIcon({ kind }: { kind: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === "plans" ? <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16m-12 4h3m-3 3h7" /></> : kind === "timetable" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 1v-9.5a8.5 8.5 0 0 1 18 0Z" /><path d="M8 11h8m-8 4h5" /></>}</svg>;
}

export default function HomeFamilyContent({ basePath }: { basePath: string }) {
  const [arabic, setArabic] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setArabic(window.localStorage.getItem("andalus-language") === "ar"), 0); return () => window.clearTimeout(timer); }, []);
  const services = [
    { kind: "plans", href: "/weekly-plan", title: arabic ? "الخطط الأسبوعية" : "Weekly plans", text: arabic ? "كل الأسابيع المتاحة، للعرض والطباعة." : "Browse, save and print every available week." },
    { kind: "timetable", href: "/timetable", title: arabic ? "جدول الحصص" : "Class timetable", text: arabic ? "مواد وحصص طفلك مرتبة حسب اليوم." : "Your child’s subjects and lessons, day by day." },
    { kind: "support", href: "/support", title: arabic ? "الدعم الفني" : "Technical support", text: arabic ? "تحتاج مساعدة؟ تواصل معنا بسهولة." : "Need a hand? We’re here to help." },
  ];
  const steps = [
    [arabic ? "اختر الفصل" : "Choose a class", arabic ? "حدد الصف والشعبة من البطاقة أعلاه." : "Select your child’s grade and class above."],
    [arabic ? "افتح أحدث خطة" : "Open the latest plan", arabic ? "تابع الدروس والواجبات وملاحظات المعلمين." : "Follow lessons, homework and teacher notes."],
    [arabic ? "احفظها أو اطبعها" : "Save or print", arabic ? "احتفظ بنسخة للمتابعة طوال الأسبوع." : "Keep a copy to follow throughout the week."],
  ];
  return <HomeReveal><div className="family-home" dir={arabic ? "rtl" : "ltr"}>
    <header className="site-header"><Link href="/" className="brand-lockup" aria-label={arabic ? "مدارس الأندلس — الرئيسية" : "AlAndalus Private Schools home"}><img src={`${basePath}/school-logo.png`} alt="AlAndalus Private Schools" /><span className="brand-copy"><strong>{arabic ? "مدارس الأندلس الأهلية" : "AlAndalus Private Schools"}</strong><small>{arabic ? "المسار المصري" : "Egyptian Section"}</small><em>{arabic ? "بوابة أولياء الأمور" : "Family portal"}</em></span></Link><nav className="desktop-nav" aria-label={arabic ? "التنقل الرئيسي" : "Main navigation"}><Link className="active" href="/">{arabic ? "الرئيسية" : "Home"}</Link><Link href="/weekly-plan">{arabic ? "الخطة الأسبوعية" : "Weekly Plan"}</Link><Link href="/timetable">{arabic ? "جدول الحصص" : "Timetable"}</Link><Link href="/support">{arabic ? "الدعم الفني" : "Technical Support"}</Link></nav></header>
    <section className="hero-section"><div className="hero-photo" style={{ backgroundImage: `url('${basePath}/school-building.jpeg')` }} role="img" aria-label={arabic ? "مبنى مدارس الأندلس — المسار المصري" : "AlAndalus Egyptian Section school building"} /><div className="hero-wash" /><div className="hero-content page-width"><div className="hero-kicker"><span />{arabic ? "معًا نتابع كل خطوة" : "A little clarity. A better school week."}</div><h1>{arabic ? "خطة طفلك الأسبوعية" : "Your child’s school week,"}<br /><span>{arabic ? "في مكان واحد" : "all in one place."}</span></h1><p>{arabic ? "الدروس والواجبات وملاحظات المعلمين، في خطة واضحة وسهلة المتابعة." : "Lessons, homework and teacher notes, beautifully organised and easy to follow."}</p><div className="hero-actions"><a className="button button-primary" href="#plan-finder">{arabic ? "اختر فصل طفلك" : "Choose your child’s class"}<span aria-hidden="true">↓</span></a><span className="family-hero-note">{arabic ? "متاحة بدون تسجيل دخول" : "No parent sign-in needed"}</span></div></div><div className="hero-year" aria-hidden="true">EST. 1984</div></section>
    <HomePlanFinder />
    <section className="family-services page-width" aria-labelledby="family-services-title" data-reveal><div className="family-section-heading"><div><p className="eyebrow">{arabic ? "كل ما تحتاجه" : "FAMILY ESSENTIALS"}</p><h2 id="family-services-title">{arabic ? "خدماتك في مكان واحد" : "Everything within reach"}</h2></div><span>{arabic ? "وصول سريع وسهل" : "Simple. Clear. Connected."}</span></div><div className="family-service-grid">{services.map(service => <Link href={service.href} key={service.kind} className={`family-service-card family-service-${service.kind}`}><span className="family-service-icon"><ServiceIcon kind={service.kind} /></span><div><h3>{service.title}</h3><p>{service.text}</p></div><span className="family-service-arrow" aria-hidden="true">{arabic ? "←" : "→"}</span></Link>)}</div></section>
    <section id="how-it-works" className="family-guide page-width" aria-labelledby="family-guide-title" data-reveal><div className="family-section-heading"><div><p className="eyebrow">{arabic ? "٣ خطوات بسيطة" : "THREE SIMPLE STEPS"}</p><h2 id="family-guide-title">{arabic ? "متابعة أسهل، أسبوع أفضل" : "A calmer week starts here"}</h2></div></div><ol>{steps.map(([title,text], index) => <li key={index}><span>{String(index+1).padStart(2,"0")}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
    <footer className="site-footer"><div className="page-width footer-grid"><div className="footer-brand"><img src={`${basePath}/school-logo.png`} alt="" /><div><strong>{arabic ? "مدارس الأندلس الأهلية" : "ALANDALUS PRIVATE SCHOOLS"}</strong><span>{arabic ? "المسار المصري" : "Egyptian Section"}</span></div></div><p>{arabic ? "العام الدراسي 2026–2027" : "Academic Year 2026–2027"}</p><Link href="/support">{arabic ? "تواصل مع الدعم الفني" : "Contact technical support"}</Link></div></footer>
  </div></HomeReveal>;
}
