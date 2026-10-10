CREATE TABLE public.survey_drafts (
  template_id text PRIMARY KEY,
  survey jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.survey_drafts TO service_role;
ALTER TABLE public.survey_drafts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.survey_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL,
  version integer NOT NULL,
  survey jsonb NOT NULL,
  note text NOT NULL DEFAULT '',
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);
GRANT ALL ON public.survey_versions TO service_role;
ALTER TABLE public.survey_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY,
  template_id text NOT NULL,
  version_id uuid REFERENCES public.survey_versions(id),
  is_preview boolean NOT NULL DEFAULT false,
  survey jsonb NOT NULL,
  answers jsonb NOT NULL,
  report_status text NOT NULL DEFAULT 'ready',
  submitted_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX submissions_submitted_at_idx ON public.submissions (submitted_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_version_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Published versions are immutable'; END; $$;
CREATE TRIGGER survey_versions_immutable BEFORE UPDATE ON public.survey_versions FOR EACH ROW EXECUTE FUNCTION public.prevent_version_update();