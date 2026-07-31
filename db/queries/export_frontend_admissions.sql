\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

WITH reviewed AS (
  SELECT
    observation.institution_id,
    observation.academic_year_start,
    observation.source_artifact_id,
    observation.dimensions,
    max(observation.value_number) FILTER (
      WHERE observation.metric_code = 'cds.c1.applied.total'
    )::bigint AS applied,
    max(observation.value_number) FILTER (
      WHERE observation.metric_code = 'cds.c1.admitted.total'
    )::bigint AS admitted,
    max(observation.value_number) FILTER (
      WHERE observation.metric_code = 'cds.c1.enrolled.total'
    )::bigint AS enrolled,
    min(observation.confidence) AS confidence,
    bool_and(observation.review_status IN ('reviewed', 'published')) AS is_reviewed
  FROM observations AS observation
  GROUP BY
    observation.institution_id,
    observation.academic_year_start,
    observation.source_artifact_id,
    observation.dimensions
), frontend_rows AS (
  SELECT
    reviewed.institution_id,
    reviewed.academic_year_start,
    reviewed.applied,
    reviewed.admitted,
    reviewed.enrolled,
    reviewed.dimensions,
    reviewed.confidence,
    source.id AS source_id,
    source.title AS source_title,
    coalesce(artifact.final_url, artifact.requested_url) AS source_url,
    artifact.captured_at::date AS captured_at
  FROM reviewed
  JOIN source_artifacts AS artifact ON artifact.id = reviewed.source_artifact_id
  JOIN sources AS source ON source.id = artifact.source_id
  WHERE reviewed.is_reviewed
    AND reviewed.applied IS NOT NULL
    AND reviewed.admitted IS NOT NULL
    AND reviewed.enrolled IS NOT NULL
)
SELECT jsonb_pretty(
  jsonb_build_object(
    'schemaVersion', 1,
    'records', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'universityId', institution_id,
          'academicYearStart', academic_year_start,
          'applied', applied,
          'admitted', admitted,
          'enrolled', enrolled,
          'dimensions', dimensions,
          'confidence', confidence,
          'sourceId', source_id,
          'sourceTitle', source_title,
          'sourceUrl', source_url,
          'capturedAt', captured_at
        )
        ORDER BY academic_year_start DESC, institution_id
      ),
      '[]'::jsonb
    )
  )
)
FROM frontend_rows;
