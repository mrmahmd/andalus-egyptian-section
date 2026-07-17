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

## Planned next phase

A separate teacher dashboard will manage subjects, classes, and weekly entries, then publish them to this parent-facing website.

### Weekly-plan publication rules

- The timetable is the source of truth for which subjects appear on each day, grade, and class section.
- Teachers can enter their plans in any order; the published plan follows the lesson order defined in that timetable.
- A scheduled subject must still appear if its teacher has not submitted an entry. Its Classwork, Homework, and Classera Notes cells show `Plan not published yet` until the plan is published.
- The Super Admin manages timetables and can review missing subject plans before a weekly plan is made public.
- Each day uses one merged day cell and automatically expands or contracts to match its actual number of lessons.
