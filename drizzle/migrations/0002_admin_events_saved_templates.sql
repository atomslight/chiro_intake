CREATE TABLE public.admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  detail text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_events TO service_role;
ALTER TABLE public.admin_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX admin_events_created_idx ON public.admin_events (created_at DESC);

CREATE TABLE public.saved_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  survey jsonb NOT NULL,
  sections int NOT NULL DEFAULT 0,
  questions int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.saved_templates TO service_role;
ALTER TABLE public.saved_templates ENABLE ROW LEVEL SECURITY;
CREATE INDEX submissions_submitted_idx ON public.submissions (submitted_at DESC);
CREATE INDEX survey_versions_template_version_idx ON public.survey_versions (template_id, version DESC);