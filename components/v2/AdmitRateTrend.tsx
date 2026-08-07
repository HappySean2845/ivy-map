'use client'

import { useState } from 'react'

import SourcePopover from '@/components/trust/SourcePopover'
import {
  admissionRateOutcomeLabel,
  admissionRatePeriodLabel,
  admissionRatePointValue,
  admissionRateScopeNote,
  admissionRateSeriesLabel,
  formatAdmissionRate,
  primaryAdmissionRateSeries,
} from '@/lib/v2/admission-rates'
import { brandOf } from '@/lib/v2/brand'
import type { AdmissionRatePoint, AdmissionRateSeries } from '@/types'

const W = 560
const H = 188
const PAD = { top: 28, right: 20, bottom: 30, left: 20 }

export function AdmitRateTrend({
  series,
  brandColor,
  universityNameCn,
}: {
  series: AdmissionRateSeries[]
  brandColor: string | null
  universityNameCn: string
}) {
  const initial = primaryAdmissionRateSeries(series)
  const [selectedId, setSelectedId] = useState(initial?.id ?? '')
  const active = series.find((item) => item.id === selectedId) ?? initial

  if (!active) {
    return (
      <div className="rounded-[24px] border border-line bg-surface p-5 sm:p-6">
        <p className="label text-leaf">录取率趋势</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">
          尚未收录{universityNameCn}经复核的官方申请与录取人数。
          <strong className="font-medium">这里不使用估算值补空</strong> ——
          没有分子分母就没有录取率。
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[24px] border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="label text-leaf">录取率趋势</p>
          <h3 className="mt-1 text-lg text-forest-deep">{admissionRateSeriesLabel(active)}</h3>
        </div>
        <p className="text-xs text-ink/50 tnum">
          {active.points.length} 个时期 · {active.scope.admissionsSystem ?? '院校官方口径'}
        </p>
      </div>

      {series.length > 1 && (
        <div
          role="group"
          aria-label={`${universityNameCn}录取率口径`}
          className="mt-4 flex flex-wrap gap-2"
        >
          {series.map((item) => {
            const selected = item.id === active.id
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedId(item.id)}
                className={`min-h-11 rounded-full border px-3 py-2 text-left text-xs transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf ${
                  selected
                    ? 'border-forest bg-forest text-paper'
                    : 'border-line bg-paper text-ink hover:border-leaf hover:bg-mint'
                }`}
              >
                {admissionRateSeriesLabel(item)}
              </button>
            )
          })}
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-ink/55">
        {admissionRateScopeNote(active)}。不同人群、不同分母各画一条线，不混算。
      </p>

      <TrendBody series={active} brandColor={brandColor} />
    </div>
  )
}

function TrendBody({
  series,
  brandColor,
}: {
  series: AdmissionRateSeries
  brandColor: string | null
}) {
  const { points } = series
  const brand = brandOf(brandColor)
  const latest = points.at(-1)

  if (!latest) return null

  if (points.length === 1) {
    return (
      <div className="mt-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <SourcePopover sourceIds={[latest.sourceId]}>
            <span className="text-3xl tracking-tight tnum">{formatAdmissionRate(latest)}</span>
          </SourcePopover>
          <span className="text-sm text-ink/60 tnum">{admissionRatePeriodLabel(latest)}</span>
        </div>
        <PointDetail point={latest} series={series} />
        <p className="mt-2.5 max-w-2xl text-xs leading-relaxed text-ink/50">
          目前这个口径只收录到一个时期，所以只显示数值，不画一条没有斜率的线。
        </p>
      </div>
    )
  }

  const allRates = points.flatMap((point) => {
    if (point.rate != null) return [point.rate]
    return [point.rateMin, point.rateMax].filter((value): value is number => value != null)
  })
  const lo = Math.min(...allRates)
  const hi = Math.max(...allRates)
  const span = Math.max(hi - lo, 0.005)
  const yMin = Math.max(0, lo - span * 0.25)
  const yMax = hi + span * 0.25
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const xOf = (index: number) => PAD.left + (innerW * index) / (points.length - 1)
  const yOf = (rate: number) => PAD.top + innerH * (1 - (rate - yMin) / (yMax - yMin))
  const line = points
    .map(
      (point, index) =>
        `${xOf(index).toFixed(1)},${yOf(admissionRatePointValue(point)).toFixed(1)}`,
    )
    .join(' ')
  const first = points[0]
  const delta = (admissionRatePointValue(latest) - admissionRatePointValue(first)) * 100
  const labelEvery = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-ink/60 tnum">
          {admissionRatePeriodLabel(first)} → {admissionRatePeriodLabel(latest)}
        </p>
        <p className="text-xs text-ink/60 tnum">
          {delta > 0 ? '+' : ''}
          {delta.toFixed(1)} 个百分点
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full text-ink"
        role="img"
        aria-label={points
          .map((point) => `${admissionRatePeriodLabel(point)} ${formatAdmissionRate(point)}`)
          .join('，')}
      >
        <line
          x1={PAD.left}
          y1={PAD.top + innerH}
          x2={W - PAD.right}
          y2={PAD.top + innerH}
          stroke="currentColor"
          strokeOpacity={0.15}
        />
        <polyline points={line} fill="none" stroke={brand} strokeWidth={1.6} />
        {points.map((point, index) => {
          const x = xOf(index)
          const y = yOf(admissionRatePointValue(point))
          const showLabel =
            index === 0 || index === points.length - 1 || index % labelEvery === 0
          return (
            <g key={`${point.academicYearStart ?? point.periodStart}-${index}`}>
              {point.rateMin != null && point.rateMax != null && (
                <line
                  x1={x}
                  x2={x}
                  y1={yOf(point.rateMax)}
                  y2={yOf(point.rateMin)}
                  stroke={brand}
                  strokeWidth={3}
                  strokeLinecap="square"
                />
              )}
              <circle cx={x} cy={y} r={3.4} fill={brand}>
                <title>{`${admissionRatePeriodLabel(point)} ${formatAdmissionRate(point)}`}</title>
              </circle>
              {showLabel && (
                <>
                  <text
                    x={x}
                    y={y - 9}
                    textAnchor="middle"
                    fontSize={10}
                    fill="currentColor"
                    className="tnum"
                  >
                    {formatAdmissionRate(point)}
                  </text>
                  <text
                    x={x}
                    y={H - 8}
                    textAnchor="middle"
                    fontSize={10}
                    fill="currentColor"
                    fillOpacity={0.5}
                    className="tnum"
                  >
                    {point.academicYearStart ?? point.periodEnd?.slice(0, 4)}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PointDetail point={latest} series={series} />
        <SourcePopover sourceIds={points.map((point) => point.sourceId)}>
          <span className="text-xs text-ink/60">查看各期来源 →</span>
        </SourcePopover>
      </div>
    </div>
  )
}

function PointDetail({
  point,
  series,
}: {
  point: AdmissionRatePoint
  series: AdmissionRateSeries
}) {
  return (
    <div className="mt-2 max-w-2xl text-xs leading-relaxed text-ink/55">
      {point.applied != null && point.outcome != null && (
        <p className="tnum">
          最新一期：{point.applied.toLocaleString('en-US')} 人申请 /{' '}
          {point.outcome.toLocaleString('en-US')} 人{admissionRateOutcomeLabel(series)}
        </p>
      )}
      {point.rate == null && point.rateMin != null && point.rateMax != null && (
        <p>区间来自官方隐私抑制规则；图上用区间中点定位，但数值始终显示上下限。</p>
      )}
      {point.citation && <p>引用口径：{point.citation}</p>}
    </div>
  )
}

export default AdmitRateTrend
