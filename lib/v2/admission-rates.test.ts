import { describe, expect, it } from 'vitest'

import type { AdmissionRateSeries } from '@/types'
import {
  admissionRatePeriodLabel,
  admissionRateScopeNote,
  admissionRateSeriesLabel,
  formatAdmissionRate,
  primaryAdmissionRateSeries,
} from './admission-rates'

function series(
  overrides: Partial<AdmissionRateSeries['scope']> = {},
  primary = false,
): AdmissionRateSeries {
  return {
    id: JSON.stringify(overrides),
    primary,
    scope: {
      rateBasis: 'admitted_over_applications',
      applicantScope: null,
      admissionsSystem: null,
      pathway: null,
      sourceMetric: null,
      periodKind: null,
      geographyDefinition: null,
      aggregation: null,
      ...overrides,
    },
    points: [],
  }
}

describe('admission rate presentation', () => {
  it('labels non-comparable scopes explicitly', () => {
    expect(admissionRateSeriesLabel(series())).toBe('本科录取率')
    expect(
      admissionRateSeriesLabel(
        series({
          rateBasis: 'confirmed_places_over_applications',
          applicantScope: 'china_domicile',
          sourceMetric: 'china_success_rate_3yr',
        }),
      ),
    ).toBe('中国大陆成功率（3 年滚动）')
    expect(
      admissionRateSeriesLabel(
        series({ applicantScope: 'international_program', pathway: 'PEAK' }),
      ),
    ).toBe('PEAK 项目录取率')
  })

  it('describes the actual audience and admissions system', () => {
    expect(
      admissionRateScopeNote(
        series({
          applicantScope: 'china_domicile',
          admissionsSystem: 'UCAS',
          geographyDefinition: 'domicile_excludes_hong_kong',
        }),
      ),
    ).toBe('中国大陆居住地申请者（不含香港） · UCAS')
  })

  it('keeps privacy-suppressed values as ranges', () => {
    const point = {
      academicYearStart: 2024,
      periodStart: null,
      periodEnd: null,
      rate: null,
      rateMin: 0.208061,
      rateMax: 0.208742,
      applied: 8_415,
      outcome: null,
      confidence: 'L2' as const,
      sourceId: 'imperial-official',
      citation: null,
    }
    expect(formatAdmissionRate(point)).toBe('20.8–20.9%')
    expect(admissionRatePeriodLabel(point)).toBe('2024–25')
  })

  it('uses the explicit primary flag instead of array order', () => {
    const china = series({ applicantScope: 'china_domicile' })
    const overall = series({ applicantScope: 'all' }, true)
    expect(primaryAdmissionRateSeries([china, overall])).toBe(overall)
  })
})
