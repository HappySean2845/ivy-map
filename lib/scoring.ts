// 评分算法。口径定义见 docs/metrics.md —— 本文件是它的实现，改这里之前先改那里。
//
// 纯函数、无 IO、无全局状态。这是产品的智力核心，也是唯一算错了
// 界面还会正常显示、人眼看不出来的地方，所以必须有测试。

import type { Admission, Cohort, Track } from '@/types'

/** 时间权重：近的一届更能代表当下。三届之和为 1。 */
export const YEAR_WEIGHTS = [0.5, 0.3, 0.2] as const

/** offer→人数折算系数的兜底值与裁剪范围（metrics.md §3） */
export const K_FALLBACK = 4.0
export const K_MIN = 1.0
export const K_MAX = 10.0

/** 归一化下界，避免几何平均被单个 0 吞掉（metrics.md §6） */
const NORM_FLOOR = 0.05

export function yearWeight(year: number, latestYear: number): number {
  const offset = latestYear - year
  return YEAR_WEIGHTS[offset] ?? 0
}

/**
 * 把 offer 口径折算成人数。
 * 返回 null 表示无法折算 —— 调用方必须当作「没有数据」，不能当 0。
 */
export function offersToAdmits(
  offers: number,
  totalOffers: number | null,
  graduates: number | null,
): number | null {
  if (!Number.isFinite(offers)) return null
  let k = K_FALLBACK
  if (totalOffers != null && graduates != null && graduates > 0) {
    k = totalOffers / graduates
  }
  k = Math.min(K_MAX, Math.max(K_MIN, k))
  return offers / k
}

/** 取一条录取记录的人数口径值。offers 口径会被折算。 */
export function resolveAdmits(
  a: Admission,
  cohort: Cohort | undefined,
): number | null {
  // 人数口径永远优先
  if (a.admits != null) return a.admits
  if (a.offers != null) {
    return offersToAdmits(
      a.offers,
      cohort?.totalOffers ?? null,
      cohort?.graduates ?? null,
    )
  }
  return null
}

export interface FeederRow {
  schoolId: string
  /** 加权录取人数 */
  volume: number
  /** 人均密度。null = 分母缺失，UI 显示「—」而不是 0 */
  density: number | null
  denominatorMissing: boolean
  /** 综合得分，由 alpha 控制规模与概率的权重 */
  score: number
  /** 按年份拆分，供溯源展开使用 */
  byYear: { year: number; admits: number | null; graduates: number | null }[]
}

export interface ScoreInput {
  /** 已按目标大学过滤过的录取记录 */
  admissions: Admission[]
  cohorts: Cohort[]
  /** 0 = 纯概率（人均密度），1 = 纯规模（绝对人数） */
  alpha: number
  /** 只看这些赛道。不传则全部 */
  tracks?: Track[]
  /** 最近一届的年份。不传则从数据里取最大值 */
  latestYear?: number
}

/**
 * 计算 Feeder 榜单。
 *
 * 归一化在**当前结果集内**做，不是全局 —— 用户筛「上海 + IB」时，排序
 * 应当反映这几所学校之间的相对关系。这也是它不能预计算的原因。
 */
export function scoreFeeders(input: ScoreInput): FeederRow[] {
  const { admissions, cohorts, alpha } = input
  const tracks = input.tracks
  const rows = admissions.filter((a) => !tracks || tracks.includes(a.track))
  if (rows.length === 0) return []

  const latestYear =
    input.latestYear ?? Math.max(...rows.map((a) => a.year))

  const cohortKey = (schoolId: string, year: number, track: Track) =>
    `${schoolId}|${year}|${track}`
  const cohortMap = new Map(
    cohorts.map((c) => [cohortKey(c.schoolId, c.year, c.track), c]),
  )

  // 按学校聚合
  const bySchool = new Map<
    string,
    { volume: number; denom: number; denomKnown: boolean; byYear: FeederRow['byYear'] }
  >()

  for (const a of rows) {
    const w = yearWeight(a.year, latestYear)
    if (w === 0) continue // 超出三届窗口

    const cohort = cohortMap.get(cohortKey(a.schoolId, a.year, a.track))
    const admits = resolveAdmits(a, cohort)
    if (admits == null) continue

    let entry = bySchool.get(a.schoolId)
    if (!entry) {
      entry = { volume: 0, denom: 0, denomKnown: true, byYear: [] }
      bySchool.set(a.schoolId, entry)
    }
    entry.volume += w * admits
    entry.byYear.push({
      year: a.year,
      admits,
      graduates: cohort?.graduates ?? null,
    })
  }

  // 分母单独累计：一所学校在某年某赛道的毕业生数只能计一次，
  // 而它可能对应多所大学的录取记录。
  for (const [schoolId, entry] of bySchool) {
    const seen = new Set<string>()
    for (const a of rows) {
      if (a.schoolId !== schoolId) continue
      const w = yearWeight(a.year, latestYear)
      if (w === 0) continue
      const key = cohortKey(a.schoolId, a.year, a.track)
      if (seen.has(key)) continue
      seen.add(key)
      const g = cohortMap.get(key)?.graduates
      if (g == null) {
        entry.denomKnown = false
      } else {
        entry.denom += w * g
      }
    }
  }

  const raw = [...bySchool.entries()].map(([schoolId, e]) => {
    // 分母缺失就是缺失，绝不猜（metrics.md §5）
    const density =
      e.denomKnown && e.denom > 0 ? e.volume / e.denom : null
    return {
      schoolId,
      volume: e.volume,
      density,
      denominatorMissing: density == null,
      byYear: e.byYear.sort((x, y) => y.year - x.year),
    }
  })

  const volumes = raw.map((r) => r.volume)
  const densities = raw.map((r) => r.density).filter((d): d is number => d != null)

  const nv = normalizer(volumes)
  const nd = normalizer(densities)

  const scored: FeederRow[] = raw.map((r) => {
    const v = nv(r.volume)
    // 密度缺失的按最低档参与排序，并由 denominatorMissing 供 UI 标注
    const d = r.density == null ? NORM_FLOOR : nd(r.density)
    return { ...r, score: Math.pow(v, alpha) * Math.pow(d, 1 - alpha) }
  })

  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // 分数相同时，有分母的排前面 —— 数据更完整的更可信
    if (a.denominatorMissing !== b.denominatorMissing) {
      return a.denominatorMissing ? 1 : -1
    }
    return b.volume - a.volume
  })
}

/** min-max 归一化到 [NORM_FLOOR, 1]。下界抬高是为了避免零吞噬。 */
function normalizer(values: number[]): (x: number) => number {
  if (values.length === 0) return () => NORM_FLOOR
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max - min < 1e-9) return () => 1
  return (x: number) =>
    NORM_FLOOR + (1 - NORM_FLOOR) * ((x - min) / (max - min))
}

// ---------------------------------------------------------------------------

export type LeverageLevel = 'high' | 'mid' | 'low'

/** 择校杠杆率的样本护栏：样本太小时 HHI 天然偏高，会给出误导性结论。 */
export const LEVERAGE_MIN_SCHOOLS = 10
export const LEVERAGE_MIN_VOLUME = 15

/**
 * 择校杠杆率（HHI）—— 某大学的录取有多集中在少数几所高中。
 * 返回 null 表示样本不足，UI 必须显示「样本不足」而不是给结论。
 */
export function computeLeverage(
  rows: Pick<FeederRow, 'schoolId' | 'volume'>[],
): { hhi: number; level: LeverageLevel } | null {
  const total = rows.reduce((s, r) => s + r.volume, 0)
  if (rows.length < LEVERAGE_MIN_SCHOOLS || total < LEVERAGE_MIN_VOLUME) {
    return null
  }
  const hhi = rows.reduce((s, r) => s + Math.pow(r.volume / total, 2), 0)
  const level: LeverageLevel = hhi > 0.15 ? 'high' : hhi < 0.05 ? 'low' : 'mid'
  return { hhi, level }
}

/**
 * 首屏默认组合是否值得展示（PRD US-1.0）：滑杆从纯规模拖到纯概率时，
 * 榜首必须发生变化。不反转的话，产品最强的一点访客根本看不到。
 */
export function hasRankReversal(input: Omit<ScoreInput, 'alpha'>): boolean {
  const byVolume = scoreFeeders({ ...input, alpha: 1 })
  const byDensity = scoreFeeders({ ...input, alpha: 0 })
  if (byVolume.length < 2 || byDensity.length < 2) return false
  return byVolume[0].schoolId !== byDensity[0].schoolId
}
