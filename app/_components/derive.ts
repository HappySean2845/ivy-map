// 首页用到的几个聚合。
//
// 这里只做**加总和排序**，不发明任何口径 —— 所有数字都先经过 lib/view 的
// buildFeederRows（它内部走 lib/scoring 的加权与归一化），本文件拿到的已经是
// 算好的 volume / density，再往上折叠一层而已。
//
// 之所以放在 app/ 而不是 lib/：它服务的是首页这几块 UI 的形状，
// 换个版式就会跟着变，不属于对用户承诺的口径层。

import { cityById, dataset } from '@/lib/data'
import { EMPTY_GATE, type Filters } from '@/lib/filters'
import { buildFeederRows, type FeederRowView } from '@/lib/view'
import type { Basis, Confidence } from '@/types'

/**
 * 不带任何筛选的基准条件。
 * alpha 只影响排序，不影响 volume / density，所以这里取多少都行。
 */
export const UNFILTERED: Filters = {
  universityId: null,
  cityId: null,
  tracks: [],
  schoolTypes: [],
  alpha: 1,
  compare: [],
  hideIneligible: false,
  gate: EMPTY_GATE,
}

/**
 * 一行的加权毕业生数（人均密度的分母）。
 * density = volume / 分母，所以反推是精确的；分母缺失时 density 为 null，这里也返回 null。
 * **不猜分母**（metrics.md §5）。
 */
export function weightedGraduates(row: FeederRowView): number | null {
  if (row.density == null || row.density <= 0) return null
  return row.volume / row.density
}

/**
 * 左屏气泡大小：每所大学近三年加权录取总量。
 * 30 所大学 × 几十条录取记录，模块加载时算一次就够，不值得预计算进构建产物。
 */
export const VOLUME_BY_UNIVERSITY: Record<string, number> = (() => {
  const out: Record<string, number> = {}
  for (const u of dataset.universities) {
    const rows = buildFeederRows({ universityId: u.id, filters: UNFILTERED })
    out[u.id] = rows.reduce((sum, r) => sum + r.volume, 0)
  }
  return out
})()

/** 右屏热力：按生源校所在城市把加权录取人数加起来。 */
export function heatByCity(rows: FeederRowView[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    out[r.school.cityId] = (out[r.school.cityId] ?? 0) + r.volume
  }
  return out
}

// ---------------------------------------------------------------------------
// 大学画像（US-1.2）

export interface UniversityProfile {
  /** 近三年加权录取总量（全量口径，不受榜单筛选影响） */
  totalVolume: number
  /** 逐年录取人数。admits 为 null 的记录不计入，也不当 0 */
  byYear: { year: number; admits: number }[]
  /** 生源地域 Top 5 */
  topCities: { cityId: string; name: string; volume: number; share: number }[]
  /** 收录到的生源校数量 —— 杠杆率护栏看的就是它 */
  schoolCount: number
  sourceIds: string[]
  /** 口径与置信一律取最保守的那一档，理由见 lib/view 的 worstBasis */
  basis: Basis
  confidence: Confidence
}

/**
 * 某所大学的整体画像。
 *
 * **刻意不吃榜单的城市/赛道筛选** —— 画像回答的是「这所大学对中国学生什么态度」，
 * 如果它跟着筛选变，用户看到的「趋势」就成了自己筛出来的一个切片。
 */
export function universityProfile(universityId: string): UniversityProfile | null {
  const rows = buildFeederRows({ universityId, filters: UNFILTERED })
  if (rows.length === 0) return null

  const byYear = new Map<number, number>()
  const byCity = new Map<string, number>()
  const sourceIds: string[] = []
  let basis: Basis = 'admits'
  let confidence: Confidence = 'L1'
  let totalVolume = 0

  for (const r of rows) {
    totalVolume += r.volume
    byCity.set(r.school.cityId, (byCity.get(r.school.cityId) ?? 0) + r.volume)

    for (const y of r.byYear) {
      if (y.admits == null) continue
      byYear.set(y.year, (byYear.get(y.year) ?? 0) + y.admits)
    }
    for (const id of r.sourceIds) {
      if (!sourceIds.includes(id)) sourceIds.push(id)
    }
    if (r.basis === 'estimated') basis = 'estimated'
    else if (r.basis === 'offers' && basis !== 'estimated') basis = 'offers'
    if (r.confidence === 'L3') confidence = 'L3'
    else if (r.confidence === 'L2' && confidence !== 'L3') confidence = 'L2'
  }

  const topCities = [...byCity.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cityId, volume]) => ({
      cityId,
      name: cityById.get(cityId)?.name ?? cityId,
      volume,
      share: totalVolume > 0 ? volume / totalVolume : 0,
    }))

  return {
    totalVolume,
    byYear: [...byYear.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, admits]) => ({ year, admits })),
    topCities,
    schoolCount: rows.length,
    sourceIds,
    basis,
    confidence,
  }
}
