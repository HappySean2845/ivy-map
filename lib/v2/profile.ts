// v2 画像的读取与派生。
//
// 这一层的职责是把两个事实源拼成一张卡片能用的形状：
//   - data/university-profiles.json  策展字段（校色、风格、三个软维度的编辑评分）
//   - data/ivy-map.json 的 officialAdmissions  官方申请/录取数
//
// 录取难度**不在策展文件里**，在这里现算。抄一份进策展文件就是第二个事实源，
// 官方数据一更新两边立刻不一致。

import { universityById, dataset } from '@/lib/data'
import raw from '@/data/university-profiles.json'
import {
  CURATED_DIMS,
  PROFILE_DIMS,
  type ProfileDataset,
  type ProfileDim,
  type ProfileScore,
  type UniversityProfile,
} from '@/types/profile'
import type { AdmissionRatePoint, AdmissionRateSeries, University } from '@/types'
import {
  admissionCountRateNote,
  latestReviewedAdmissionCountPoint,
  primaryAdmissionCountSeries,
} from '@/lib/v2/admission-counts'
import {
  admissionRateOutcomeLabel,
  admissionRatePeriodLabel,
  admissionRatePointValue,
  admissionRateSeriesLabel,
  formatAdmissionRate,
  primaryAdmissionRateSeries,
} from '@/lib/v2/admission-rates'

const profileData = raw as unknown as ProfileDataset

export const profileById = new Map(profileData.profiles.map((p) => [p.universityId, p]))

export const COUNTRY_LABEL: Record<string, string> = {
  US: '美国',
  UK: '英国',
  HK: '中国香港',
  CA: '加拿大',
  JP: '日本',
}

export function countryLabel(code: string): string {
  return COUNTRY_LABEL[code] ?? code
}

// ---------------------------------------------------------------------------
// 录取率

/**
 * 录取率趋势，按学年升序。
 *
 * 目前每所大学只有一个学年的官方快照，所以这个数组长度通常是 1 ——
 * 卡片必须能优雅处理「只有一个点」的情况（显示数字，不画一条没有斜率的线）。
 */
export function admitRateTrend(university: University): AdmissionRatePoint[] {
  const primary = primaryAdmissionRateSeries(university.admissionRateSeries)
  if (primary) return primary.points

  return university.officialAdmissions
    .filter((s) => s.applied > 0)
    .map((s) => ({
      academicYearStart: s.academicYearStart,
      periodStart: null,
      periodEnd: null,
      applied: s.applied,
      outcome: s.admitted,
      rate: s.admitted / s.applied,
      rateMin: null,
      rateMax: null,
      confidence: s.confidence,
      sourceId: s.sourceId,
      citation: null,
    }))
    .sort((a, b) => a.academicYearStart - b.academicYearStart)
}

/** 学年显示形式：2025 → 2025–26 */
export function schoolYearLabel(start: number): string {
  return `${start}–${String(start + 1).slice(-2)}`
}

/**
 * 录取难度分。
 *
 * `(1 - 录取率) × 100`，**零任意参数**：3.6% 的录取率算出 96 分，
 * 而 96 这个数字一句话就能解释清楚 ——「96.4% 的申请者被拒」。
 *
 * 用对数或分段映射能把藤校之间的差距拉开、图看着更好看，但每个折点都是我们拍的，
 * 拍出来的曲线没办法向家长解释。这个产品宁可要一条能解释的直线。
 */
export function selectivityScore(university: University): ProfileScore {
  const trend = admitRateTrend(university)
  const latest = trend.at(-1)
  if (!latest) {
    const countSeries = primaryAdmissionCountSeries(university.admissionCountSeries)
    const latestCount = latestReviewedAdmissionCountPoint(countSeries)
    if (countSeries) {
      return {
        value: null,
        basis: `${admissionCountRateNote(countSeries)}招生人数不进入录取难度评分。`,
        kind: 'measured',
        sourceIds: latestCount ? [latestCount.sourceId] : [],
      }
    }
    return {
      value: null,
      basis: '尚未收录该校经复核的官方申请与录取人数，不用估算值补空',
      kind: 'measured',
      sourceIds: [],
    }
  }
  const primary = primaryAdmissionRateSeries(university.admissionRateSeries)
  const rateLabel = primary ? admissionRateSeriesLabel(primary) : '官方录取率'
  const period = admissionRatePeriodLabel(latest)
  const counts =
    latest.applied != null && latest.outcome != null
      ? `（${latest.applied.toLocaleString('en-US')} 人申请 / ${latest.outcome.toLocaleString('en-US')} 人${primary ? admissionRateOutcomeLabel(primary) : '录取'}）`
      : ''
  return {
    value: Math.round((1 - admissionRatePointValue(latest)) * 100),
    basis: `${period} ${rateLabel} ${formatAdmissionRate(latest)}${counts}`,
    kind: 'measured',
    sourceIds: [latest.sourceId],
  }
}

// ---------------------------------------------------------------------------
// 组合视图

export interface UniversityView {
  university: University
  profile: UniversityProfile
  scores: Record<ProfileDim, ProfileScore>
  trend: AdmissionRatePoint[]
  rateSeries: AdmissionRateSeries[]
  primaryRateSeries: AdmissionRateSeries | null
  countSeries: University['admissionCountSeries']
  primaryCountSeries: University['admissionCountSeries'][number] | null
}

/** 四个维度的完整分：三个来自策展文件，录取难度现算。 */
export function resolveScores(
  university: University,
  profile: UniversityProfile,
): Record<ProfileDim, ProfileScore> {
  const out = {} as Record<ProfileDim, ProfileScore>
  out.selectivity = selectivityScore(university)
  for (const dim of CURATED_DIMS) out[dim] = profile.scores[dim]
  return out
}

export function viewOf(universityId: string): UniversityView | null {
  const university = universityById.get(universityId)
  const profile = profileById.get(universityId)
  if (!university || !profile) return null
  const rateSeries = university.admissionRateSeries
  const countSeries = university.admissionCountSeries
  return {
    university,
    profile,
    scores: resolveScores(university, profile),
    trend: admitRateTrend(university),
    rateSeries,
    primaryRateSeries: primaryAdmissionRateSeries(rateSeries),
    countSeries,
    primaryCountSeries: primaryAdmissionCountSeries(countSeries),
  }
}

/**
 * 确定性打散的刷卡顺序。
 *
 * 不能用 Math.random —— 服务端和客户端会算出两个不同的顺序，hydration 直接炸。
 * 也不用 CSV 原顺序：那是按国家分组的，美国 22 所连着刷完才见到第一所英国学校。
 * FNV-1a 拿 id 算个稳定的键排序，每次刷都是同一套顺序，但国家和难度是混着的。
 */
function shuffleKey(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 有画像的大学，按打散顺序。没画像的直接不进卡组 —— 空卡比没有更糟。 */
export function deckOrder(): UniversityView[] {
  return dataset.universities
    .filter((u) => profileById.has(u.id))
    .map((u) => viewOf(u.id))
    .filter((v): v is UniversityView => v != null)
    .sort((a, b) => shuffleKey(a.university.id) - shuffleKey(b.university.id))
}

/** 每根轴的 measured / editorial / 缺数据 计数，详情页要把这个讲出来。 */
export function scoreProvenance(scores: Record<ProfileDim, ProfileScore>) {
  let measured = 0
  let editorial = 0
  let missing = 0
  for (const dim of PROFILE_DIMS) {
    const s = scores[dim]
    if (s.value == null) missing++
    else if (s.kind === 'measured') measured++
    else editorial++
  }
  return { measured, editorial, missing }
}

// ---------------------------------------------------------------------------
// 生源校覆盖

export interface FeederCoverage {
  /** 有赛道、能进密度排名的高中数 */
  rankedSchools: number
  /** 只有去向证据（未拆分赛道）的高中数 */
  evidenceSchools: number
}

/**
 * 这所大学在本站有多少国内生源校数据。
 *
 * 「选高中」那条路必须先把这个数说出来 —— 目前 56 条排名录取只覆盖牛津和剑桥，
 * 选了哈佛再跳到榜单，看到的是一张空表。**让人点完才发现是空的，是最糟的做法**：
 * 他会以为是产品坏了，而不是数据还没到。
 */
export function feederCoverage(universityId: string): FeederCoverage {
  const ranked = new Set<string>()
  for (const a of dataset.admissions) {
    if (a.universityId === universityId) ranked.add(a.schoolId)
  }
  const evidence = new Set<string>()
  for (const e of dataset.feederEvidence) {
    if (e.universityId === universityId && !ranked.has(e.schoolId)) evidence.add(e.schoolId)
  }
  return { rankedSchools: ranked.size, evidenceSchools: evidence.size }
}

/** 有生源校数据的大学，「选高中」页把它们排在前面当快捷入口。 */
export function universitiesWithFeeders(): UniversityView[] {
  return deckOrder()
    .map((view) => ({ view, cov: feederCoverage(view.university.id) }))
    .filter(({ cov }) => cov.rankedSchools > 0 || cov.evidenceSchools > 0)
    .sort(
      (a, b) =>
        b.cov.rankedSchools - a.cov.rankedSchools ||
        b.cov.evidenceSchools - a.cov.evidenceSchools,
    )
    .map(({ view }) => view)
}
