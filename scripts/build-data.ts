// CSV → 校验 → data/ivy-map.json
//
// 这是数据质量的唯一防线（docs/design.md §1.4）。它取代了关系数据库的
// 外键约束，而且能查外键查不了的东西 —— 比如「首屏默认组合会不会发生
// 排名反转」，那才是决定产品有没有说服力的东西。
//
//   pnpm data:build

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'
import { z } from 'zod'
import {
  TRACKS,
  BASES,
  CONFIDENCES,
  SCHOOL_TYPES,
  ADMISSION_RATE_BASES,
  ADMISSION_COUNT_KINDS,
  ADMISSION_RATE_AVAILABILITY,
  type Dataset,
  type Track,
  type Admission,
  type AdmissionCountScope,
  type AdmissionCountSeries,
  type AdmissionRateScope,
  type AdmissionRateSeries,
  type Cohort,
  type FeederEvidence,
  type Source,
} from '../types/index.js'
import {
  CURATED_TRAITS,
  type ProfileDataset,
  type UniversityProfile,
} from '../types/profile.js'
import { scoreFeeders, computeLeverage, hasRankReversal } from '../lib/scoring.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RAW = resolve(ROOT, 'data/raw')
const OUT = resolve(ROOT, 'data/ivy-map.json')
const PROFILE_OUT = resolve(ROOT, 'data/university-profiles.json')

// --- 报告 -------------------------------------------------------------------

const errors: string[] = []
const warnings: string[] = []
const fail = (m: string) => errors.push(m)
const warn = (m: string) => warnings.push(m)

// --- CSV 读取 ---------------------------------------------------------------

function readCsv(name: string): Record<string, string>[] {
  const path = resolve(RAW, name)
  if (!existsSync(path)) {
    fail(`缺少数据文件：data/raw/${name}`)
    return []
  }
  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(
    readFileSync(path, 'utf8').trim(),
    { header: true, skipEmptyLines: true },
  )
  for (const e of parseErrors) fail(`${name} 第 ${e.row} 行解析失败：${e.message}`)
  return data
}

function readJson(name: string): unknown {
  const path = resolve(RAW, name)
  if (!existsSync(path)) {
    fail(`缺少数据文件：data/raw/${name}`)
    return null
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`${name} JSON 解析失败：${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

const str = (v: string | undefined) => {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}
const num = (v: string | undefined) => {
  const s = str(v)
  if (s == null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
const bool = (v: string | undefined) => {
  const s = str(v)?.toLowerCase()
  if (s == null) return null
  return s === 'yes' || s === 'true' || s === '1'
}
const list = (v: string | undefined, sep = '|') =>
  (str(v) ?? '')
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean)

// --- Schema -----------------------------------------------------------------

const TrackEnum = z.enum(TRACKS)
const OfficialAdmissionsInputSchema = z.object({
  schemaVersion: z.literal(1),
  records: z.array(
    z.object({
      universityId: z.string().min(1),
      academicYearStart: z.number().int().min(1900).max(2100),
      applied: z.number().int().nonnegative(),
      admitted: z.number().int().nonnegative(),
      enrolled: z.number().int().nonnegative(),
      dimensions: z.object({
        term: z.literal('fall'),
        campus: z.string().min(1).optional(),
        cohort: z.literal('first_time_first_year'),
        population: z.literal('degree_seeking'),
      }),
      confidence: z.enum(CONFIDENCES),
      sourceId: z.string().min(1),
      sourceTitle: z.string().min(1),
      sourceUrl: z.url(),
      capturedAt: z.iso.date(),
    }),
  ),
})
const AdmissionRateInputSchema = z.object({
  schemaVersion: z.literal(1),
  records: z.array(
    z
      .object({
        universityId: z.string().min(1),
        academicYearStart: z.number().int().min(1900).max(2100).nullable(),
        periodStart: z.iso.date().nullable(),
        periodEnd: z.iso.date().nullable(),
        ratePercent: z.number().min(0).max(100).nullable(),
        rateMinPercent: z.number().min(0).max(100).nullable(),
        rateMaxPercent: z.number().min(0).max(100).nullable(),
        applied: z.number().int().nonnegative().nullable(),
        outcome: z.number().int().nonnegative().nullable(),
        dimensions: z
          .object({
            rate_basis: z.enum(ADMISSION_RATE_BASES),
            applicant_scope: z.string().min(1).optional(),
            admissions_system: z.string().min(1).optional(),
            pathway: z.string().min(1).optional(),
            source_metric: z.string().min(1).optional(),
            period_kind: z.string().min(1).optional(),
            geography_definition: z.string().min(1).optional(),
            aggregation: z.string().min(1).optional(),
          })
          .passthrough(),
        confidence: z.enum(CONFIDENCES),
        sourceId: z.string().min(1),
        sourceTitle: z.string().min(1),
        sourceUrl: z.url().nullable(),
        capturedAt: z.iso.date(),
        citation: z.string().min(1).nullable(),
      })
      .superRefine((record, ctx) => {
        const exact = record.ratePercent != null
        const bounded = record.rateMinPercent != null || record.rateMaxPercent != null
        if (exact === bounded) {
          ctx.addIssue({
            code: 'custom',
            message: '录取率必须是精确值，或至少包含一个上下界，且不能同时存在',
          })
        }
        if (
          record.rateMinPercent != null &&
          record.rateMaxPercent != null &&
          record.rateMinPercent > record.rateMaxPercent
        ) {
          ctx.addIssue({ code: 'custom', message: '录取率区间下限不能高于上限' })
        }
        if (exact && (record.applied == null) !== (record.outcome == null)) {
          ctx.addIssue({ code: 'custom', message: '申请数与结果数必须同时存在或同时为空' })
        }
      }),
  ),
})
const AdmissionCountInputSchema = z.object({
  schemaVersion: z.literal(1),
  records: z.array(
    z
      .object({
        universityId: z.string().min(1),
        academicYearStart: z.number().int().min(1900).max(2100),
        kind: z.enum(ADMISSION_COUNT_KINDS),
        value: z.number().int().nonnegative().nullable(),
        valueMin: z.number().int().nonnegative().nullable(),
        valueMax: z.number().int().nonnegative().nullable(),
        valueText: z.string().min(1).nullable(),
        dimensions: z.object({
          applicant_scope: z.string().min(1),
          pathway: z.string().min(1).nullable(),
          admissions_system: z.string().min(1).nullable(),
          source_metric: z.string().min(1),
          rate_availability: z.enum(ADMISSION_RATE_AVAILABILITY),
        }),
        confidence: z.enum(CONFIDENCES),
        reviewStatus: z.enum(['extracted', 'reviewed', 'published']),
        sourceId: z.string().min(1),
        sourceTitle: z.string().min(1),
        sourceUrl: z.url().nullable(),
        capturedAt: z.iso.date(),
        citation: z.string().min(1).nullable(),
      })
      .superRefine((record, ctx) => {
        const exact = record.value != null
        const range = record.valueMin != null && record.valueMax != null
        const text = record.valueText != null
        if (Number(exact) + Number(range) + Number(text) !== 1) {
          ctx.addIssue({
            code: 'custom',
            message: '招生人数必须是精确/约数单值、完整范围或文本边界三者之一',
          })
        }
        if (range && record.valueMin! > record.valueMax!) {
          ctx.addIssue({ code: 'custom', message: '招生人数区间下限不能高于上限' })
        }
        if (record.kind === 'actual' && record.reviewStatus === 'extracted') {
          ctx.addIssue({ code: 'custom', message: '未复核记录必须标为 estimated 或 planned' })
        }
      }),
  ),
})
const FeederEvidenceInputSchema = z.object({
  schemaVersion: z.literal(1),
  reviewedAt: z.iso.datetime(),
  sourceArtifact: z.object({
    sourceId: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  scope: z.object({
    academicYearStart: z.number().int().min(1900).max(2100),
    admissionRound: z.enum(['early_combined', 'combined', 'unknown']),
    countKind: z.enum(BASES),
    studentScope: z.string().min(1),
    isComplete: z.boolean(),
    confidence: z.enum(CONFIDENCES),
  }),
  records: z
    .array(
      z.object({
        schoolId: z.string().min(1),
        universityId: z.string().min(1),
        track: z.enum(TRACKS).nullable(),
        countValue: z.number().int().nonnegative(),
        sourceLocator: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1),
})
const trackOf = (v: string | undefined, ctx: string): Track | null => {
  const p = TrackEnum.safeParse(str(v))
  if (!p.success) {
    fail(`${ctx}：赛道必须是 ${TRACKS.join(' / ')} 之一，收到 "${v ?? ''}"`)
    return null
  }
  return p.data
}

// --- 载入 -------------------------------------------------------------------

const cities = readCsv('cities.csv').map((r) => ({
  id: r.id,
  name: r.name,
  province: r.province,
  lng: num(r.lng) ?? 0,
  lat: num(r.lat) ?? 0,
}))

const rawUniversities = readCsv('universities.csv').map((r) => ({
  id: r.id,
  nameCn: r.name_cn,
  nameEn: r.name_en,
  country: r.country,
  city: r.city,
  lng: num(r.lng) ?? 0,
  lat: num(r.lat) ?? 0,
}))

const officialAdmissionsParsed = OfficialAdmissionsInputSchema.safeParse(
  readJson('official-university-admissions.json'),
)
if (!officialAdmissionsParsed.success) {
  for (const issue of officialAdmissionsParsed.error.issues) {
    fail(`official-university-admissions.json ${issue.path.join('.')}：${issue.message}`)
  }
}
const officialAdmissionRecords = officialAdmissionsParsed.success
  ? officialAdmissionsParsed.data.records
  : []

const admissionRatesParsed = AdmissionRateInputSchema.safeParse(
  readJson('admission-rate-trends.json'),
)
if (!admissionRatesParsed.success) {
  for (const issue of admissionRatesParsed.error.issues) {
    fail(`admission-rate-trends.json ${issue.path.join('.')}：${issue.message}`)
  }
}
const admissionRateRecords = admissionRatesParsed.success
  ? admissionRatesParsed.data.records
  : []

const admissionCountsParsed = AdmissionCountInputSchema.safeParse(
  readJson('admission-count-trends.json'),
)
if (!admissionCountsParsed.success) {
  for (const issue of admissionCountsParsed.error.issues) {
    fail(`admission-count-trends.json ${issue.path.join('.')}：${issue.message}`)
  }
}
const admissionCountRecords = admissionCountsParsed.success
  ? admissionCountsParsed.data.records
  : []

const feederEvidenceParsed = FeederEvidenceInputSchema.safeParse(
  readJson('feeder-evidence.json'),
)
if (!feederEvidenceParsed.success) {
  for (const issue of feederEvidenceParsed.error.issues) {
    fail(`feeder-evidence.json ${issue.path.join('.')}：${issue.message}`)
  }
}

const requirementRows = readCsv('requirements.csv')
const requirementBySchool = new Map(requirementRows.map((r) => [r.school_id, r]))

const NationalityEnum = z.enum(['none', 'foreign', 'hk_mo_tw', 'foreign_or_pr', 'unknown'])
const HukouEnum = z.enum(['none', 'local_city', 'local_district', 'unknown'])

const schools = readCsv('schools.csv').map((r) => {
  const req = requirementBySchool.get(r.id)
  const typeParsed = z.enum(SCHOOL_TYPES).safeParse(str(r.type))
  if (!typeParsed.success) fail(`学校 ${r.id}：性质必须是 ${SCHOOL_TYPES.join(' / ')} 之一`)

  const tracks = list(r.tracks)
    .map((t) => trackOf(t, `学校 ${r.id}`))
    .filter((t): t is Track => t != null)
  if (tracks.length === 0) fail(`学校 ${r.id}：至少要有一个赛道`)

  if (!cities.some((c) => c.id === r.city_id)) {
    fail(`学校 ${r.id}：城市 "${r.city_id}" 不在 cities.csv 里`)
  }

  // 门槛数据缺失是警告不是错误 —— 但它是差异化所在，必须每天被看见
  if (!req) warn(`学校 ${r.id}（${r.name_cn}）：门槛数据未录入`)

  const nat = NationalityEnum.safeParse(str(req?.nationality) ?? 'unknown')
  const huk = HukouEnum.safeParse(str(req?.hukou) ?? 'unknown')
  if (req && !nat.success) fail(`学校 ${r.id}：国籍要求取值非法 "${req.nationality}"`)
  if (req && !huk.success) fail(`学校 ${r.id}：户籍要求取值非法 "${req.hukou}"`)

  return {
    id: r.id,
    nameCn: r.name_cn,
    nameEn: str(r.name_en),
    cityId: r.city_id,
    district: str(r.district),
    type: typeParsed.success ? typeParsed.data : 'private_intl',
    tracks,
    tuitionCny: num(r.tuition_cny),
    boarding: bool(r.boarding),
    verified: bool(r.verified) ?? false,
    requirement: {
      nationality: nat.success ? nat.data : ('unknown' as const),
      hukou: huk.success ? huk.data : ('unknown' as const),
      entryGrades:
        req && str(req.entry_grades)
          ? list(req.entry_grades).map(Number).filter(Number.isFinite)
          : null,
      examTypes: req ? list(req.exam_types) : [],
      applicationWindow: req ? str(req.application_window) : null,
      sourceId: req ? str(req.source_id) : null,
      notes: req ? str(req.notes) : null,
    },
  }
})

const placementSources = readCsv('sources.csv').map((r) => ({
  id: r.id,
  type: (str(r.type) ?? 'official') as 'official' | 'media' | 'report' | 'crowdsourced',
  title: r.title,
  url: r.url,
  publishedAt: str(r.published_at),
  capturedAt: str(r.captured_at) ?? '',
  confidence: (str(r.confidence) ?? 'L3') as (typeof CONFIDENCES)[number],
}))
const officialSourceById = new Map<string, Source>()
for (const record of officialAdmissionRecords) {
  const existing = officialSourceById.get(record.sourceId)
  if (
    existing &&
    (existing.title !== record.sourceTitle || existing.url !== record.sourceUrl)
  ) {
    fail(`官方来源 ${record.sourceId} 在发布数据中出现不一致的标题或 URL`)
    continue
  }
  officialSourceById.set(record.sourceId, {
    id: record.sourceId,
    type: 'official',
    title: record.sourceTitle,
    url: record.sourceUrl,
    publishedAt: null,
    capturedAt: record.capturedAt,
    confidence: record.confidence,
  })
}
for (const record of admissionRateRecords) {
  const existing = officialSourceById.get(record.sourceId)
  if (existing) {
    if (existing.url != null && record.sourceUrl != null && existing.url !== record.sourceUrl) {
      fail(`录取率来源 ${record.sourceId} 与官方招生快照的 URL 不一致`)
    }
    continue
  }
  officialSourceById.set(record.sourceId, {
    id: record.sourceId,
    type: record.sourceUrl == null ? 'report' : 'official',
    title: record.sourceTitle,
    url: record.sourceUrl,
    publishedAt: null,
    capturedAt: record.capturedAt,
    confidence: record.confidence,
  })
}
for (const record of admissionCountRecords) {
  const existing = officialSourceById.get(record.sourceId)
  if (existing) {
    if (existing.url != null && record.sourceUrl != null && existing.url !== record.sourceUrl) {
      fail(`招生人数来源 ${record.sourceId} 与现有招生来源的 URL 不一致`)
    }
    continue
  }
  officialSourceById.set(record.sourceId, {
    id: record.sourceId,
    type: record.sourceUrl == null ? 'report' : 'official',
    title: record.sourceTitle,
    url: record.sourceUrl,
    publishedAt: null,
    capturedAt: record.capturedAt,
    confidence: record.confidence,
  })
}
const placementSourceIds = new Set(placementSources.map((source) => source.id))
for (const sourceId of officialSourceById.keys()) {
  if (placementSourceIds.has(sourceId)) fail(`来源 ID 重复：${sourceId}`)
}
const sources = [...placementSources, ...officialSourceById.values()]
const sourceIds = new Set(sources.map((s) => s.id))
const schoolIds = new Set(schools.map((s) => s.id))
const universityIds = new Set(rawUniversities.map((u) => u.id))

const feederEvidence: FeederEvidence[] = []
const feederEvidenceKeys = new Set<string>()
if (feederEvidenceParsed.success) {
  const { scope, sourceArtifact } = feederEvidenceParsed.data
  if (!sourceIds.has(sourceArtifact.sourceId)) {
    fail(`生源去向证据引用了不存在的来源：${sourceArtifact.sourceId}`)
  }
  for (const [index, record] of feederEvidenceParsed.data.records.entries()) {
    const where = `feeder-evidence.json records.${index}`
    if (!schoolIds.has(record.schoolId)) {
      fail(`${where}：学校 "${record.schoolId}" 不存在`)
      continue
    }
    if (!universityIds.has(record.universityId)) {
      fail(`${where}：大学 "${record.universityId}" 不存在`)
      continue
    }
    if (Object.keys(record.sourceLocator).length === 0) {
      fail(`${where}：缺少来源定位信息`)
      continue
    }
    const key = [
      record.schoolId,
      record.universityId,
      scope.academicYearStart,
      scope.admissionRound,
      record.track ?? '',
      sourceArtifact.sourceId,
    ].join('|')
    if (feederEvidenceKeys.has(key)) {
      fail(`${where}：重复的生源去向证据 ${key}`)
      continue
    }
    feederEvidenceKeys.add(key)
    feederEvidence.push({
      schoolId: record.schoolId,
      universityId: record.universityId,
      academicYearStart: scope.academicYearStart,
      admissionRound: scope.admissionRound,
      track: record.track,
      countKind: scope.countKind,
      countValue: record.countValue,
      studentScope: scope.studentScope,
      isComplete: scope.isComplete,
      confidence: scope.confidence,
      sourceId: sourceArtifact.sourceId,
    })
  }
}

const officialAdmissionsByUniversity = new Map<
  string,
  Array<{
    academicYearStart: number
    applied: number
    admitted: number
    enrolled: number
    campus: string | null
    confidence: (typeof CONFIDENCES)[number]
    sourceId: string
  }>
>()
const officialAdmissionKeys = new Set<string>()
for (const record of officialAdmissionRecords) {
  if (!universityIds.has(record.universityId)) {
    fail(`官方招生数据引用了不存在的大学：${record.universityId}`)
    continue
  }
  if (record.admitted > record.applied) {
    fail(`大学 ${record.universityId}：录取数不能高于申请数`)
  }
  if (record.enrolled > record.admitted) {
    fail(`大学 ${record.universityId}：入学数不能高于录取数`)
  }
  const campus = record.dimensions.campus ?? null
  const key = `${record.universityId}|${record.academicYearStart}|${campus ?? ''}`
  if (officialAdmissionKeys.has(key)) {
    fail(`官方招生数据重复：${key}`)
    continue
  }
  officialAdmissionKeys.add(key)
  const snapshots = officialAdmissionsByUniversity.get(record.universityId) ?? []
  snapshots.push({
    academicYearStart: record.academicYearStart,
    applied: record.applied,
    admitted: record.admitted,
    enrolled: record.enrolled,
    campus,
    confidence: record.confidence,
    sourceId: record.sourceId,
  })
  officialAdmissionsByUniversity.set(record.universityId, snapshots)
}

const admissionRateSeriesByUniversity = new Map<string, AdmissionRateSeries[]>()
const admissionRateSeriesByKey = new Map<string, AdmissionRateSeries>()
const admissionRatePointKeys = new Set<string>()

for (const record of admissionRateRecords) {
  if (!universityIds.has(record.universityId)) {
    fail(`录取率趋势引用了不存在的大学：${record.universityId}`)
    continue
  }
  if (!sourceIds.has(record.sourceId)) {
    fail(`录取率趋势引用了不存在的来源：${record.sourceId}`)
    continue
  }
  if (record.applied != null && record.outcome != null && record.outcome > record.applied) {
    fail(`大学 ${record.universityId}：录取/Offer/入读结果数不能高于申请数`)
  }

  const scope: AdmissionRateScope = {
    rateBasis: record.dimensions.rate_basis,
    applicantScope: record.dimensions.applicant_scope ?? null,
    admissionsSystem: record.dimensions.admissions_system ?? null,
    pathway: record.dimensions.pathway ?? null,
    sourceMetric: record.dimensions.source_metric ?? null,
    periodKind: record.dimensions.period_kind ?? null,
    geographyDefinition: record.dimensions.geography_definition ?? null,
    aggregation: record.dimensions.aggregation ?? null,
  }
  const scopeKey = JSON.stringify(scope)
  const seriesKey = `${record.universityId}|${scopeKey}`
  let series = admissionRateSeriesByKey.get(seriesKey)
  if (!series) {
    series = {
      id: `${record.universityId}:${Buffer.from(scopeKey).toString('base64url')}`,
      primary: false,
      scope,
      points: [],
    }
    admissionRateSeriesByKey.set(seriesKey, series)
    admissionRateSeriesByUniversity.set(record.universityId, [
      ...(admissionRateSeriesByUniversity.get(record.universityId) ?? []),
      series,
    ])
  }

  const pointKey = `${seriesKey}|${record.academicYearStart ?? ''}|${record.periodStart ?? ''}|${record.periodEnd ?? ''}`
  if (admissionRatePointKeys.has(pointKey)) {
    fail(`录取率趋势重复：${pointKey}`)
    continue
  }
  admissionRatePointKeys.add(pointKey)
  series.points.push({
    academicYearStart: record.academicYearStart,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    rate: record.ratePercent == null ? null : record.ratePercent / 100,
    rateMin: record.rateMinPercent == null ? null : record.rateMinPercent / 100,
    rateMax: record.rateMaxPercent == null ? null : record.rateMaxPercent / 100,
    applied: record.applied,
    outcome: record.outcome,
    confidence: record.confidence,
    sourceId: record.sourceId,
    citation: record.citation,
  })
}

function admissionRateSeriesRank(series: AdmissionRateSeries): number {
  const scope = series.scope.applicantScope
  const audienceRank =
    scope == null || scope === 'all'
      ? 0
      : scope === 'international' || scope === 'international_program'
        ? 10
        : scope === 'china_domicile' || scope === 'china_nationality'
          ? 20
          : 30
  const basisRank = ADMISSION_RATE_BASES.indexOf(series.scope.rateBasis)
  return audienceRank + basisRank
}

for (const seriesList of admissionRateSeriesByUniversity.values()) {
  for (const series of seriesList) {
    series.points.sort((left, right) => {
      const leftKey = left.academicYearStart ?? Number(left.periodStart?.slice(0, 4) ?? 0)
      const rightKey = right.academicYearStart ?? Number(right.periodStart?.slice(0, 4) ?? 0)
      return leftKey - rightKey
    })
  }
  seriesList.sort(
    (left, right) => admissionRateSeriesRank(left) - admissionRateSeriesRank(right),
  )
  if (seriesList[0]) seriesList[0].primary = true
}

const admissionCountSeriesByUniversity = new Map<string, AdmissionCountSeries[]>()
const admissionCountSeriesByKey = new Map<string, AdmissionCountSeries>()
const admissionCountPointKeys = new Set<string>()

for (const record of admissionCountRecords) {
  if (!universityIds.has(record.universityId)) {
    fail(`招生人数趋势引用了不存在的大学：${record.universityId}`)
    continue
  }
  if (!sourceIds.has(record.sourceId)) {
    fail(`招生人数趋势引用了不存在的来源：${record.sourceId}`)
    continue
  }

  const scope: AdmissionCountScope = {
    applicantScope: record.dimensions.applicant_scope,
    pathway: record.dimensions.pathway,
    admissionsSystem: record.dimensions.admissions_system,
    sourceMetric: record.dimensions.source_metric,
    rateAvailability: record.dimensions.rate_availability,
  }
  const scopeKey = JSON.stringify(scope)
  const seriesKey = `${record.universityId}|${scopeKey}`
  let series = admissionCountSeriesByKey.get(seriesKey)
  if (!series) {
    series = {
      id: `${record.universityId}:${Buffer.from(scopeKey).toString('base64url')}`,
      scope,
      points: [],
    }
    admissionCountSeriesByKey.set(seriesKey, series)
    admissionCountSeriesByUniversity.set(record.universityId, [
      ...(admissionCountSeriesByUniversity.get(record.universityId) ?? []),
      series,
    ])
  }

  const pointKey = `${seriesKey}|${record.academicYearStart}|${record.kind}`
  if (admissionCountPointKeys.has(pointKey)) {
    fail(`招生人数趋势重复：${pointKey}`)
    continue
  }
  admissionCountPointKeys.add(pointKey)
  series.points.push({
    academicYearStart: record.academicYearStart,
    kind: record.kind,
    value: record.value,
    valueMin: record.valueMin,
    valueMax: record.valueMax,
    valueText: record.valueText,
    confidence: record.confidence,
    reviewStatus: record.reviewStatus,
    sourceId: record.sourceId,
    citation: record.citation,
  })
}

const countKindOrder = new Map(ADMISSION_COUNT_KINDS.map((kind, index) => [kind, index]))
for (const seriesList of admissionCountSeriesByUniversity.values()) {
  for (const series of seriesList) {
    series.points.sort(
      (left, right) =>
        left.academicYearStart - right.academicYearStart ||
        (countKindOrder.get(left.kind) ?? 0) - (countKindOrder.get(right.kind) ?? 0),
    )
  }
}

const cohorts: Cohort[] = readCsv('cohorts.csv').flatMap((r, i) => {
  const track = trackOf(r.track, `cohorts.csv 第 ${i + 2} 行`)
  if (!track) return []
  if (!schoolIds.has(r.school_id)) {
    fail(`cohorts.csv 第 ${i + 2} 行：学校 "${r.school_id}" 不存在`)
    return []
  }
  if (!sourceIds.has(r.source_id)) {
    fail(`cohorts.csv 第 ${i + 2} 行：来源 "${r.source_id}" 不存在 —— 无来源的数据不得入库`)
    return []
  }
  return [
    {
      schoolId: r.school_id,
      year: num(r.year) ?? 0,
      track,
      graduates: num(r.graduates), // null 就是 null，绝不猜
      totalOffers: num(r.total_offers),
      sourceId: r.source_id,
    },
  ]
})

const admissions: Admission[] = readCsv('admissions.csv').flatMap((r, i) => {
  const where = `admissions.csv 第 ${i + 2} 行`
  const track = trackOf(r.track, where)
  if (!track) return []
  if (!schoolIds.has(r.school_id)) {
    fail(`${where}：学校 "${r.school_id}" 不存在`)
    return []
  }
  if (!universityIds.has(r.university_id)) {
    fail(`${where}：大学 "${r.university_id}" 不存在`)
    return []
  }
  if (!sourceIds.has(r.source_id)) {
    fail(`${where}：来源 "${r.source_id}" 不存在 —— 无来源的数据不得入库`)
    return []
  }

  const basisParsed = z.enum(BASES).safeParse(str(r.basis))
  if (!basisParsed.success) {
    fail(`${where}：口径必须是 ${BASES.join(' / ')} 之一。看不出是哪种口径的数据，宁可不录`)
    return []
  }
  const confParsed = z.enum(CONFIDENCES).safeParse(str(r.confidence))
  if (!confParsed.success) {
    fail(`${where}：置信等级必须是 L1 / L2 / L3`)
    return []
  }

  const admits = num(r.admits)
  const offers = num(r.offers)
  if (admits == null && offers == null) {
    fail(`${where}：录取人数和 offer 数不能都为空`)
    return []
  }

  // 折算过的记录必须降一级置信（metrics.md §3）
  let confidence = confParsed.data
  if (basisParsed.data === 'estimated' && confidence !== 'L3') {
    confidence = confidence === 'L1' ? 'L2' : 'L3'
    warn(`${where}：估算记录的置信已自动下调为 ${confidence}`)
  }

  return [
    {
      schoolId: r.school_id,
      universityId: r.university_id,
      year: num(r.year) ?? 0,
      track,
      admits,
      offers,
      basis: basisParsed.data,
      confidence,
      sourceId: r.source_id,
    },
  ]
})

// --- 多来源冲突检测 ---------------------------------------------------------

const byKey = new Map<string, Admission[]>()
for (const a of admissions) {
  const k = `${a.schoolId}|${a.universityId}|${a.year}|${a.track}`
  byKey.set(k, [...(byKey.get(k) ?? []), a])
}
for (const [k, group] of byKey) {
  if (group.length < 2) continue
  const values = [...new Set(group.map((g) => g.admits ?? g.offers))]
  if (values.length > 1) {
    warn(`多来源不一致：${k} → ${values.join(' vs ')}（UI 必须明示，不得替用户选一个）`)
    for (const g of group) {
      g.conflict = {
        otherSourceIds: group.filter((x) => x !== g).map((x) => x.sourceId),
        values: values.filter((v): v is number => v != null),
      }
    }
  }
}

// --- 派生指标：择校杠杆率 ---------------------------------------------------

const universities = rawUniversities.map((u) => {
  const rows = scoreFeeders({
    admissions: admissions.filter((a) => a.universityId === u.id),
    cohorts,
    alpha: 1,
  })
  const officialAdmissions = (officialAdmissionsByUniversity.get(u.id) ?? []).sort(
    (left, right) => right.academicYearStart - left.academicYearStart,
  )
  const admissionRateSeries = admissionRateSeriesByUniversity.get(u.id) ?? []
  const admissionCountSeries = admissionCountSeriesByUniversity.get(u.id) ?? []
  return {
    ...u,
    cai: null,
    leverage: computeLeverage(rows),
    officialAdmissions,
    admissionRateSeries,
    admissionCountSeries,
  }
})

// --- 首屏默认组合（PRD US-1.0）---------------------------------------------
// 线上没有解说员，滑杆的价值全靠首屏那一次自动演示。默认组合必须能反转，
// 否则产品最强的一点访客根本看不到 —— 而这是数据一变就会悄悄失效的东西。

function pickDefaultView(): Dataset['defaultView'] {
  const candidates: {
    universityId: string
    cityId: string | null
    track: Track
    n: number
  }[] = []
  // cityId 允许为 null = 全国视图。
  // 原来只遍历「城市 × 赛道」，漏掉了全国 —— 而真实数据里唯一的真反转
  // （剑桥 × 全国 × A-Level：光华剑桥规模第一、深国交密度第一，两所都有
  // 分母）恰好就出现在全国视图上，被这个漏洞挡在门外。
  const cityScopes: (string | null)[] = [null, ...cities.map((c) => c.id)]
  for (const u of universities) {
    for (const cid of cityScopes) {
      for (const t of TRACKS) {
        const schoolsIn = new Set(
          schools
            .filter((s) => (cid === null || s.cityId === cid) && s.tracks.includes(t))
            .map((s) => s.id),
        )
        const subset = admissions.filter(
          (a) => a.universityId === u.id && a.track === t && schoolsIn.has(a.schoolId),
        )
        if (new Set(subset.map((a) => a.schoolId)).size < 2) continue
        if (!hasRankReversal({ admissions: subset, cohorts })) continue
        candidates.push({ universityId: u.id, cityId: cid, track: t, n: subset.length })
      }
    }
  }
  if (candidates.length === 0) return null
  // 样本最多的最有说服力；同样多时优先具体城市（对家长更贴身）
  candidates.sort((a, b) => b.n - a.n || (a.cityId === null ? 1 : -1))
  const { universityId, cityId, track } = candidates[0]
  return { universityId, cityId, track }
}

const defaultView = pickDefaultView()

// --- 质量检查（data-sources.md §7）------------------------------------------

const withDenominator = cohorts.filter((c) => c.graduates != null).length
const denomCoverage = cohorts.length === 0 ? 0 : withDenominator / cohorts.length

if (admissions.length === 0) {
  warn('录取数据为空 —— 主线数据尚未录入。这是当前的头号阻塞项')
} else {
  if (denomCoverage < 0.8) {
    warn(
      `分母覆盖率 ${(denomCoverage * 100).toFixed(0)}%（目标 ≥ 80%）—— 分母不够，滑杆演示会失效`,
    )
  }
  if (!defaultView) {
    warn('找不到能演示排名反转的默认组合 —— US-1.0 首屏自解释会失去核心说服力')
  }
  if (!universities.some((u) => u.leverage?.level === 'low')) {
    warn('没有任何大学被判定为「择校杠杆低」—— 「别折腾」的叙事缺少实例')
  }
  const unsourced = admissions.filter((a) => !sourceIds.has(a.sourceId)).length
  if (unsourced > 0) fail(`有 ${unsourced} 条录取记录没有有效来源`)
}

for (const universityId of ['oxford', 'cambridge']) {
  if (!universityIds.has(universityId)) fail(`强制保留大学缺失：${universityId}`)
  if (!admissions.some((admission) => admission.universityId === universityId)) {
    fail(`强制保留的 ${universityId} 生源校录取数据为空`)
  }
}
for (const universityId of [
  'harvard',
  'cmu',
  'caltech',
  'uchicago',
  'northwestern',
  'cornell',
  'uw',
]) {
  if (!officialAdmissionsByUniversity.has(universityId)) {
    fail(`已复核官方招生数据缺失：${universityId}`)
  }
}

const unverified = schools.filter((s) => !s.verified).length
if (unverified > 0)
  warn(`${unverified} / ${schools.length} 所学校的身份信息尚未人工核对（verified=no）`)

const noRequirement = schools.filter((s) => !requirementBySchool.has(s.id)).length
if (noRequirement > 0) {
  warn(
    `${noRequirement} / ${schools.length} 所学校缺门槛数据 —— 这是可行性闸门的前提，也是唯一能在本周期建立的护城河`,
  )
}

// --- v2 大学画像 ------------------------------------------------------------
// 独立产物 data/university-profiles.json，不并进 Dataset。
// 门禁比事实层松一档（编辑档位允许无来源），但**声称是 measured 就必须给来源**。
// 五档画像必须保持分布，否则指纹只会变成装饰。

const ProfileTraitSchema = z
  .object({
    level: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
      .nullable(),
    basis: z.string().min(1),
    kind: z.enum(['measured', 'editorial']),
    sourceIds: z.array(z.string().min(1)),
  })
  .strict()

const ProfileInputSchema = z
  .object({
    schemaVersion: z.literal(2),
    _note: z.array(z.string()).optional(),
    profiles: z.array(
      z
        .object({
          universityId: z.string().min(1),
          websiteUrl: z.url().nullable(),
          logoPath: z.string().min(1).nullable(),
          brandColor: z
            .string()
            .regex(/^#[0-9A-Fa-f]{6}$/, '校色必须是 #RRGGBB 形式')
            .nullable(),
          monogram: z.string().min(1).max(4),
          foundedYear: z.number().int().min(1000).max(2100).nullable(),
          strengths: z.array(z.string().min(1)),
          vibe: z.string().min(1).nullable(),
          traits: z.object(
            Object.fromEntries(
              CURATED_TRAITS.map((trait) => [trait, ProfileTraitSchema]),
            ) as Record<(typeof CURATED_TRAITS)[number], typeof ProfileTraitSchema>,
          ),
          reviewed: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict()

const profileParsed = ProfileInputSchema.safeParse(readJson('university-profiles.json'))
if (!profileParsed.success) {
  for (const issue of profileParsed.error.issues) {
    fail(`[v2 profiles] university-profiles.json ${issue.path.join('.')}：${issue.message}`)
  }
}

const profiles: UniversityProfile[] = profileParsed.success ? profileParsed.data.profiles : []
const profileIds = new Set<string>()
for (const p of profiles) {
  if (!universityIds.has(p.universityId)) {
    fail(`[v2 profiles] 画像引用了不存在的大学：${p.universityId}`)
  }
  if (profileIds.has(p.universityId)) {
    fail(`[v2 profiles] 画像重复：${p.universityId}`)
  }
  profileIds.add(p.universityId)

  for (const trait of CURATED_TRAITS) {
    const rating = p.traits[trait]
    // 声称是实测就必须能查 —— 这条不留活口
    if (rating.kind === 'measured' && rating.sourceIds.length === 0) {
      fail(`[v2 profiles] ${p.universityId}.${trait}：kind=measured 但没有来源`)
    }
    for (const id of rating.sourceIds) {
      if (!sourceIds.has(id)) {
        fail(`[v2 profiles] ${p.universityId}.${trait}：来源 "${id}" 不存在`)
      }
    }
    if (rating.level == null && rating.kind === 'measured') {
      warn(`[v2 profiles] ${p.universityId}.${trait}：measured 但无档位，指纹会断轴`)
    }
  }
}

// 指纹存在的理由是区分学校。某条编辑轴如果挤在三档以内，或半数以上落在同一档，
// 就不该上线假装提供了信息。
for (const trait of CURATED_TRAITS) {
  const levels = profiles
    .map((profile) => profile.traits[trait].level)
    .filter((level): level is NonNullable<typeof level> => level != null)
  const counts = new Map<number, number>()
  for (const level of levels) counts.set(level, (counts.get(level) ?? 0) + 1)
  const largestBand = Math.max(0, ...counts.values())
  if (counts.size < 4) {
    fail(`[v2 profiles] ${trait} 只覆盖 ${counts.size} 个档位，区分度不足`)
  }
  if (largestBand > profiles.length / 2) {
    fail(`[v2 profiles] ${trait} 有 ${largestBand}/${profiles.length} 所学校挤在同一档`)
  }
}

const missingProfiles = [...universityIds].filter((id) => !profileIds.has(id))
if (missingProfiles.length > 0) {
  warn(
    `[v2 profiles] ${missingProfiles.length} 所大学没有画像，刷卡时会被跳过：${missingProfiles.join('、')}`,
  )
}
const unreviewed = profiles.filter((p) => !p.reviewed).length
if (unreviewed > 0) {
  warn(`[v2 profiles] ${unreviewed} / ${profiles.length} 份画像未人工复核（详情页已明示）`)
}

// --- 输出 -------------------------------------------------------------------

const dataset: Dataset = {
  builtAt: new Date().toISOString(),
  cities,
  universities,
  schools,
  cohorts,
  admissions,
  feederEvidence,
  sources,
  defaultView,
}

console.log('\n' + '='.repeat(64))
console.log('IVY Map 数据构建')
console.log('='.repeat(64))
console.log(`城市 ${cities.length} · 大学 ${universities.length} · 高中 ${schools.length}`)
console.log(
  `排名录取 ${admissions.length} · 非排名去向证据 ${feederEvidence.length} · 届次 ${cohorts.length} · 来源 ${sources.length}`,
)
console.log(`官方招生快照 ${officialAdmissionRecords.length}`)
console.log(
  `官方录取率 ${admissionRateRecords.length} 个点 · ${admissionRateSeriesByKey.size} 个独立口径`,
)
console.log(
  `招生人数趋势 ${admissionCountRecords.length} 个点 · ${admissionCountSeriesByKey.size} 个独立口径`,
)
console.log(`v2 大学画像 ${profiles.length}/${universityIds.size}`)
console.log(
  `门槛数据 ${schools.length - noRequirement}/${schools.length} · 分母覆盖 ${(denomCoverage * 100).toFixed(0)}%`,
)
console.log(
  `首屏默认组合：${defaultView ? `${defaultView.universityId} × ${defaultView.cityId} × ${defaultView.track}` : '（无 —— 数据不足）'}`,
)

if (warnings.length) {
  console.log('\n⚠  警告 ' + warnings.length)
  for (const w of warnings) console.log('   · ' + w)
}
if (errors.length) {
  console.log('\n✗  错误 ' + errors.length + '（构建失败）')
  for (const e of errors) console.log('   · ' + e)
  console.log()
  process.exit(1)
}

writeFileSync(OUT, JSON.stringify(dataset, null, 2))
const kb = (Buffer.byteLength(JSON.stringify(dataset)) / 1024).toFixed(1)
console.log(`\n✓  已写入 data/ivy-map.json（${kb} KB）`)

// builtAt 沿用 dataset 的，两份产物必须是同一时刻的快照
const profileDataset: ProfileDataset = { builtAt: dataset.builtAt, profiles }
writeFileSync(PROFILE_OUT, JSON.stringify(profileDataset, null, 2))
const profileKb = (Buffer.byteLength(JSON.stringify(profileDataset)) / 1024).toFixed(1)
console.log(
  `✓  已写入 data/university-profiles.json（${profileKb} KB · ${profiles.length} 份画像）\n`,
)
