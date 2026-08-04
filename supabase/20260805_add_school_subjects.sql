insert into public.subjects (code, name_en, name_ar, parent_plan_name, minimum_grade, maximum_grade)
values
  ('computer', 'Computer', 'كمبيوتر', 'Computer', 1, 10),
  ('ai', 'AI', 'الذكاء الاصطناعي', 'AI', 1, 10),
  ('handwriting-library', 'Handwriting & Library', 'خط ومكتبة', 'Handwriting & Library', 1, 10),
  ('professional-skills', 'Professional Skills', 'مهارات مهنية', 'Professional Skills', 1, 10),
  ('integrated-science', 'Integrated Science', 'علوم متكاملة', 'Integrated Science', 1, 10)
on conflict (code) do update set name_en = excluded.name_en, name_ar = excluded.name_ar, parent_plan_name = excluded.parent_plan_name, is_active = true, include_in_weekly_plan = true;
