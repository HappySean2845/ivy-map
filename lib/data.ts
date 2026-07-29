// 数据加载。构建期产物直接 import 进 bundle —— 没有运行时请求，
// 所以所有页面天然是静态的（docs/design.md §2 的约束）。

import raw from '@/data/ivy-map.json'
import type { Dataset } from '@/types'

export const dataset = raw as unknown as Dataset

export const cityById = new Map(dataset.cities.map((c) => [c.id, c]))
export const universityById = new Map(dataset.universities.map((u) => [u.id, u]))
export const schoolById = new Map(dataset.schools.map((s) => [s.id, s]))
export const sourceById = new Map(dataset.sources.map((s) => [s.id, s]))

/** 数据完备度 —— 首页状态板用，也是每天该看一眼的东西 */
export function dataStatus() {
  const { schools, cohorts, admissions, universities, defaultView } = dataset
  const withRequirement = schools.filter(
    (s) => s.requirement.sourceId != null || s.requirement.nationality !== 'unknown',
  ).length
  const withDenominator = cohorts.filter((c) => c.graduates != null).length
  return {
    admissions: admissions.length,
    cohorts: cohorts.length,
    sources: dataset.sources.length,
    schools: schools.length,
    universities: universities.length,
    verifiedSchools: schools.filter((s) => s.verified).length,
    requirementCoverage: schools.length ? withRequirement / schools.length : 0,
    denominatorCoverage: cohorts.length ? withDenominator / cohorts.length : 0,
    hasDefaultView: defaultView != null,
    hasLowLeverage: universities.some((u) => u.leverage?.level === 'low'),
  }
}
