import SourcePopover from '@/components/trust/SourcePopover'
import {
  admissionCountKindLabel,
  admissionCountPointValue,
  admissionCountRateNote,
  admissionCountScopeNote,
  admissionCountSeriesLabel,
  formatAdmissionCount,
  latestReviewedAdmissionCountPoint,
  primaryAdmissionCountSeries,
} from '@/lib/v2/admission-counts'
import { brandOf } from '@/lib/v2/brand'
import type { AdmissionCountPoint, AdmissionCountSeries } from '@/types'

const W = 560
const H = 196
const PAD = { top: 34, right: 22, bottom: 32, left: 22 }

export function AdmissionCountTrend({
  series,
  brandColor,
}: {
  series: AdmissionCountSeries[]
  brandColor: string | null
}) {
  const active = primaryAdmissionCountSeries(series)
  if (!active) return null

  const latestReviewed = latestReviewedAdmissionCountPoint(active)
  const qualified = active.points.filter((point) => point.kind !== 'actual')

  return (
    <div className="rounded-[24px] border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="label text-leaf">内地招生记录</p>
          <h3 className="mt-1 text-lg text-forest-deep">{admissionCountSeriesLabel()}</h3>
        </div>
        <p className="text-xs text-ink/50 tnum">{active.points.length} 条年度记录</p>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink/55">
        {admissionCountScopeNote(active)}。{admissionCountRateNote(active)}
      </p>

      {latestReviewed && (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <SourcePopover sourceIds={[latestReviewed.sourceId]}>
            <span className="text-3xl tracking-tight tnum">
              {formatAdmissionCount(latestReviewed)}
            </span>
          </SourcePopover>
          <span className="text-sm text-ink/60 tnum">
            最新经复核 · {latestReviewed.academicYearStart} 年
          </span>
        </div>
      )}

      <CountChart points={active.points} brandColor={brandColor} />

      {qualified.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="label text-leaf">估算与计划单独列示</p>
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-xs text-ink/60 sm:grid-cols-2">
            {qualified.map((point) => (
              <li
                key={`${point.academicYearStart}-${point.kind}`}
                className="flex items-baseline justify-between gap-3"
              >
                <span>
                  {point.academicYearStart} · {admissionCountKindLabel(point)}
                </span>
                <span className="shrink-0 tnum">{formatAdmissionCount(point)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-line pt-3">
        <p className="max-w-2xl text-xs leading-relaxed text-ink/50">
          实心点是经复核的实际录取人数；空心点是估算或下限；虚线方块是计划名额。
          这些人数不能用于四维图的“录取难度”评分。
        </p>
        <SourcePopover sourceIds={active.points.map((point) => point.sourceId)}>
          <span className="text-xs text-ink/60">查看各期来源 →</span>
        </SourcePopover>
      </div>
    </div>
  )
}

function CountChart({
  points,
  brandColor,
}: {
  points: AdmissionCountPoint[]
  brandColor: string | null
}) {
  const plotted = points.flatMap((point) => {
    const value = admissionCountPointValue(point)
    return value == null ? [] : [{ point, value }]
  })
  if (plotted.length < 2) return null

  const brand = brandOf(brandColor)
  const years = [...new Set(plotted.map(({ point }) => point.academicYearStart))]
  const maxValue = Math.max(...plotted.map(({ value }) => value))
  const yMax = Math.max(maxValue * 1.15, 1)
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const xOf = (year: number) =>
    years.length === 1
      ? PAD.left + innerW / 2
      : PAD.left + (innerW * years.indexOf(year)) / (years.length - 1)
  const yOf = (value: number) => PAD.top + innerH * (1 - value / yMax)
  const outcomes = plotted.filter(({ point }) => point.kind !== 'planned')
  const line = outcomes
    .map(({ point, value }) => `${xOf(point.academicYearStart)},${yOf(value)}`)
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-3 w-full text-ink"
      role="img"
      aria-label={points
        .map(
          (point) =>
            `${point.academicYearStart} 年${admissionCountKindLabel(point)} ${formatAdmissionCount(point)}`,
        )
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
      {outcomes.length > 1 && (
        <polyline points={line} fill="none" stroke={brand} strokeWidth={1.6} />
      )}

      {plotted.map(({ point, value }) => {
        const x = xOf(point.academicYearStart)
        const y = yOf(value)
        const actual = point.kind === 'actual'
        const planned = point.kind === 'planned'
        return (
          <g key={`${point.academicYearStart}-${point.kind}`}>
            {planned ? (
              <rect
                x={x - 4}
                y={y - 4}
                width={8}
                height={8}
                fill="var(--paper)"
                stroke={brand}
                strokeWidth={1.5}
                strokeDasharray="2 1"
              />
            ) : (
              <circle
                cx={x}
                cy={y}
                r={3.8}
                fill={actual ? brand : 'var(--paper)'}
                stroke={brand}
                strokeWidth={1.5}
              />
            )}
            <text
              x={x}
              y={planned ? y + 18 : y - 10}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              className="tnum"
            >
              {formatAdmissionCount(point).replace(' 人', '')}
            </text>
          </g>
        )
      })}

      {years.map((year) => (
        <text
          key={year}
          x={xOf(year)}
          y={H - 8}
          textAnchor="middle"
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.5}
          className="tnum"
        >
          {year}
        </text>
      ))}
    </svg>
  )
}

export default AdmissionCountTrend
