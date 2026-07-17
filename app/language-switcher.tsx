"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const ar: Record<string, string> = {
  "Home": "الرئيسية", "Weekly Plan": "الخطة الأسبوعية", "How it works": "كيف تعمل المنصة؟", "Technical Support": "الدعم الفني", "Support": "الدعم الفني", "Teacher Login": "دخول المعلمين",
  "Back to Home": "العودة للرئيسية", "FAMILY ACCESS": "بوابة أولياء الأمور", "Weekly Plan Library": "مكتبة الخطط الأسبوعية", "Select a class to view every weekly plan published by the school.": "اختر الصف والشعبة لعرض كل الخطط الأسبوعية المنشورة من المدرسة.", "PLAN FINDER": "البحث عن الخطة", "Choose your child’s class": "اختر صف وشعبة الطالب", "Plans remain available here for families to revisit whenever needed.": "تظل الخطط متاحة هنا ليعود إليها أولياء الأمور في أي وقت.", "Showing plans for": "الخطط المعروضة لـ", "Available weekly plans": "الخطط الأسبوعية المتاحة", "plans available": "خطط متاحة", "Available": "متاح", "Latest": "الأحدث", "Coming soon": "قريبًا", "Print / Download": "طباعة / تحميل", "OFFICIAL WEEKLY PLAN": "الخطة الأسبوعية المعتمدة", "Back to Plans": "العودة إلى الخطط", "Print / Save PDF": "طباعة / حفظ PDF", "Change class": "تغيير الفصل",
  "Grade": "الصف", "Class": "الشعبة", "Sign In": "تسجيل الدخول", "Create New Account": "إنشاء حساب جديد", "Full Name": "الاسم بالكامل", "Username": "اسم المستخدم", "Password": "كلمة المرور", "Account Type": "نوع الحساب", "Teacher": "معلم", "Admin": "إداري", "Teaching Department": "القسم التعليمي", "Administrative Position": "المسمى الإداري", "Deputy": "وكيل", "Department Supervisor": "مشرف شعبة", "Supervised Department": "القسم المُشرف عليه", "Create Account": "إنشاء الحساب",
  "Teacher Workspace": "مساحة عمل المعلمين", "Welcome back": "مرحبًا بعودتك", "Join the workspace": "انضم إلى مساحة العمل", "Sign in to your account": "سجل الدخول إلى حسابك", "Create your teacher account": "أنشئ حساب المعلم", "Teaching Assignments": "المواد والفصول", "Subject": "المادة", "Add Assignment": "إضافة تكليف", "Add Another Assignment": "إضافة تكليف آخر", "Remember me": "تذكرني", "Forgot password?": "نسيت كلمة المرور؟",
  "Overview": "نظرة عامة", "Weekly Plans": "الخطط الأسبوعية", "My Classes": "فصولي", "My Subjects": "موادي", "Calendar": "التقويم", "Workspace": "مساحة العمل", "Account": "الحساب", "Settings": "الإعدادات", "Academic year": "العام الدراسي", "Good evening, Mr. Mohamed.": "مساء الخير، أستاذ محمد.", "Here’s what is happening with your weekly plans.": "إليك آخر ما يحدث في خططك الأسبوعية.", "Create weekly entry": "إضافة إدخال أسبوعي", "This week’s plans": "خطط هذا الأسبوع", "Weekly progress": "التقدم الأسبوعي", "My assignments": "تكليفاتي", "Edit": "تعديل", "Delete": "حذف", "Actions": "الإجراءات", "Published": "منشور", "Drafts": "مسودات", "Needs review": "تحتاج مراجعة", "All Weekly Plans": "كل الخطط الأسبوعية", "Teacher Accounts": "حسابات المعلمين", "Activity Log": "سجل النشاط", "Open public plan": "فتح الخطة العامة",
  "HELP DESK": "مكتب الدعم", "Tell us what happened and send your message directly to the school support team on WhatsApp.": "اكتب المشكلة وسنجهز رسالتك مباشرة لفريق دعم المدرسة على واتساب.", "We are here to help.": "نحن هنا لمساعدتك.", "Describe the issue": "اشرح المشكلة", "Send to WhatsApp": "الإرسال إلى واتساب", "SUPPORT REQUEST": "طلب دعم", "How can we help?": "كيف يمكننا مساعدتك؟", "Your Name": "الاسم", "Phone Number or Email": "رقم الهاتف أو البريد الإلكتروني", "Issue Category": "نوع المشكلة", "Describe the Problem": "وصف المشكلة", "Website issue": "مشكلة في الموقع", "Weekly plan issue": "مشكلة في الخطة الأسبوعية", "Account issue": "مشكلة في الحساب", "Other technical issue": "مشكلة تقنية أخرى", "What happens next?": "ماذا سيحدث بعد ذلك؟", "After you press the button, WhatsApp opens with your message ready. Press Send in WhatsApp to deliver it to school support.": "بعد الضغط على الزر سيفتح واتساب والرسالة جاهزة. اضغط إرسال داخل واتساب لتصل إلى دعم المدرسة.", "Send via WhatsApp": "إرسال عبر واتساب", "Your message is sent to the school support number: 00966552019074.": "ستُرسل رسالتك إلى رقم دعم المدرسة: 00966552019074.",
  "Sunday": "الأحد", "Monday": "الاثنين", "Tuesday": "الثلاثاء", "Wednesday": "الأربعاء", "Thursday": "الخميس", "Course": "المادة", "Classwork": "عمل الحصة", "Homework": "الواجب المنزلي", "Classera Notes": "ملاحظات كلاسيرا", "Notes": "ملاحظات", "Assessments & Quizzes": "الاختبارات والتقييمات"
};

function translatePage(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    if (node.parentElement?.closest(".plan-paper, .super-admin-portal")) return;
    const original = node.nodeValue ?? "";
    const value = original.trim();
    if (ar[value]) node.nodeValue = original.replace(value, ar[value]);
  });
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[placeholder], textarea[placeholder]").forEach((field) => {
    if (field.closest(".plan-paper, .super-admin-portal")) return;
    if (ar[field.placeholder.trim()]) field.placeholder = ar[field.placeholder.trim()];
  });
}

export default function LanguageSwitcher({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const pathname = usePathname();
  useEffect(() => { const stored = window.localStorage.getItem("andalus-language") as "en" | "ar" | null; if (stored) setLanguage(stored); }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.body.classList.toggle("arabic-ui", language === "ar");
    window.localStorage.setItem("andalus-language", language);
    if (language !== "ar") return;
    translatePage(document.body);
    const observer = new MutationObserver(() => translatePage(document.body));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language, pathname]);
  return <>{children}{!pathname.endsWith("/super-admin") && <button className="language-switcher" type="button" onClick={() => { const next = language === "en" ? "ar" : "en"; window.localStorage.setItem("andalus-language", next); window.location.reload(); }}>{language === "en" ? "العربية" : "English"}</button>}</>;
}
