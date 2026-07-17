"use client";

import { useEffect, useState } from "react";

const ar: Record<string, string> = {
  "Home": "الرئيسية", "Weekly Plan": "الخطة الأسبوعية", "Teacher Login": "دخول المعلمين", "Sign In": "تسجيل الدخول", "Create New Account": "إنشاء حساب جديد", "Full Name": "الاسم بالكامل", "Username": "اسم المستخدم", "Password": "كلمة المرور", "Account Type": "نوع الحساب", "Teacher": "معلم", "Admin": "إداري", "Teaching Department": "القسم التعليمي", "Administrative Position": "المسمى الإداري", "Deputy": "وكيل", "Department Supervisor": "مشرف شعبة", "Supervised Department": "القسم المُشرف عليه", "Create Account": "إنشاء الحساب",
  "Welcome back": "مرحبًا بعودتك", "Join the workspace": "انضم إلى مساحة العمل", "Sign in to your account": "سجل الدخول إلى حسابك", "Create your teacher account": "أنشئ حساب المعلم", "Enter your details to continue to the teacher dashboard.": "أدخل بياناتك للانتقال إلى لوحة تحكم المعلم.", "Add your account details, teaching classes and subjects.": "أضف بيانات حسابك والفصول والمواد التي تدرسها.", "Teacher Workspace": "مساحة عمل المعلمين", "Plan the week.": "خطط للأسبوع.", "Keep every family informed.": "وأبقِ كل أسرة على اطلاع.", "One weekly plan": "خطة أسبوعية واحدة", "Ready for families": "جاهزة لأولياء الأمور", "Print & PDF": "طباعة وملف PDF",
  "Teaching Assignments": "المواد والفصول", "Subject": "المادة", "Grade": "الصف", "Class": "الشعبة", "Add Assignment": "إضافة تكليف", "Add Another Assignment": "إضافة تكليف آخر", "No assignments added yet": "لم تتم إضافة أي تكليفات بعد", "Administrator access": "صلاحيات إداري", "Remember me": "تذكرني", "Forgot password?": "نسيت كلمة المرور؟", "First time here?": "أول مرة هنا؟", "Already have an account?": "لديك حساب بالفعل؟",
  "My Weekly Plans": "خططي الأسبوعية", "Create Weekly Plan": "إنشاء خطة أسبوعية", "Dashboard": "لوحة التحكم", "Published": "منشور", "Drafts": "مسودات", "Classes": "الفصول", "Subjects": "المواد", "All Weekly Plans": "كل الخطط الأسبوعية", "Account Approvals": "اعتمادات الحسابات", "Manage public weekly plans": "إدارة الخطط الأسبوعية العامة", "Manage Public Plans": "إدارة الخطط العامة", "Review": "مراجعة", "Manage": "إدارة", "Open workspace": "فتح لوحة التحكم", "Role": "الدور", "Status": "الحالة", "All Roles": "كل الأدوار", "All Statuses": "كل الحالات", "Pending": "قيد المراجعة", "Active": "نشط", "Rejected": "مرفوض", "Save account changes": "حفظ التعديلات", "Cancel": "إلغاء", "Approve account": "اعتماد الحساب", "Reject request": "رفض الطلب", "Account Role": "دور الحساب", "Teacher Classes & Subjects": "فصول ومواد المعلم", "Add assignment": "إضافة تكليف",
  "Sunday": "الأحد", "Monday": "الاثنين", "Tuesday": "الثلاثاء", "Wednesday": "الأربعاء", "Thursday": "الخميس", "Course": "المادة", "Classwork": "عمل الحصة", "Homework": "الواجب المنزلي", "Classera Notes": "ملاحظات كلاسيرا", "Notes": "ملاحظات", "Assessments & Quizzes": "الاختبارات والتقييمات", "Print / Save PDF": "طباعة / حفظ PDF", "Search": "بحث", "View Weekly Plan": "عرض الخطة الأسبوعية", "Back to home": "العودة للرئيسية", "Weekly Study Plan": "خطة الدراسة الأسبوعية"
};

function translatePage(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => { const value = node.nodeValue ?? ""; const trimmed = value.trim(); if (ar[trimmed]) node.nodeValue = value.replace(trimmed, ar[trimmed]); });
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[placeholder], textarea[placeholder]").forEach((field) => { if (ar[field.placeholder.trim()]) field.placeholder = ar[field.placeholder.trim()]; });
}

export default function LanguageSwitcher({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<"en" | "ar">("en");
  useEffect(() => { const stored = window.localStorage.getItem("andalus-language") as "en" | "ar" | null; if (stored) setLanguage(stored); }, []);
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = language === "ar" ? "rtl" : "ltr"; document.body.classList.toggle("arabic-ui", language === "ar"); if (language === "ar") translatePage(document.body); window.localStorage.setItem("andalus-language", language); }, [language]);
  return <>{children}<button className="language-switcher" type="button" onClick={() => { const next = language === "en" ? "ar" : "en"; window.localStorage.setItem("andalus-language", next); window.location.reload(); }}>{language === "en" ? "العربية" : "English"}</button></>;
}
