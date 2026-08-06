\pset tuples_only on
\pset format unaligned

WITH count_rows AS (
  SELECT
    observation.institution_id,
    observation.academic_year_start,
    CASE
      WHEN observation.metric_code = 'admissions.planned_places' THEN 'planned'
      WHEN COALESCE((observation.dimensions->>'approximate')::boolean, false) THEN 'estimated'
      ELSE 'actual'
    END AS count_kind,
    observation.value_number,
    observation.value_min,
    observation.value_max,
    observation.value_text,
    observation.confidence,
    observation.review_status,
    observation.dimensions->>'applicant_scope' AS applicant_scope,
    observation.dimensions->>'pathway' AS pathway,
    CASE
      WHEN observation.institution_id = 'cuhk' THEN 'gaokao_early_batch'
      ELSE 'mainland_undergraduate_scheme'
    END AS admissions_system,
    observation.dimensions->>'source_metric' AS source_metric,
    CASE
      WHEN observation.institution_id = 'cuhk' THEN 'not_applicable_early_batch'
      ELSE 'missing_denominator'
    END AS rate_availability,
    source.id || '-hk-mainland-counts' AS source_id,
    source.title || ' · 香港内地招生人数' AS source_title,
    CASE
      WHEN source.canonical_url ~ '^https?://' THEN source.canonical_url
      ELSE NULL
    END AS source_url,
    artifact.captured_at::date AS captured_at,
    observation.source_locator->>'citedSource' AS citation
  FROM observations AS observation
  JOIN source_artifacts AS artifact ON artifact.id = observation.source_artifact_id
  JOIN sources AS source ON source.id = artifact.source_id
  WHERE observation.institution_id IN ('hku', 'hkust', 'cuhk')
    AND observation.metric_code IN ('admissions.admitted', 'admissions.planned_places')
    AND observation.dimensions->>'source_metric' = 'mainland_admitted_count'
    AND observation.review_status IN ('reviewed', 'published', 'extracted')
    AND (
      observation.value_number IS NOT NULL
      OR observation.value_text IS NOT NULL
      OR (observation.value_min IS NOT NULL AND observation.value_max IS NOT NULL)
    )
)
SELECT jsonb_build_object(
  'schemaVersion', 1,
  'records', COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'universityId', institution_id,
        'academicYearStart', academic_year_start,
        'kind', count_kind,
        'value', value_number,
        'valueMin', value_min,
        'valueMax', value_max,
        'valueText', value_text,
        'confidence', confidence,
        'reviewStatus', review_status,
        'dimensions', jsonb_build_object(
          'applicant_scope', applicant_scope,
          'pathway', pathway,
          'admissions_system', admissions_system,
          'source_metric', source_metric,
          'rate_availability', rate_availability
        ),
        'sourceId', source_id,
        'sourceTitle', source_title,
        'sourceUrl', source_url,
        'capturedAt', captured_at,
        'citation', citation
      )
      ORDER BY institution_id, academic_year_start, count_kind
    ),
    '[]'::jsonb
  )
)::text
FROM count_rows;
