// 数据加载。构建期产物直接 import 进 bundle —— 没有运行时请求，
// 所以所有页面天然是静态的（docs/design.md §2 的约束）。

import raw from '@/data/ivy-map.json'
import type { Dataset } from '@/types'

export const dataset = raw as unknown as Dataset

export const cityById = new Map(dataset.cities.map((c) => [c.id, c]))
export const universityById = new Map(dataset.universities.map((u) => [u.id, u]))
export const schoolById = new Map(dataset.schools.map((s) => [s.id, s]))
export const sourceById = new Map(dataset.sources.map((s) => [s.id, s]))

/** 数据完备度 —— 首页要把这些数字讲出来，见下 */
export function dataStatus() {
  const { schools, cohorts, admissions, universities, defaultView } = dataset
  const withRequirement = schools.filter(
    (s) => s.requirement.sourceId != null || s.requirement.nationality !== 'unknown',
  ).length
  const withDenominator = cohorts.filter((c) => c.graduates != null).length
  const officialAdmissions = universities.reduce(
    (count, university) => count + university.officialAdmissions.length,
    0,
  )

  // 首屏要讲的两个数（见下方注释）
  const schoolsWithAdmissions = new Set(admissions.map((a) => a.schoolId)).size
  const schoolsWithGraduates = new Set(
    cohorts.filter((c) => c.graduates != null).map((c) => c.schoolId),
  ).size

  return {
    admissions: admissions.length,
    cohorts: cohorts.length,
    sources: dataset.sources.length,
    schools: schools.length,
    universities: universities.length,
    officialAdmissions,
    verifiedSchools: schools.filter((s) => s.verified).length,
    requirementCoverage: schools.length ? withRequirement / schools.length : 0,
    denominatorCoverage: cohorts.length ? withDenominator / cohorts.length : 0,
    hasDefaultView: defaultView != null,
    hasLowLeverage: universities.some((u) => u.leverage?.level === 'low'),
    schoolsWithAdmissions,
    schoolsWithGraduates,
  }
}

/**
 * 首屏那句话的数据支撑（PRD US-1.0）。
 *
 * 收录的学校里只有极少数公布了毕业生总数 —— **这不是要藏的缺陷，它就是
 * 这个产品的发现**。没有分母就算不出人均命中率，这正是市面上所有榜单
 * 只能给你 offer 数的原因，也正是我们做这件事的理由。
 *
 * 所以这句话要放在首屏显眼处，当论点讲，不当免责声明。
 */
export function denominatorGapLine(): string {
  const s = dataStatus()
  return (
    `我们收录的 ${s.schools} 所学校中，只有 ${s.schoolsWithGraduates} 所公布了毕业生总数。` +
    `没有分母，就算不出人均命中率 —— 这就是为什么所有榜单都只能给你 offer 数。`
  )
}
