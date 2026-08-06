import { describe, expect, it } from 'vitest'

import type { AdmissionCountPoint, AdmissionCountSeries } from '@/types'
import {
  admissionCountPointValue,
  admissionCountRateNote,
  formatAdmissionCount,
  latestReviewedAdmissionCountPoint,
} from './admission-counts'

function point(overrides: Partial<AdmissionCountPoint> = {}): AdmissionCountPoint {
  return {
    academicYearStart: 2024,
    kind: 'actual',
    value: 413,
    valueMin: null,
    valueMax: null,
    valueText: null,
    confidence: 'L2',
    reviewStatus: 'reviewed',
    sourceId: 'admission-rate-trends-2026-08-06',
    citation: null,
    ...overrides,
  }
}

function series(overrides: Partial<AdmissionCountSeries['scope']> = {}): AdmissionCountSeries {
  return {
    id: 'cuhk:mainland',
    scope: {
      applicantScope: 'mainland_china',
      pathway: 'mainland_undergraduate_scheme',
      admissionsSystem: 'gaokao_early_batch',
      sourceMetric: 'mainland_admitted_count',
      rateAvailability: 'not_applicable_early_batch',
      ...overrides,
    },
    points: [],
  }
}

describe('Hong Kong admission count presentation', () => {
  it('keeps actual, estimated, planned, range, and lower-bound wording distinct', () => {
    expect(formatAdmissionCount(point())).toBe('413 人')
    expect(formatAdmissionCount(point({ kind: 'estimated', value: 780 }))).toBe('约 780 人')
    expect(
      formatAdmissionCount(
        point({ kind: 'planned', value: null, valueMin: 400, valueMax: 406 }),
      ),
    ).toBe('计划 400–406 人')
    expect(
      formatAdmissionCount(
        point({ kind: 'estimated', value: null, valueText: '>250 (Gaokao applicants)' }),
      ),
    ).toBe('>250 人（高考生）')
  })

  it('uses numeric bounds only for chart position, not display precision', () => {
    expect(admissionCountPointValue(point({ value: null, valueText: '>300' }))).toBe(300)
    expect(admissionCountPointValue(point({ value: null, valueMin: 400, valueMax: 406 }))).toBe(
      403,
    )
  })

  it('selects the latest reviewed actual for cards and ignores estimates/plans', () => {
    const input = series()
    input.points = [
      point({ academicYearStart: 2023, value: 578 }),
      point({
        academicYearStart: 2024,
        kind: 'estimated',
        value: 780,
        reviewStatus: 'extracted',
      }),
      point({
        academicYearStart: 2025,
        kind: 'planned',
        value: 400,
        reviewStatus: 'extracted',
      }),
    ]
    expect(latestReviewedAdmissionCountPoint(input)?.value).toBe(578)
  })

  it('explains why CUHK has no admission-rate percentage', () => {
    expect(admissionCountRateNote(series())).toContain('录取率不适用')
    expect(
      admissionCountRateNote(
        series({
          admissionsSystem: 'mainland_undergraduate_scheme',
          rateAvailability: 'missing_denominator',
        }),
      ),
    ).toContain('不能换算成录取率')
  })
})
