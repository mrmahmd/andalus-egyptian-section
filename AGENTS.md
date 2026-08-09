# AlAndalus Egyptian Section — Weekly Study Plan Platform

This is the live parent, teacher, supervisor, administrator, and Super Admin platform for AlAndalus Private Schools — Egyptian Section.

## Project surface

- Parent portal: `app/page.tsx`, `app/weekly-plan/page.tsx`, `app/timetable/page.tsx`, and `app/support/page.tsx`
- Staff sign-in and teacher workspace: `app/teachers/login/page.tsx` and `app/teachers/page.tsx`
- Administrator workspace: `app/admin/page.tsx`
- Super Admin workspace: `app/super-admin/page.tsx`
- Global branding, responsive design, and language direction: `app/globals.css`
- Language switching and English/Arabic text: `app/language-switcher.tsx`
- Mobile parent navigation: `app/mobile-navigation.tsx`
- Timetable source used by the front end: `app/data/class-timetables.json`
- Supabase SQL changes: `supabase/`

## Product rules

1. Parents do not sign in. They can browse only published weekly plans, select Grade, Class, and Week, then view or print the approved plan.
2. Teachers submit plans only for their assigned classes and subjects.
3. Subject supervisors review their department teachers' submissions. A plan is published only after the required supervisor approvals.
4. Deputies and administrators can review published plans and reports but do not create weekly plans unless an explicit future permission changes this.
5. The Super Admin manages staff accounts, roles, assignments, access to weekly-plan creation, and platform-wide controls.
6. The public weekly-plan paper is always English and left-to-right, including when the surrounding parent portal is Arabic.
7. The timetable determines the display order of subjects and periods. Plan submission order must never determine the public plan order.
8. Quran, PE, and Swimming may have fixed parent-facing text when required; do not create teacher submissions for them unless the owner explicitly asks.

## English subjects and programmes

- The public timetable uses `English` as its broad subject name.
- Grades 1–6: teachers select `English` or `Connect Plus` while writing a plan.
- Grades 7–9: teachers select `Hello` or `Hello Plus`.
- Grade 10: teachers select `Hello` or `Upstream`.
- `Discover` belongs to the English department for Grades 1–3.
- When a programme is selected, prefix it automatically in the Classwork text as agreed by the owner.

## Language and layout requirements

- Parent portal, teacher workspace, administrator workspace, and login pages support English and Arabic.
- Arabic UI must be fully translated, right-to-left, and use the established Arabic fonts (`Alexandria` / `Cairo`).
- Keep timetable lesson cells left-to-right even when the timetable page interface is Arabic, because subject names are English.
- Super Admin remains English-only; do not show its language switcher.
- Parent mobile layout must hide desktop top navigation, use the mobile bottom navigation, and keep the language control clear of the header.
- Do not alter the approved weekly-plan print layout, school branding, colour palette, header centering, or print rules without explicit approval.

## Data and security

- Supabase project reference: `datpwzmistmoelqcaibg`.
- Never expose Supabase service-role credentials in client code or commit them.
- Preserve RLS and role boundaries. A teacher must not read or edit another teacher's submissions.
- Treat staff accounts and all plan records as real data. Before replacing a timetable or resetting a trial period, use a deliberate cleanup SQL script and keep accounts, roles, and assignments unless asked otherwise.
- Official Term 1 2026–2027 academic weeks are seeded in `supabase/20260809_seed_official_term_one_weeks.sql` (Weeks 1–17, 6 Sep 2026–2 Jan 2027).

## Development and publishing

- Preserve the existing Next.js and pnpm setup.
- Use `pnpm run build` to validate code before publishing. If `node` is absent from PATH in this environment, use the bundled Node runtime.
- GitHub Pages repository: `mrmahmd/andalus-egyptian-section`, branch `main`.
- Do not stage or remove unrelated untracked directories such as `output/`, `tmp/`, or a user-created `pnpm-lock.yaml`.
- Commit only the files needed for the requested change, then push to `main` when the owner asks to publish or when the requested change is clearly intended for the live platform.

## Working style

- Explain the intended change in clear Egyptian Arabic before a significant visual or workflow change.
- Verify functional changes proportionately; do not claim a database save, approval workflow, or live deployment succeeded without evidence.
- Keep changes scoped. Ask before destructive resets, mass deletion, role changes, or changes that affect real staff access.
