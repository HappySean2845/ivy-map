// 官方录取率趋势。
//
// **本来计划用 ECharts，改成了手写 SVG。** 原因是数据的真实形状：
// 一所大学最多也就 5–6 个学年的 CDS 记录，而 ECharts 的 LineChart 目前
// 还没被 components/map/echarts.ts 注册（那里只引了 scatter + geo）——
// 为一条六个点的折线往 bundle 里加一个图表类型，不划算。
//
// 更要紧的是**当前每所大学只有一个学年的快照**。所以这个组件的主要工作
// 不是画线，而是**在只有一个点时不要假装有趋势**：显示那个数字，并说清
// 为什么没有线。补齐多年数据之后，同一个组件自动开始画线。

import SourcePopover from '@/components/trust/SourcePopover'
import { brandOf } from '@/lib/v2/brand'
import { schoolYearLabel } from '@/lib/v2/profile'
import type { AdmitRatePoint } from '@/types/profile'

const W = 560
const H = 168
const PAD = { top: 22, right: 20, bottom: 26, left: 20 }

export function AdmitRateTrend({
  points,
  brandColor,
  universityNameCn,
}: {
  points: AdmitRatePoint[]
  brandColor: string | null
  universityNameCn: string
}) {
  const brand = brandOf(brandColor)

  if (points.length === 0) {
    return (
      <div className="border-y border-ink/15 py-4">
        <p className="label text-ink/40">录取率趋势</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">
          尚未收录{universityNameCn}经复核的官方申请与录取人数。
          <strong className="font-medium">这里不使用估算值补空</strong> ——
          没有分子分母就没有录取率，写一个近似值只会让人以为它是真的。
        </p>
      </div>
    )
  }

  if (points.length === 1) {
    const only = points[0]
    return (
      <div className="border-y border-ink/15 py-4">
        <p className="label text-ink/40">录取率趋势</p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <SourcePopover sourceIds={[only.sourceId]}>
            <span className="text-3xl tracking-tight tnum">{(only.rate * 100).toFixed(1)}%</span>
          </SourcePopover>
          <span className="text-sm text-ink/60 tnum">
            {schoolYearLabel(only.academicYearStart)} 学年 · {only.applied.toLocaleString('en-US')}{' '}
            人申请 / {only.admitted.toLocaleString('en-US')} 人录取
          </span>
        </div>
        <p className="mt-2.5 max-w-2xl text-xs leading-relaxed text-ink/50">
          目前只收录到一个学年，<strong className="font-medium">画不出趋势</strong> ——
          一个点连不成线。多年份的 Common Data Set 还在补，补齐后这里会自动变成折线。
        </p>
      </div>
    )
  }

  const rates = points.map((p) => p.rate)
  const lo = Math.min(...rates)
  const hi = Math.max(...rates)
  // 上下各留一点空间，否则最高最低点会贴在边框上
  const span = Math.max(hi - lo, 0.005)
  const yMin = Math.max(0, lo - span * 0.35)
  const yMax = hi + span * 0.35

  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const xOf = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1))
  const yOf = (rate: number) => PAD.top + innerH * (1 - (rate - yMin) / (yMax - yMin))

  const line = points.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.rate).toFixed(1)}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]
  const delta = (last.rate - first.rate) * 100

  return (
    <div className="border-y border-ink/15 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label text-ink/40">录取率趋势</p>
        <p className="text-xs text-ink/60 tnum">
          {schoolYearLabel(first.academicYearStart)} → {schoolYearLabel(last.academicYearStart)} ·{' '}
          {delta > 0 ? '+' : ''}
          {delta.toFixed(1)} 个百分点
        </p>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full text-ink"
        role="img"
        aria-label={points
          .map((p) => `${schoolYearLabel(p.academicYearStart)} 学年 ${(p.rate * 100).toFixed(1)}%`)
          .join('，')}
      >
        {/* 基线，不画完整网格 —— 六个点的图加网格只是噪声 */}
        <line
          x1={PAD.left}
          y1={PAD.top + innerH}
          x2={W - PAD.right}
          y2={PAD.top + innerH}
          stroke="currentColor"
          strokeOpacity={0.15}
        />
        <polyline points={line} fill="none" stroke={brand} strokeWidth={1.5} />
        {points.map((p, i) => (
          <g key={p.academicYearStart}>
            <circle cx={xOf(i)} cy={yOf(p.rate)} r={3.5} fill={brand} />
            <text
              x={xOf(i)}
              y={yOf(p.rate) - 9}
              textAnchor="middle"
              fontSize={11}
              fill="currentColor"
              className="tnum"
            >
              {(p.rate * 100).toFixed(1)}%
            </text>
            <text
              x={xOf(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.5}
              className="tnum"
            >
              {p.academicYearStart}
            </text>
          </g>
        ))}
      </svg>

      <SourcePopover sourceIds={points.map((p) => p.sourceId)}>
        <span className="text-xs text-ink/60">查看各年官方来源 →</span>
      </SourcePopover>
    </div>
  )
}

export default AdmitRateTrend
