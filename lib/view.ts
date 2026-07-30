// 视图模型：把「数据 + 筛选」变成榜单能直接渲染的一行行东西。
// RANK / SCHOOL 两个组件层共用，保证它们看到的永远是同一份口径。
//
// 关键顺序：**先过滤，再打分**。scoreFeeders 的归一化是在当前结果集内做的
// （metrics.md §6），先打分再过滤会让分数反映一个用户根本没看到的集合。

import { cityById, dataset, schoolById } from '@/lib/data'
import { checkEligibility, matchesFilters, type Eligibility, type Filters } from '@/lib/filters'
import { scoreFeeders, yearWeight, type FeederRow } from '@/lib/scoring'
import type { Admission, Basis, Confidence, School } from '@/types'

export interface FeederRowView extends FeederRow {
  rank: number
  school: School
  cityName: string
  eligibility: Eligibility
  sourceIds: string[]
  basis: 'admits' | 'offers' | 'estimated'
  confidence: 'L1' | 'L2' | 'L3'
}

/**
 * 「近三年」的三年，取全库最新年份，不取当前筛选结果里的最新年份。
 * 否则筛出来的小集合恰好只有 2023 的数据时，2023 会被当成「最近一届」拿到
 * 0.5 权重 —— 同一所学校在不同筛选下 Volume 会变，用户没法理解。
 */
export const LATEST_YEAR: number | undefined = dataset.admissions.length
  ? Math.max(...dataset.admissions.map((a) => a.year))
  : undefined

/** 口径取最保守的那个：只要掺了估算就整体标估算，避免把折算过的数字说成实数。 */
function worstBasis(list: Admission[]): Basis {
  if (list.some((a) => a.basis === 'estimated')) return 'estimated'
  if (list.some((a) => a.basis === 'offers')) return 'offers'
  return 'admits'
}

/** 置信同理取最低的一档 —— 一行数据的可信度由它最弱的那条来源决定。 */
function worstConfidence(list: Admission[]): Confidence {
  if (list.some((a) => a.confidence === 'L3')) return 'L3'
  if (list.some((a) => a.confidence === 'L2')) return 'L2'
  return 'L1'
}

/**
 * 构建 Feeder 榜单。
 *
 * 注意这里**不处理 hideIneligible** —— 隐藏是展示层的事，交给 FeederTable。
 * 好处是名次始终反映完整结果集：打开隐藏开关后看到 1、3、5 名，用户能意识到
 * 中间还有学校存在，只是他报不了（US-2.2「置灰但仍然可见」的同一逻辑）。
 */
export function buildFeederRows(args: {
  universityId: string
  filters: Filters
}): FeederRowView[] {
  const { universityId, filters } = args
  if (!universityId) return []

  // 1. 先按筛选条件圈定学校
  const schools = dataset.schools.filter((s) => matchesFilters(s, filters))
  if (schools.length === 0) return []
  const allowed = new Set(schools.map((s) => s.id))

  // 2. 再圈定这些学校投向该大学的录取记录
  const admissions = dataset.admissions.filter(
    (a) =>
      a.universityId === universityId &&
      allowed.has(a.schoolId) &&
      (filters.tracks.length === 0 || filters.tracks.includes(a.track)),
  )
  if (admissions.length === 0) return []

  // 3. 最后才打分（归一化只在这个结果集内做）
  const rows = scoreFeeders({
    admissions,
    cohorts: dataset.cohorts,
    alpha: filters.alpha,
    tracks: filters.tracks.length ? filters.tracks : undefined,
    latestYear: LATEST_YEAR,
  })

  // 溯源用：每所学校贡献了哪些录取记录
  const bySchool = new Map<string, Admission[]>()
  for (const a of admissions) {
    const list = bySchool.get(a.schoolId)
    if (list) list.push(a)
    else bySchool.set(a.schoolId, [a])
  }

  const out: FeederRowView[] = []
  rows.forEach((row, i) => {
    const school = schoolById.get(row.schoolId)
    if (!school) return // 数据不一致时宁可少一行，也不渲染一个没有出处的名字
    const contributing = bySchool.get(row.schoolId) ?? []

    out.push({
      ...row,
      rank: i + 1,
      school,
      cityName: cityById.get(school.cityId)?.name ?? '',
      eligibility: checkEligibility(school, filters.gate),
      sourceIds: collectSourceIds(row, contributing),
      basis: worstBasis(contributing),
      confidence: worstConfidence(contributing),
    })
  })

  // 上一步可能丢过行，名次要连续
  return out.map((r, i) => ({ ...r, rank: i + 1 }))
}

/**
 * 一行数据背后的全部出处：录取记录的来源 + 冲突的其他来源 + 分母（届次）的来源。
 * 分母也要带上 —— 人均密度是被展示的数值，它的分母同样需要可溯源（US-7.1）。
 */
function collectSourceIds(row: FeederRow, contributing: Admission[]): string[] {
  const ids: string[] = []
  const push = (id: string | null | undefined) => {
    if (id && !ids.includes(id)) ids.push(id)
  }

  for (const a of contributing) {
    if (LATEST_YEAR != null && yearWeight(a.year, LATEST_YEAR) === 0) continue
    push(a.sourceId)
    a.conflict?.otherSourceIds.forEach(push)
  }

  for (const c of dataset.cohorts) {
    if (c.schoolId !== row.schoolId) continue
    if (LATEST_YEAR != null && yearWeight(c.year, LATEST_YEAR) === 0) continue
    if (!contributing.some((a) => a.track === c.track && a.year === c.year)) continue
    push(c.sourceId)
  }

  return ids
}
