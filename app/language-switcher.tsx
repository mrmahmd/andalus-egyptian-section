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

const homeAr: Record<string, string> = {
  "Home": "الرئيسية", "Weekly Plan": "الخطة الأسبوعية", "Timetable": "جدول الحصص", "Portal": "البوابة", "School Portal": "بوابة المدرسة", "How it works": "كيف تعمل المنصة؟", "Technical Support": "الدعم الفني", "Support": "الدعم الفني",
  "Weekly plans are published every Thursday for the following school week.": "تُنشر الخطط الأسبوعية كل يوم خميس للأسبوع الدراسي التالي.",
  "ALANDALUS PRIVATE SCHOOLS": "مدارس الأندلس الأهلية", "Egyptian Section · Weekly Study Plan": "المسار المصري · الخطة الدراسية الأسبوعية", "Egyptian Section": "المسار المصري",
  "Find your plan": "ابحث عن خطتك", "One clear plan.": "خطة واحدة واضحة.", "A stronger school week.": "أسبوع دراسي أكثر تنظيمًا.",
  "Everything families need to follow lessons, homework, and teacher notes—beautifully organised in one place.": "كل ما يحتاجه ولي الأمر لمتابعة الدروس والواجبات وملاحظات المعلمين، في مكان واحد منظم.",
  "Find your weekly plan": "ابحث عن خطتك الأسبوعية", "View sample plan": "عرض نموذج الخطة", "Weekly planner": "مخطط أسبوعي", "Find your class plan": "ابحث عن خطة الفصل",
  "Grade": "الصف", "Class": "الشعبة", "School week": "الأسبوع الدراسي", "Select grade": "اختر الصف", "Select class": "اختر الشعبة", "View plan": "عرض الخطة",
  "Designed around families": "مصممة لأولياء الأمور", "School planning that feels effortless.": "تنظيم مدرسي واضح وسهل.", "A calm, reliable view of the week—on any screen, at any time.": "متابعة هادئة وموثوقة للأسبوع، من أي جهاز وفي أي وقت.",
  "Clear weekly learning": "تعلم أسبوعي واضح", "Classwork, homework, and Classera notes arranged by subject and school day.": "عمل الحصة والواجبات وملاحظات كلاسيرا مرتبة حسب المادة واليوم الدراسي.",
  "Updated by teachers": "يُحدّثه المعلمون", "Every subject teacher adds their own plan, so families always see the latest version.": "يضيف كل معلم خطته، لتظهر لولي الأمر أحدث نسخة دائمًا.",
  "Ready to print": "جاهزة للطباعة", "Open the complete weekly plan online or download a school-branded PDF in one click.": "اعرض الخطة كاملة على الموقع أو حمّل نسخة PDF رسمية بضغطة واحدة.",
  "A week at a glance": "الأسبوع في نظرة واحدة", "From Sunday to Thursday, nothing gets missed.": "من الأحد إلى الخميس، كل شيء واضح.", "Each subject appears in its own row, with classwork, homework, and notes kept clear and easy to scan.": "تظهر كل مادة في صف مستقل مع عمل الحصة والواجبات والملاحظات بشكل واضح.", "Explore the full weekly plan": "استكشف الخطة الأسبوعية الكاملة",
  "For families": "لأولياء الأمور", "Everything your child needs for the week.": "كل ما يحتاجه طفلك خلال الأسبوع.", "Open the approved school plan from any device, then save or print a copy whenever you need it.": "افتح الخطة المعتمدة من أي جهاز، ثم احفظها أو اطبعها وقتما تحتاج.", "View this week’s plan": "عرض خطة هذا الأسبوع",
  "Weekly Study Plan · Academic Year 2026–2027": "الخطة الدراسية الأسبوعية · العام الدراسي 2026–2027", "View weekly plan": "عرض الخطة الأسبوعية",
  "Class Timetable": "جدول الحصص", "Choose your child's grade and class to see the official lesson order for the week.": "اختر صف وشعبة طفلك لعرض ترتيب الحصص الرسمي خلال الأسبوع.", "Viewing timetable for": "الجدول المعروض لـ", "WEEKLY LESSON ORDER": "ترتيب الحصص الأسبوعي", "lessons": "حصص", "How this helps": "كيف يساعدك ذلك", "This order will later organise published weekly-plan subjects automatically.": "سيُنظّم هذا الجدول مواد الخطة الأسبوعية المنشورة تلقائيًا عند ربط النظام.",
  "Sunday": "الأحد", "Monday": "الاثنين", "Tuesday": "الثلاثاء", "Wednesday": "الأربعاء", "Thursday": "الخميس", "DAY": "اليوم", "COURSE": "المادة", "HOMEWORK": "الواجب", "Teacher updated": "يحدّثها المعلم", "Print-ready PDF": "PDF جاهز للطباعة"
};

Object.assign(homeAr, {
  "AlAndalus Private Schools": "مدارس الأندلس الأهلية",
  "Egyptian Section": "المسار المصري",
  "Weekly Plans Platform": "منصة الخطط الأسبوعية",
  "Browse weekly plans": "تصفح الخطط الأسبوعية",
  "Choose your child’s grade and class to see approved weekly plans published by the school.": "اختر صف الطالب وشعبته لعرض الخطط الأسبوعية المعتمدة والمنشورة من المدرسة.",
  "Only supervisor-approved plans are shown here. Previous plans remain available for families to revisit.": "تظهر هنا الخطط المعتمدة من المشرف فقط، وتبقى الخطط السابقة متاحة لرجوع أولياء الأمور إليها.",
  "Published plans for": "الخطط المنشورة لـ",
  "Academic Year 2026–2027": "العام الدراسي 2026–2027",
  "Loading published plans…": "جارٍ تحميل الخطط المنشورة…",
  "No approved weekly plans have been published for this class yet.": "لا توجد خطط أسبوعية معتمدة ومنشورة لهذا الفصل حتى الآن.",
  "No approved plans yet": "لا توجد خطط معتمدة بعد",
  "View": "عرض",
  "Week": "الأسبوع",
  "Available": "متاح",
  "Choose your child’s grade, class and any available school week from the plan library.": "اختر الصف والشعبة والأسبوع الدراسي المتاح من مكتبة الخطط.",
  "This approved plan does not contain lesson entries yet.": "لا تحتوي هذه الخطة المعتمدة على حصص مضافة حتى الآن.",
  "Notes and assessment details will appear here when they are added and approved by the school.": "ستظهر هنا الملاحظات وتفاصيل التقييم بعد إضافتها واعتمادها من المدرسة.",
  "Class Timetable": "جدول الحصص",
  "Choose your child's grade and class to see the official lesson order for the week.": "اختر صف الطالب وشعبته لعرض ترتيب الحصص الرسمي للأسبوع.",
  "Viewing timetable for": "الجدول المعروض لـ",
  "WEEKLY LESSON ORDER": "ترتيب الحصص الأسبوعي",
  "How this helps": "كيف يساعدك ذلك",
  "This order will later organise published weekly-plan subjects automatically.": "سينظم هذا الجدول مواد الخطة الأسبوعية المنشورة تلقائيًا.",
  "Weekly plan format preview": "معاينة تنسيق الخطة الأسبوعية",
  "WEEKLY PLAN": "الخطة الأسبوعية",
  "OFFICIAL SCHOOL FORMAT": "التنسيق المدرسي المعتمد",
  "Approved plans": "خطط معتمدة",
  "Available online": "متاحة عبر المنصة",
  "Clear lesson order": "ترتيب حصص واضح",
  "Easy to follow": "سهل المتابعة",
  "Official school format": "التنسيق المدرسي المعتمد",
  "Ready to print": "جاهزة للطباعة",
  "Open technical support": "فتح الدعم الفني",
});

const staffAr: Record<string, string> = {
  "School Staff Portal": "بوابة موظفي المدرسة", "One secure sign in.": "تسجيل دخول آمن واحد.", "Every workspace.": "كل لوحات التحكم.", "Teachers and administrators enter from one portal and continue to their correct workspace.": "يدخل المعلمون والإداريون من بوابة واحدة ثم ينتقل كل منهم إلى لوحته المناسبة.",
  "One portal": "بوابة واحدة", "Every school account begins from this single sign-in page.": "يبدأ كل حساب مدرسي من صفحة الدخول الموحدة هذه.", "Role-based access": "صلاحيات حسب الدور", "Your approved account opens only the workspace assigned to you.": "يفتح حسابك المعتمد لوحة التحكم المخصصة لك فقط.", "Ready for families": "جاهزة لأولياء الأمور", "Published plans appear on the parent-facing page.": "تظهر الخطط المنشورة في صفحة أولياء الأمور.",
  "Sign in to your school account": "سجّل دخولك إلى حساب المدرسة", "Create your school account": "أنشئ حساب المدرسة", "Your approved account will open the correct dashboard automatically.": "سيفتح حسابك المعتمد لوحة التحكم المناسبة تلقائيًا.",
  "Sign In": "تسجيل الدخول", "Create New Account": "إنشاء حساب جديد", "Welcome back": "مرحبًا بعودتك", "Join the workspace": "انضم إلى مساحة العمل", "Full Name": "الاسم بالكامل", "Username": "اسم المستخدم", "Password": "كلمة المرور", "Account Type": "نوع الحساب", "Teacher": "معلم", "Admin": "إداري", "Create Account": "إنشاء الحساب",
  "Teaching Department": "القسم التعليمي", "Teacher Name": "اسم المعلم", "Admin Name": "اسم الإداري", "Administrative Position": "المسمى الإداري", "Administrative Role": "الدور الإداري", "Administrative": "إداري", "English Supervisor": "مشرف اللغة الإنجليزية", "Arabic Supervisor": "مشرف اللغة العربية", "Math & Science Supervisor": "مشرف الماث والساينس", "Vice Principal": "وكيل", "Deputy": "وكيل", "Department Supervisor": "مشرف شعبة", "Supervised Department": "القسم المُشرف عليه", "Teaching Assignments": "المواد والفصول", "Subject": "المادة", "Grade": "الصف", "Class": "الشعبة", "Add Assignment": "إضافة تكليف", "Add Another Assignment": "إضافة تكليف آخر", "Remember me": "تذكرني", "Forgot password?": "هل نسيت كلمة المرور؟", "First time here?": "هل تزور البوابة لأول مرة؟", "Already have an account?": "لديك حساب بالفعل؟",
  "Teacher Workspace": "لوحة تحكم المعلم", "Overview": "نظرة عامة", "Weekly Plans": "الخطط الأسبوعية", "My Classes": "فصولي", "My Subjects": "موادي", "Calendar": "التقويم", "Workspace": "مساحة العمل", "Account": "الحساب", "Settings": "الإعدادات", "Academic year": "العام الدراسي", "Profile & assignments": "الملف الشخصي والتكليفات", "Need help?": "هل تحتاج مساعدة؟", "Open support": "فتح الدعم الفني", "All changes saved": "تم حفظ جميع التغييرات", "Create weekly entry": "إضافة إدخال أسبوعي", "Good evening, Mr. Mohamed.": "مساء الخير، أستاذ محمد.", "Here’s what is happening with your weekly plans.": "إليك آخر ما يحدث في خططك الأسبوعية.",
  "This week’s entries": "إدخالات هذا الأسبوع", "Published": "منشور", "Drafts": "مسودات", "Needs attention": "تحتاج متابعة", "This week’s plans": "خطط هذا الأسبوع", "Weekly progress": "التقدم الأسبوعي", "My assignments": "تكليفاتي", "Edit": "تعديل", "Delete": "حذف", "Save draft": "حفظ كمسودة", "Publish plan": "نشر الخطة", "Classwork": "عمل الحصة", "Homework": "الواجب المنزلي", "Classera Notes": "ملاحظات كلاسيرا", "Quizzes & Assessments": "الاختبارات والتقييمات",
  "Admin Control Center": "مركز تحكم الإدارة", "All Weekly Plans": "كل الخطط الأسبوعية", "Teacher Accounts": "حسابات المعلمين", "Activity Log": "سجل النشاط", "Open public plan": "فتح الخطة العامة", "Administration workspace": "مساحة عمل الإدارة", "Review and manage every published plan, draft and teacher submission.": "راجع وأدر كل خطة منشورة أو مسودة أو إدخال من المعلمين.", "Weekly plan directory": "دليل الخطط الأسبوعية", "Full administrator access": "صلاحيات إدارية كاملة", "Actions": "الإجراءات", "View": "عرض", "Cancel": "إلغاء", "Save changes": "حفظ التعديلات", "Delete this weekly plan?": "حذف هذه الخطة الأسبوعية؟"
};

Object.assign(staffAr, {
  "Loading teacher data…": "جارٍ تحميل بيانات المعلم…",
  "Weekly plan creation closed": "إنشاء الخطة الأسبوعية مغلق حاليًا",
  "Published entries": "إدخالات منشورة",
  "Visible after plan publication": "تظهر بعد نشر الخطة",
  "Draft entries": "إدخالات مسودة",
  "Timetable slots": "حصص الجدول",
  "Recent weekly entries": "أحدث الإدخالات الأسبوعية",
  "Academic Weeks": "الأسابيع الدراسية",
  "No academic weeks configured yet.": "لم يتم إعداد أسابيع دراسية بعد.",
  "Quiz or assessment": "اختبار أو تقييم",
  "Choose the subject, then add the quiz for this class.": "اختر المادة ثم أضف الاختبار لهذا الفصل.",
  "Quiz day": "يوم الاختبار",
  "Quiz details": "تفاصيل الاختبار",
  "Title, scope or revision pages": "العنوان أو المنهج أو صفحات المراجعة",
  "Read-only access": "صلاحية عرض فقط",
  "View published plans for every grade and class.": "عرض الخطط المنشورة لكل صف وشعبة.",
  "Published Weekly Plan Report": "تقرير الخطط الأسبوعية المنشورة",
  "Review every published weekly plan by grade, class and academic week. This account cannot create, edit or submit plans.": "راجع كل خطة أسبوعية منشورة حسب الصف والشعبة والأسبوع الدراسي. لا يمكن لهذا الحساب إنشاء أو تعديل أو إرسال الخطط.",
  "Open family plan": "فتح خطة أولياء الأمور",
  "Published plans": "الخطط المنشورة",
  "Across the school": "على مستوى المدرسة",
  "Classes in view": "الفصول المعروضة",
  "Selected report filters": "وفق عوامل التصفية المختارة",
  "Published lessons": "الحصص المنشورة",
  "Visible in these plans": "ظاهرة في هذه الخطط",
  "School weeks": "الأسابيع الدراسية",
  "Available in the report": "متاحة في التقرير",
  "Full published-plan directory": "دليل الخطط المنشورة الكامل",
  "Loading live reports…": "جارٍ تحميل التقارير…",
  "No published plans match these filters yet.": "لا توجد خطط منشورة مطابقة لعوامل التصفية حتى الآن.",
  "All Grades": "كل الصفوف",
  "All Classes": "كل الشعب",
  "All Weeks": "كل الأسابيع",
  "View full report": "عرض التقرير الكامل",
  "Close report": "إغلاق التقرير",
  "School Staff Portal": "بوابة موظفي المدرسة",
  "One secure sign in.": "تسجيل دخول آمن واحد.",
  "Every workspace.": "كل لوحات التحكم.",
  "Department Teachers": "معلمو الشعبة",
  "Department management": "إدارة الشعبة",
  "Manage only the teachers assigned to your supervision group.": "أدر فقط المعلمين المرتبطين بإشرافك.",
  "teachers": "معلّمًا",
  "Manage": "إدارة",
  "Account not registered yet": "الحساب لم يُسجل بعد",
  "Teacher assignments": "تكليفات المعلم",
  "Assign classes and subjects, or remove an existing assignment.": "أضف فصولًا ومواد للمعلم أو احذف أي تكليف موجود.",
  "This teacher must create and activate a school account before classes and subjects can be assigned.": "يجب أن ينشئ هذا المعلم حساب المدرسة ويُفعّل أولًا قبل إضافة الفصول والمواد.",
  "Select class": "اختر الفصل",
  "Select subject": "اختر المادة",
  "Assign to teacher": "إسناد للمعلم",
  "No classes or subjects assigned yet.": "لا توجد فصول أو مواد مسندة بعد.",
  "No teachers are linked to your department yet.": "لا يوجد معلمون مرتبطون بشعبتك حتى الآن.",
  "Supervisor workspace": "مساحة عمل المشرف",
  "Only your assigned teachers appear here. Read every lesson, homework item and Classera note before making a decision.": "تظهر هنا خطط معلميك المكلّفين فقط. راجع كل درس وواجب وملاحظة في كلاسيرا قبل اتخاذ القرار.",
  "Your approval publishes the subject for families": "اعتمادك ينشر المادة لأولياء الأمور",
  "Waiting for review": "بانتظار المراجعة",
  "Need your decision": "تحتاج قرارك",
  "Returned for changes": "أُعيدت للتعديل",
  "Waiting for teacher update": "بانتظار تعديل المعلم",
  "Approved & published": "معتمدة ومنشورة",
  "Visible to families": "ظاهرة لأولياء الأمور",
  "No plans match this review status yet.": "لا توجد خطط بهذه الحالة حاليًا.",
  "Your review note": "ملاحظتك للمراجعة",
  "The teacher has been asked to revise this plan.": "طُلب من المعلم تعديل هذه الخطة.",
  "Published for families": "منشورة لأولياء الأمور",
  "This subject was approved and is currently visible in the family weekly plan.": "تم اعتماد هذه المادة وهي ظاهرة حاليًا في الخطة الأسبوعية لأولياء الأمور.",
  "Read every lesson, homework item and Classera note. Your approval publishes that subject for families immediately.": "راجع كل درس وواجب وملاحظة في Classera؛ فاعتمادك ينشر المادة لأولياء الأمور فورًا.",
  "Approve & publish": "اعتماد ونشر",
  "The plan was approved and is now published for families.": "تم اعتماد الخطة ونشرها فورًا لأولياء الأمور.",
  "Teacher Reviews": "\u0645\u0631\u0627\u062c\u0639\u0629 \u062e\u0637\u0637 \u0627\u0644\u0645\u0639\u0644\u0645\u064a\u0646", "Teacher plans for review": "\u062e\u0637\u0637 \u0627\u0644\u0645\u0639\u0644\u0645\u064a\u0646 \u0644\u0644\u0645\u0631\u0627\u062c\u0639\u0629", "Read every lesson, homework item and Classera note before approving a submission.": "\u0627\u0642\u0631\u0623 \u0643\u0644 \u062f\u0631\u0633 \u0648\u0648\u0627\u062c\u0628 \u0648\u0645\u0644\u0627\u062d\u0638\u0629 \u0641\u064a Classera \u0642\u0628\u0644 \u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u062e\u0637\u0629.", "Review note": "\u0645\u0644\u0627\u062d\u0638\u0629 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629", "Write the required changes for the teacher": "\u0627\u0643\u062a\u0628 \u0627\u0644\u062a\u0639\u062f\u064a\u0644\u0627\u062a \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0645\u0646 \u0627\u0644\u0645\u0639\u0644\u0645", "Return for changes": "\u0625\u0631\u062c\u0627\u0639 \u0644\u0644\u062a\u0639\u062f\u064a\u0644", "Approve plan": "\u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u062e\u0637\u0629", "No teacher plans are waiting for review in your department.": "\u0644\u0627 \u062a\u0648\u062c\u062f \u062e\u0637\u0637 \u0645\u0646 \u0645\u0639\u0644\u0645\u064a \u0634\u0639\u0628\u062a\u0643 \u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629.", "Submit for review": "\u0625\u0631\u0633\u0627\u0644 \u0644\u0644\u0645\u0631\u0627\u062c\u0639\u0629", "Save draft": "\u062d\u0641\u0638 \u0643\u0645\u0633\u0648\u062f\u0629",
  "Use this form for website access, weekly plan, account or technical issues.": "\u0627\u0633\u062a\u062e\u062f\u0645 \u0647\u0630\u0647 \u0627\u0644\u0641\u0648\u0631\u0645\u0629 \u0644\u0645\u0634\u0643\u0644\u0627\u062a \u0627\u0644\u0645\u0648\u0642\u0639 \u0623\u0648 \u0627\u0644\u062e\u0637\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0629 \u0623\u0648 \u0627\u0644\u062d\u0633\u0627\u0628 \u0623\u0648 \u0623\u064a \u0645\u0634\u0643\u0644\u0629 \u062a\u0642\u0646\u064a\u0629.",
  "Describe the issue": "\u0627\u0634\u0631\u062d \u0627\u0644\u0645\u0634\u0643\u0644\u0629", "Send to WhatsApp": "\u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0625\u0644\u0649 WhatsApp", "Include the page and what you were trying to do.": "\u0627\u0630\u0643\u0631 \u0627\u0644\u0635\u0641\u062d\u0629 \u0648\u0645\u0627 \u0643\u0646\u062a \u062a\u062d\u0627\u0648\u0644 \u062a\u0646\u0641\u064a\u0630\u0647.", "Your message opens ready to send to school support.": "\u0633\u062a\u0641\u062a\u062d \u0631\u0633\u0627\u0644\u062a\u0643 \u062c\u0627\u0647\u0632\u0629 \u0644\u0644\u0625\u0631\u0633\u0627\u0644 \u0625\u0644\u0649 \u062f\u0639\u0645 \u0627\u0644\u0645\u062f\u0631\u0633\u0629.",
  "Enter your name": "\u0627\u0643\u062a\u0628 \u0627\u0633\u0645\u0643", "Enter your phone number or email": "\u0627\u0643\u062a\u0628 \u0631\u0642\u0645 \u0647\u0627\u062a\u0641\u0643 \u0623\u0648 \u0628\u0631\u064a\u062f\u0643", "Write the details of the problem here": "\u0627\u0643\u062a\u0628 \u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0645\u0634\u0643\u0644\u0629 \u0647\u0646\u0627", "What happens next?": "\u0645\u0627\u0630\u0627 \u0633\u064a\u062d\u062f\u062b \u0628\u0639\u062f \u0630\u0644\u0643\u061f", "Send via WhatsApp": "\u0625\u0631\u0633\u0627\u0644 \u0639\u0628\u0631 WhatsApp"
});

Object.assign(staffAr, {
  "Arabic": "العربية",
  "Islamic": "التربية الإسلامية",
  "English": "اللغة الإنجليزية",
  "English - Connect Plus": "اللغة الإنجليزية - Connect Plus",
  "English - Hello": "اللغة الإنجليزية - Hello",
  "English - Hello Plus": "اللغة الإنجليزية - Hello Plus",
  "Discover": "Discover",
  "Math": "الرياضيات",
  "Science": "العلوم",
  "Social": "الدراسات الاجتماعية",
  "ICT": "تكنولوجيا المعلومات",
  "PE": "التربية البدنية",
  "Swimming": "السباحة",
  "Art": "التربية الفنية",
  "Swimming Department": "قسم السباحة",
  "Art Department": "قسم التربية الفنية",
  "PE Department": "قسم التربية البدنية",
  "ICT Department": "قسم ICT",
});

// Additional dashboard vocabulary (unicode escapes keep Arabic stable across shells).
Object.assign(staffAr, {
  "Teacher Department": "\u0642\u0633\u0645 \u0627\u0644\u0645\u0639\u0644\u0645", "Teacher workspace": "\u0644\u0648\u062d\u0629 \u0639\u0645\u0644 \u0627\u0644\u0645\u0639\u0644\u0645", "Create weekly plan": "\u0625\u0646\u0634\u0627\u0621 \u062e\u0637\u0629 \u0623\u0633\u0628\u0648\u0639\u064a\u0629", "Assignments": "\u0627\u0644\u062a\u0643\u0644\u064a\u0641\u0627\u062a", "Published entries": "\u0627\u0644\u0625\u062f\u062e\u0627\u0644\u0627\u062a \u0627\u0644\u0645\u0646\u0634\u0648\u0631\u0629", "Draft entries": "\u0625\u062f\u062e\u0627\u0644\u0627\u062a \u0645\u0633\u0648\u062f\u0629", "Timetable slots": "\u062d\u0635\u0635 \u0627\u0644\u062c\u062f\u0648\u0644", "Recent weekly entries": "\u0622\u062e\u0631 \u0625\u062f\u062e\u0627\u0644\u0627\u062a \u0623\u0633\u0628\u0648\u0639\u064a\u0629", "Day": "\u0627\u0644\u064a\u0648\u0645", "Status": "\u0627\u0644\u062d\u0627\u0644\u0629", "Last updated": "\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b", "No weekly-plan entries saved yet.": "\u0644\u0645 \u064a\u062a\u0645 \u062d\u0641\u0638 \u0625\u062f\u062e\u0627\u0644\u0627\u062a \u0623\u0633\u0628\u0648\u0639\u064a\u0629 \u0628\u0639\u062f.", "Approved Classes": "\u0627\u0644\u0641\u0635\u0648\u0644 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629", "Approved Subjects": "\u0627\u0644\u0645\u0648\u0627\u062f \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629", "No classes assigned yet.": "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0639\u064a\u064a\u0646 \u0641\u0635\u0648\u0644 \u0628\u0639\u062f.", "No subjects assigned yet.": "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0639\u064a\u064a\u0646 \u0645\u0648\u0627\u062f \u0628\u0639\u062f.", "Account Settings": "\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0628", "Name": "\u0627\u0644\u0627\u0633\u0645", "Department": "\u0627\u0644\u0642\u0633\u0645", "Sign out": "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c", "Build the whole week": "\u0623\u0646\u0634\u0626 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0643\u0627\u0645\u0644\u0627\u064b", "One save for the whole week": "\u062d\u0641\u0638 \u0648\u0627\u062d\u062f \u0644\u0644\u0623\u0633\u0628\u0648\u0639 \u0643\u0644\u0647", "Class & Subject": "\u0627\u0644\u0641\u0635\u0644 \u0648\u0627\u0644\u0645\u0627\u062f\u0629", "Academic Week": "\u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0627\u0644\u062f\u0631\u0627\u0633\u064a", "Classwork": "\u0639\u0645\u0644 \u0627\u0644\u062d\u0635\u0629", "Homework": "\u0627\u0644\u0648\u0627\u062c\u0628 \u0627\u0644\u0645\u0646\u0632\u0644\u064a", "Weekly notes": "\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0623\u0633\u0628\u0648\u0639\u064a\u0629", "Save weekly plan": "\u062d\u0641\u0638 \u0627\u0644\u062e\u0637\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0629", "Connect Plus": "\u0643\u0648\u0646\u0643\u062a \u0628\u0644\u0633", "English Hello": "\u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a\u0629 - Hello", "Hello Plus": "\u0647\u0627\u0644\u0648 \u0628\u0644\u0633", "Discover": "\u062f\u064a\u0633\u0643\u0641", "French": "\u0627\u0644\u0644\u063a\u0629 \u0627\u0644\u0641\u0631\u0646\u0633\u064a\u0629"
});

Object.assign(staffAr, {
  "Your live assignments and weekly-plan progress are shown below.": "\u062a\u0638\u0647\u0631 \u0647\u0646\u0627 \u062a\u0643\u0644\u064a\u0641\u0627\u062a\u0643 \u0627\u0644\u0645\u0639\u062a\u0645\u062f\u0629 \u0648\u062a\u0642\u062f\u0645 \u062e\u0637\u0637\u0643 \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0629.",
  "This section is connected to your approved school profile.": "\u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u0645\u0631\u062a\u0628\u0637 \u0628\u0645\u0644\u0641\u0643 \u0627\u0644\u0645\u062f\u0631\u0633\u064a \u0627\u0644\u0645\u0639\u062a\u0645\u062f.",
  "Supabase connected": "\u0645\u062a\u0635\u0644 \u0628\u0640 Supabase", "Teacher": "\u0645\u0639\u0644\u0645", "Search plans, classes or subjects": "\u0627\u0628\u062d\u062b \u0639\u0646 \u0627\u0644\u062e\u0637\u0637 \u0623\u0648 \u0627\u0644\u0641\u0635\u0648\u0644 \u0623\u0648 \u0627\u0644\u0645\u0648\u0627\u062f",
  "Approved by Super Admin": "\u0645\u0639\u062a\u0645\u062f \u0645\u0646 \u0627\u0644\u0645\u0634\u0631\u0641 \u0627\u0644\u0639\u0627\u0645", "Visible after plan publication": "\u0638\u0627\u0647\u0631 \u0628\u0639\u062f \u0646\u0634\u0631 \u0627\u0644\u062e\u0637\u0629", "Saved in Supabase": "\u0645\u062d\u0641\u0648\u0638 \u0641\u064a Supabase", "Controls plan placement": "\u064a\u062d\u062f\u062f \u0645\u0648\u0636\u0639 \u0627\u0644\u062e\u0637\u0629",
  "Available weekly-plan periods from Supabase.": "\u0627\u0644\u0641\u062a\u0631\u0627\u062a \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0629 \u0645\u062a\u0627\u062d\u0629 \u0645\u0646 Supabase.", "Your account is authenticated and connected to Supabase.": "\u062d\u0633\u0627\u0628\u0643 \u0645\u0648\u062b\u0642 \u0648\u0645\u062a\u0635\u0644 \u0628\u0640 Supabase.",
  "Need help?": "\u0647\u0644 \u062a\u062d\u062a\u0627\u062c \u0645\u0633\u0627\u0639\u062f\u0629\u061f", "Contact the academic coordinator for account or assignment changes.": "\u062a\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0646\u0633\u0642 \u0627\u0644\u0623\u0643\u0627\u062f\u064a\u0645\u064a \u0644\u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u062d\u0633\u0627\u0628 \u0623\u0648 \u0627\u0644\u062a\u0643\u0644\u064a\u0641\u0627\u062a.", "Open support": "\u0641\u062a\u062d \u0627\u0644\u062f\u0639\u0645 \u0627\u0644\u0641\u0646\u064a"
});

Object.assign(staffAr, {
  "My weekly plans": "\u062e\u0637\u0637\u064a \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0629", "All my weekly plans": "\u0643\u0644 \u062e\u0637\u0637\u064a \u0627\u0644\u0623\u0633\u0628\u0648\u0639\u064a\u0629", "One row represents one class plan for one school week. Open it to continue writing all of its lessons.": "\u064a\u0645\u062b\u0644 \u0643\u0644 \u0635\u0641 \u062e\u0637\u0629 \u0641\u0635\u0644 \u0648\u0627\u062d\u062f\u0629 \u0644\u0623\u0633\u0628\u0648\u0639 \u062f\u0631\u0627\u0633\u064a \u0648\u0627\u062d\u062f. \u0627\u0641\u062a\u062d\u0647\u0627 \u0644\u0627\u0633\u062a\u0643\u0645\u0627\u0644 \u0643\u062a\u0627\u0628\u0629 \u062c\u0645\u064a\u0639 \u062d\u0635\u0635\u0647\u0627.",
  "Week": "\u0627\u0644\u0623\u0633\u0628\u0648\u0639", "Subjects written": "\u0627\u0644\u0645\u0648\u0627\u062f \u0627\u0644\u0645\u0643\u062a\u0648\u0628\u0629", "Status": "\u0627\u0644\u062d\u0627\u0644\u0629", "Last saved": "\u0622\u062e\u0631 \u062d\u0641\u0638", "Actions": "\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a", "No weekly plans have been started yet.": "\u0644\u0645 \u062a\u0628\u062f\u0623 \u0623\u064a \u062e\u0637\u0637 \u0623\u0633\u0628\u0648\u0639\u064a\u0629 \u0628\u0639\u062f.",
  "Published for families": "\u0645\u0646\u0634\u0648\u0631\u0629 \u0644\u0623\u0648\u0644\u064a\u0627\u0621 \u0627\u0644\u0623\u0645\u0648\u0631", "Sent to supervisor": "\u062a\u0645 \u0625\u0631\u0633\u0627\u0644\u0647\u0627 \u0644\u0644\u0645\u0634\u0631\u0641", "Changes requested": "\u0645\u0637\u0644\u0648\u0628 \u062a\u0639\u062f\u064a\u0644", "Approved â€” waiting for class": "\u0645\u0639\u062a\u0645\u062f\u0629 \u2014 \u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0643\u062a\u0645\u0627\u0644 \u062e\u0637\u0629 \u0627\u0644\u0641\u0635\u0644", "Draft in progress": "\u0645\u0633\u0648\u062f\u0629 \u0642\u064a\u062f \u0627\u0644\u0625\u0639\u062f\u0627\u062f",
  "Continue plan": "\u0627\u0633\u062a\u0643\u0645\u0627\u0644 \u0627\u0644\u062e\u0637\u0629", "Preview": "\u0645\u0639\u0627\u064a\u0646\u0629", "Preview parent plan": "\u0645\u0639\u0627\u064a\u0646\u0629 \u062e\u0637\u0629 \u0648\u0644\u064a \u0627\u0644\u0623\u0645\u0631", "Withdraw": "\u0633\u062d\u0628 \u0645\u0646 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629", "Clear draft": "\u062d\u0630\u0641 \u0627\u0644\u0645\u0633\u0648\u062f\u0629", "lesson": "\u062d\u0635\u0629", "lessons": "\u062d\u0635\u0635",
  "Quiz or assessment": "\u0627\u062e\u062a\u0628\u0627\u0631 \u0623\u0648 \u062a\u0642\u064a\u064a\u0645", "Choose the subject, then add the quiz for this class.": "\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629\u060c \u062b\u0645 \u0623\u0636\u0641 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0635\u0644.", "Weekly notes for families": "\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0623\u0633\u0628\u0648\u0639\u064a\u0629 \u0644\u0623\u0648\u0644\u064a\u0627\u0621 \u0627\u0644\u0623\u0645\u0648\u0631", "Spelling words, reminders or important announcements.": "\u0643\u0644\u0645\u0627\u062a \u0625\u0645\u0644\u0627\u0621\u060c \u062a\u0630\u0643\u064a\u0631\u0627\u062a \u0623\u0648 \u0625\u0639\u0644\u0627\u0646\u0627\u062a \u0645\u0647\u0645\u0629.",
  "Copy this subject plan to other classes": "\u0646\u0633\u062e \u062e\u0637\u0629 \u0647\u0630\u0647 \u0627\u0644\u0645\u0627\u062f\u0629 \u0625\u0644\u0649 \u0641\u0635\u0648\u0644 \u0623\u062e\u0631\u0649", "Save this class as a draft first, then you can copy one subject plan to your other eligible classes.": "\u0627\u062d\u0641\u0638 \u062e\u0637\u0629 \u0647\u0630\u0627 \u0627\u0644\u0641\u0635\u0644 \u0643\u0645\u0633\u0648\u062f\u0629 \u0623\u0648\u0644\u0627\u064b\u060c \u062b\u0645 \u064a\u0645\u0643\u0646\u0643 \u0646\u0633\u062e \u062e\u0637\u0629 \u0645\u0627\u062f\u0629 \u0625\u0644\u0649 \u0641\u0635\u0648\u0644\u0643 \u0627\u0644\u0623\u062e\u0631\u0649 \u0627\u0644\u0645\u0624\u0647\u0644\u0629.", "Copy plan": "\u0646\u0633\u062e \u0627\u0644\u062e\u0637\u0629", "Every card is one of your real timetable lessons. Save once when the whole class week is ready.": "\u0643\u0644 \u0628\u0637\u0627\u0642\u0629 \u062a\u0645\u062b\u0644 \u062d\u0635\u0629 \u062d\u0642\u064a\u0642\u064a\u0629 \u0645\u0646 \u062c\u062f\u0648\u0644\u0643. \u0627\u062d\u0641\u0638 \u0645ر\u0629 \u0648ا\u062d\u062f\u0629 \u0628عد \u0627\u0643تمال \u0623\u0633\u0628\u0648ع \u0627\u0644\u0641\u0635\u0644.", "Saving is blocked until the timetable is connected.": "\u064a\u062a\u0639\u0630\u0631 \u0627\u0644\u062d\u0641\u0638 \u062d\u062a\u0649 \u064a\u062a\u0645 \u0631\u0628\u0637 \u062c\u062f\u0648\u0644 \u0627\u0644\u062d\u0635\u0635.", "Select subject": "\u0627\u062e\u062a\u0631 \u0627\u0644\u0645\u0627\u062f\u0629", "Select quiz day": "\u0627\u062e\u062a\u0631 \u064aوم \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631", "Quiz details": "\u062aف\u0627\u0635\u064a\u0644 \u0627\u0644\u0627\u062e\u062a\u0628ار", "Title, scope or revision pages": "\u0627\u0644\u0639\u0646\u0648\u0627ن\u060c \u0627\u0644\u0646\u0637اق \u0623\u0648 \u0635ف\u062d\u0627\u062a \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629"
});

// Complete staff-workspace vocabulary. Keys intentionally match the rendered
// English copy because the dashboard is translated after React renders it.
Object.assign(staffAr, {
  "Administration Reports": "تقارير الإدارة",
  "Administration": "الإدارة",
  "Published Plan Report": "تقرير الخطط المنشورة",
  "Family Plan Page": "صفحة خطط أولياء الأمور",
  "Administrative account": "حساب إداري",
  "Administrative report navigation": "التنقل في تقارير الإدارة",
  "Live school data": "بيانات المدرسة المباشرة",
  "Read-only reporting": "تقارير للعرض فقط",
  "Administrative workspace": "مساحة عمل الإدارة",
  "Weekly-plan creation access": "صلاحية إنشاء الخطة الأسبوعية",
  "Open or close plan creation for all teachers, or control an individual teacher.": "افتح أو أغلق إنشاء الخطط لجميع المعلمين، أو تحكم في صلاحية معلم محدد.",
  "Close creation": "إغلاق الإنشاء",
  "Open creation": "فتح الإنشاء",
  "Open": "مفتوح",
  "Closed": "مغلق",
  "Published lessons": "الحصص المنشورة",
  "Last updated": "آخر تحديث",
  "Report": "التقرير",
  "Period": "الحصة",
  "Subject & teacher": "المادة والمعلم",
  "Classera notes": "ملاحظات كلاسيرا",
  "School day": "يوم دراسي",
  "The published-plan report could not be loaded.": "تعذر تحميل تقرير الخطط المنشورة.",
  "Weekly plan creation is open.": "تم فتح إنشاء الخطط الأسبوعية.",
  "Weekly plan creation is closed.": "تم إغلاق إنشاء الخطط الأسبوعية.",
  "Close workspace menu": "إغلاق قائمة لوحة التحكم",
  "Teacher workspace menu": "قائمة لوحة تحكم المعلم",
  "Close menu": "إغلاق القائمة",
  "Teacher workspace navigation": "التنقل في لوحة تحكم المعلم",
  "Open workspace menu": "فتح قائمة لوحة التحكم",
  "Supervisor workspace navigation": "التنقل في لوحة تحكم المشرف",
  "Weekly plan summary": "ملخص الخطط الأسبوعية",
  "Only the Super Admin can change these assignments.": "يمكن للمشرف العام فقط تعديل هذه التكليفات.",
  "Weekly plan review": "مراجعة الخطط الأسبوعية",
  "Choose a school week, teacher, then class. All subjects the teacher wrote for that class are reviewed together as one weekly plan.": "اختر الأسبوع الدراسي ثم المعلم ثم الفصل. تُراجع جميع المواد التي كتبها المعلم لهذا الفصل معًا كخطة أسبوعية واحدة.",
  "1. School week": "١. الأسبوع الدراسي",
  "2. Teacher": "٢. المعلم",
  "3. Class": "٣. الفصل",
  "Select week": "اختر الأسبوع",
  "Select teacher": "اختر المعلم",
  "Select the school week and teacher to open their weekly-plan review.": "اختر الأسبوع الدراسي والمعلم لفتح مراجعة خطته الأسبوعية.",
  "has not sent a weekly plan for": "لم يرسل خطة أسبوعية للأسبوع",
  "yet.": "حتى الآن.",
  "Submitted": "أُرسلت",
  "Classera": "كلاسيرا",
  "Quizzes & assessments": "الاختبارات والتقييمات",
  "Return whole plan": "إرجاع الخطة كاملة للتعديل",
  "Approve whole plan": "اعتماد الخطة كاملة",
  "Approved for this department": "معتمدة من هذه الشعبة",
  "This complete department plan was approved. It will be visible to families once every required department plan for the class and week is approved.": "تم اعتماد خطة الشعبة كاملة. ستظهر لأولياء الأمور بعد اعتماد جميع خطط الشعب المطلوبة لهذا الفصل والأسبوع.",
  "The teacher has been asked to revise this plan.": "طُلب من المعلم مراجعة هذه الخطة وتعديلها.",
  "submitted": "مرسلة للمراجعة",
  "changes requested": "مطلوب تعديل",
  "approved": "معتمدة",
  "draft": "مسودة",
  "published": "منشورة",
  "Entries are placed according to your timetable slots.": "تُرتب الإدخالات تلقائيًا حسب حصص جدولك.",
  "Saving draft…": "جارٍ حفظ المسودة…",
  "Draft saved automatically": "تم حفظ المسودة تلقائيًا",
  "Auto-save is on": "الحفظ التلقائي يعمل",
  "Under supervisor review": "قيد مراجعة المشرف",
  "Changes requested by supervisor": "طلب المشرف تعديلات",
  "Approved": "معتمدة",
  "Saved as draft": "محفوظة كمسودة",
  "You can preview it, or withdraw it to make changes before the supervisor decides.": "يمكنك معاينتها أو سحبها لإجراء تعديلات قبل قرار المشرف.",
  "Update the required items, then submit the plan for review again.": "عدّل البنود المطلوبة ثم أرسل الخطة للمراجعة مرة أخرى.",
  "This subject has already been approved. Contact your supervisor if a correction is needed.": "تم اعتماد هذه المادة بالفعل. تواصل مع مشرفك إذا احتجت إلى تصحيح.",
  "This plan is saved privately and has not been sent for review.": "هذه الخطة محفوظة بصورة خاصة ولم تُرسل للمراجعة بعد.",
  "1. Academic week": "١. الأسبوع الدراسي",
  "2. Class": "٢. الفصل",
  "Timetable connection required": "يلزم ربط جدول الحصص",
  "Subject": "المادة",
  "Science component": "فرع العلوم المتكاملة",
  "Select Chemistry, Physics or Biology": "اختر الكيمياء أو الفيزياء أو الأحياء",
  "Chemistry": "الكيمياء",
  "Physics": "الفيزياء",
  "Biology": "الأحياء",
  "Integrated Science": "العلوم المتكاملة",
  "English programme": "برنامج اللغة الإنجليزية",
  "The programme name is added automatically before Classwork.": "يُضاف اسم البرنامج تلقائيًا قبل عمل الحصة.",
  "Lesson, unit and pages": "اكتب الدرس والوحدة والصفحات",
  "Homework for this lesson": "اكتب واجب هذه الحصة",
  "Reminder or materials": "اكتب التذكير أو الأدوات المطلوبة",
  "Choose the subject, then add the quiz for this class.": "اختر المادة ثم أضف اختبار هذا الفصل.",
  "Only classes in the same grade where you teach the same subject appear here. The copied plans are saved as drafts; quizzes and weekly notes stay with the original class.": "تظهر هنا فقط فصول الصف نفسه التي تدرّس لها المادة نفسها. تُحفظ الخطط المنسوخة كمسودات، وتظل الاختبارات والملاحظات الأسبوعية في الفصل الأصلي.",
  "Subject to copy": "المادة المراد نسخها",
  "No other eligible class is assigned to you for this subject and grade.": "لا يوجد فصل آخر مؤهل ومُسند إليك لهذه المادة وهذا الصف.",
  "Different lesson dates or periods are matched by lesson order: first lesson to first lesson, second to second, and so on.": "تُطابق الحصص المختلفة حسب ترتيبها: الحصة الأولى مع الأولى، والثانية مع الثانية، وهكذا.",
  "Save copied drafts": "حفظ الخطط المنسوخة كمسودات",
  "Saving…": "جارٍ الحفظ…",
  "Resubmit for review": "إعادة الإرسال للمراجعة",
  "Preview only — nothing has been saved or sent": "معاينة فقط — لم يتم حفظ أو إرسال أي شيء",
  "Parent weekly-plan preview": "معاينة خطة ولي الأمر",
  "Close parent plan preview": "إغلاق معاينة خطة ولي الأمر",
  "Your current writing is shown in its real timetable position. Other subjects are intentionally blank because this is only your private preview.": "تظهر كتابتك الحالية في موضعها الحقيقي بالجدول. تُترك المواد الأخرى فارغة عمدًا لأن هذه معاينة خاصة بك فقط.",
  "Loading the class timetable…": "جارٍ تحميل جدول الفصل…",
  "No timetable lessons are available for this class yet.": "لا توجد حصص متاحة لهذا الفصل في الجدول حتى الآن.",
  "This preview does not submit, approve, or publish the weekly plan.": "هذه المعاينة لا ترسل الخطة ولا تعتمدها ولا تنشرها.",
  "Return to editor": "العودة إلى المحرر",
  "Sunday": "الأحد",
  "Monday": "الاثنين",
  "Tuesday": "الثلاثاء",
  "Wednesday": "الأربعاء",
  "Thursday": "الخميس"
});

// Super Admin vocabulary. The Super Admin used to be intentionally English
// only; it now follows the same saved dashboard-language preference as the
// teacher and administrator workspaces.
Object.assign(staffAr, {
  "Super Admin Control Center": "مركز تحكم المشرف العام",
  "Super administrator navigation": "التنقل في لوحة المشرف العام",
  "Super Administration": "الإشراف العام",
  "Account Approvals": "اعتماد الحسابات",
  "Review new teacher and administrator account requests.": "راجع طلبات حسابات المعلمين والإداريين الجديدة.",
  "Live school directory": "دليل المدرسة المباشر",
  "All Accounts": "جميع الحسابات",
  "Real teachers and administrators loaded securely from the school database.": "المعلمون والإداريون الحقيقيون محمّلون بأمان من قاعدة بيانات المدرسة.",
  "Access control": "إدارة الصلاحيات",
  "Roles & Permissions": "الأدوار والصلاحيات",
  "See exactly what each school role is allowed to manage.": "اعرض بدقة ما يُسمح لكل دور مدرسي بإدارته.",
  "Weekly-plan control": "التحكم في الخطط الأسبوعية",
  "Manage Public Plans": "إدارة الخطط المنشورة",
  "Review and control the real weekly plans stored in the school database.": "راجع وتحكم في الخطط الأسبوعية الحقيقية المحفوظة بقاعدة بيانات المدرسة.",
  "School calendar": "التقويم المدرسي",
  "School Holidays": "الإجازات المدرسية",
  "School-wide Holidays": "إجازات جميع الفصول",
  "Mark a day as an official holiday for every class in one school week.": "حدّد يومًا كإجازة رسمية لجميع الفصول في أسبوع دراسي واحد.",
  "School structure": "هيكل المدرسة",
  "Classes & Subjects": "الفصول والمواد",
  "Live classes and weekly-plan subjects available for teacher assignments.": "الفصول والمواد المتاحة مباشرة لتكليفات المعلمين.",
  "Account history": "سجل الحسابات",
  "Recent account registration, approval and access activity.": "أحدث أنشطة التسجيل والاعتماد والوصول إلى الحسابات.",
  "Platform status": "حالة المنصة",
  "System Settings": "إعدادات النظام",
  "Review the active platform configuration and connected services.": "راجع إعدادات المنصة الحالية والخدمات المتصلة.",
  "Primary authority": "الصلاحية الرئيسية",
  "Approve accounts and control every school workspace.": "اعتمد الحسابات وتحكم في جميع لوحات المدرسة.",
  "Search real staff names or assignments": "ابحث عن أسماء الموظفين أو التكليفات",
  "Supabase connected": "متصل بقاعدة Supabase",
  "Manage public weekly plans": "إدارة الخطط الأسبوعية المنشورة",
  "Pending approval": "بانتظار الاعتماد",
  "Waiting for your decision": "بانتظار قرارك",
  "Active accounts": "الحسابات النشطة",
  "Can access their workspace": "يمكنهم دخول لوحة التحكم",
  "Not registered": "غير مسجل",
  "Not Registered": "غير مسجل",
  "Listed staff without accounts": "موظفون مدرجون بلا حسابات",
  "Active admins": "الإداريون النشطون",
  "Admin Control Center access": "لديهم صلاحية لوحة الإدارة",
  "Account requests requiring review": "طلبات الحسابات التي تحتاج مراجعة",
  "Real school staff directory": "دليل موظفي المدرسة الحقيقي",
  "Loading accounts from Supabase…": "جارٍ تحميل الحسابات من Supabase…",
  "Search": "بحث",
  "Name or username": "الاسم أو اسم المستخدم",
  "Role": "الدور",
  "All Roles": "جميع الأدوار",
  "Status": "الحالة",
  "All Statuses": "جميع الحالات",
  "Pending": "قيد الانتظار",
  "Active": "نشط",
  "Suspended": "موقوف",
  "Rejected": "مرفوض",
  "School Staff": "موظف المدرسة",
  "Department / Assignments": "القسم / التكليفات",
  "Requested": "تاريخ الطلب",
  "Last Action": "آخر إجراء",
  "Loading the real school directory…": "جارٍ تحميل دليل المدرسة الحقيقي…",
  "Review": "مراجعة",
  "Manage": "إدارة",
  "Open workspace": "فتح لوحة التحكم",
  "Waiting for registration": "بانتظار إنشاء الحساب",
  "No account requests need your review right now.": "لا توجد طلبات حسابات تحتاج مراجعتك الآن.",
  "No real staff accounts match the selected filters.": "لا توجد حسابات موظفين تطابق عوامل التصفية المحددة.",
  "Super Admin": "المشرف العام",
  "Full school access: approves accounts, assigns classes and subjects, suspends users, manages every plan and controls platform settings.": "صلاحية شاملة: اعتماد الحسابات، وتعيين الفصول والمواد، وإيقاف المستخدمين، وإدارة الخطط وإعدادات المنصة.",
  "Vice Principal": "وكيل المدرسة",
  "School-wide administrative review access after account approval. Weekly-plan editing remains limited by the assigned admin scope.": "صلاحية مراجعة إدارية شاملة بعد اعتماد الحساب، مع الالتزام بنطاق التعديل المخصص.",
  "Department Supervisor": "مشرف الشعبة",
  "Reviews only the teachers in the supervisor’s own department: English, Arabic & Social Studies, or Math & Science.": "يراجع معلمي شعبته فقط: الإنجليزية، أو العربية والدراسات، أو الرياضيات والعلوم.",
  "Creates weekly-plan content only for the classes and subjects assigned by the Super Admin.": "يكتب الخطة الأسبوعية للفصول والمواد التي يعيّنها له المشرف العام فقط.",
  "School week": "الأسبوع الدراسي",
  "Real weekly-plan directory": "دليل الخطط الأسبوعية الحقيقي",
  "Open family plan page": "فتح صفحة خطط أولياء الأمور",
  "Class Teacher": "رائد الفصل",
  "Entries": "الإدخالات",
  "Updated": "آخر تحديث",
  "Super Admin override": "نشر استثنائي من المشرف العام",
  "Opening…": "جارٍ الفتح…",
  "Edit plan": "تعديل الخطة",
  "Remove override": "إلغاء النشر الاستثنائي",
  "Force publish": "نشر استثنائي",
  "Delete plan": "حذف الخطة",
  "No weekly plans were created for the selected school week.": "لم تُنشأ خطط أسبوعية للأسبوع الدراسي المحدد.",
  "School-wide holiday control": "إدارة الإجازات لجميع الفصول",
  "A holiday replaces that day's lessons for every class. Saved teacher content is kept safely in the database.": "تحل الإجازة محل حصص اليوم لجميع الفصول، مع الاحتفاظ بكتابات المعلمين بأمان في قاعدة البيانات.",
  "Day": "اليوم",
  "Holiday title": "عنوان الإجازة",
  "Family note": "ملاحظة لأولياء الأمور",
  "Optional parent-facing note": "ملاحظة اختيارية لأولياء الأمور",
  "Save holiday": "حفظ الإجازة",
  "No school-wide holidays are set for this week.": "لا توجد إجازات عامة محددة لهذا الأسبوع.",
  "School Classes": "فصول المدرسة",
  "Weekly-plan Subjects": "مواد الخطة الأسبوعية",
  "Recent Account Activity": "أحدث أنشطة الحسابات",
  "Registration and approval activity from the live directory.": "أنشطة التسجيل والاعتماد من الدليل المباشر.",
  "No staff account activity yet": "لا يوجد نشاط لحسابات الموظفين بعد",
  "New registration requests and your approval actions will appear here.": "ستظهر هنا طلبات التسجيل الجديدة وإجراءات اعتمادك.",
  "Open or close plan creation for all teachers, then set individual exceptions.": "افتح أو أغلق إنشاء الخطط لجميع المعلمين، ثم حدّد الاستثناءات الفردية.",
  "Open for teachers": "مفتوح للمعلمين",
  "Closed for teachers": "مغلق للمعلمين",
  "Database": "قاعدة البيانات",
  "Supabase is connected and the protected school directory is available.": "قاعدة Supabase متصلة ودليل المدرسة المحمي متاح.",
  "Connected": "متصل",
  "Academic Year": "العام الدراسي",
  "The dashboard and weekly-plan workspace are prepared for the current school year.": "لوحة التحكم ومساحة الخطط الأسبوعية جاهزتان للعام الدراسي الحالي.",
  "Grades & Sections": "الصفوف والشعب",
  "Two sections are available for every grade from Grade 1 through Grade 10.": "تتوفر شعبتان لكل صف من الصف الأول إلى الصف العاشر.",
  "Security": "الأمان",
  "Role-based access and Row Level Security protect staff-only database operations.": "تحمي صلاحيات الأدوار وسياسات أمان الصفوف عمليات قاعدة البيانات الخاصة بالموظفين.",
  "Access control active": "نظام الصلاحيات مفعّل",
  "Super Admin editor": "محرر المشرف العام",
  "Changes are saved directly to the approved paper layout. Publication still follows the required supervisor approval workflow.": "تُحفظ التعديلات مباشرة في القالب المعتمد، ويظل النشر خاضعًا لمسار موافقات المشرفين.",
  "Classera notes": "ملاحظات كلاسيرا",
  "Super Admin approval": "اعتماد المشرف العام",
  "Live account management": "إدارة الحساب الفعلي",
  "Review account request": "مراجعة طلب الحساب",
  "Manage real staff account": "إدارة حساب الموظف الفعلي",
  "School role": "الدور المدرسي",
  "Approving this request creates the real active profile and sends this user to the correct dashboard. The account role comes from the approved school directory and cannot be changed by the applicant.": "اعتماد الطلب ينشئ الملف النشط ويوجه المستخدم إلى لوحته الصحيحة. ويأتي الدور من دليل المدرسة المعتمد ولا يستطيع مقدم الطلب تغييره.",
  "Teaching Classes & Subjects": "الفصول والمواد التدريسية",
  "Add & save assignment": "إضافة التكليف وحفظه",
  "No classes or subjects assigned yet.": "لم تُعيّن فصول أو مواد بعد.",
  "Every addition or removal is saved to Supabase immediately. The teacher or supervisor will see it after refreshing their workspace.": "تُحفظ كل إضافة أو إزالة فورًا في Supabase، وتظهر للمعلم أو المشرف بعد تحديث لوحته.",
  "Administrator": "إداري",
  "Admin scope is assigned from the approved school directory.": "يُحدد نطاق الإداري من دليل المدرسة المعتمد.",
  "Account recovery": "استعادة الحساب",
  "Set a temporary password": "تعيين كلمة مرور مؤقتة",
  "Use this only when a staff member cannot sign in. Share the new password privately; it is never stored in this page.": "استخدم هذا الخيار فقط عند تعذر دخول الموظف، وشاركه كلمة المرور الجديدة بصورة خاصة؛ فهي لا تُحفظ في هذه الصفحة.",
  "Temporary password": "كلمة المرور المؤقتة",
  "At least 8 characters": "ثمانية أحرف على الأقل",
  "Reset password": "إعادة تعيين كلمة المرور",
  "Reject request": "رفض الطلب",
  "Reactivate account": "إعادة تنشيط الحساب",
  "Suspend account": "إيقاف الحساب",
  "Done": "تم",
  "Approve account": "اعتماد الحساب",
  "Close": "إغلاق"
});

function normalizedText(value: string) {
  return value.replaceAll("â€™", "’").replaceAll("â€”", "—").replaceAll("â€“", "–").replaceAll("â†’", "→").replaceAll("â†“", "↓").replaceAll("آ·", "·");
}

function translateDynamicStaffText(value: string) {
  let match = value.match(/^Period (\d+)$/);
  if (match) return `الحصة ${match[1]}`;
  match = value.match(/^(\d+) lessons?$/);
  if (match) return `${match[1]} حصة`;
  match = value.match(/^(\d+) lessons? ready for this week$/);
  if (match) return `${match[1]} حصة جاهزة لهذا الأسبوع`;
  match = value.match(/^(\d+) matching timetable lessons?$/);
  if (match) return `${match[1]} حصة مطابقة في الجدول`;
  match = value.match(/^(\d+) class plans? found$/);
  if (match) return `تم العثور على ${match[1]} خطة فصل`;
  match = value.match(/^(\d+) subject entries? waiting for review$/);
  if (match) return `${match[1]} إدخال مادة بانتظار المراجعة`;
  match = value.match(/^(\d+) class \/ subject assignments?$/);
  if (match) return `${match[1]} تكليف فصل ومادة`;
  match = value.match(/^Grade (\d+) · ([A-Za-z])$/);
  if (match) return `الصف ${match[1]} · الشعبة ${match[2]}`;
  match = value.match(/^Grade (\d+) ([A-Za-z])$/);
  if (match) return `الصف ${match[1]} ${match[2]}`;
  match = value.match(/^Week (\d+)$/);
  if (match) return `الأسبوع ${match[1]}`;
  match = value.match(/^Week (\d+)(.+)$/);
  if (match) {
    const localizedDate = match[2]
      .replaceAll("September", "سبتمبر")
      .replaceAll("October", "أكتوبر")
      .replaceAll("November", "نوفمبر")
      .replaceAll("December", "ديسمبر")
      .replaceAll("January", "يناير");
    return `الأسبوع ${match[1]}${localizedDate}`;
  }
  match = value.match(/^Submitted (.+)$/);
  if (match) return `أُرسلت في ${match[1]}`;
  match = value.match(/^(\d+) published plans? shown$/);
  if (match) return `يتم عرض ${match[1]} خطة منشورة`;
  match = value.match(/^(\d+) staff members? shown$/);
  if (match) return `يتم عرض ${match[1]} من موظفي المدرسة`;
  match = value.match(/^(\d+) plans? in this week$/);
  if (match) return `${match[1]} خطة في هذا الأسبوع`;
  match = value.match(/^(\d+) plans? stored in Supabase$/);
  if (match) return `${match[1]} خطة محفوظة في Supabase`;
  match = value.match(/^(\d+) active class sections?$/);
  if (match) return `${match[1]} فصلًا نشطًا`;
  match = value.match(/^(\d+) active subjects? available for assignments$/);
  if (match) return `${match[1]} مادة نشطة متاحة للتكليفات`;
  match = value.match(/^Grades (\d+)–(\d+)$/);
  if (match) return `من الصف ${match[1]} إلى الصف ${match[2]}`;
  match = value.match(/^Approved (.+)$/);
  if (match) return `تم الاعتماد في ${match[1]}`;
  match = value.match(/^Rejected (.+)$/);
  if (match) return `تم الرفض في ${match[1]}`;
  return undefined;
}

function translatePage(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    // The timetable is intentionally English-only, including on the Arabic platform.
    if (node.parentElement?.closest(".plan-paper, .parent-preview-paper, .timetable-grid")) return;
    const original = node.nodeValue ?? "";
    const value = original.trim();
    const translated = value.startsWith("Welcome, ")
      ? `\u0645\u0631\u062d\u0628\u064b\u0627\u060c ${value.slice(9)}`
      : staffAr[normalizedText(value)] ?? homeAr[normalizedText(value)] ?? ar[value] ?? translateDynamicStaffText(normalizedText(value));
    if (translated) node.nodeValue = original.replace(value, translated);
  });
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[placeholder], textarea[placeholder]").forEach((field) => {
    if (field.closest(".plan-paper, .parent-preview-paper, .timetable-grid")) return;
    const translated = staffAr[normalizedText(field.placeholder.trim())] ?? homeAr[normalizedText(field.placeholder.trim())] ?? ar[field.placeholder.trim()];
    if (translated) field.placeholder = translated;
  });
}

export default function LanguageSwitcher({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [languageReady, setLanguageReady] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    setLanguage(window.localStorage.getItem("andalus-language") === "ar" ? "ar" : "en");
    setLanguageReady(true);
  }, []);
  useEffect(() => {
    if (!languageReady) return;
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.body.classList.toggle("arabic-ui", language === "ar");
    window.localStorage.setItem("andalus-language", language);
    if (language !== "ar") return;
    translatePage(document.body);
    const observer = new MutationObserver(() => translatePage(document.body));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language, languageReady, pathname]);
  const switchLanguage = () => {
    const next = language === "en" ? "ar" : "en";
    window.localStorage.setItem("andalus-language", next);
    window.location.reload();
  };
  const isStaffDashboard = pathname.startsWith("/teachers") || pathname.startsWith("/admin");
  return <>{children}{!pathname.includes("/super-admin") && !isStaffDashboard && <div className="language-control"><button className="language-switcher" type="button" aria-label="Change language" aria-expanded={languageMenuOpen} onClick={() => setLanguageMenuOpen((open) => !open)}><span aria-hidden="true">◎</span><b>{language === "en" ? "AR" : "EN"}</b></button>{languageMenuOpen && <div className="language-menu"><strong>{language === "en" ? "Language" : "اللغة"}</strong><button type="button" onClick={switchLanguage}>{language === "en" ? "العربية" : "English"}</button></div>}</div>}</>;
}

export function StaffLanguagePreference() {
  const [language, setLanguage] = useState<"en" | "ar">("en");
  useEffect(() => setLanguage(window.localStorage.getItem("andalus-language") === "ar" ? "ar" : "en"), []);
  const changeLanguage = () => {
    const next = language === "en" ? "ar" : "en";
    window.localStorage.setItem("andalus-language", next);
    window.location.reload();
  };
  const arabic = language === "ar";
  return <section className="teacher-card teacher-language-settings" dir={arabic ? "rtl" : "ltr"}><div><p className="teacher-kicker">{arabic ? "اللغة" : "Language"}</p><h2>{arabic ? "لغة لوحة التحكم" : "Dashboard language"}</h2><p>{arabic ? "اختر اللغة التي ستظهر بها لوحة التحكم." : "Choose the language used across your dashboard."}</p></div><button type="button" className="teacher-primary-button" onClick={changeLanguage}>{arabic ? "English" : "العربية"}</button></section>;
}
