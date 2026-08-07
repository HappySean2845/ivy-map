import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Papa from 'papaparse'

import {
  REQUIREMENT_KEYS,
  type DestinationDenominator,
  type DestinationOutcomeKind,
  type DestinationShareObservation,
  type DestinationValueStatus,
  type QuarantinedDestinationRow,
  type RequirementBasis,
  type RequirementKey,
  type RequirementValue,
  type UniversityEnrichmentDataset,
  type UniversityRequirementProfile,
} from '../../types/university-enrichment.js'

type CsvRow = Record<string, string>

interface CatalogUniversity {
  id: string
  name_cn: string
  name_en: string
  country: string
}

interface CatalogSchool {
  id: string
  nameCn: string
  nameEn: string | null
  region: string
}

interface CourseAttributionCatalog {
  schools: CatalogSchool[]
}

const ROOT = resolve(import.meta.dirname, '../..')
const DEFAULT_INPUT = resolve(ROOT, '.data/university-enrichment')
const DEFAULT_OUTPUT = resolve(ROOT, 'data/university-enrichment.json')

const UNIVERSITY_SLUG_ALIASES: Record<string, string> = {
  penn: 'upenn',
  tokyo: 'utokyo',
  uwashington: 'uw',
}

const SCHOOL_ALIASES: Record<string, string> = {
  '上中国际部 SHSID': 'shsid',
  七宝德怀特: 'qibaodwight',
  '世外（上海市世界外国语中学）': 'wfls',
  '人大附ICC（人大附中中外合作办学项目）': 'rdfz',
  光华剑桥: 'guanghua',
  北师大实验国际部: 'bnusz',
  十一学校国际部: 'bjshiyi',
  北京鼎石学校: 'keystone',
  '协和古北（上海协和双语学校古北校区）': 'concordia',
  四中国际校区: 'bhsf',
  包玉刚实验学校: 'ykpao',
  '平和（上海市民办平和学校）': 'pinghe',
  星河湾双语学校: 'xinghewan',
}

const REQUIREMENT_SOURCE_LABEL: Record<string, RequirementKey> = {
  托福: 'toefl',
  雅思: 'ielts',
  SAT: 'sat',
  ACT: 'act',
  AP: 'ap',
  'A-Level': 'alevel',
  IB: 'ib',
}

const REQUIREMENT_METRIC: Record<RequirementKey, string> = {
  toefl: 'undergrad.requirement.toefl',
  ielts: 'undergrad.requirement.ielts',
  sat: 'undergrad.requirement.sat',
  act: 'undergrad.requirement.act',
  ap: 'undergrad.requirement.ap',
  alevel: 'undergrad.requirement.alevel',
  ib: 'undergrad.requirement.ib',
}

const REQUIREMENT_METRIC_LABEL: Record<RequirementKey, string> = {
  toefl: 'Undergraduate TOEFL requirement or guidance',
  ielts: 'Undergraduate IELTS requirement or guidance',
  sat: 'Undergraduate SAT requirement or reference range',
  act: 'Undergraduate ACT requirement or reference range',
  ap: 'Undergraduate AP requirement or guidance',
  alevel: 'Undergraduate A-Level requirement or guidance',
  ib: 'Undergraduate IB requirement or guidance',
}

const SCOPE_CODE: Record<string, string> = {
  大陆: 'mainland_china',
  大陆高中: 'mainland_high_schools',
  含海外高中: 'chinese_students_including_overseas_high_schools',
  大陆及港澳: 'mainland_hong_kong_macao',
  大陆高考: 'mainland_gaokao',
  国内: 'domestic_china',
}

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name)
  return index >= 0 ? resolve(process.argv[index + 1] ?? fallback) : fallback
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function stableHash(value: unknown): string {
  return sha256(canonicalJson(value))
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
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

function readCsv(path: string): CsvRow[] {
  const parsed = Papa.parse<CsvRow>(readFileSync(path, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors.length > 0) {
    throw new Error(`${path}: ${parsed.errors.map((error) => error.message).join('; ')}`)
  }
  return parsed.data
}

function readUniversities(): CatalogUniversity[] {
  return readCsv(resolve(ROOT, 'data/raw/universities.csv')) as unknown as CatalogUniversity[]
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/international|school|college|academy|high|division/gi, '')
    .replace(/国际课程中心|中外合作办学项目|外籍人员子女学校|国际高中|国际学校|国际部|实验学校|双语学校|教育学园/g, '')
    .replace(/[\s·・（）()\-_—,/]+/g, '')
}

function universityId(slug: string, catalogIds: Set<string>): string | null {
  const id = UNIVERSITY_SLUG_ALIASES[slug] ?? slug
  return catalogIds.has(id) ? id : null
}

function schoolMatcher(schools: CatalogSchool[]) {
  const byId = new Map(schools.map((school) => [school.id, school]))
  const exact = new Map(schools.map((school) => [school.nameCn, school]))
  const normalized = new Map<string, CatalogSchool[]>()
  for (const school of schools) {
    const key = normalizeName(school.nameCn)
    normalized.set(key, [...(normalized.get(key) ?? []), school])
  }

  return (label: string): CatalogSchool | null => {
    const aliasId = SCHOOL_ALIASES[label]
    if (aliasId) return byId.get(aliasId) ?? null
    const exactMatch = exact.get(label)
    if (exactMatch) return exactMatch
    const candidates = normalized.get(normalizeName(label)) ?? []
    return candidates.length === 1 ? candidates[0] : null
  }
}

function requirementBasis(text: string, key: RequirementKey, country: string): RequirementBasis {
  if (/^(?:—|null)\b|不适用|未公布|无统一/.test(text)) return 'unavailable'
  if (/mid[- ]?50|中段\s*50|录取生.*区间/i.test(text)) return 'mid50'
  if (/typical|典型|standard offers?|offer range/i.test(text)) return 'typical_offer'
  const hasCompetitive = /competitive|recommended|preferred|建议|期望|竞争/i.test(text)
  const hasMinimum = /minimum|最低|至少|≥|起步|hard requirement/i.test(text)
  if (hasCompetitive && hasMinimum) return 'mixed'
  if (hasCompetitive) {
    return 'competitive'
  }
  if (hasMinimum) return 'minimum'
  if (country === 'US' && ['sat', 'act'].includes(key) && /^\d{2,4}\s*[-–]\s*\d{2,4}$/.test(text)) {
    return 'mid50'
  }
  if (/按专业|随专业|两档|五档|路径|组合|range|区间/i.test(text)) return 'mixed'
  return 'mixed'
}

function lineValue(block: string, expression: RegExp): string | null {
  return block.match(expression)?.[1]?.trim() ?? null
}

function parseRating(block: string, label: '安全性' | '中国友好度') {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = block.match(
    new RegExp(`^\\s*- ${escaped} \\*\\*(\\d+|None)/100\\*\\*(?:（([^）]+)）)?：(.+)$`, 'm'),
  )
  if (!match || match[1] === 'None') return null
  const value = Number(match[1])
  if (!Number.isFinite(value) || value < 0 || value > 100) return null
  return { value, band: match[2]?.trim() ?? null, text: match[3].trim() }
}

function parseRequirementProfiles(markdown: string, universities: CatalogUniversity[]) {
  const catalog = new Map(universities.map((university) => [university.id, university]))
  const heading = /^###\s+.+?\s+\(`([^`]+)`\)\s*$/gm
  const matches = [...markdown.matchAll(heading)]
  const profiles: UniversityRequirementProfile[] = []

  for (const [index, match] of matches.entries()) {
    const rawSlug = match[1]
    const id = UNIVERSITY_SLUG_ALIASES[rawSlug] ?? rawSlug
    const university = catalog.get(id)
    if (!university) throw new Error(`requirements: unknown university slug ${rawSlug}`)
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? markdown.length
    const block = markdown.slice(start, end)
    const location = lineValue(block, /^\s*- \*\*地区\*\*：(.+)$/m)
    const styleBlurbZh = lineValue(block, /^\s*- \*\*优化简介（风格简述）\*\*：(.+)$/m)
    const notes = lineValue(block, /^\s*- 备注：(.+)$/m) ?? ''
    const sourceLine = lineValue(block, /^\s*- 来源：(.+)$/m) ?? ''
    if (!location || !styleBlurbZh) throw new Error(`requirements: incomplete profile ${id}`)

    const requirements = {} as Record<RequirementKey, RequirementValue>
    for (const [sourceLabel, key] of Object.entries(REQUIREMENT_SOURCE_LABEL)) {
      const text = lineValue(
        block,
        new RegExp(`^\\s+- ${sourceLabel.replace('-', '\\-')}：(.+)$`, 'm'),
      )
      if (!text) throw new Error(`requirements: missing ${sourceLabel} for ${id}`)
      requirements[key] = { text, basis: requirementBasis(text, key, university.country) }
    }

    const cost = location.match(/生活成本\s+(Med-High|Med-Low|High|Med|Low)/i)?.[1] ?? null
    const locationWithoutCost = location.replace(/\s*·?\s*生活成本\s+.+$/i, '').trim()
    const locationParts = locationWithoutCost.split(/\s+·\s+/).map((part) => part.trim())
    const sourceUrls = sourceLine.match(/https?:\/\/[^；;\s]+/g) ?? []

    profiles.push({
      universityId: id,
      setting: locationParts[0],
      climate: locationParts.slice(1).join(' · ') || null,
      livingCost: cost as UniversityRequirementProfile['livingCost'],
      requirements,
      safety: parseRating(block, '安全性'),
      chinaFriendliness: parseRating(block, '中国友好度'),
      styleBlurbZh,
      sourceUrls,
      notes,
    })
  }

  if (profiles.length !== 32 || new Set(profiles.map((profile) => profile.universityId)).size !== 32) {
    throw new Error(`requirements: expected 32 unique profiles, received ${profiles.length}`)
  }
  return profiles.sort((left, right) => left.universityId.localeCompare(right.universityId))
}

function outcomeKind(metric: string): DestinationOutcomeKind {
  if (metric === 'offer') return 'offers'
  if (metric === 'admitted') return 'admits'
  return 'unknown'
}

function valueStatus(value: string, note: string): DestinationValueStatus {
  if (!value.trim()) return 'missing'
  return /估算|推算|计划|拟招|≈|约\s*\d|近\s*\d|沿用/i.test(note)
    ? 'estimated'
    : 'reported'
}

function parseInteger(value: string): number | null {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : null
}

function denominatorId(row: CsvRow, id: string): string {
  return `denom:${id}:${row.year}:${outcomeKind(row.metric)}:${SCOPE_CODE[row.scope] ?? 'unknown'}`
}

function parseDenominators(rows: CsvRow[], universityIds: Set<string>) {
  return rows.map((row, index): DestinationDenominator => {
    const id = universityId(row.university_slug, universityIds)
    if (!id) throw new Error(`denominators row ${index + 2}: unknown ${row.university_slug}`)
    const year = Number(row.year)
    if (!Number.isInteger(year) || year < 2023 || year > 2026) {
      throw new Error(`denominators row ${index + 2}: invalid year ${row.year}`)
    }
    const value = parseInteger(row.mainland_total)
    if (row.mainland_total && value == null) {
      throw new Error(`denominators row ${index + 2}: invalid value ${row.mainland_total}`)
    }
    return {
      id: denominatorId(row, id),
      universityId: id,
      year,
      value,
      outcomeKind: outcomeKind(row.metric),
      valueStatus: valueStatus(row.mainland_total, row.note),
      scopeCode: row.scope ? (SCOPE_CODE[row.scope] ?? `other:${normalizeName(row.scope)}`) : null,
      scopeLabel: row.scope || null,
      source: row.source,
      note: row.note,
    }
  })
}

function parseDestinationRows({
  filename,
  rows,
  universityIds,
  matchSchool,
  denominators,
}: {
  filename: QuarantinedDestinationRow['file']
  rows: CsvRow[]
  universityIds: Set<string>
  matchSchool: (label: string) => CatalogSchool | null
  denominators: DestinationDenominator[]
}) {
  const shares: DestinationShareObservation[] = []
  const quarantined: QuarantinedDestinationRow[] = []
  const denominatorByUniversityYear = new Map(
    denominators.map((denominator) => [
      `${denominator.universityId}:${denominator.year}`,
      denominator,
    ]),
  )

  for (const [index, row] of rows.entries()) {
    const quarantine = (reason: QuarantinedDestinationRow['reason']) => {
      quarantined.push({
        file: filename,
        row: index + 2,
        highSchool: row.high_school,
        universitySlug: row.university_slug,
        year: row.year,
        reason,
      })
    }
    if (row.high_school === '版本与口径声明') {
      quarantine('synthetic_school_heading')
      continue
    }
    const year = Number(row.year)
    if (!Number.isInteger(year) || year < 2023 || year > 2026) {
      quarantine('out_of_scope_year')
      continue
    }
    const id = universityId(row.university_slug, universityIds)
    if (!id) {
      quarantine('unknown_university')
      continue
    }
    const school = matchSchool(row.high_school)
    if (!school) {
      quarantine('unknown_school')
      continue
    }
    const numerator = parseInteger(row.hs_admitted)
    if (numerator == null) {
      quarantine('invalid_value')
      continue
    }

    const denominator = denominatorByUniversityYear.get(`${id}:${year}`) ?? null
    const rowDenominator = parseInteger(row.mainland_total)
    if (denominator?.value != null && rowDenominator !== denominator.value) {
      throw new Error(
        `${filename} row ${index + 2}: denominator mismatch ${rowDenominator}/${denominator.value}`,
      )
    }
    const rowOutcome = outcomeKind(row.metric)
    if (denominator && rowOutcome !== denominator.outcomeKind) {
      throw new Error(`${filename} row ${index + 2}: outcome mismatch`)
    }
    const share = denominator?.value ? numerator / denominator.value : null
    if (row.density && share != null && Math.abs(Number(row.density) - share) > 0.00011) {
      throw new Error(`${filename} row ${index + 2}: density formula mismatch`)
    }
    if (share != null && share > 1) {
      throw new Error(`${filename} row ${index + 2}: numerator exceeds denominator`)
    }

    shares.push({
      schoolId: school.id,
      schoolName: school.nameCn,
      universityId: id,
      year,
      numerator,
      outcomeKind: rowOutcome,
      denominatorId: denominator?.value != null ? denominator.id : null,
      denominator: denominator?.value ?? null,
      denominatorStatus: denominator?.valueStatus ?? 'missing',
      denominatorScopeCode: denominator?.scopeCode ?? null,
      denominatorScopeLabel: denominator?.scopeLabel ?? null,
      share,
      numeratorSource: row.numerator_source,
      denominatorSource: row.denominator_source,
      denominatorNote: row.denominator_note,
    })
  }

  return { shares, quarantined }
}

function validateUniqueShares(shares: DestinationShareObservation[]) {
  const keys = new Set<string>()
  for (const share of shares) {
    const key = `${share.schoolId}:${share.universityId}:${share.year}`
    if (keys.has(key)) throw new Error(`duplicate destination share: ${key}`)
    keys.add(key)
  }
}

function artifactSelect(sourceId: string, sha: string) {
  return `(SELECT id FROM source_artifacts WHERE source_id = ${sql(sourceId)} AND sha256 = ${sql(sha)})`
}

function buildSql(
  data: UniversityEnrichmentDataset,
  schools: CatalogSchool[],
  inputs: Record<'requirements' | 'density2026' | 'denominators' | 'densityHistory', string>,
) {
  const sourceId = 'university-enrichment-2026'
  const runId = `university-enrichment-${data.sources.requirementsSha256.slice(0, 16)}`
  const statements = ['\\set ON_ERROR_STOP on', 'BEGIN;', 'SET LOCAL ROLE ivy_map_owner;']
  statements.push(
    `INSERT INTO institutions (id, kind, name_en, name_local, country_code, status) VALUES ('ivy-map-research', 'system', 'IVY Map Research', 'IVY Map 数据研究', 'CN', 'active') ON CONFLICT (id) DO UPDATE SET updated_at = now();`,
    `INSERT INTO sources (id, institution_id, source_type, dataset_kind, title, canonical_url, confidence, access_status, first_seen_at, last_checked_at) VALUES (${sql(sourceId)}, 'ivy-map-research', 'report', 'admission_requirements', 'IV Map 32校录取要求与画像增强及生源密度', 'urn:ivy-map:curated:university-enrichment:2026', 'L2', 'captured', now(), now()) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, dataset_kind = EXCLUDED.dataset_kind, last_checked_at = now();`,
    `INSERT INTO crawl_runs (run_id, tool_version, seed_file, started_at, finished_at, status, seed_count, fetched_source_count, failed_source_count, artifact_count, discovered_link_count, manifest_sha256, imported_at) VALUES (${sql(runId)}, 'university-enrichment-cleaner/1', 'requirements.md + density CSVs', now(), now(), 'completed', 4, 4, 0, 4, 0, ${sql(stableHash(data.sources))}, now()) ON CONFLICT (run_id) DO UPDATE SET imported_at = now();`,
  )

  const artifacts = [
    ['requirements.md', data.sources.requirementsSha256, inputs.requirements, 'text/markdown'],
    ['density-2026.csv', data.sources.density2026Sha256, inputs.density2026, 'text/csv'],
    ['denominators.csv', data.sources.denominatorsSha256, inputs.denominators, 'text/csv'],
    ['density-history.csv', data.sources.densityHistorySha256, inputs.densityHistory, 'text/csv'],
  ] as const
  for (const [name, sha, content, mime] of artifacts) {
    statements.push(
      `INSERT INTO source_artifacts (source_id, first_seen_run_id, last_seen_run_id, artifact_kind, requested_url, final_url, sha256, mime_type, byte_size, local_path, captured_at) VALUES (${sql(sourceId)}, ${sql(runId)}, ${sql(runId)}, 'document', ${sql(`urn:ivy-map:attachment:${name}`)}, NULL, ${sql(sha)}, ${sql(mime)}, ${Buffer.byteLength(content)}, ${sql(`.data/university-enrichment/${name}`)}, now()) ON CONFLICT (source_id, sha256) DO UPDATE SET last_seen_run_id = EXCLUDED.last_seen_run_id;`,
    )
  }

  const requirementArtifact = artifactSelect(sourceId, data.sources.requirementsSha256)
  for (const [alias, institutionId] of Object.entries(UNIVERSITY_SLUG_ALIASES)) {
    statements.push(
      `INSERT INTO institution_aliases (institution_id, alias, alias_norm, alias_kind, review_status, source_artifact_id) VALUES (${sql(institutionId)}, ${sql(alias)}, ${sql(normalizeName(alias))}, 'slug', 'reviewed', ${requirementArtifact}) ON CONFLICT (institution_id, alias_norm) DO NOTHING;`,
    )
  }
  const requirementDimensions = canonicalJson({
    required: ['credential', 'basis'],
    optional: ['applicant_scope', 'programme_scope', 'effective_cycle'],
  })
  for (const key of REQUIREMENT_KEYS) {
    statements.push(
      `INSERT INTO metric_definitions (code, dataset_kind, section, label, value_type, unit, dimension_schema) VALUES (${sql(REQUIREMENT_METRIC[key])}, 'admission_requirements', 'undergraduate', ${sql(REQUIREMENT_METRIC_LABEL[key])}, 'text', NULL, ${sql(requirementDimensions)}::jsonb) ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, dimension_schema = EXCLUDED.dimension_schema;`,
    )
  }
  statements.push(
    `INSERT INTO metric_definitions (code, dataset_kind, section, label, value_type, unit, dimension_schema) VALUES ('profile.editorial.safety', 'editorial_research', 'living_environment', 'Editorial safety assessment', 'number', 'score_0_100', '{}'::jsonb), ('profile.editorial.china_friendliness', 'editorial_research', 'living_environment', 'Editorial China-friendliness assessment', 'number', 'score_0_100', '{}'::jsonb) ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, unit = EXCLUDED.unit;`,
  )

  for (const profile of data.requirements) {
    for (const key of REQUIREMENT_KEYS) {
      const value = profile.requirements[key]
      const dimensions = canonicalJson({ credential: key, basis: value.basis })
      const observationHash = stableHash({
        institutionId: profile.universityId,
        metricCode: REQUIREMENT_METRIC[key],
        dimensions,
      })
      statements.push(
        `INSERT INTO observations (institution_id, metric_code, value_text, dimensions, source_artifact_id, source_locator, confidence, review_status, observation_hash) VALUES (${sql(profile.universityId)}, ${sql(REQUIREMENT_METRIC[key])}, ${sql(value.text)}, ${sql(dimensions)}::jsonb, ${requirementArtifact}, ${sql(canonicalJson({ universityId: profile.universityId, field: key }))}::jsonb, 'L2', 'extracted', ${sql(observationHash)}) ON CONFLICT (observation_hash) DO UPDATE SET value_text = EXCLUDED.value_text, dimensions = EXCLUDED.dimensions, source_artifact_id = EXCLUDED.source_artifact_id;`,
      )
    }
    for (const [metricCode, rating] of [
      ['profile.editorial.safety', profile.safety],
      ['profile.editorial.china_friendliness', profile.chinaFriendliness],
    ] as const) {
      if (!rating) continue
      const dimensions = canonicalJson({ band: rating.band, rationale: rating.text })
      const observationHash = stableHash({ profile: profile.universityId, metricCode })
      statements.push(
        `INSERT INTO observations (institution_id, metric_code, value_number, unit, dimensions, source_artifact_id, source_locator, confidence, review_status, observation_hash) VALUES (${sql(profile.universityId)}, ${sql(metricCode)}, ${rating.value}, 'score_0_100', ${sql(dimensions)}::jsonb, ${requirementArtifact}, ${sql(canonicalJson({ universityId: profile.universityId, field: metricCode }))}::jsonb, 'L3', 'extracted', ${sql(observationHash)}) ON CONFLICT (observation_hash) DO UPDATE SET value_number = EXCLUDED.value_number, dimensions = EXCLUDED.dimensions, source_artifact_id = EXCLUDED.source_artifact_id;`,
      )
    }
  }

  const usedSchools = new Set(data.destinationShares.map((share) => share.schoolId))
  for (const school of schools.filter((item) => usedSchools.has(item.id))) {
    statements.push(
      `INSERT INTO institutions (id, kind, name_en, name_local, country_code, status) VALUES (${sql(school.id)}, 'high_school', ${sql(school.nameEn ?? school.nameCn)}, ${sql(school.nameCn)}, 'CN', 'active') ON CONFLICT (id) DO UPDATE SET name_en = EXCLUDED.name_en, name_local = EXCLUDED.name_local, updated_at = now();`,
      `INSERT INTO institution_aliases (institution_id, alias, alias_norm, alias_kind, review_status, source_artifact_id) VALUES (${sql(school.id)}, ${sql(school.nameCn)}, ${sql(normalizeName(school.nameCn))}, 'name', 'reviewed', ${requirementArtifact}) ON CONFLICT (institution_id, alias_norm) DO NOTHING;`,
    )
  }

  const denominatorHashes = new Map<string, string>()
  const denominatorArtifact = artifactSelect(sourceId, data.sources.denominatorsSha256)
  for (const denominator of data.denominators.filter((item) => item.value != null)) {
    const observationHash = stableHash({ denominator: denominator.id })
    denominatorHashes.set(denominator.id, observationHash)
    statements.push(
      `INSERT INTO feeder_admission_observations (destination_university_id, origin_school_id, geography_id, granularity, academic_year_start, admission_round, track, count_kind, outcome_kind, value_status, population_scope_code, count_value, count_min, count_max, student_scope, is_complete, confidence, source_artifact_id, source_locator, review_status, observation_hash) VALUES (${sql(denominator.universityId)}, NULL, NULL, 'university_total', ${denominator.year}, 'combined', NULL, ${sql(denominator.outcomeKind)}, ${sql(denominator.outcomeKind)}, ${sql(denominator.valueStatus)}, ${sql(denominator.scopeCode)}, ${denominator.value}, NULL, NULL, ${sql(denominator.scopeLabel ?? 'unknown')}, true, ${sql(denominator.valueStatus === 'estimated' ? 'L3' : 'L2')}, ${denominatorArtifact}, ${sql(canonicalJson({ source: denominator.source, note: denominator.note }))}::jsonb, 'extracted', ${sql(observationHash)}) ON CONFLICT (observation_hash) DO UPDATE SET count_value = EXCLUDED.count_value, outcome_kind = EXCLUDED.outcome_kind, value_status = EXCLUDED.value_status, population_scope_code = EXCLUDED.population_scope_code, source_artifact_id = EXCLUDED.source_artifact_id, source_locator = EXCLUDED.source_locator;`,
    )
  }

  const density2026Artifact = artifactSelect(sourceId, data.sources.density2026Sha256)
  const densityHistoryArtifact = artifactSelect(sourceId, data.sources.densityHistorySha256)
  for (const share of data.destinationShares) {
    const observationHash = stableHash({
      school: share.schoolId,
      university: share.universityId,
      year: share.year,
      numerator: share.numerator,
      outcome: share.outcomeKind,
    })
    const denominatorHash = share.denominatorId
      ? (denominatorHashes.get(share.denominatorId) ?? null)
      : null
    const artifact = share.year === 2026 ? density2026Artifact : densityHistoryArtifact
    const countKind = share.outcomeKind === 'unknown' ? 'reported' : share.outcomeKind
    statements.push(
      `INSERT INTO feeder_admission_observations (destination_university_id, origin_school_id, geography_id, granularity, academic_year_start, admission_round, track, count_kind, outcome_kind, value_status, population_scope_code, denominator_observation_id, count_value, count_min, count_max, student_scope, is_complete, confidence, source_artifact_id, source_locator, review_status, observation_hash) VALUES (${sql(share.universityId)}, ${sql(share.schoolId)}, NULL, 'school', ${share.year}, 'combined', NULL, ${sql(countKind)}, ${sql(share.outcomeKind === 'unknown' ? null : share.outcomeKind)}, 'reported', ${sql(share.denominatorScopeCode)}, ${denominatorHash ? `(SELECT id FROM feeder_admission_observations WHERE observation_hash = ${sql(denominatorHash)})` : 'NULL'}, ${share.numerator}, NULL, NULL, ${sql('reported_high_school_outcome')}, false, 'L2', ${artifact}, ${sql(canonicalJson({ numeratorSource: share.numeratorSource, denominatorNote: share.denominatorNote }))}::jsonb, 'extracted', ${sql(observationHash)}) ON CONFLICT (observation_hash) DO UPDATE SET count_value = EXCLUDED.count_value, outcome_kind = EXCLUDED.outcome_kind, value_status = EXCLUDED.value_status, population_scope_code = EXCLUDED.population_scope_code, denominator_observation_id = EXCLUDED.denominator_observation_id, source_artifact_id = EXCLUDED.source_artifact_id, source_locator = EXCLUDED.source_locator;`,
    )
  }

  statements.push('COMMIT;', '')
  return statements.join('\n')
}

function main() {
  const inputDir = arg('--input-dir', DEFAULT_INPUT)
  const outputPath = arg('--output', DEFAULT_OUTPUT)
  const sqlOutputPath = arg('--sql-output', resolve(inputDir, 'import.sql'))
  const paths = {
    requirements: resolve(inputDir, 'requirements.md'),
    density2026: resolve(inputDir, 'density-2026.csv'),
    denominators: resolve(inputDir, 'denominators.csv'),
    densityHistory: resolve(inputDir, 'density-history.csv'),
  }
  const inputs = {
    requirements: readFileSync(paths.requirements, 'utf8'),
    density2026: readFileSync(paths.density2026, 'utf8'),
    denominators: readFileSync(paths.denominators, 'utf8'),
    densityHistory: readFileSync(paths.densityHistory, 'utf8'),
  }
  const universities = readUniversities()
  const universityIds = new Set(universities.map((university) => university.id))
  const courseCatalog = JSON.parse(
    readFileSync(resolve(ROOT, 'data/course-attribution.json'), 'utf8'),
  ) as CourseAttributionCatalog
  const matchSchool = schoolMatcher(courseCatalog.schools)
  const requirements = parseRequirementProfiles(inputs.requirements, universities)
  const denominatorRows = readCsv(paths.denominators)
  const denominators = parseDenominators(denominatorRows, universityIds)
  const current = parseDestinationRows({
    filename: 'density-2026.csv',
    rows: readCsv(paths.density2026),
    universityIds,
    matchSchool,
    denominators,
  })
  const history = parseDestinationRows({
    filename: 'density-history.csv',
    rows: readCsv(paths.densityHistory),
    universityIds,
    matchSchool,
    denominators,
  })
  const destinationShares = [...current.shares, ...history.shares].sort(
    (left, right) =>
      left.universityId.localeCompare(right.universityId) ||
      right.year - left.year ||
      left.schoolName.localeCompare(right.schoolName, 'zh'),
  )
  validateUniqueShares(destinationShares)
  const quarantined = [...current.quarantined, ...history.quarantined]

  const data: UniversityEnrichmentDataset = {
    schemaVersion: 1,
    publishedAt: '2026-08-06',
    sources: {
      requirementsSha256: sha256(inputs.requirements),
      density2026Sha256: sha256(inputs.density2026),
      denominatorsSha256: sha256(inputs.denominators),
      densityHistorySha256: sha256(inputs.densityHistory),
    },
    requirements,
    denominators,
    destinationShares,
    quarantined,
    report: {
      requirementProfiles: requirements.length,
      denominatorRows: denominators.length,
      denominatorRowsWithValues: denominators.filter((item) => item.value != null).length,
      destinationRows: destinationShares.length,
      destinationRowsWithShares: destinationShares.filter((item) => item.share != null).length,
      quarantinedRows: quarantined.length,
      schools: new Set(destinationShares.map((item) => item.schoolId)).size,
      universities: new Set(destinationShares.map((item) => item.universityId)).size,
    },
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`)
  writeFileSync(sqlOutputPath, buildSql(data, courseCatalog.schools, inputs))
  console.log(JSON.stringify(data.report, null, 2))
  console.log(`wrote ${outputPath}`)
  console.log(`wrote ${sqlOutputPath}`)
}

main()
