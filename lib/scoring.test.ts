import { describe, it, expect } from 'vitest'
import {
  scoreFeeders,
  computeLeverage,
  offersToAdmits,
  hasRankReversal,
  K_FALLBACK,
} from './scoring'
import type { Admission, Cohort, Track } from '@/types'

const LATEST = 2025

function adm(
  schoolId: string,
  year: number,
  admits: number | null,
  opts: Partial<Admission> = {},
): Admission {
  return {
    schoolId,
    universityId: 'brown',
    year,
    track: 'IB' as Track,
    admits,
    offers: null,
    basis: 'admits',
    confidence: 'L1',
    sourceId: 's1',
    ...opts,
  }
}

function coh(
  schoolId: string,
  year: number,
  graduates: number | null,
  totalOffers: number | null = null,
): Cohort {
  return { schoolId, year, track: 'IB', graduates, totalOffers, sourceId: 's1' }
}

// docs/metrics.md §9 的示例：A 校规模大，B 校密度高
const EXAMPLE_ADMISSIONS = [
  adm('a', 2025, 6),
  adm('a', 2024, 5),
  adm('a', 2023, 4),
  adm('b', 2025, 3),
  adm('b', 2024, 2),
  adm('b', 2023, 3),
]
const EXAMPLE_COHORTS = [
  coh('a', 2025, 180),
  coh('a', 2024, 175),
  coh('a', 2023, 170),
  coh('b', 2025, 48),
  coh('b', 2024, 45),
  coh('b', 2023, 44),
]

describe('Volume / Density —— metrics.md §9 的示例计算', () => {
  const rows = scoreFeeders({
    admissions: EXAMPLE_ADMISSIONS,
    cohorts: EXAMPLE_COHORTS,
    alpha: 0.5,
    latestYear: LATEST,
  })
  const a = rows.find((r) => r.schoolId === 'a')!
  const b = rows.find((r) => r.schoolId === 'b')!

  it('加权录取人数', () => {
    expect(a.volume).toBeCloseTo(5.3, 6) // .5*6 + .3*5 + .2*4
    expect(b.volume).toBeCloseTo(2.7, 6)
  })

  it('人均密度 —— 分母也要加权', () => {
    expect(a.density!).toBeCloseTo(5.3 / 176.5, 6) // ≈ 3.0%
    expect(b.density!).toBeCloseTo(2.7 / 46.3, 6) // ≈ 5.8%
  })

  it('规模大的学校密度反而低 —— 这就是整个产品的立论', () => {
    expect(a.volume).toBeGreaterThan(b.volume)
    expect(b.density!).toBeGreaterThan(a.density!)
  })
})

describe('滑杆：alpha 控制规模与概率的权重', () => {
  const run = (alpha: number) =>
    scoreFeeders({
      admissions: EXAMPLE_ADMISSIONS,
      cohorts: EXAMPLE_COHORTS,
      alpha,
      latestYear: LATEST,
    })

  it('alpha=1 纯规模，A 校居首', () => {
    expect(run(1)[0].schoolId).toBe('a')
  })

  it('alpha=0 纯概率，B 校居首', () => {
    expect(run(0)[0].schoolId).toBe('b')
  })

  it('拖动滑杆会发生排名反转 —— US-1.0 依赖这个', () => {
    expect(
      hasRankReversal({
        admissions: EXAMPLE_ADMISSIONS,
        cohorts: EXAMPLE_COHORTS,
        latestYear: LATEST,
      }),
    ).toBe(true)
  })
})

describe('分母缺失：显示「—」而不是 0', () => {
  it('毕业生数为 null 时密度为 null，绝不退化成 0', () => {
    const rows = scoreFeeders({
      admissions: [adm('x', 2025, 5)],
      cohorts: [coh('x', 2025, null)],
      alpha: 0.5,
      latestYear: LATEST,
    })
    expect(rows[0].density).toBeNull()
    expect(rows[0].denominatorMissing).toBe(true)
  })

  it('同分时有分母的排在缺分母的前面', () => {
    const rows = scoreFeeders({
      admissions: [adm('known', 2025, 5), adm('unknown', 2025, 5)],
      cohorts: [coh('known', 2025, 100), coh('unknown', 2025, null)],
      alpha: 1, // 纯规模，两者 volume 相同
      latestYear: LATEST,
    })
    expect(rows[0].schoolId).toBe('known')
  })
})

describe('offer → 人数折算', () => {
  it('有该校当年的 offer/毕业生比时按实际系数折算', () => {
    // 300 offers / 100 graduates = 人均 3 枚
    expect(offersToAdmits(30, 300, 100)).toBeCloseTo(10, 6)
  })

  it('缺数据时退回全局中位数', () => {
    expect(offersToAdmits(40, null, null)).toBeCloseTo(40 / K_FALLBACK, 6)
  })

  it('系数被裁剪到 [1, 10]，防止异常数据放大误差', () => {
    expect(offersToAdmits(10, 1, 100)).toBeCloseTo(10, 6) // k 会被抬到 1
    expect(offersToAdmits(100, 10000, 100)).toBeCloseTo(10, 6) // k 被压到 10
  })

  it('人数口径永远优先于 offer 口径', () => {
    const rows = scoreFeeders({
      admissions: [adm('x', 2025, 4, { offers: 20, basis: 'admits' })],
      cohorts: [coh('x', 2025, 100)],
      alpha: 1,
      latestYear: LATEST,
    })
    expect(rows[0].volume).toBeCloseTo(0.5 * 4, 6) // 用 4，不是 20/k
  })
})

describe('边界情形', () => {
  it('空输入返回空数组，不抛异常', () => {
    expect(scoreFeeders({ admissions: [], cohorts: [], alpha: 0.5 })).toEqual([])
  })

  it('三届窗口之外的年份不计入', () => {
    const rows = scoreFeeders({
      admissions: [adm('x', 2025, 10), adm('x', 2021, 999)],
      cohorts: [coh('x', 2025, 100), coh('x', 2021, 100)],
      alpha: 1,
      latestYear: LATEST,
    })
    expect(rows[0].volume).toBeCloseTo(5, 6) // 只有 0.5*10
  })

  it('全部同值时不产生 NaN', () => {
    const rows = scoreFeeders({
      admissions: [adm('x', 2025, 5), adm('y', 2025, 5)],
      cohorts: [coh('x', 2025, 100), coh('y', 2025, 100)],
      alpha: 0.5,
      latestYear: LATEST,
    })
    for (const r of rows) expect(Number.isFinite(r.score)).toBe(true)
  })

  it('只有两所学校时不会因几何平均退化为全 0', () => {
    const rows = scoreFeeders({
      admissions: EXAMPLE_ADMISSIONS,
      cohorts: EXAMPLE_COHORTS,
      alpha: 0.5,
      latestYear: LATEST,
    })
    for (const r of rows) expect(r.score).toBeGreaterThan(0)
  })

  it('毕业生数为 0 视作无分母，不产生除零', () => {
    const rows = scoreFeeders({
      admissions: [adm('x', 2025, 5)],
      cohorts: [coh('x', 2025, 0)],
      alpha: 0.5,
      latestYear: LATEST,
    })
    expect(rows[0].density).toBeNull()
  })
})

describe('择校杠杆率', () => {
  const spread = (n: number, each: number) =>
    Array.from({ length: n }, (_, i) => ({ schoolId: `s${i}`, volume: each }))

  it('样本不足时返回 null，不给结论', () => {
    expect(computeLeverage(spread(5, 10))).toBeNull() // 学校数不够
    expect(computeLeverage(spread(12, 0.5))).toBeNull() // 总量不够
  })

  it('高度集中 → 高杠杆', () => {
    const rows = [
      { schoolId: 'big', volume: 80 },
      ...spread(11, 2).map((r) => ({ ...r, volume: 2 })),
    ]
    expect(computeLeverage(rows)!.level).toBe('high')
  })

  it('高度分散 → 低杠杆（「别折腾」的数据依据）', () => {
    expect(computeLeverage(spread(60, 2))!.level).toBe('low')
  })
})
