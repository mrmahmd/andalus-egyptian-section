# AlAndalus Weekly Study Plan

The public weekly study-plan website for AlAndalus Private Schools — Egyptian Section.

## Features

- English parent-facing school homepage
- Weekly plan finder by grade, class, and week
- Sunday-to-Thursday study plan with multiple subjects per day
- Classwork, homework, and Classera notes
- Print-ready and PDF-friendly weekly plan
- Responsive layout for mobile, tablet, and desktop

## Development

```bash
npm install
npm run dev
```

Create a production export with:

```bash
npm run build
```

The site is deployed automatically to GitHub Pages when changes reach the `main` branch.

## Supabase-backed staff workspace

- Teacher and administrator registration uses the approved school staff directory.
- New accounts remain pending until the Super Admin approves them.
- Active teachers see only their approved classes and subjects.
- The teacher editor saves the whole week in one action and places entries according to the timetable.
- Quizzes and family notes are saved in their dedicated database tables.
- Weekly-plan creation remains blocked until the academic week and timetable slots are configured.

### Weekly-plan publication rules

- The timetable is the source of truth for which subjects appear on each day, grade, and class section.
- Teachers can enter their plans in any order; the published plan follows the lesson order defined in that timetable.
- A scheduled subject must still appear if its teacher has not submitted an entry. Its Classwork, Homework, and Classera Notes cells show `Plan not published yet` until the plan is published.
- The Super Admin manages timetables and can review missing subject plans before a weekly plan is made public.
- Each day uses one merged day cell and automatically expands or contracts to match its actual number of lessons.

### Staff roles and supervision rules

- During account creation, a teacher selects the English Department, Arabic & Social Studies Department, or Math & Science Department.
- Teachers who select a department belong to that department's supervisor and should only be visible to that supervisor in the Admin workspace.
- Admin account creation will use explicit role choices: Administrative, English Supervisor, Arabic Supervisor, or Math & Science Supervisor.
- An English Supervisor can review only English-department teachers; an Arabic Supervisor can review only Arabic & Social Studies teachers; and a Math & Science Supervisor can review only Math & Science teachers.
- The Super Admin/Owner retains visibility and management access across all teachers, supervisors, assignments, plans, and departments.
