\set ON_ERROR_STOP on

SET ROLE ivy_map_owner;

-- 大学录取要求与编辑研究也是可追溯数据集，不应伪装成 CDS / facts。
ALTER TABLE sources
  DROP CONSTRAINT IF EXISTS sources_dataset_kind_check;
ALTER TABLE sources
  ADD CONSTRAINT sources_dataset_kind_check
  CHECK (dataset_kind IN (
    'cds',
    'facts',
    'government_trend',
    'feeder_report',
    'admission_requirements',
    'editorial_research'
  ));

ALTER TABLE metric_definitions
  DROP CONSTRAINT IF EXISTS metric_definitions_dataset_kind_check;
ALTER TABLE metric_definitions
  ADD CONSTRAINT metric_definitions_dataset_kind_check
  CHECK (dataset_kind IN (
    'cds',
    'facts',
    'government_trend',
    'feeder_report',
    'admission_requirements',
    'editorial_research'
  ));

-- 别名必须经人工确认。alias_norm 不设全局唯一：同名冲突要能被保留并进入复核，
-- 而不是被数据库悄悄合并成同一所学校。
CREATE TABLE IF NOT EXISTS institution_aliases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions(id),
  alias text NOT NULL,
  alias_norm text NOT NULL,
  alias_kind text NOT NULL CHECK (alias_kind IN ('slug', 'name', 'abbreviation', 'legacy')),
  review_status text NOT NULL DEFAULT 'reviewed'
    CHECK (review_status IN ('extracted', 'reviewed', 'rejected')),
  source_artifact_id bigint REFERENCES source_artifacts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, alias_norm)
);

CREATE INDEX IF NOT EXISTS institution_aliases_lookup_idx
  ON institution_aliases (alias_norm, review_status);

-- 旧 count_kind 同时表达“结果是什么”和“是不是估算”，新数据必须把两者拆开。
ALTER TABLE feeder_admission_observations
  DROP CONSTRAINT IF EXISTS feeder_admission_observations_count_kind_check;
ALTER TABLE feeder_admission_observations
  ADD CONSTRAINT feeder_admission_observations_count_kind_check
  CHECK (count_kind IN (
    'admits', 'offers', 'reported', 'estimated', 'enrolled', 'interviews'
  ));

ALTER TABLE feeder_admission_observations
  ADD COLUMN IF NOT EXISTS outcome_kind text,
  ADD COLUMN IF NOT EXISTS value_status text,
  ADD COLUMN IF NOT EXISTS population_scope_code text,
  ADD COLUMN IF NOT EXISTS denominator_observation_id bigint
    REFERENCES feeder_admission_observations(id);

ALTER TABLE feeder_admission_observations
  DROP CONSTRAINT IF EXISTS feeder_admission_observations_outcome_kind_check;
ALTER TABLE feeder_admission_observations
  ADD CONSTRAINT feeder_admission_observations_outcome_kind_check
  CHECK (outcome_kind IS NULL OR outcome_kind IN (
    'admits', 'offers', 'enrolled', 'interviews', 'reported'
  ));

ALTER TABLE feeder_admission_observations
  DROP CONSTRAINT IF EXISTS feeder_admission_observations_value_status_check;
ALTER TABLE feeder_admission_observations
  ADD CONSTRAINT feeder_admission_observations_value_status_check
  CHECK (value_status IS NULL OR value_status IN (
    'reported', 'estimated', 'range', 'lower_bound'
  ));

ALTER TABLE feeder_admission_observations
  DROP CONSTRAINT IF EXISTS feeder_admission_observations_denominator_self_check;
ALTER TABLE feeder_admission_observations
  ADD CONSTRAINT feeder_admission_observations_denominator_self_check
  CHECK (denominator_observation_id IS NULL OR denominator_observation_id <> id);

UPDATE feeder_admission_observations
SET outcome_kind = CASE count_kind
    WHEN 'admits' THEN 'admits'
    WHEN 'offers' THEN 'offers'
    WHEN 'enrolled' THEN 'enrolled'
    WHEN 'interviews' THEN 'interviews'
    WHEN 'reported' THEN 'reported'
    ELSE outcome_kind
  END,
  value_status = CASE count_kind
    WHEN 'estimated' THEN 'estimated'
    ELSE COALESCE(value_status, 'reported')
  END
WHERE outcome_kind IS NULL OR value_status IS NULL;

CREATE INDEX IF NOT EXISTS feeder_denominator_lookup_idx
  ON feeder_admission_observations (
    destination_university_id,
    academic_year_start,
    outcome_kind,
    population_scope_code
  )
  WHERE granularity = 'university_total';

CREATE INDEX IF NOT EXISTS feeder_denominator_link_idx
  ON feeder_admission_observations (denominator_observation_id)
  WHERE denominator_observation_id IS NOT NULL;

RESET ROLE;
