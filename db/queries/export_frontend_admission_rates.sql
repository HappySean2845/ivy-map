\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

WITH rate_rows AS (
  SELECT
    rate.id,
    rate.institution_id,
    rate.academic_year_start,
    rate.period_start,
    rate.period_end,
    rate.value_number AS rate_percent,
    rate.value_min AS rate_min_percent,
    rate.value_max AS rate_max_percent,
    rate.dimensions,
    rate.source_artifact_id,
    rate.source_locator,
    rate.confidence,
    artifact.captured_at::date AS captured_at,
    source.id AS source_id,
    source.title AS source_title,
    CASE
      WHEN source.canonical_url ~ '^https?://' THEN source.canonical_url
      ELSE NULL
    END AS source_url
  FROM observations AS rate
  JOIN source_artifacts AS artifact ON artifact.id = rate.source_artifact_id
  JOIN sources AS source ON source.id = artifact.source_id
  WHERE rate.metric_code = 'admissions.rate'
    AND rate.review_status IN ('reviewed', 'published')
    AND (
      rate.value_number IS NOT NULL
      OR (rate.value_min IS NOT NULL AND rate.value_max IS NOT NULL)
    )
), frontend_rows AS (
  SELECT
    rate.institution_id,
    rate.academic_year_start,
    rate.period_start,
    rate.period_end,
    rate.rate_percent,
    rate.rate_min_percent,
    rate.rate_max_percent,
    applied.value_number::bigint AS applied,
    outcome.value_number::bigint AS outcome,
    rate.dimensions,
    rate.confidence,
    rate.source_id,
    rate.source_title,
    rate.source_url,
    rate.captured_at,
    rate.source_locator->>'citedSource' AS citation
  FROM rate_rows AS rate
  LEFT JOIN LATERAL (
    SELECT observation.value_number
    FROM observations AS observation
    WHERE observation.institution_id = rate.institution_id
      AND observation.review_status IN ('reviewed', 'published')
      AND observation.metric_code IN ('cds.c1.applied.total', 'admissions.applications')
      AND observation.academic_year_start IS NOT DISTINCT FROM rate.academic_year_start
      AND observation.period_start IS NOT DISTINCT FROM rate.period_start
      AND observation.period_end IS NOT DISTINCT FROM rate.period_end
      AND observation.dimensions = rate.dimensions - 'rate_basis'
    ORDER BY
      (observation.source_artifact_id = rate.source_artifact_id) DESC,
      observation.confidence ASC,
      observation.id DESC
    LIMIT 1
  ) AS applied ON true
  LEFT JOIN LATERAL (
    SELECT observation.value_number
    FROM observations AS observation
    WHERE observation.institution_id = rate.institution_id
      AND observation.review_status IN ('reviewed', 'published')
      AND observation.metric_code = CASE rate.dimensions->>'rate_basis'
        WHEN 'admitted_over_applications' THEN
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM observations AS exact
              WHERE exact.institution_id = rate.institution_id
                AND exact.academic_year_start IS NOT DISTINCT FROM rate.academic_year_start
                AND exact.period_start IS NOT DISTINCT FROM rate.period_start
                AND exact.period_end IS NOT DISTINCT FROM rate.period_end
                AND exact.dimensions = rate.dimensions - 'rate_basis'
                AND exact.metric_code = 'cds.c1.admitted.total'
                AND exact.review_status IN ('reviewed', 'published')
            ) THEN 'cds.c1.admitted.total'
            ELSE 'admissions.admitted'
          END
        WHEN 'confirmed_places_over_applications' THEN 'admissions.confirmed_places'
        WHEN 'offers_over_applications' THEN 'admissions.offers'
        WHEN 'admitted_over_exam_candidates' THEN 'admissions.admitted'
        ELSE '__unsupported__'
      END
      AND observation.academic_year_start IS NOT DISTINCT FROM rate.academic_year_start
      AND observation.period_start IS NOT DISTINCT FROM rate.period_start
      AND observation.period_end IS NOT DISTINCT FROM rate.period_end
      AND observation.dimensions = rate.dimensions - 'rate_basis'
    ORDER BY
      (observation.source_artifact_id = rate.source_artifact_id) DESC,
      observation.confidence ASC,
      observation.id DESC
    LIMIT 1
  ) AS outcome ON true
)
SELECT jsonb_pretty(
  jsonb_build_object(
    'schemaVersion', 1,
    'records', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'universityId', institution_id,
          'academicYearStart', academic_year_start,
          'periodStart', period_start,
          'periodEnd', period_end,
          'ratePercent', rate_percent,
          'rateMinPercent', rate_min_percent,
          'rateMaxPercent', rate_max_percent,
          'applied', applied,
          'outcome', outcome,
          'dimensions', dimensions,
          'confidence', confidence,
          'sourceId', source_id,
          'sourceTitle', source_title,
          'sourceUrl', source_url,
          'capturedAt', captured_at,
          'citation', citation
        )
        ORDER BY
          institution_id,
          dimensions->>'rate_basis',
          dimensions->>'applicant_scope',
          dimensions->>'pathway',
          academic_year_start,
          period_start
      ),
      '[]'::jsonb
    )
  )
)
FROM frontend_rows;
