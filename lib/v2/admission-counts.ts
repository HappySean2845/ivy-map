import type { AdmissionCountPoint, AdmissionCountSeries } from '@/types'

export function admissionCountSeriesLabel(): string {
  return '内地本科录取人数'
}

export function admissionCountScopeNote(series: AdmissionCountSeries): string {
  return series.scope.admissionsSystem === 'gaokao_early_batch'
    ? '内地本科生 · 全国统招提前批'
    : '中国大陆本科生 · 内地本科生入学计划'
}

export function admissionCountRateNote(series: AdmissionCountSeries): string {
  void series
  return '因港校同时招收内地高考生，与国际课程生缺乏同口径分母，录取率目前无法估算。'
}

export function admissionCountKindLabel(point: AdmissionCountPoint): string {
  if (point.kind === 'planned') return '计划名额'
  if (point.kind === 'estimated') return '估算/边界'
  return '实际录取'
}

function formatTextValue(valueText: string): string {
  const translated = valueText.replace(' (Gaokao applicants)', '（高考生）')
  const match = translated.match(/^([<>]=?\d+)(.*)$/)
  return match ? `${match[1]} 人${match[2]}` : translated
}

export function formatAdmissionCount(point: AdmissionCountPoint): string {
  if (point.valueText) return formatTextValue(point.valueText)
  if (point.valueMin != null && point.valueMax != null) {
    const range = `${point.valueMin.toLocaleString('en-US')}–${point.valueMax.toLocaleString('en-US')} 人`
    return point.kind === 'planned' ? `计划 ${range}` : range
  }
  if (point.value != null) {
    const value = `${point.value.toLocaleString('en-US')} 人`
    if (point.kind === 'planned') return `计划 ${value}`
    if (point.kind === 'estimated') return `约 ${value}`
    return value
  }
  return '—'
}

export function admissionCountPointValue(point: AdmissionCountPoint): number | null {
  if (point.value != null) return point.value
  if (point.valueMin != null && point.valueMax != null) {
    return (point.valueMin + point.valueMax) / 2
  }
  const bound = point.valueText?.match(/[\d,]+/)?.[0]
  return bound ? Number(bound.replaceAll(',', '')) : null
}

export function latestReviewedAdmissionCountPoint(
  series: AdmissionCountSeries | null | undefined,
): AdmissionCountPoint | null {
  if (!series) return null
  return (
    series.points.findLast(
      (point) =>
        point.kind === 'actual' &&
        (point.reviewStatus === 'reviewed' || point.reviewStatus === 'published'),
    ) ?? null
  )
}

export function primaryAdmissionCountSeries(
  series: AdmissionCountSeries[],
): AdmissionCountSeries | null {
  return series[0] ?? null
}
