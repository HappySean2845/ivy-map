\set ON_ERROR_STOP on

SET ROLE ivy_map_owner;

CREATE TABLE IF NOT EXISTS institution_cohorts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions(id),
  academic_year_start integer NOT NULL CHECK (academic_year_start BETWEEN 1900 AND 2100),
  scope text NOT NULL CHECK (scope IN ('school', 'department')),
  curriculum_code text,
  graduates integer NOT NULL CHECK (graduates > 0),
  total_offers integer CHECK (total_offers >= 0),
  source_kind text NOT NULL CHECK (source_kind IN ('research_markdown', 'legacy_csv')),
  source_reference text NOT NULL,
  source_artifact_id bigint REFERENCES source_artifacts(id),
  source_locator jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence text NOT NULL CHECK (confidence IN ('L1', 'L2', 'L3')),
  review_status text NOT NULL DEFAULT 'extracted' CHECK (review_status IN ('extracted', 'reviewed', 'rejected', 'published')),
  cohort_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'school' AND curriculum_code IS NULL) OR
    (scope = 'department' AND curriculum_code IN ('AP', 'IB', 'ALEVEL'))
  ),
  CHECK (source_kind <> 'research_markdown' OR source_artifact_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS institution_cohorts_school_year_idx
  ON institution_cohorts (institution_id, academic_year_start DESC);
CREATE INDEX IF NOT EXISTS institution_cohorts_scope_idx
  ON institution_cohorts (scope, curriculum_code, review_status, academic_year_start DESC);

RESET ROLE;
