INSERT INTO public.saved_templates (name, survey, sections, questions, updated_at)
SELECT DISTINCT ON (v.survey->>'name') v.survey->>'name', v.survey,
  jsonb_array_length(v.survey->'modules'),
  (SELECT COALESCE(sum(jsonb_array_length(g->'questions')),0) FROM jsonb_array_elements(v.survey->'modules') m, jsonb_array_elements(m->'groups') g)::int,
  v.published_at
FROM public.survey_versions v
WHERE v.survey->>'name' IS NOT NULL
ORDER BY v.survey->>'name', v.version DESC
ON CONFLICT (name) DO NOTHING;