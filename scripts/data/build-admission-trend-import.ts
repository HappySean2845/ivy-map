import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import Papa from 'papaparse'

type JsonObject = Record<string, unknown>
type Confidence = 'L1' | 'L2' | 'L3'
type ReviewStatus = 'extracted' | 'reviewed'

interface RawRow {
  region: string
  slug: string
  name_cn: string
  name_en: string
  metric: string
  year: string
  applicants: string
  admitted: string
  rate_pct: string
  tier: string
  source: string
}

interface Period {
  academicYearStart: number | null
  periodStart: string | null
  periodEnd: string | null
}

interface ValuePayload {
  valueNumber?: number
  valueText?: string
  valueMin?: number
  valueMax?: number
}

interface ObservationDraft extends Period, ValuePayload {
  institutionId: string
  metricCode: string
  unit: string
  dimensions: JsonObject
  sourceId: string
  artifactSha256: string
  sourceLocator: JsonObject
  confidence: Confidence
  reviewStatus: ReviewStatus
  preferExisting?: boolean
}

interface MetricDefinition {
  datasetKind: 'cds' | 'facts' | 'government_trend'
  section: string
  label: string
  valueType: 'number' | 'percent'
  unit: string
}

interface FileArtifact {
  path: string
  sha256: string
  byteSize: number
  mimeType: string
  sourceId: string
  requestedUrl: string
  capturedAt: string
}

const EXPECTED_HEADERS = [
  'region',
  'slug',
  'name_cn',
  'name_en',
  'metric',
  'year',
  'applicants',
  'admitted',
  'rate_pct',
  'tier',
  'source',
]

const EXPECTED_IMPERIAL_SHA256 =
  '8e686affe71f6bae4360ee9248cabc8a97e5c3ab94ae5f13fdf4527199a9f1b6'

const METRICS: Record<string, MetricDefinition> = {
  'cds.c1.applied.total': {
    datasetKind: 'cds',
    section: 'C1',
    label: 'First-time, first-year degree-seeking applicants',
    valueType: 'number',
    unit: 'students',
  },
  'cds.c1.admitted.total': {
    datasetKind: 'cds',
    section: 'C1',
    label: 'First-time, first-year degree-seeking students admitted',
    valueType: 'number',
    unit: 'students',
  },
  'admissions.applications': {
    datasetKind: 'government_trend',
    section: 'admissions_trend',
    label: 'Undergraduate applications or candidates',
    valueType: 'number',
    unit: 'students',
  },
  'admissions.admitted': {
    datasetKind: 'government_trend',
    section: 'admissions_trend',
    label: 'Undergraduate students admitted',
    valueType: 'number',
    unit: 'students',
  },
  'admissions.offers': {
    datasetKind: 'government_trend',
    section: 'admissions_trend',
    label: 'Undergraduate offers made',
    valueType: 'number',
    unit: 'students',
  },
  'admissions.confirmed_places': {
    datasetKind: 'government_trend',
    section: 'admissions_trend',
    label: 'Undergraduate places confirmed or students enrolled',
    valueType: 'number',
    unit: 'students',
  },
  'admissions.planned_places': {
    datasetKind: 'government_trend',
    section: 'admissions_trend',
    label: 'Planned undergraduate places',
    valueType: 'number',
    unit: 'students',
  },
  'admissions.rate': {
    datasetKind: 'government_trend',
    section: 'admissions_trend',
    label: 'Admission, offer, success, or confirmed-place rate',
    valueType: 'percent',
    unit: 'percent',
  },
  'enrollment.undergraduate.total': {
    datasetKind: 'facts',
    section: 'enrollment_trend',
    label: 'Total undergraduate enrollment',
    valueType: 'number',
    unit: 'students',
  },
  'enrollment.undergraduate.international': {
    datasetKind: 'facts',
    section: 'enrollment_trend',
    label: 'International undergraduate enrollment',
    valueType: 'number',
    unit: 'students',
  },
  'enrollment.undergraduate.international_share': {
    datasetKind: 'facts',
    section: 'enrollment_trend',
    label: 'International share of undergraduate enrollment',
    valueType: 'percent',
    unit: 'percent',
  },
}

const IMPERIAL_TOTALS: Record<
  number,
  { applications: number; offers: number; confirmed: number; range: string }
> = {
  2020: { applications: 25780, offers: 8758, confirmed: 3454, range: 'C391:E391' },
  2021: { applications: 28905, offers: 7821, confirmed: 3308, range: 'F391:H391' },
  2022: { applications: 28877, offers: 7616, confirmed: 3092, range: 'I391:K391' },
  2023: { applications: 30739, offers: 7948, confirmed: 3137, range: 'L391:N391' },
  2024: { applications: 32887, offers: 8264, confirmed: 3474, range: 'O391:Q391' },
  2025: { applications: 33923, offers: 8143, confirmed: 3627, range: 'R391:T391' },
}

const IMPERIAL_CHINA_ROWS = [
  48, 185, 315, 445, 565, 696, 836, 925, 1009, 1140, 1260, 1371, 1535, 1667, 1819, 1956, 2087,
  2201, 2327,
]

const IMPERIAL_CHINA: Record<
  number,
  {
    applications: number
    offersVisible: number
    offersSuppressed: number
    confirmedVisible: number
    confirmedSuppressed: number
    columns: string
  }
> = {
  2021: {
    applications: 6181,
    offersVisible: 1575,
    offersSuppressed: 2,
    confirmedVisible: 703,
    confirmedSuppressed: 2,
    columns: 'C:E',
  },
  2022: {
    applications: 6533,
    offersVisible: 1675,
    offersSuppressed: 2,
    confirmedVisible: 807,
    confirmedSuppressed: 2,
    columns: 'F:H',
  },
  2023: {
    applications: 7092,
    offersVisible: 1618,
    offersSuppressed: 0,
    confirmedVisible: 734,
    confirmedSuppressed: 0,
    columns: 'I:K',
  },
  2024: {
    applications: 7344,
    offersVisible: 1528,
    offersSuppressed: 1,
    confirmedVisible: 675,
    confirmedSuppressed: 2,
    columns: 'L:N',
  },
  2025: {
    applications: 8415,
    offersVisible: 1731,
    offersSuppressed: 0,
    confirmedVisible: 805,
    confirmedSuppressed: 0,
    columns: 'O:Q',
  },
}

function arg(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? (process.argv[index + 1] ?? null) : null
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as JsonObject)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function sql(value: unknown): string {
  if (value == null) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return `'${String(value).replace(/\0/g, '').replace(/'/g, "''")}'`
}

function parsePeriod(raw: string): Period {
  if (/^\d{4}$/.test(raw)) {
    return { academicYearStart: Number(raw), periodStart: null, periodEnd: null }
  }
  const academic = raw.match(/^(\d{4})[–—-](\d{2})$/)
  if (academic) {
    const start = Number(academic[1])
    const end = Number(`${String(start).slice(0, 2)}${academic[2]}`)
    return {
      academicYearStart: start,
      periodStart: `${start}-01-01`,
      periodEnd: `${end}-12-31`,
    }
  }
  const rolling = raw.match(/^(\d{4})[–—-](\d{4})$/)
  if (rolling) {
    return {
      academicYearStart: null,
      periodStart: `${rolling[1]}-01-01`,
      periodEnd: `${rolling[2]}-12-31`,
    }
  }
  throw new Error(`unsupported year or period: ${raw}`)
}

function parseNumericClaim(raw: string): { value: number; approximate: boolean } | null {
  const normalized = raw.replace(/,/g, '').trim()
  if (!normalized || normalized === '未找到' || normalized === '—') return null
  const exact = normalized.match(/^\d+(?:\.\d+)?$/)
  if (exact) return { value: Number(normalized), approximate: false }
  const approximate = normalized.match(/^约(\d+(?:\.\d+)?)$/)
  if (approximate) return { value: Number(approximate[1]), approximate: true }
  return null
}

function confidenceForTier(tier: string): Confidence {
  if (tier === 'A') return 'L1'
  if (tier === 'B') return 'L2'
  return 'L3'
}

function observationHash(observation: ObservationDraft): string {
  return createHash('sha256')
    .update(
      canonicalJson({
        schema: 'admission-trends-v1',
        institutionId: observation.institutionId,
        metricCode: observation.metricCode,
        academicYearStart: observation.academicYearStart,
        periodStart: observation.periodStart,
        periodEnd: observation.periodEnd,
        dimensions: observation.dimensions,
      }),
    )
    .digest('hex')
}

function validateValue(observation: ObservationDraft) {
  const scalarCount =
    Number(observation.valueNumber != null) + Number(observation.valueText != null)
  const hasRange = observation.valueMin != null || observation.valueMax != null
  if (scalarCount + Number(hasRange) !== 1)
    throw new Error(
      `invalid value payload for ${observation.institutionId}/${observation.metricCode}`,
    )
  if (hasRange) {
    if (observation.valueMin == null || observation.valueMax == null)
      throw new Error(
        `incomplete range for ${observation.institutionId}/${observation.metricCode}`,
      )
    if (observation.valueMin > observation.valueMax)
      throw new Error(
        `reversed range for ${observation.institutionId}/${observation.metricCode}`,
      )
  }
}

function main() {
  const csvArg = arg('--csv')
  const markdownArg = arg('--markdown')
  const imperialArg = arg('--imperial')
  const outputArg = arg('--output-dir')
  if (!csvArg || !markdownArg || !imperialArg || !outputArg) {
    throw new Error(
      'usage: pnpm data:admission-trends:sql -- --csv <csv> --markdown <md> --imperial <xlsx> --output-dir <dir>',
    )
  }

  const csvPath = resolve(csvArg)
  const markdownPath = resolve(markdownArg)
  const imperialPath = resolve(imperialArg)
  const outputDir = resolve(outputArg)
  const csvSha = sha256File(csvPath)
  const markdownSha = sha256File(markdownPath)
  const imperialSha = sha256File(imperialPath)
  if (imperialSha !== EXPECTED_IMPERIAL_SHA256) {
    throw new Error(
      `Imperial workbook changed (${imperialSha}); re-audit cell mappings before importing`,
    )
  }

  const parsed = Papa.parse<RawRow>(readFileSync(csvPath, 'utf8'), {
    header: true,
    skipEmptyLines: 'greedy',
  })
  if (parsed.errors.length) {
    throw new Error(parsed.errors.map((error) => error.message).join('; '))
  }
  if (canonicalJson(parsed.meta.fields) !== canonicalJson(EXPECTED_HEADERS)) {
    throw new Error(`unexpected CSV headers: ${parsed.meta.fields?.join(', ')}`)
  }
  const rows = parsed.data.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, String(value ?? '').trim()]),
    ),
  ) as unknown as RawRow[]
  if (rows.length !== 921) throw new Error(`expected 921 CSV rows, got ${rows.length}`)

  const schoolKeys = new Set<string>()
  const logicalRows = new Set<string>()
  for (const row of rows) {
    schoolKeys.add(row.slug)
    const key = `${row.slug}/${row.metric}/${row.year}`
    if (logicalRows.has(key)) throw new Error(`duplicate CSV row: ${key}`)
    logicalRows.add(key)
  }
  if (schoolKeys.size !== 32)
    throw new Error(`expected 32 universities, got ${schoolKeys.size}`)

  const csvArtifact: FileArtifact = {
    path: csvPath,
    sha256: csvSha,
    byteSize: statSync(csvPath).size,
    mimeType: 'text/csv; charset=utf-8',
    sourceId: 'admission-rate-trends-2026-08-06',
    requestedUrl: 'urn:ivy-map:attachment:admission-rate-trends.csv',
    capturedAt: statSync(csvPath).mtime.toISOString(),
  }
  const markdownArtifact: FileArtifact = {
    path: markdownPath,
    sha256: markdownSha,
    byteSize: statSync(markdownPath).size,
    mimeType: 'text/markdown; charset=utf-8',
    sourceId: 'admission-rate-trends-2026-08-06',
    requestedUrl: 'urn:ivy-map:attachment:admission-rate-trends-methodology.md',
    capturedAt: statSync(markdownPath).mtime.toISOString(),
  }
  const imperialArtifact: FileArtifact = {
    path: imperialPath,
    sha256: imperialSha,
    byteSize: statSync(imperialPath).size,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sourceId: 'imperial-official',
    requestedUrl: 'https://www.imperial.ac.uk/planning',
    capturedAt: statSync(imperialPath).mtime.toISOString(),
  }

  const observations: ObservationDraft[] = []
  const quarantined: Array<{ row: number; key: string; reason: string; raw: RawRow }> = []
  const emittedRows = new Set<number>()

  function emit(rowNumber: number, observation: ObservationDraft) {
    if (!(observation.metricCode in METRICS))
      throw new Error(`unknown metric: ${observation.metricCode}`)
    validateValue(observation)
    observations.push(observation)
    emittedRows.add(rowNumber)
  }

  function locator(rowNumber: number, row: RawRow): JsonObject {
    return {
      file: basename(csvPath),
      row: rowNumber,
      rawMetric: row.metric,
      tier: row.tier,
      citedSource: row.source,
    }
  }

  function emitTriplet(
    rowNumber: number,
    row: RawRow,
    firstMetric: string,
    secondMetric: string,
    dimensions: JsonObject,
    rateBasis: string,
    options: { preferExisting?: boolean; forceExtracted?: boolean } = {},
  ) {
    const period = parsePeriod(row.year)
    const first = parseNumericClaim(row.applicants)
    const second = parseNumericClaim(row.admitted)
    const rate = parseNumericClaim(row.rate_pct)
    const approximate = Boolean(first?.approximate || second?.approximate || rate?.approximate)
    const confidence = confidenceForTier(row.tier)
    const reviewStatus: ReviewStatus =
      options.forceExtracted || row.tier === 'C' || row.tier === '-' || approximate
        ? 'extracted'
        : 'reviewed'
    const sourceLocator = locator(rowNumber, row)

    if (first) {
      emit(rowNumber, {
        ...period,
        institutionId: row.slug,
        metricCode: firstMetric,
        valueNumber: first.value,
        unit: METRICS[firstMetric].unit,
        dimensions,
        sourceId: csvArtifact.sourceId,
        artifactSha256: csvArtifact.sha256,
        sourceLocator,
        confidence,
        reviewStatus,
        preferExisting: options.preferExisting,
      })
    }
    if (second) {
      emit(rowNumber, {
        ...period,
        institutionId: row.slug,
        metricCode: secondMetric,
        valueNumber: second.value,
        unit: METRICS[secondMetric].unit,
        dimensions,
        sourceId: csvArtifact.sourceId,
        artifactSha256: csvArtifact.sha256,
        sourceLocator,
        confidence,
        reviewStatus,
        preferExisting: options.preferExisting,
      })
    }
    if (rate) {
      const rateDimensions = { ...dimensions, rate_basis: rateBasis }
      emit(rowNumber, {
        ...period,
        institutionId: row.slug,
        metricCode: 'admissions.rate',
        valueNumber: rate.value,
        unit: 'percent',
        dimensions: rateDimensions,
        sourceId: csvArtifact.sourceId,
        artifactSha256: csvArtifact.sha256,
        sourceLocator,
        confidence,
        reviewStatus,
      })
      if (first && second && first.value > 0 && !first.approximate && !second.approximate) {
        const derived = (100 * second.value) / first.value
        if (Math.abs(derived - rate.value) > 0.06) {
          throw new Error(
            `rate mismatch at CSV row ${rowNumber}: ${rate.value} vs ${derived.toFixed(4)}`,
          )
        }
      }
    }
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const common = { study_level: 'undergraduate', source_metric: row.metric }

    if (row.slug === 'imperial' && row.metric === 'overall_place_rate') {
      const year = Number(row.year)
      const total = IMPERIAL_TOTALS[year]
      if (!total) throw new Error(`missing Imperial total manifest for ${row.year}`)
      const csvApplications = parseNumericClaim(row.applicants)?.value
      const csvConfirmed = parseNumericClaim(row.admitted)?.value
      const csvRate = parseNumericClaim(row.rate_pct)?.value
      if (csvApplications !== total.applications || csvConfirmed !== total.confirmed)
        throw new Error(`Imperial CSV/workbook mismatch for ${year}`)
      if (
        csvRate == null ||
        Math.abs(csvRate - (100 * total.confirmed) / total.applications) > 0.06
      )
        throw new Error(`Imperial rate mismatch for ${year}`)
      const dimensions = {
        ...common,
        admissions_system: 'UCAS',
        applicant_scope: 'all',
        period_kind: 'entry_cycle',
      }
      const sourceLocator = {
        file: basename(imperialPath),
        sheet: '1.Admission Rate',
        range: total.range,
        labels: ['Applications Received', 'Offer Made', 'UF'],
        crossCheckCsvRow: rowNumber,
      }
      for (const [metricCode, valueNumber] of [
        ['admissions.applications', total.applications],
        ['admissions.offers', total.offers],
        ['admissions.confirmed_places', total.confirmed],
      ] as const) {
        emit(rowNumber, {
          academicYearStart: year,
          periodStart: null,
          periodEnd: null,
          institutionId: row.slug,
          metricCode,
          valueNumber,
          unit: 'students',
          dimensions,
          sourceId: imperialArtifact.sourceId,
          artifactSha256: imperialArtifact.sha256,
          sourceLocator,
          confidence: 'L1',
          reviewStatus: 'reviewed',
        })
      }
      emit(rowNumber, {
        academicYearStart: year,
        periodStart: null,
        periodEnd: null,
        institutionId: row.slug,
        metricCode: 'admissions.rate',
        valueNumber: Number(((100 * total.confirmed) / total.applications).toFixed(4)),
        unit: 'percent',
        dimensions: { ...dimensions, rate_basis: 'confirmed_places_over_applications' },
        sourceId: imperialArtifact.sourceId,
        artifactSha256: imperialArtifact.sha256,
        sourceLocator,
        confidence: 'L1',
        reviewStatus: 'reviewed',
      })
      return
    }

    if (row.slug === 'imperial' && row.metric === 'china_offer_rate') {
      const year = Number(row.year)
      const total = IMPERIAL_CHINA[year]
      if (!total) throw new Error(`missing Imperial China manifest for ${row.year}`)
      if (
        parseNumericClaim(row.applicants)?.value !== total.applications ||
        parseNumericClaim(row.admitted)?.value !== total.offersVisible
      )
        throw new Error(`Imperial China CSV/workbook mismatch for ${year}`)
      const dimensions = {
        ...common,
        admissions_system: 'UCAS',
        applicant_scope: 'china_nationality',
        geography_definition: 'nationality_not_domicile',
        aggregation: 'sum_department_china_rows',
      }
      const sourceLocator = {
        file: basename(imperialPath),
        sheet: '4.Nationality',
        columns: total.columns,
        rows: IMPERIAL_CHINA_ROWS,
        suppressedCellRule: 'official workbook displays values of five and under as *',
        crossCheckCsvRow: rowNumber,
      }
      emit(rowNumber, {
        academicYearStart: year,
        periodStart: null,
        periodEnd: null,
        institutionId: row.slug,
        metricCode: 'admissions.applications',
        valueNumber: total.applications,
        unit: 'students',
        dimensions,
        sourceId: imperialArtifact.sourceId,
        artifactSha256: imperialArtifact.sha256,
        sourceLocator,
        confidence: 'L2',
        reviewStatus: 'reviewed',
      })
      const offersMax = total.offersVisible + 5 * total.offersSuppressed
      const confirmedMax = total.confirmedVisible + 5 * total.confirmedSuppressed
      emit(rowNumber, {
        academicYearStart: year,
        periodStart: null,
        periodEnd: null,
        institutionId: row.slug,
        metricCode: 'admissions.offers',
        ...(total.offersSuppressed
          ? { valueMin: total.offersVisible, valueMax: offersMax }
          : { valueNumber: total.offersVisible }),
        unit: 'students',
        dimensions,
        sourceId: imperialArtifact.sourceId,
        artifactSha256: imperialArtifact.sha256,
        sourceLocator,
        confidence: 'L2',
        reviewStatus: 'reviewed',
      })
      emit(rowNumber, {
        academicYearStart: year,
        periodStart: null,
        periodEnd: null,
        institutionId: row.slug,
        metricCode: 'admissions.confirmed_places',
        ...(total.confirmedSuppressed
          ? { valueMin: total.confirmedVisible, valueMax: confirmedMax }
          : { valueNumber: total.confirmedVisible }),
        unit: 'students',
        dimensions,
        sourceId: imperialArtifact.sourceId,
        artifactSha256: imperialArtifact.sha256,
        sourceLocator,
        confidence: 'L2',
        reviewStatus: 'reviewed',
      })
      emit(rowNumber, {
        academicYearStart: year,
        periodStart: null,
        periodEnd: null,
        institutionId: row.slug,
        metricCode: 'admissions.rate',
        ...(total.offersSuppressed
          ? {
              valueMin: Number(((100 * total.offersVisible) / total.applications).toFixed(4)),
              valueMax: Number(((100 * offersMax) / total.applications).toFixed(4)),
            }
          : {
              valueNumber: Number(
                ((100 * total.offersVisible) / total.applications).toFixed(4),
              ),
            }),
        unit: 'percent',
        dimensions: { ...dimensions, rate_basis: 'offers_over_applications' },
        sourceId: imperialArtifact.sourceId,
        artifactSha256: imperialArtifact.sha256,
        sourceLocator,
        confidence: 'L2',
        reviewStatus: 'reviewed',
      })
      return
    }

    switch (row.metric) {
      case 'overall_admit_rate':
        emitTriplet(
          rowNumber,
          row,
          'cds.c1.applied.total',
          'cds.c1.admitted.total',
          {
            cohort: 'first_time_first_year',
            population: 'degree_seeking',
            term: 'fall',
          },
          'admitted_over_applications',
          { preferExisting: true },
        )
        break
      case 'intl_ug_share': {
        const period = parsePeriod(row.year)
        const total = parseNumericClaim(row.applicants)
        const international = parseNumericClaim(row.admitted)
        const share = parseNumericClaim(row.rate_pct)
        if (!total || !international || !share)
          throw new Error(`invalid international share row ${rowNumber}`)
        const dimensions = {
          ...common,
          term: 'fall',
          population: 'undergraduate',
          international_definition: 'IPEDS_nonresident_alien',
        }
        for (const [metricCode, valueNumber] of [
          ['enrollment.undergraduate.total', total.value],
          ['enrollment.undergraduate.international', international.value],
          ['enrollment.undergraduate.international_share', share.value],
        ] as const) {
          emit(rowNumber, {
            ...period,
            institutionId: row.slug,
            metricCode,
            valueNumber,
            unit: METRICS[metricCode].unit,
            dimensions,
            sourceId: csvArtifact.sourceId,
            artifactSha256: csvArtifact.sha256,
            sourceLocator: locator(rowNumber, row),
            confidence: 'L1',
            reviewStatus: 'reviewed',
          })
        }
        break
      }
      case 'overall_success_rate':
        emitTriplet(
          rowNumber,
          row,
          'admissions.applications',
          'admissions.confirmed_places',
          { ...common, admissions_system: 'UCAS', applicant_scope: 'all' },
          'confirmed_places_over_applications',
        )
        break
      case 'china_success_rate':
        emitTriplet(
          rowNumber,
          row,
          'admissions.applications',
          'admissions.confirmed_places',
          {
            ...common,
            admissions_system: 'UCAS',
            applicant_scope: 'china_domicile',
            geography_definition: 'domicile_excludes_hong_kong',
          },
          'confirmed_places_over_applications',
        )
        break
      case 'china_success_rate_3yr':
        emitTriplet(
          rowNumber,
          row,
          'admissions.applications',
          'admissions.confirmed_places',
          {
            ...common,
            admissions_system: 'UCAS',
            applicant_scope: 'china_domicile',
            period_kind: 'rolling_three_entry_years',
          },
          'confirmed_places_over_applications',
        )
        break
      case 'overall_place_rate':
        emitTriplet(
          rowNumber,
          row,
          'admissions.applications',
          row.slug === 'lse' ? 'admissions.planned_places' : 'admissions.confirmed_places',
          {
            ...common,
            admissions_system: 'UCAS',
            applicant_scope: 'all',
            approximate: row.tier === 'C',
          },
          row.slug === 'lse'
            ? 'planned_places_over_applications'
            : 'confirmed_places_over_applications',
        )
        break
      case 'ippan_senbatsu_rate':
        emitTriplet(
          rowNumber,
          row,
          'admissions.applications',
          'admissions.admitted',
          {
            ...common,
            admissions_system: 'japan_national_university_exam',
            pathway: 'ippan_senbatsu',
            applicant_scope: 'exam_candidates',
          },
          'admitted_over_exam_candidates',
        )
        break
      case 'peak_rate':
        emitTriplet(
          rowNumber,
          row,
          'admissions.applications',
          'admissions.admitted',
          {
            ...common,
            admissions_system: 'university_direct',
            pathway: 'PEAK',
            applicant_scope: 'international_program',
          },
          'admitted_over_applications',
        )
        break
      case 'intl_admit_rate':
        emitTriplet(
          rowNumber,
          row,
          'admissions.applications',
          'admissions.admitted',
          {
            ...common,
            admissions_system: 'Ontario_CUDO',
            applicant_scope: 'international',
          },
          'admitted_over_applications',
        )
        break
      case 'nonlocal_admit_rate':
        emitTriplet(
          rowNumber,
          row,
          'admissions.applications',
          'admissions.admitted',
          {
            ...common,
            applicant_scope: 'nonlocal',
            approximate: true,
          },
          'admitted_over_applications',
          { forceExtracted: true },
        )
        break
      case 'mainland_admitted_count': {
        const period = parsePeriod(row.year)
        const base = {
          ...period,
          institutionId: row.slug,
          unit: 'students',
          dimensions: {
            ...common,
            applicant_scope: 'mainland_china',
            pathway: 'mainland_undergraduate_scheme',
          },
          sourceId: csvArtifact.sourceId,
          artifactSha256: csvArtifact.sha256,
          sourceLocator: locator(rowNumber, row),
          confidence: 'L2' as const,
        }
        const exact = parseNumericClaim(row.admitted)
        if (exact && !exact.approximate) {
          emit(rowNumber, {
            ...base,
            metricCode: 'admissions.admitted',
            valueNumber: exact.value,
            reviewStatus: 'reviewed',
          })
        } else if (row.admitted === '约780') {
          emit(rowNumber, {
            ...base,
            metricCode: 'admissions.admitted',
            valueNumber: 780,
            dimensions: { ...base.dimensions, approximate: true },
            reviewStatus: 'extracted',
          })
        } else if (row.admitted === '>250（高考生）') {
          emit(rowNumber, {
            ...base,
            metricCode: 'admissions.admitted',
            valueText: '>250 (Gaokao applicants)',
            dimensions: { ...base.dimensions, approximate: true },
            reviewStatus: 'extracted',
          })
        } else if (row.admitted === '计划高考400') {
          emit(rowNumber, {
            ...base,
            metricCode: 'admissions.planned_places',
            valueNumber: 400,
            dimensions: { ...base.dimensions, approximate: true },
            reviewStatus: 'extracted',
          })
        } else if (row.admitted === '计划约400–406') {
          emit(rowNumber, {
            ...base,
            metricCode: 'admissions.planned_places',
            valueMin: 400,
            valueMax: 406,
            dimensions: { ...base.dimensions, approximate: true },
            reviewStatus: 'extracted',
          })
        } else if (row.admitted === '计划约250，实际>300') {
          emit(rowNumber, {
            ...base,
            metricCode: 'admissions.planned_places',
            valueNumber: 250,
            dimensions: { ...base.dimensions, approximate: true },
            reviewStatus: 'extracted',
          })
          emit(rowNumber, {
            ...base,
            metricCode: 'admissions.admitted',
            valueText: '>300',
            dimensions: { ...base.dimensions, approximate: true },
            reviewStatus: 'extracted',
          })
        } else {
          throw new Error(`unsupported Hong Kong count at row ${rowNumber}: ${row.admitted}`)
        }
        break
      }
      default:
        throw new Error(`unsupported CSV metric at row ${rowNumber}: ${row.metric}`)
    }

    if (!emittedRows.has(rowNumber)) {
      quarantined.push({
        row: rowNumber,
        key: `${row.slug}/${row.metric}/${row.year}`,
        reason: 'source explicitly reports that the value was not found',
        raw: row,
      })
    }
  })

  const hashes = new Set<string>()
  for (const observation of observations) {
    const hash = observationHash(observation)
    if (hashes.has(hash))
      throw new Error(
        `duplicate normalized observation: ${observation.institutionId}/${observation.metricCode}`,
      )
    hashes.add(hash)
  }

  for (const row of rows) {
    if (row.tier === 'C' || row.tier === '-') continue
    if (row.rate_pct && parseNumericClaim(row.rate_pct)?.value != null) {
      const rate = parseNumericClaim(row.rate_pct)!.value
      if (rate < 0 || rate > 100) throw new Error(`rate outside 0-100: ${rate}`)
    }
  }

  const artifacts = [csvArtifact, markdownArtifact, imperialArtifact]
  const runId = `manual-admission-trends-${csvSha.slice(0, 12)}`
  const manifestSha = createHash('sha256')
    .update(
      canonicalJson(
        artifacts.map((artifact) => ({
          sha256: artifact.sha256,
          byteSize: artifact.byteSize,
          mimeType: artifact.mimeType,
          sourceId: artifact.sourceId,
          requestedUrl: artifact.requestedUrl,
          capturedAt: artifact.capturedAt,
        })),
      ),
    )
    .digest('hex')
  const startedAt = artifacts
    .map((artifact) => artifact.capturedAt)
    .sort()
    .at(-1) as string

  const statements = ['\\set ON_ERROR_STOP on', 'BEGIN;', 'SET LOCAL ROLE ivy_map_owner;']
  statements.push(
    `INSERT INTO institutions (id, kind, name_en, name_local, country_code, status) VALUES ('ivy-map-research', 'system', 'IVY Map Research', 'IVY Map 数据研究', 'CN', 'active') ON CONFLICT (id) DO UPDATE SET name_en = EXCLUDED.name_en, name_local = EXCLUDED.name_local, updated_at = now();`,
  )
  statements.push(
    `INSERT INTO sources (id, institution_id, source_type, dataset_kind, title, canonical_url, confidence, access_status, first_seen_at, last_checked_at) VALUES ('admission-rate-trends-2026-08-06', 'ivy-map-research', 'report', 'government_trend', 'IV Map 录取率历年趋势（32校）', 'urn:ivy-map:curated:admission-rate-trends:2026-08-06', 'L2', 'captured', ${sql(startedAt)}::timestamptz, ${sql(startedAt)}::timestamptz) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, confidence = EXCLUDED.confidence, access_status = EXCLUDED.access_status, last_checked_at = EXCLUDED.last_checked_at;`,
  )
  statements.push(
    `INSERT INTO crawl_runs (run_id, tool_version, seed_file, started_at, finished_at, status, seed_count, fetched_source_count, failed_source_count, artifact_count, discovered_link_count, manifest_sha256, imported_at) VALUES (${sql(runId)}, 'admission-trends-v1', ${sql(`${basename(csvPath)}, ${basename(markdownPath)}, ${basename(imperialPath)}`)}, ${sql(startedAt)}::timestamptz, ${sql(startedAt)}::timestamptz, 'completed', 2, 2, 0, 3, 0, ${sql(manifestSha)}, now()) ON CONFLICT (run_id) DO UPDATE SET status = EXCLUDED.status, artifact_count = EXCLUDED.artifact_count, manifest_sha256 = EXCLUDED.manifest_sha256, imported_at = now();`,
  )

  for (const artifact of artifacts) {
    statements.push(
      `INSERT INTO crawl_attempts (run_id, source_id, artifact_kind, requested_url, final_url, status, http_status, mime_type, byte_size, sha256, local_path, fetched_at) VALUES (${sql(runId)}, ${sql(artifact.sourceId)}, 'document', ${sql(artifact.requestedUrl)}, NULL, 'fetched', NULL, ${sql(artifact.mimeType)}, ${artifact.byteSize}, ${sql(artifact.sha256)}, NULL, ${sql(artifact.capturedAt)}::timestamptz) ON CONFLICT (run_id, source_id, requested_url) DO UPDATE SET status = EXCLUDED.status, mime_type = EXCLUDED.mime_type, byte_size = EXCLUDED.byte_size, sha256 = EXCLUDED.sha256, fetched_at = EXCLUDED.fetched_at;`,
    )
    statements.push(
      `INSERT INTO source_artifacts (source_id, first_seen_run_id, last_seen_run_id, artifact_kind, requested_url, final_url, sha256, mime_type, byte_size, local_path, captured_at) VALUES (${sql(artifact.sourceId)}, ${sql(runId)}, ${sql(runId)}, 'document', ${sql(artifact.requestedUrl)}, NULL, ${sql(artifact.sha256)}, ${sql(artifact.mimeType)}, ${artifact.byteSize}, NULL, ${sql(artifact.capturedAt)}::timestamptz) ON CONFLICT (source_id, sha256) DO UPDATE SET last_seen_run_id = EXCLUDED.last_seen_run_id, mime_type = EXCLUDED.mime_type, byte_size = EXCLUDED.byte_size, captured_at = EXCLUDED.captured_at;`,
    )
  }

  const dimensionSchema = canonicalJson({
    required: ['study_level'],
    optional: [
      'admissions_system',
      'applicant_scope',
      'cohort',
      'geography_definition',
      'international_definition',
      'pathway',
      'period_kind',
      'population',
      'rate_basis',
      'source_metric',
      'term',
    ],
  })
  for (const [code, metric] of Object.entries(METRICS)) {
    statements.push(
      `INSERT INTO metric_definitions (code, dataset_kind, section, label, value_type, unit, dimension_schema) VALUES (${sql(code)}, ${sql(metric.datasetKind)}, ${sql(metric.section)}, ${sql(metric.label)}, ${sql(metric.valueType)}, ${sql(metric.unit)}, ${sql(dimensionSchema)}::jsonb) ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, value_type = EXCLUDED.value_type, unit = EXCLUDED.unit, dimension_schema = EXCLUDED.dimension_schema;`,
    )
  }

  for (const observation of observations) {
    const hash = observationHash(observation)
    const values = [
      sql(observation.institutionId),
      sql(observation.metricCode),
      sql(observation.academicYearStart),
      observation.periodStart ? `${sql(observation.periodStart)}::date` : 'NULL',
      observation.periodEnd ? `${sql(observation.periodEnd)}::date` : 'NULL',
      sql(observation.valueNumber),
      sql(observation.valueText),
      sql(observation.valueMin),
      sql(observation.valueMax),
      sql(observation.unit),
      `${sql(canonicalJson(observation.dimensions))}::jsonb`,
      `(SELECT id FROM source_artifacts WHERE source_id = ${sql(observation.sourceId)} AND sha256 = ${sql(observation.artifactSha256)})`,
      `${sql(canonicalJson(observation.sourceLocator))}::jsonb`,
      sql(observation.confidence),
      sql(observation.reviewStatus),
      sql(hash),
    ].join(', ')
    const conflictUpdate =
      'value_number = EXCLUDED.value_number, value_text = EXCLUDED.value_text, value_min = EXCLUDED.value_min, value_max = EXCLUDED.value_max, unit = EXCLUDED.unit, source_artifact_id = EXCLUDED.source_artifact_id, source_locator = EXCLUDED.source_locator, confidence = EXCLUDED.confidence, review_status = EXCLUDED.review_status'
    if (observation.preferExisting) {
      statements.push(
        `INSERT INTO observations (institution_id, metric_code, academic_year_start, period_start, period_end, value_number, value_text, value_min, value_max, unit, dimensions, source_artifact_id, source_locator, confidence, review_status, observation_hash) SELECT ${values} WHERE NOT EXISTS (SELECT 1 FROM observations AS existing WHERE existing.institution_id = ${sql(observation.institutionId)} AND existing.metric_code = ${sql(observation.metricCode)} AND existing.academic_year_start IS NOT DISTINCT FROM ${sql(observation.academicYearStart)} AND existing.observation_hash <> ${sql(hash)}) ON CONFLICT (observation_hash) DO UPDATE SET ${conflictUpdate};`,
      )
    } else {
      statements.push(
        `INSERT INTO observations (institution_id, metric_code, academic_year_start, period_start, period_end, value_number, value_text, value_min, value_max, unit, dimensions, source_artifact_id, source_locator, confidence, review_status, observation_hash) VALUES (${values}) ON CONFLICT (observation_hash) DO UPDATE SET ${conflictUpdate};`,
      )
    }
  }
  statements.push('COMMIT;', '')

  const countsByMetric: Record<string, number> = {}
  const countsByStatus: Record<string, number> = {}
  for (const observation of observations) {
    countsByMetric[observation.metricCode] = (countsByMetric[observation.metricCode] ?? 0) + 1
    countsByStatus[observation.reviewStatus] =
      (countsByStatus[observation.reviewStatus] ?? 0) + 1
  }
  const qualityReport = {
    schemaVersion: 1,
    input: {
      rows: rows.length,
      universities: schoolKeys.size,
      csvSha256: csvSha,
      markdownSha256: markdownSha,
      imperialSha256: imperialSha,
    },
    output: {
      observations: observations.length,
      rowsWithObservations: emittedRows.size,
      quarantinedRows: quarantined.length,
      countsByMetric,
      countsByStatus,
      rangeObservations: observations.filter((item) => item.valueMin != null).length,
      textObservations: observations.filter((item) => item.valueText != null).length,
    },
    quarantined,
    corrections: [
      {
        scope: 'Imperial China nationality offer and confirmed-place totals',
        years: [2021, 2022, 2024],
        action:
          'stored as ranges because the official workbook suppresses values of five and under',
      },
    ],
  }
  const normalized = {
    schemaVersion: 1,
    generatedFrom: {
      csv: { name: basename(csvPath), sha256: csvSha },
      markdown: { name: basename(markdownPath), sha256: markdownSha },
      imperial: { name: basename(imperialPath), sha256: imperialSha },
    },
    observations: observations.map((observation) => ({
      ...observation,
      observationHash: observationHash(observation),
    })),
  }

  mkdirSync(outputDir, { recursive: true })
  writeFileSync(
    resolve(outputDir, 'normalized.json'),
    `${JSON.stringify(normalized, null, 2)}\n`,
  )
  writeFileSync(
    resolve(outputDir, 'quality-report.json'),
    `${JSON.stringify(qualityReport, null, 2)}\n`,
  )
  writeFileSync(resolve(outputDir, 'import.sql'), statements.join('\n'))
  console.log(
    JSON.stringify(
      {
        outputDir,
        rows: rows.length,
        universities: schoolKeys.size,
        observations: observations.length,
        reviewed: countsByStatus.reviewed ?? 0,
        extracted: countsByStatus.extracted ?? 0,
        quarantinedRows: quarantined.length,
      },
      null,
      2,
    ),
  )
}

main()
