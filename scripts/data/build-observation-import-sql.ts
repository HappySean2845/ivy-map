import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

type JsonObject = Record<string, unknown>

interface ObservationValue {
  metricCode: string
  valueNumber: number
  sourceLocator: JsonObject
}

interface ReviewedEntry {
  institutionId: string
  sourceId: string
  artifactSha256: string
  academicYearStart: number
  dimensions: JsonObject
  observations: ObservationValue[]
}

interface ReviewedObservationFile {
  schemaVersion: number
  reviewedAt: string
  entries: ReviewedEntry[]
}

const METRICS = {
  'cds.c1.applied.total': 'First-time, first-year degree-seeking applicants',
  'cds.c1.admitted.total': 'First-time, first-year degree-seeking students admitted',
  'cds.c1.enrolled.total': 'First-time, first-year degree-seeking students enrolled',
} as const

function arg(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? (process.argv[index + 1] ?? null) : null
}

function sql(value: unknown): string {
  if (value == null) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return `'${String(value).replace(/\0/g, '').replace(/'/g, "''")}'`
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as JsonObject).sort(([left], [right]) =>
      left.localeCompare(right),
    )
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function observationHash(entry: ReviewedEntry, observation: ObservationValue): string {
  return createHash('sha256')
    .update(
      canonicalJson({
        institutionId: entry.institutionId,
        metricCode: observation.metricCode,
        academicYearStart: entry.academicYearStart,
        dimensions: entry.dimensions,
      }),
    )
    .digest('hex')
}

function validate(input: ReviewedObservationFile) {
  if (input.schemaVersion !== 1)
    throw new Error(`unsupported reviewed observation schema: ${input.schemaVersion}`)
  if (!Number.isFinite(Date.parse(input.reviewedAt)))
    throw new Error(`invalid reviewedAt: ${input.reviewedAt}`)
  if (input.entries.length === 0) throw new Error('reviewed observation file is empty')

  const hashes = new Set<string>()
  for (const entry of input.entries) {
    if (!entry.institutionId || !entry.sourceId)
      throw new Error('institutionId and sourceId are required')
    if (!/^[a-f0-9]{64}$/.test(entry.artifactSha256))
      throw new Error(`invalid artifact SHA-256 for ${entry.institutionId}`)
    if (
      !Number.isInteger(entry.academicYearStart) ||
      entry.academicYearStart < 1900 ||
      entry.academicYearStart > 2100
    )
      throw new Error(`invalid academicYearStart for ${entry.institutionId}`)
    if (entry.observations.length === 0)
      throw new Error(`no observations for ${entry.institutionId}`)

    for (const observation of entry.observations) {
      if (!(observation.metricCode in METRICS))
        throw new Error(`unknown metric code: ${observation.metricCode}`)
      if (!Number.isInteger(observation.valueNumber) || observation.valueNumber < 0)
        throw new Error(`invalid numeric value for ${entry.institutionId}`)
      if (Object.keys(observation.sourceLocator).length === 0)
        throw new Error(`source locator is required for ${entry.institutionId}`)
      const hash = observationHash(entry, observation)
      if (hashes.has(hash)) throw new Error(`duplicate logical observation: ${hash}`)
      hashes.add(hash)
    }
  }
}

function main() {
  const inputArg = arg('--input')
  if (!inputArg)
    throw new Error(
      'usage: pnpm data:observations:sql -- --input .data/reviewed/observations.json',
    )

  const inputPath = resolve(inputArg)
  const input = JSON.parse(readFileSync(inputPath, 'utf8')) as ReviewedObservationFile
  validate(input)

  const dimensionSchema = canonicalJson({
    required: ['cohort', 'population', 'term'],
    optional: ['campus'],
  })
  const statements = ['\\set ON_ERROR_STOP on', 'BEGIN;', 'SET LOCAL ROLE ivy_map_owner;']

  for (const [code, label] of Object.entries(METRICS)) {
    statements.push(
      `INSERT INTO metric_definitions (code, dataset_kind, section, label, value_type, unit, dimension_schema) VALUES (${sql(code)}, 'cds', 'C1', ${sql(label)}, 'number', 'students', ${sql(dimensionSchema)}::jsonb) ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, value_type = EXCLUDED.value_type, unit = EXCLUDED.unit, dimension_schema = EXCLUDED.dimension_schema;`,
    )
  }

  let observationCount = 0
  for (const entry of input.entries) {
    for (const observation of entry.observations) {
      const hash = observationHash(entry, observation)
      statements.push(
        `INSERT INTO observations (institution_id, metric_code, academic_year_start, value_number, unit, dimensions, source_artifact_id, source_locator, confidence, review_status, observation_hash) VALUES (${sql(entry.institutionId)}, ${sql(observation.metricCode)}, ${sql(entry.academicYearStart)}, ${sql(observation.valueNumber)}, 'students', ${sql(canonicalJson(entry.dimensions))}::jsonb, (SELECT id FROM source_artifacts WHERE source_id = ${sql(entry.sourceId)} AND sha256 = ${sql(entry.artifactSha256)}), ${sql(canonicalJson(observation.sourceLocator))}::jsonb, 'L1', 'reviewed', ${sql(hash)}) ON CONFLICT (observation_hash) DO UPDATE SET value_number = EXCLUDED.value_number, unit = EXCLUDED.unit, source_artifact_id = EXCLUDED.source_artifact_id, source_locator = EXCLUDED.source_locator, confidence = EXCLUDED.confidence, review_status = EXCLUDED.review_status;`,
      )
      observationCount += 1
    }
  }

  statements.push('COMMIT;', '')
  const outputPath = resolve(dirname(inputPath), 'import.sql')
  writeFileSync(outputPath, statements.join('\n'))
  console.log(`${outputPath} (${observationCount} observations)`)
}

main()
