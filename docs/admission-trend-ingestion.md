# Admission trend ingestion

The `admission-rate-trends.csv` batch is not a single comparable admission-rate series. It contains US admit rates, US international undergraduate enrollment share, UK success/offer/confirmed-place rates, Japanese pathway rates, Canadian international-admit rates, and Hong Kong counts or estimates.

`scripts/data/build-admission-trend-import.ts` normalizes those rows into the existing `observations` table. No new fact table is required.

## Metric model

- Existing US counts continue to use `cds.c1.applied.total` and `cds.c1.admitted.total`.
- Cross-system counts use `admissions.applications`, `admissions.offers`, `admissions.admitted`, `admissions.confirmed_places`, or `admissions.planned_places`.
- All ratios use `admissions.rate`; `dimensions.rate_basis` records the numerator and denominator so UK offer rates cannot be confused with US admit rates.
- IPEDS international-undergraduate facts use `enrollment.undergraduate.total`, `enrollment.undergraduate.international`, and `enrollment.undergraduate.international_share`.
- Pathway, applicant geography, reporting system, and rolling-period semantics live in `dimensions`.

## Review and value rules

- Tier A exact facts are stored as `reviewed`, confidence `L1`.
- Tier B reviewed transformations are stored as `reviewed`, confidence `L2`.
- Tier C, approximate, planned, and inequality claims are stored as `extracted` and are not ready for normal frontend publication.
- Missing-source rows create no observation and appear in `quality-report.json`.
- Oxford rolling three-year windows use `period_start` and `period_end`; they are not converted into invented annual values.
- Imperial privacy-suppressed cells are stored as ranges. The CSV's visible-cell sums are not treated as exact totals.

## Generate a batch

Raw attachments stay outside Git. Generated SQL and reports belong under ignored `.data/`.

```bash
pnpm data:admission-trends:sql -- \
  --csv /absolute/path/admission-rate-trends.csv \
  --markdown '/absolute/path/IV Map 录取率历年趋势（32校）.md' \
  --imperial /absolute/path/imperial_ug.xlsx \
  --output-dir .data/admission-trends-2026-08-06
```

The output contains:

- `normalized.json`: reviewed normalized records and deterministic hashes;
- `quality-report.json`: reconciliation counts, corrections, and quarantined rows;
- `import.sql`: transactional, idempotent PostgreSQL import.

The importer records the three source artifacts by SHA-256. It preserves an existing official CDS observation when the historical CSV overlaps the same university, metric, and entry year.

## Frontend publication

Database ingestion does not alter the bundled frontend JSON automatically. Export the reviewed snapshot from Fly after an import:

```bash
set -euo pipefail
flyctl ssh console -a llm-gateway-pg \
  -C "sh -lc 'export PGPASSWORD=\"\$OPERATOR_PASSWORD\"; psql -q -h \"\$FLY_APP_NAME.internal\" -p 5432 -U postgres -d ivy_map -v ON_ERROR_STOP=1 -f -'" \
  < db/queries/export_frontend_admission_rates.sql \
  > data/raw/admission-rate-trends.json
flyctl ssh console -a llm-gateway-pg \
  -C "sh -lc 'export PGPASSWORD=\"\$OPERATOR_PASSWORD\"; psql -q -h \"\$FLY_APP_NAME.internal\" -p 5432 -U postgres -d ivy_map -v ON_ERROR_STOP=1 -f -'" \
  < db/queries/export_frontend_admission_counts.sql \
  > data/raw/admission-count-trends.json
pnpm data:build
```

`db/queries/export_frontend_admission_rates.sql` selects only `reviewed`/`published` rate observations, attaches exact application/outcome counts where available, preserves rolling periods, and exposes `value_min/value_max` for privacy-suppressed ranges. The current reviewed export contains 522 points, 32 independent scope series, and 28 universities.

`db/queries/export_frontend_admission_counts.sql` publishes the three Hong Kong universities' `mainland_admitted_count` evidence as a separate typed series. Reviewed actual counts may appear on cards; extracted estimates and planned places are limited to the detail timeline and keep explicit labels. CUHK carries a `not_applicable_early_batch` rate state rather than a fabricated denominator.

The build assigns exactly one primary series per university for cards and the selectivity axis. It prioritizes all-applicant institutional scope, then international/international-program scope, while every China-specific, pathway-specific, or alternate-denominator series remains available through the detail-page scope switch. Different scope signatures are never merged into one line.
