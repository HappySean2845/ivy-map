\set ON_ERROR_STOP on

SET ROLE ivy_map_owner;

CREATE TABLE IF NOT EXISTS feeder_admission_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  destination_university_id text NOT NULL REFERENCES institutions(id),
  origin_school_id text REFERENCES institutions(id),
  geography_id text,
  granularity text NOT NULL CHECK (granularity IN ('school', 'city', 'province', 'country', 'university_total')),
  academic_year_start integer NOT NULL CHECK (academic_year_start BETWEEN 1900 AND 2100),
  admission_round text NOT NULL CHECK (admission_round IN ('ED', 'ED1', 'ED2', 'EA', 'REA', 'RD', 'rolling', 'early_combined', 'combined', 'unknown')),
  track text CHECK (track IN ('AP', 'IB', 'ALEVEL')),
  count_kind text NOT NULL CHECK (count_kind IN ('admits', 'offers', 'estimated')),
  count_value integer CHECK (count_value >= 0),
  count_min integer CHECK (count_min >= 0),
  count_max integer CHECK (count_max >= 0),
  student_scope text NOT NULL,
  is_complete boolean NOT NULL DEFAULT false,
  confidence text NOT NULL CHECK (confidence IN ('L1', 'L2', 'L3')),
  source_artifact_id bigint NOT NULL REFERENCES source_artifacts(id),
  source_locator jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_status text NOT NULL DEFAULT 'extracted' CHECK (review_status IN ('extracted', 'reviewed', 'rejected', 'published')),
  observation_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((granularity = 'school') = (origin_school_id IS NOT NULL)),
  CHECK (
    (count_value IS NOT NULL AND count_min IS NULL AND count_max IS NULL) OR
    (count_value IS NULL AND count_min IS NOT NULL AND count_max IS NOT NULL)
  ),
  CHECK (count_min IS NULL OR count_min <= count_max)
);

CREATE INDEX IF NOT EXISTS feeder_destination_year_idx
  ON feeder_admission_observations (destination_university_id, academic_year_start DESC);
CREATE INDEX IF NOT EXISTS feeder_origin_year_idx
  ON feeder_admission_observations (origin_school_id, academic_year_start DESC)
  WHERE origin_school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS feeder_publication_idx
  ON feeder_admission_observations (review_status, granularity, academic_year_start DESC);

RESET ROLE;
