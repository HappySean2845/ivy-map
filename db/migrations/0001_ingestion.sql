\set ON_ERROR_STOP on

SET ROLE ivy_map_owner;

CREATE TABLE IF NOT EXISTS institutions (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('university', 'high_school', 'government', 'system')),
  name_en text NOT NULL,
  name_local text,
  country_code text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'merged', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sources (
  id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions(id),
  source_type text NOT NULL CHECK (source_type IN ('official', 'government', 'media', 'report', 'crowdsourced')),
  dataset_kind text NOT NULL CHECK (dataset_kind IN ('cds', 'facts', 'government_trend', 'feeder_report')),
  title text NOT NULL,
  canonical_url text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('L1', 'L2', 'L3')),
  access_status text,
  http_status integer,
  final_url text,
  error_detail text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  UNIQUE (canonical_url)
);

CREATE TABLE IF NOT EXISTS crawl_runs (
  run_id text PRIMARY KEY,
  tool_version text NOT NULL,
  seed_file text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('completed', 'partial', 'failed')),
  seed_count integer NOT NULL CHECK (seed_count >= 0),
  fetched_source_count integer NOT NULL CHECK (fetched_source_count >= 0),
  failed_source_count integer NOT NULL CHECK (failed_source_count >= 0),
  artifact_count integer NOT NULL CHECK (artifact_count >= 0),
  discovered_link_count integer NOT NULL CHECK (discovered_link_count >= 0),
  manifest_sha256 text NOT NULL,
  imported_at timestamptz
);

CREATE TABLE IF NOT EXISTS crawl_attempts (
  run_id text NOT NULL REFERENCES crawl_runs(run_id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES sources(id),
  artifact_kind text NOT NULL CHECK (artifact_kind IN ('index_page', 'document')),
  requested_url text NOT NULL,
  final_url text,
  status text NOT NULL CHECK (status IN ('fetched', 'http_error', 'timeout', 'too_large', 'network_error')),
  http_status integer,
  mime_type text,
  byte_size bigint,
  sha256 text,
  local_path text,
  etag text,
  last_modified text,
  fetched_at timestamptz NOT NULL,
  error_detail text,
  PRIMARY KEY (run_id, source_id, requested_url)
);

CREATE TABLE IF NOT EXISTS source_artifacts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id text NOT NULL REFERENCES sources(id),
  first_seen_run_id text NOT NULL REFERENCES crawl_runs(run_id),
  last_seen_run_id text NOT NULL REFERENCES crawl_runs(run_id),
  artifact_kind text NOT NULL CHECK (artifact_kind IN ('index_page', 'document')),
  requested_url text NOT NULL,
  final_url text,
  sha256 text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  local_path text,
  etag text,
  last_modified text,
  captured_at timestamptz NOT NULL,
  UNIQUE (source_id, sha256)
);

CREATE TABLE IF NOT EXISTS source_links (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id text NOT NULL REFERENCES sources(id),
  first_seen_run_id text NOT NULL REFERENCES crawl_runs(run_id),
  last_seen_run_id text NOT NULL REFERENCES crawl_runs(run_id),
  discovered_url text NOT NULL,
  link_text text NOT NULL DEFAULT '',
  link_kind text NOT NULL CHECK (link_kind IN ('document', 'related_page')),
  edition_label text,
  UNIQUE (source_id, discovered_url)
);

CREATE TABLE IF NOT EXISTS metric_definitions (
  code text PRIMARY KEY,
  dataset_kind text NOT NULL CHECK (dataset_kind IN ('cds', 'facts', 'government_trend', 'feeder_report')),
  section text,
  label text NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('number', 'percent', 'money', 'boolean', 'text', 'range')),
  unit text,
  dimension_schema jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  institution_id text NOT NULL REFERENCES institutions(id),
  metric_code text NOT NULL REFERENCES metric_definitions(code),
  academic_year_start integer,
  period_start date,
  period_end date,
  value_number numeric,
  value_text text,
  value_boolean boolean,
  value_min numeric,
  value_max numeric,
  unit text,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_artifact_id bigint NOT NULL REFERENCES source_artifacts(id),
  source_locator jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence text NOT NULL CHECK (confidence IN ('L1', 'L2', 'L3')),
  review_status text NOT NULL DEFAULT 'extracted' CHECK (review_status IN ('extracted', 'reviewed', 'rejected', 'published')),
  observation_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    num_nonnulls(value_number, value_text, value_boolean) +
    CASE WHEN value_min IS NOT NULL OR value_max IS NOT NULL THEN 1 ELSE 0 END = 1
  ),
  CHECK ((value_min IS NULL) = (value_max IS NULL)),
  CHECK (value_min IS NULL OR value_min <= value_max)
);

CREATE INDEX IF NOT EXISTS sources_institution_idx ON sources (institution_id, dataset_kind);
CREATE INDEX IF NOT EXISTS crawl_attempts_status_idx ON crawl_attempts (status, fetched_at DESC);
CREATE INDEX IF NOT EXISTS source_artifacts_sha_idx ON source_artifacts (sha256);
CREATE INDEX IF NOT EXISTS source_links_edition_idx ON source_links (source_id, edition_label);
CREATE INDEX IF NOT EXISTS observations_lookup_idx ON observations (institution_id, metric_code, academic_year_start);

RESET ROLE;
