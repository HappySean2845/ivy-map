// 四维评分雷达图。
//
// **为什么手写 SVG 而不用已经在依赖里的 ECharts：**
//
// 1. 刷卡时每张卡都有一张图，ECharts 每个实例要一个 canvas 加一个 ResizeObserver，
//    反复创建销毁的开销全花在一个静态四边形上。
// 2. ECharts 的 radar 画不出这里最要紧的两件事 —— **顶点分实心空心**、
//    **某根轴没数据时多边形在那里断开**。而这两件事恰恰是这张图能不能上线的前提：
//    打分天生主观，不把「官方算出来的」和「编辑判断的」在形状上分开，
//    这张图就是在拿观点冒充数据。
//
// ECharts 留给录取率趋势折线（详情页，单实例）。
//
// 这个组件是纯展示，不带 'use client' —— 服务端直出，卡片不必等 JS。

import {
  PROFILE_DIMS,
  PROFILE_DIM_DIRECTION,
  PROFILE_DIM_LABEL,
  type ProfileDim,
  type ProfileScore,
} from '@/types/profile'
import { brandOf, withAlpha } from '@/lib/v2/brand'

/** 轴的方位角，顺序对齐 PROFILE_DIMS：录取难度在上，顺时针排下去。 */
const AXIS_DEG: Record<ProfileDim, number> = {
  selectivity: -90,
  affinity: 0,
  safety: 90,
  facilities: 180,
}

/** 网格圈，同时也是刻度 */
const RINGS = [0.25, 0.5, 0.75, 1]

function polar(deg: number, r: number, cx: number, cy: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export function ScoreRadar({
  scores,
  brandColor,
  size = 168,
  showLabels = true,
  className = '',
}: {
  scores: Record<ProfileDim, ProfileScore>
  brandColor: string | null
  size?: number
  /** 卡片上空间紧时可以关掉标签，靠外面的文字列表说明 */
  showLabels?: boolean
  className?: string
}) {
  const brand = brandOf(brandColor)
  // 标签要占地方，所以画布比多边形大一圈
  const pad = showLabels ? size * 0.17 : size * 0.04
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - pad

  const dims = PROFILE_DIMS
  const withValue = dims.filter((d) => scores[d].value != null)

  // 多边形只连有值的顶点。缺数据的轴就是缺口 —— 不用 0 填，那会画成「这项得 0 分」
  const path = withValue
    .map((d) => {
      const value = scores[d].value as number
      const p = polar(AXIS_DEG[d], (r * value) / 100, cx, cy)
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`
    })
    .join(' ')

  const summary = dims
    .map((d) => {
      const s = scores[d]
      const kind = s.kind === 'measured' ? '官方数据' : '编辑评估'
      return s.value == null
        ? `${PROFILE_DIM_LABEL[d]}：暂无数据`
        : `${PROFILE_DIM_LABEL[d]} ${s.value} 分（${PROFILE_DIM_DIRECTION[d]}，${kind}）`
    })
    .join('；')

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={summary}
      className={className}
    >
      {/* 网格：hairline 黑，和全站分隔线同一套语言 */}
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          points={dims
            .map((d) => {
              const p = polar(AXIS_DEG[d], r * ring, cx, cy)
              return `${p.x.toFixed(2)},${p.y.toFixed(2)}`
            })
            .join(' ')}
          fill="none"
          stroke="currentColor"
          strokeOpacity={ring === 1 ? 0.28 : 0.1}
          strokeWidth={1}
        />
      ))}

      {/* 轴线。没数据的轴画虚线 —— 一眼看出那不是「得分低」，是「没查到」 */}
      {dims.map((d) => {
        const p = polar(AXIS_DEG[d], r, cx, cy)
        const missing = scores[d].value == null
        return (
          <line
            key={d}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="currentColor"
            strokeOpacity={missing ? 0.2 : 0.12}
            strokeDasharray={missing ? '2 3' : undefined}
            strokeWidth={1}
          />
        )
      })}

      {/* 数据形状。少于 3 个点连不成面，只画点 */}
      {withValue.length >= 3 && (
        <polygon points={path} fill={withAlpha(brand, 0.12)} stroke={brand} strokeWidth={1.5} />
      )}
      {withValue.length === 2 && (
        <polyline points={path} fill="none" stroke={brand} strokeWidth={1.5} />
      )}

      {/* 顶点：实心 = 官方数据可溯源，空心 = 编辑评估 */}
      {withValue.map((d) => {
        const value = scores[d].value as number
        const p = polar(AXIS_DEG[d], (r * value) / 100, cx, cy)
        const measured = scores[d].kind === 'measured'
        return (
          <circle
            key={d}
            cx={p.x}
            cy={p.y}
            r={measured ? 3.5 : 3}
            fill={measured ? brand : 'var(--paper)'}
            stroke={brand}
            strokeWidth={1.5}
          />
        )
      })}

      {showLabels &&
        dims.map((d) => {
          const p = polar(AXIS_DEG[d], r + pad * 0.62, cx, cy)
          const deg = AXIS_DEG[d]
          const anchor = deg === 0 ? 'end' : deg === 180 ? 'start' : 'middle'
          // 上下两个标签要手动压一下基线，否则会贴着网格
          const dy = deg === -90 ? -1 : deg === 90 ? 9 : 3.5
          return (
            <text
              key={d}
              x={p.x}
              y={p.y + dy}
              textAnchor={anchor}
              fontSize={size < 190 ? 9.5 : 11}
              fill="currentColor"
              fillOpacity={scores[d].value == null ? 0.35 : 0.6}
            >
              {PROFILE_DIM_LABEL[d]}
            </text>
          )
        })}
    </svg>
  )
}

export default ScoreRadar
