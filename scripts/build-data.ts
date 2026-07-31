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
  type Dataset,
  type Track,
  type Admission,
  type Cohort,
} from '../types/index.js'
import { scoreFeeders, computeLeverage, hasRankReversal } from '../lib/scoring.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RAW = resolve(ROOT, 'data/raw')
const OUT = resolve(ROOT, 'data/ivy-map.json')

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
const officialSourceById = new Map<
  string,
  {
    id: string
    type: 'official'
    title: string
    url: string
    publishedAt: null
    capturedAt: string
    confidence: (typeof CONFIDENCES)[number]
  }
>()
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
const placementSourceIds = new Set(placementSources.map((source) => source.id))
for (const sourceId of officialSourceById.keys()) {
  if (placementSourceIds.has(sourceId)) fail(`来源 ID 重复：${sourceId}`)
}
const sources = [...placementSources, ...officialSourceById.values()]
const sourceIds = new Set(sources.map((s) => s.id))
const schoolIds = new Set(schools.map((s) => s.id))
const universityIds = new Set(rawUniversities.map((u) => u.id))

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
  return { ...u, cai: null, leverage: computeLeverage(rows), officialAdmissions }
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

// --- 输出 -------------------------------------------------------------------

const dataset: Dataset = {
  builtAt: new Date().toISOString(),
  cities,
  universities,
  schools,
  cohorts,
  admissions,
  sources,
  defaultView,
}

console.log('\n' + '='.repeat(64))
console.log('IVY Map 数据构建')
console.log('='.repeat(64))
console.log(`城市 ${cities.length} · 大学 ${universities.length} · 高中 ${schools.length}`)
console.log(`录取记录 ${admissions.length} · 届次 ${cohorts.length} · 来源 ${sources.length}`)
console.log(`官方招生快照 ${officialAdmissionRecords.length}`)
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
console.log(`\n✓  已写入 data/ivy-map.json（${kb} KB）\n`)
