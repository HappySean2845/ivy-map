import type { AdmissionRateBasis, AdmissionRatePoint, AdmissionRateSeries } from '@/types'

const BASIS_LABEL: Record<AdmissionRateBasis, string> = {
  admitted_over_applications: '录取率',
  confirmed_places_over_applications: '成功率',
  offers_over_applications: 'Offer 率',
  admitted_over_exam_candidates: '合格率',
}

const OUTCOME_LABEL: Record<AdmissionRateBasis, string> = {
  admitted_over_applications: '录取',
  confirmed_places_over_applications: '确认入读',
  offers_over_applications: '获得 Offer',
  admitted_over_exam_candidates: '合格',
}

export function admissionRateSeriesLabel(series: AdmissionRateSeries): string {
  const { applicantScope, pathway, sourceMetric, rateBasis } = series.scope
  if (pathway === 'PEAK') return 'PEAK 项目录取率'
  if (pathway === 'ippan_senbatsu') return '一般选拔合格率'
  if (applicantScope === 'international') return '国际生录取率'
  if (applicantScope === 'international_program') {
    return pathway
      ? `${pathway} 项目${BASIS_LABEL[rateBasis]}`
      : `国际项目${BASIS_LABEL[rateBasis]}`
  }
  if (applicantScope === 'china_domicile') {
    return sourceMetric?.endsWith('_3yr') ? '中国大陆成功率（3 年滚动）' : '中国大陆成功率'
  }
  if (applicantScope === 'china_nationality') return '中国籍 Offer 率'
  if (rateBasis === 'confirmed_places_over_applications') return '本科成功率'
  if (rateBasis === 'admitted_over_exam_candidates') return '本科合格率'
  return `本科${BASIS_LABEL[rateBasis]}`
}

export function admissionRateScopeNote(series: AdmissionRateSeries): string {
  const { applicantScope, admissionsSystem, pathway, geographyDefinition } = series.scope
  const audience =
    applicantScope == null || applicantScope === 'all'
      ? '全体本科申请者'
      : applicantScope === 'international'
        ? '国际本科申请者'
        : applicantScope === 'international_program'
          ? `${pathway ?? '国际项目'}申请者`
          : applicantScope === 'china_domicile'
            ? geographyDefinition === 'domicile_excludes_hong_kong'
              ? '中国大陆居住地申请者（不含香港）'
              : '中国居住地申请者'
            : applicantScope === 'china_nationality'
              ? '中国国籍申请者'
              : applicantScope === 'exam_candidates'
                ? `${pathway === 'ippan_senbatsu' ? '一般选拔' : '入学考试'}考生`
                : applicantScope
  return admissionsSystem ? `${audience} · ${admissionsSystem}` : audience
}

export function admissionRateOutcomeLabel(series: AdmissionRateSeries): string {
  return OUTCOME_LABEL[series.scope.rateBasis]
}

export function admissionRatePointValue(point: AdmissionRatePoint): number {
  if (point.rate != null) return point.rate
  if (point.rateMin != null && point.rateMax != null) return (point.rateMin + point.rateMax) / 2
  return 0
}

export function formatAdmissionRate(point: AdmissionRatePoint): string {
  if (point.rate != null) return `${(point.rate * 100).toFixed(1)}%`
  if (point.rateMin != null && point.rateMax != null) {
    return `${(point.rateMin * 100).toFixed(1)}–${(point.rateMax * 100).toFixed(1)}%`
  }
  return '—'
}

export function admissionRatePeriodLabel(point: AdmissionRatePoint): string {
  if (point.periodStart && point.periodEnd) {
    return `${point.periodStart.slice(0, 4)}–${point.periodEnd.slice(0, 4)} 滚动窗口`
  }
  if (point.academicYearStart != null) {
    return `${point.academicYearStart}–${String(point.academicYearStart + 1).slice(-2)}`
  }
  return '时期未标注'
}

export function primaryAdmissionRateSeries(
  series: AdmissionRateSeries[],
): AdmissionRateSeries | null {
  return series.find((item) => item.primary) ?? series[0] ?? null
}
