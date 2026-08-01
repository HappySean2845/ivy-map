// 筛选条件 + 可行性闸门判定（PRD E2）。
//
// 这个文件是产品的差异化所在：别的榜单只告诉你「哪所学校好」，
// 我们还要告诉你「这所学校招不招你家孩子，为什么不招」。
//
// 两条不能破的规矩：
//   1. 门槛信息缺失时返回 'unknown'，绝不默认判为可申请（US-2.2 验收标准）。
//   2. reasons 必须是具体原因，不能是「不可申请」这种废话。

import { cityById, dataset } from '@/lib/data'
import type { School, SchoolType, Track } from '@/types'

// ---------------------------------------------------------------------------
// 类型

export type DataMode = 'feeders' | 'official'

export interface Gate {
  nationality: 'cn' | 'foreign' | 'hk_mo_tw' | 'pr' | null
  localHukou: boolean | null
  cityId: string | null // 学籍所在城市
  grade: number | null // 当前年级
  targetYear: number | null
}

export interface Filters {
  dataMode: DataMode
  universityId: string | null
  cityId: string | null // 榜单筛的城市
  tracks: Track[] // 空数组 = 不限
  schoolTypes: SchoolType[] // 空数组 = 不限
  alpha: number // 0 = 概率优先, 1 = 规模优先
  compare: string[] // school ids
  hideIneligible: boolean
  gate: Gate
}

export type Eligibility =
  /**
   * 闸门表单没填 —— 我们**什么都没检查**，所以不能声称任何结论。
   *
   * 这个状态是补上来的：原来这种情况直接返回 eligible，表格于是渲染成
   * 「未发现限制」——门槛数据 0/40 全空，却告诉家长没有限制，是彻头彻尾的
   * 假陈述，也正是 PRD US-2.2 明令禁止的「不得默认判为可申请」。
   * 把它单独立成一个状态，类型系统就会强制每个消费方处理它。
   */
  | { status: 'unchecked' }
  | { status: 'eligible' }
  | { status: 'ineligible'; reasons: string[] } // 明确不符合
  | { status: 'unknown'; reasons: string[] } // 门槛信息缺失 / 需进一步确认

/** 对比集合上限（PRD US-3.2：2–4 所） */
export const MAX_COMPARE = 4

/** 年级的合法范围，用于表单与 URL 解析的边界校验 */
export const GRADE_MIN = 1
export const GRADE_MAX = 12

// ---------------------------------------------------------------------------
// 默认值

export const EMPTY_GATE: Gate = {
  nationality: null,
  localHukou: null,
  cityId: null,
  grade: null,
  targetYear: null,
}

/**
 * 首屏默认组合（PRD US-1.0：落地即有内容，不得是空白地图等待点击）。
 * 优先用构建期校验过「滑杆能演示排名反转」的 defaultView；数据还没录到那一步时，
 * 退回到录取记录最多的大学 —— 至少首屏不是空的。
 */
function pickDefaultUniversityId(): string | null {
  if (dataset.defaultView) return dataset.defaultView.universityId
  const count = new Map<string, number>()
  for (const a of dataset.admissions) {
    count.set(a.universityId, (count.get(a.universityId) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [id, n] of count) {
    if (n > bestN) {
      best = id
      bestN = n
    }
  }
  return best ?? dataset.universities[0]?.id ?? null
}

/**
 * 应用初始状态。**不要直接修改它**，需要变更时复制一份再改
 * （`{ ...DEFAULT_FILTERS, cityId: 'shanghai' }`）。
 */
export const DEFAULT_FILTERS: Filters = {
  dataMode: 'feeders',
  universityId: pickDefaultUniversityId(),
  cityId: dataset.defaultView?.cityId ?? null,
  tracks: dataset.defaultView ? [dataset.defaultView.track] : [],
  schoolTypes: [],
  alpha: 0.5,
  compare: [],
  hideIneligible: false,
  gate: EMPTY_GATE,
}

// ---------------------------------------------------------------------------
// 榜单筛选

/** 学校是否落在当前筛选条件内。城市 / 赛道 / 学校性质三项，空 = 不限。 */
export function matchesFilters(school: School, filters: Filters): boolean {
  if (filters.cityId && school.cityId !== filters.cityId) return false
  if (filters.tracks.length > 0 && !school.tracks.some((t) => filters.tracks.includes(t))) {
    return false
  }
  if (filters.schoolTypes.length > 0 && !filters.schoolTypes.includes(school.type)) {
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// 可行性闸门

/** 闸门是否填了内容。全空时不做任何资格判定 —— 表单是增强，不是门槛（US-2.1）。 */
export function isGateActive(gate: Gate): boolean {
  return (
    gate.nationality !== null ||
    gate.localHukou !== null ||
    gate.cityId !== null ||
    gate.grade !== null ||
    gate.targetYear !== null
  )
}

/** 当前学年的起始年份。用 builtAt 而不是 new Date()，避免 SSR/CSR 算出不同结果。 */
function currentSchoolYear(): number {
  const d = new Date(dataset.builtAt)
  const t = Number.isNaN(d.getTime()) ? new Date() : d
  // 国内学年 9 月开学，8 月及以后算新学年
  return t.getUTCMonth() >= 7 ? t.getUTCFullYear() : t.getUTCFullYear() - 1
}

/**
 * 孩子入学时会是几年级。
 * 填了目标入学年份就按它推算；没填则同时接受「当前年级」和「下一学年」两种情况，
 * 避免因为一个没填的字段就把学校误判成不可申请。
 */
function entryGradeCandidates(gate: Gate): number[] {
  const g = gate.grade as number
  if (gate.targetYear != null) {
    const entry = g + (gate.targetYear - currentSchoolYear())
    if (entry >= GRADE_MIN && entry <= GRADE_MAX) return [entry]
  }
  return [g, g + 1]
}

/**
 * 判定一所学校收不收这个孩子。
 *
 * 国籍和户籍要分清楚：**户籍能想办法（借读、积分、迁户），国籍想不了办法**。
 * 所以国籍不符合是硬墙，文案直说；户籍不符合时文案要点出还有政策口径可查。
 *
 * 闸门没填 → 不做任何判定，返回 eligible（表示「没发现不符合的条件」）。
 * UI 应先用 isGateActive() 决定要不要展示资格状态，避免在用户没提问时给答案。
 */
export function checkEligibility(school: School, gate: Gate): Eligibility {
  if (!isGateActive(gate)) return { status: 'unchecked' }

  const req = school.requirement
  const cityName = cityById.get(school.cityId)?.name ?? '学校所在城市'
  const gateCityName = gate.cityId ? (cityById.get(gate.cityId)?.name ?? null) : null

  // 整条门槛都没收录 —— 这是数据缺口，不是「可以申请」
  if (req.nationality === 'unknown' && req.hukou === 'unknown' && req.entryGrades == null) {
    return {
      status: 'unknown',
      reasons: [
        '该校门槛信息待补充（国籍/身份、学籍户籍、开放年级均未收录），请以学校官方招生简章为准',
      ],
    }
  }

  const blocked: string[] = [] // 明确不符合
  const unclear: string[] = [] // 缺信息 / 需向学校确认

  // --- 1. 国籍与身份（办不了的那一类，放最前面）---
  if (gate.nationality) {
    const nat = gate.nationality
    switch (req.nationality) {
      case 'none':
        break
      case 'foreign':
        if (nat === 'cn') {
          blocked.push('仅招收外籍人员子女（需持外国护照），中国大陆护照不符合')
        } else if (nat === 'pr') {
          blocked.push('仅招收外籍人员子女（需持外国护照），仅持境外永久居留权不符合')
        } else if (nat === 'hk_mo_tw') {
          unclear.push('仅招收外籍人员子女；港澳台身份是否适用需向学校确认')
        }
        break
      case 'foreign_or_pr':
        if (nat === 'cn') {
          blocked.push('仅招收外籍人员子女或持境外永久居留权的学生')
        } else if (nat === 'hk_mo_tw') {
          unclear.push(
            '招收外籍人员子女或持境外永久居留权的学生；港澳台身份是否适用需向学校确认',
          )
        }
        break
      case 'hk_mo_tw':
        if (nat === 'cn') {
          blocked.push('仅招收港澳台侨学生，中国大陆身份不符合')
        } else if (nat === 'foreign' || nat === 'pr') {
          unclear.push('面向港澳台侨学生招生；外籍或境外永居身份是否适用需向学校确认')
        }
        break
      case 'unknown':
        unclear.push('该校的国籍/身份要求待补充')
        break
    }
  }

  // --- 2. 学籍与户籍（有政策口径可查的那一类）---
  if (gate.localHukou !== null || gate.cityId !== null) {
    // null = 用户没填学籍城市，无法比对
    const sameCity = gate.cityId == null ? null : gate.cityId === school.cityId
    switch (req.hukou) {
      case 'none':
        break
      case 'local_city':
        if (sameCity === false) {
          blocked.push(`需${cityName}本市学籍/户籍，孩子学籍在${gateCityName ?? '其他城市'}`)
        } else if (gate.localHukou === false) {
          blocked.push(`需${cityName}本市户籍；非本市户籍需另行确认借读或积分入学政策`)
        } else if (gate.localHukou === null) {
          unclear.push(`需${cityName}本市户籍，请确认孩子户籍是否在${cityName}`)
        }
        break
      case 'local_district':
        if (sameCity === false) {
          blocked.push(
            `需${cityName}${school.district ?? ''}的学籍/户籍，孩子学籍在${gateCityName ?? '其他城市'}`,
          )
        } else if (gate.localHukou === false) {
          blocked.push(`需${cityName}本市户籍并对口${school.district ?? '指定'}学区`)
        } else {
          unclear.push(
            `需对口${cityName}${school.district ?? ''}学区，具体对口范围需向学校确认`,
          )
        }
        break
      case 'unknown':
        unclear.push('该校的学籍/户籍要求待补充')
        break
    }
  }

  // --- 3. 开放入学的年级 ---
  if (gate.grade != null) {
    const grades = req.entryGrades
    if (grades == null || grades.length === 0) {
      unclear.push('该校开放入学的年级待补充')
    } else {
      const candidates = entryGradeCandidates(gate)
      if (!candidates.some((g) => grades.includes(g))) {
        const list = [...grades].sort((a, b) => a - b).join(' / ')
        const when =
          gate.targetYear != null && candidates.length === 1
            ? `按 ${gate.targetYear} 年入学计算，孩子入学时为 ${candidates[0]} 年级`
            : `孩子当前 ${gate.grade} 年级`
        blocked.push(`仅在 ${list} 年级开放入学；${when}`)
      }
    }
  }

  if (blocked.length > 0) return { status: 'ineligible', reasons: blocked }
  if (unclear.length > 0) return { status: 'unknown', reasons: unclear }
  return { status: 'eligible' }
}
