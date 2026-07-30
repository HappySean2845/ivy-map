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
export function resolveAdmits(a: Admission, cohort: Cohort | undefined): number | null {
  // 人数口径永远优先
  if (a.admits != null) return a.admits
  if (a.offers != null) {
    return offersToAdmits(a.offers, cohort?.totalOffers ?? null, cohort?.graduates ?? null)
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
  /** 密度实际基于哪几届算的（降序）。空数组 = 无分母 */
  densityYears: number[]
  /** true = 密度只覆盖了部分年份，UI 必须标注「基于 20XX–20XX」 */
  densityPartial: boolean
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

  const latestYear = input.latestYear ?? Math.max(...rows.map((a) => a.year))

  const cohortKey = (schoolId: string, year: number, track: Track) =>
    `${schoolId}|${year}|${track}`
  const cohortMap = new Map(cohorts.map((c) => [cohortKey(c.schoolId, c.year, c.track), c]))

  // 按学校聚合。
  //
  // 分子算两份：
  //   volume  —— 三届窗口内全部录取的加权和，用于「规模」轴
  //   densNum —— 只统计**同时有毕业生数**的那些年份，用于「密度」轴
  //
  // 为什么要分开：分子算三届、分母只有两届，比值就是错的。
  // 但反过来「缺一年就把整校密度判为 null」也太严 —— 实测会把 A-Level
  // 赛道所有学校的密度全抹成「—」，滑杆两端排序完全一致，反转演示不出来。
  // 正确做法是在**分子分母都有**的年份交集上算比值，并记下用了哪几届
  // 供 UI 标注（比如「基于 2024–2025 两届」）。
  interface Acc {
    volume: number
    densNum: number
    densDen: number
    densYears: Set<number>
    allYears: Set<number>
    byYear: FeederRow['byYear']
  }
  const bySchool = new Map<string, Acc>()

  for (const a of rows) {
    const w = yearWeight(a.year, latestYear)
    if (w === 0) continue // 超出三届窗口

    const cohort = cohortMap.get(cohortKey(a.schoolId, a.year, a.track))
    const admits = resolveAdmits(a, cohort)
    if (admits == null) continue

    let e = bySchool.get(a.schoolId)
    if (!e) {
      e = {
        volume: 0,
        densNum: 0,
        densDen: 0,
        densYears: new Set(),
        allYears: new Set(),
        byYear: [],
      }
      bySchool.set(a.schoolId, e)
    }
    e.volume += w * admits
    e.allYears.add(a.year)
    e.byYear.push({
      year: a.year,
      admits,
      graduates: cohort?.graduates ?? null,
    })

    if (cohort?.graduates != null && cohort.graduates > 0) {
      e.densNum += w * admits
      e.densYears.add(a.year)
    }
  }

  // 分母：一所学校在某 (年份, 赛道) 的毕业生数只能计一次，
  // 而它可能对应多所大学的录取记录。
  for (const [schoolId, e] of bySchool) {
    const counted = new Set<string>()
    for (const a of rows) {
      if (a.schoolId !== schoolId) continue
      if (yearWeight(a.year, latestYear) === 0) continue
      const key = cohortKey(a.schoolId, a.year, a.track)
      if (counted.has(key)) continue
      const g = cohortMap.get(key)?.graduates
      if (g == null || g <= 0) continue
      counted.add(key)
      e.densDen += yearWeight(a.year, latestYear) * g
    }
  }

  const raw = [...bySchool.entries()].map(([schoolId, e]) => {
    // 分母缺失就是缺失，绝不猜（metrics.md §5）
    const density = e.densDen > 0 ? e.densNum / e.densDen : null
    const densityYears = [...e.densYears].sort((x, y) => y - x)
    return {
      schoolId,
      volume: e.volume,
      density,
      denominatorMissing: density == null,
      densityYears,
      // 密度只覆盖了部分年份 —— UI 必须标注是基于哪几届算的
      densityPartial: density != null && densityYears.length < e.allYears.size,
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
  return (x: number) => NORM_FLOOR + (1 - NORM_FLOOR) * ((x - min) / (max - min))
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
 *
 * **必须是真反转。** 缺分母的学校在概率轴上走 NORM_FLOOR 兜底，会被推到
 * 末位，从而制造出「榜首变了」的假象——但那不是密度差异，只是数据缺失。
 * 拿这种组合当首屏演示，等于用一个我们自己都不知道的数字去说服用户。
 * 所以要求换位的两所学校**都有真实密度**。
 */
export function hasRankReversal(input: Omit<ScoreInput, 'alpha'>): boolean {
  const byVolume = scoreFeeders({ ...input, alpha: 1 })
  const byDensity = scoreFeeders({ ...input, alpha: 0 })
  if (byVolume.length < 2 || byDensity.length < 2) return false

  const volTop = byVolume[0]
  const densTop = byDensity[0]
  if (volTop.schoolId === densTop.schoolId) return false

  // 换位的双方都必须有分母，否则这个「反转」是数据缺失的产物
  return volTop.density != null && densTop.density != null
}
