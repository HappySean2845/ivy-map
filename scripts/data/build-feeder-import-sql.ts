import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Papa from 'papaparse'
import { z } from 'zod'

type JsonObject = Record<string, unknown>

const InputSchema = z.object({
  schemaVersion: z.literal(1),
  reviewedAt: z.iso.datetime(),
  sourceArtifact: z.object({
    sourceId: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  scope: z.object({
    academicYearStart: z.number().int().min(1900).max(2100),
    admissionRound: z.enum([
      'ED',
      'ED1',
      'ED2',
      'EA',
      'REA',
      'RD',
      'rolling',
      'early_combined',
      'combined',
      'unknown',
    ]),
    countKind: z.enum(['admits', 'offers', 'estimated']),
    studentScope: z.string().min(1),
    isComplete: z.boolean(),
    confidence: z.enum(['L1', 'L2', 'L3']),
  }),
  records: z
    .array(
      z.object({
        schoolId: z.string().min(1),
        universityId: z.string().min(1),
        track: z.enum(['AP', 'IB', 'ALEVEL']).nullable(),
        countValue: z.number().int().nonnegative(),
        sourceLocator: z
          .record(z.string(), z.unknown())
          .refine((value) => Object.keys(value).length > 0),
      }),
    )
    .min(1),
})

interface CatalogRow {
  id: string
  name_cn: string
  name_en: string
  country?: string
}

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
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function readCatalog(path: string): Map<string, CatalogRow> {
  const parsed = Papa.parse<CatalogRow>(readFileSync(path, 'utf8').trim(), {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors.length)
    throw new Error(parsed.errors.map((error) => error.message).join('; '))
  return new Map(parsed.data.map((row) => [row.id, row]))
}

function main() {
  const inputArg = arg('--input')
  const outputArg = arg('--output')
  if (!inputArg || !outputArg) {
    throw new Error(
      'usage: pnpm data:feeder:sql -- --input data/raw/feeder-evidence.json --output .data/runs/<runId>/feeder-import.sql',
    )
  }

  const inputPath = resolve(inputArg)
  const outputPath = resolve(outputArg)
  const input = InputSchema.parse(JSON.parse(readFileSync(inputPath, 'utf8')))
  const schools = readCatalog(resolve('data/raw/schools.csv'))
  const universities = readCatalog(resolve('data/raw/universities.csv'))
  const seen = new Set<string>()
  const statements = ['\\set ON_ERROR_STOP on', 'BEGIN;', 'SET LOCAL ROLE ivy_map_owner;']

  for (const record of input.records) {
    const school = schools.get(record.schoolId)
    const university = universities.get(record.universityId)
    if (!school) throw new Error(`unknown school: ${record.schoolId}`)
    if (!university) throw new Error(`unknown university: ${record.universityId}`)

    const logicalKey = canonicalJson({
      destinationUniversityId: record.universityId,
      originSchoolId: record.schoolId,
      academicYearStart: input.scope.academicYearStart,
      admissionRound: input.scope.admissionRound,
      track: record.track,
      studentScope: input.scope.studentScope,
      sourceId: input.sourceArtifact.sourceId,
    })
    if (seen.has(logicalKey)) throw new Error(`duplicate feeder observation: ${logicalKey}`)
    seen.add(logicalKey)
    const observationHash = createHash('sha256').update(logicalKey).digest('hex')

    statements.push(
      `INSERT INTO institutions (id, kind, name_en, name_local, country_code, status) VALUES (${sql(school.id)}, 'high_school', ${sql(school.name_en || school.name_cn)}, ${sql(school.name_cn)}, 'CN', 'active') ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, name_en = EXCLUDED.name_en, name_local = EXCLUDED.name_local, country_code = EXCLUDED.country_code, updated_at = now();`,
      `INSERT INTO institutions (id, kind, name_en, name_local, country_code, status) VALUES (${sql(university.id)}, 'university', ${sql(university.name_en)}, ${sql(university.name_cn)}, ${sql(university.country)}, 'active') ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, name_en = EXCLUDED.name_en, name_local = EXCLUDED.name_local, country_code = EXCLUDED.country_code, updated_at = now();`,
      `INSERT INTO feeder_admission_observations (destination_university_id, origin_school_id, geography_id, granularity, academic_year_start, admission_round, track, count_kind, count_value, count_min, count_max, student_scope, is_complete, confidence, source_artifact_id, source_locator, review_status, observation_hash) VALUES (${sql(record.universityId)}, ${sql(record.schoolId)}, NULL, 'school', ${sql(input.scope.academicYearStart)}, ${sql(input.scope.admissionRound)}, ${sql(record.track)}, ${sql(input.scope.countKind)}, ${sql(record.countValue)}, NULL, NULL, ${sql(input.scope.studentScope)}, ${sql(input.scope.isComplete)}, ${sql(input.scope.confidence)}, (SELECT id FROM source_artifacts WHERE source_id = ${sql(input.sourceArtifact.sourceId)} AND sha256 = ${sql(input.sourceArtifact.sha256)}), ${sql(canonicalJson(record.sourceLocator))}::jsonb, 'reviewed', ${sql(observationHash)}) ON CONFLICT (observation_hash) DO UPDATE SET count_kind = EXCLUDED.count_kind, count_value = EXCLUDED.count_value, count_min = EXCLUDED.count_min, count_max = EXCLUDED.count_max, source_artifact_id = EXCLUDED.source_artifact_id, source_locator = EXCLUDED.source_locator, confidence = EXCLUDED.confidence, review_status = EXCLUDED.review_status;`,
    )
  }

  statements.push('COMMIT;', '')
  writeFileSync(outputPath, statements.join('\n'))
  console.log(`${outputPath} (${input.records.length} feeder observations)`)
}

main()
